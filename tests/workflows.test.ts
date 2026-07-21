import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  approveIngestionProposal,
  normalizeWorkflowState,
  rejectIngestionProposal,
  runIngestionWorkflow
} from '../src/main/workflows'
import type { IngestionProposal } from '../src/shared/types'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

async function fixture(): Promise<{ root: string; source: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'knot-workflow-unit-'))
  roots.push(root)
  const source = path.join(root, 'source.txt')
  await writeFile(source, '# Customer signal\n\nThree operators requested export controls.\n', 'utf8')
  return { root, source }
}

describe('ingestion workflows', () => {
  it('extracts without writing, then publishes atomically only after approval', async () => {
    const { root, source } = await fixture()
    let state = await runIngestionWorkflow(normalizeWorkflowState(), { workflowId: 'clean-import', paths: [source] }, [source], async () => '')
    expect(state.proposals).toHaveLength(1)
    expect(state.proposals[0]).toMatchObject({ title: 'Customer signal', status: 'pending', source: 'workflow' })
    expect(await readdir(root)).toEqual(['source.txt'])
    state = await approveIngestionProposal(root, state, state.proposals[0].id)
    expect(state.proposals[0].status).toBe('approved')
    const output = await readFile(path.join(root, 'inbox', 'customer-signal.md'), 'utf8')
    expect(output).toContain('type: Reference')
    expect(output).toContain('Three operators requested export controls.')
  })

  it('falls back deterministically when AI enrichment fails and preserves the review gate', async () => {
    const { source } = await fixture()
    const state = await runIngestionWorkflow(normalizeWorkflowState(), { workflowId: 'ai-curated-import', paths: [source] }, [source], async () => { throw new Error('offline') })
    expect(state.proposals[0].warning).toContain('deterministic proposal')
    expect(state.proposals[0].warning).toContain('offline')
    expect(state.proposals[0].status).toBe('pending')
  })

  it('does not overwrite an existing imported concept and records explicit rejection', async () => {
    const { root, source } = await fixture()
    let state = await runIngestionWorkflow(normalizeWorkflowState(), { workflowId: 'clean-import', paths: [source] }, [source], async () => '')
    state = await approveIngestionProposal(root, state, state.proposals[0].id)
    state = await runIngestionWorkflow(state, { workflowId: 'clean-import', paths: [source] }, [source], async () => '')
    const second = state.proposals.find((proposal) => proposal.status === 'pending')!
    state = await approveIngestionProposal(root, state, second.id)
    expect(await readFile(path.join(root, 'inbox', 'customer-signal-2.md'), 'utf8')).toContain('Customer signal')
    const third: IngestionProposal = { ...second, id: crypto.randomUUID(), status: 'pending', reviewedAt: undefined }
    state.proposals.unshift(third)
    state = rejectIngestionProposal(state, third.id)
    expect(state.proposals.find((proposal) => proposal.id === third.id)?.status).toBe('rejected')
  })

  it('blocks a stale MCP replacement instead of overwriting newer local knowledge', async () => {
    const { root } = await fixture()
    await writeFile(path.join(root, 'decision.md'), 'current owner revision', 'utf8')
    const proposal: IngestionProposal = {
      id: crypto.randomUUID(), runId: 'local-mcp', source: 'local-mcp', sourceName: 'agent', filename: 'decision.md',
      title: 'Decision', type: 'Decision', description: 'Agent proposal', tags: ['mcp-proposal'], body: '# Decision\n\nStale replacement.',
      targetDocumentId: 'decision', baseRevision: '0000000000000000', status: 'pending', createdAt: new Date().toISOString()
    }
    const state = normalizeWorkflowState({ proposals: [proposal] })
    await expect(approveIngestionProposal(root, state, proposal.id)).rejects.toThrow('target changed')
    expect(await readFile(path.join(root, 'decision.md'), 'utf8')).toBe('current owner revision')
  })
})
