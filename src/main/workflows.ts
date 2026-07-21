import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { serializeConcept } from './okf'
import type {
  IngestionProposal,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunInput,
  WorkflowWorkspaceState
} from '../shared/types'

const MAX_SOURCE_BYTES = 25 * 1024 * 1024
const MAX_EXTRACTED_CHARS = 2_000_000
const acceptedExtensions = ['.md', '.txt', '.html', '.htm', '.json', '.csv', '.docx', '.pdf']

export const BUILT_IN_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'clean-import',
    name: 'Clean source intake',
    description: 'Extract and normalize supported files, then hold every concept for human review.',
    mode: 'deterministic',
    acceptedExtensions,
    steps: ['extract', 'normalize', 'review', 'publish'],
    builtIn: true
  },
  {
    id: 'ai-curated-import',
    name: 'AI-curated knowledge',
    description: 'Use your signed-in Codex subscription to propose clearer metadata and structure before review.',
    mode: 'ai-assisted',
    acceptedExtensions,
    steps: ['extract', 'normalize', 'ai-enrich', 'review', 'publish'],
    builtIn: true
  }
]

export function normalizeWorkflowState(value?: Partial<WorkflowWorkspaceState>): WorkflowWorkspaceState {
  const custom = (value?.definitions ?? []).filter((definition) => !definition.builtIn)
  return {
    definitions: [...BUILT_IN_WORKFLOWS, ...custom],
    runs: value?.runs ?? [],
    proposals: value?.proposals ?? []
  }
}

function titleFromFilename(filename: string): string {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'imported-knowledge'
}

function cleanText(value: string): string {
  return value
    .split(String.fromCharCode(0)).join('')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS)
}

async function extractSource(sourcePath: string): Promise<string> {
  const metadata = await stat(sourcePath)
  if (!metadata.isFile()) throw new Error(`${path.basename(sourcePath)} is not a file.`)
  if (metadata.size > MAX_SOURCE_BYTES) throw new Error(`${path.basename(sourcePath)} exceeds the 25 MB import limit.`)
  const extension = path.extname(sourcePath).toLowerCase()
  if (!acceptedExtensions.includes(extension)) throw new Error(`${extension || 'This file type'} is not supported.`)

  if (extension === '.docx') {
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.extractRawText({ path: sourcePath })
    return cleanText(result.value)
  }
  if (extension === '.pdf') {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(await readFile(sourcePath))
    return cleanText(result.text)
  }

  const raw = await readFile(sourcePath, 'utf8')
  if (extension === '.html' || extension === '.htm') {
    const { convert: htmlToText } = await import('html-to-text')
    return cleanText(htmlToText(raw, { wordwrap: false, selectors: [{ selector: 'img', format: 'skip' }] }))
  }
  if (extension === '.json') {
    const parsed = JSON.parse(raw) as unknown
    return cleanText(`\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``)
  }
  return cleanText(raw.replace(/^---\n[\s\S]*?\n---\n?/, ''))
}

const aiProposalSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.string().min(1).max(120),
  description: z.string().max(500),
  tags: z.array(z.string().min(1).max(60)).max(20),
  body: z.string().min(1).max(MAX_EXTRACTED_CHARS)
})

function parseAiProposal(output: string): z.infer<typeof aiProposalSchema> {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1)
  return aiProposalSchema.parse(JSON.parse(candidate))
}

export async function runIngestionWorkflow(
  previous: WorkflowWorkspaceState,
  input: WorkflowRunInput,
  sourcePaths: string[],
  aiEnrich: (sourceName: string, extracted: string) => Promise<string>
): Promise<WorkflowWorkspaceState> {
  const state = normalizeWorkflowState(previous)
  const workflow = state.definitions.find((item) => item.id === input.workflowId)
  if (!workflow) throw new Error('The selected workflow no longer exists.')
  if (!sourcePaths.length) return state
  if (sourcePaths.length > 20) throw new Error('Import up to 20 files in one workflow run.')

  const runId = crypto.randomUUID()
  const run: WorkflowRun = {
    id: runId,
    workflowId: workflow.id,
    sourceNames: sourcePaths.map((sourcePath) => path.basename(sourcePath)),
    status: 'extracting',
    proposalIds: [] as string[],
    startedAt: new Date().toISOString()
  }
  state.runs.unshift(run)

  try {
    for (const sourcePath of sourcePaths) {
      const sourceName = path.basename(sourcePath)
      const extracted = await extractSource(sourcePath)
      if (!extracted) throw new Error(`${sourceName} did not contain extractable text.`)
      const fallbackTitle = extracted.match(/^#\s+(.+)$/m)?.[1]?.trim().slice(0, 200) || titleFromFilename(sourceName)
      let proposal: IngestionProposal = {
        id: crypto.randomUUID(),
        runId,
        source: 'workflow',
        sourceName,
        filename: `${slug(fallbackTitle)}.md`,
        title: fallbackTitle,
        type: 'Reference',
        description: extracted.replace(/[#*`_[\]()>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240),
        tags: ['imported'],
        body: extracted.startsWith('# ') ? extracted : `# ${fallbackTitle}\n\n${extracted}`,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
      if (workflow.mode === 'ai-assisted') {
        try {
          const enriched = parseAiProposal(await aiEnrich(sourceName, extracted.slice(0, 60_000)))
          proposal = { ...proposal, ...enriched, filename: `${slug(enriched.title)}.md` }
        } catch (error) {
          proposal.warning = `AI enrichment was unavailable; the deterministic proposal is ready. ${error instanceof Error ? error.message : ''}`.trim()
        }
      }
      state.proposals.unshift(proposal)
      run.proposalIds.push(proposal.id)
    }
    run.status = 'awaiting-review'
    run.completedAt = new Date().toISOString()
  } catch (error) {
    run.status = 'failed'
    run.completedAt = new Date().toISOString()
    run.error = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    state.runs = state.runs.slice(0, 100)
    state.proposals = state.proposals.slice(0, 500)
  }
  return state
}

function insideWorkspace(root: string, relative: string): string {
  const normalized = relative.replaceAll('\\', '/').replace(/^\/+/, '')
  if (!normalized || normalized.split('/').includes('..')) throw new Error('The proposal target is outside this workspace.')
  const candidate = path.resolve(root, ...normalized.split('/'))
  const base = path.resolve(root)
  if (!candidate.startsWith(`${base}${path.sep}`)) throw new Error('The proposal target is outside this workspace.')
  return candidate
}

export async function approveIngestionProposal(
  root: string,
  previous: WorkflowWorkspaceState,
  proposalId: string
): Promise<WorkflowWorkspaceState> {
  const state = normalizeWorkflowState(previous)
  const proposal = state.proposals.find((item) => item.id === proposalId)
  if (!proposal || proposal.status !== 'pending') throw new Error('This proposal is no longer awaiting review.')

  let relative = proposal.targetDocumentId ? `${proposal.targetDocumentId}.md` : `inbox/${slug(proposal.filename.replace(/\.md$/i, ''))}.md`
  if (!proposal.targetDocumentId && existsSync(insideWorkspace(root, relative))) {
    const base = relative.replace(/\.md$/i, '')
    let suffix = 2
    while (suffix < 1_000 && existsSync(insideWorkspace(root, `${base}-${suffix}.md`))) suffix += 1
    relative = `${base}-${suffix}.md`
  }
  const target = insideWorkspace(root, relative)
  if (proposal.targetDocumentId && proposal.baseRevision) {
    const current = await readFile(target, 'utf8')
    const revision = createHash('sha256').update(current).digest('hex').slice(0, 16)
    if (revision !== proposal.baseRevision) throw new Error('The target changed after this proposal was created. Review a fresh proposal before applying it.')
  }
  const content = serializeConcept({
    type: proposal.type,
    title: proposal.title,
    description: proposal.description,
    tags: proposal.tags,
    timestamp: new Date().toISOString(),
    source: proposal.sourceName
  }, proposal.body)
  const temporary = `${target}.knot-tmp`
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(temporary, content.endsWith('\n') ? content : `${content}\n`, 'utf8')
  await rename(temporary, target)
  proposal.status = 'approved'
  proposal.reviewedAt = new Date().toISOString()
  const run = state.runs.find((item) => item.id === proposal.runId)
  if (run && run.proposalIds.every((id) => state.proposals.find((item) => item.id === id)?.status !== 'pending')) run.status = 'completed'
  return state
}

export function rejectIngestionProposal(previous: WorkflowWorkspaceState, proposalId: string): WorkflowWorkspaceState {
  const state = normalizeWorkflowState(previous)
  const proposal = state.proposals.find((item) => item.id === proposalId)
  if (!proposal || proposal.status !== 'pending') throw new Error('This proposal is no longer awaiting review.')
  proposal.status = 'rejected'
  proposal.reviewedAt = new Date().toISOString()
  const run = state.runs.find((item) => item.id === proposal.runId)
  if (run && run.proposalIds.every((id) => state.proposals.find((item) => item.id === id)?.status !== 'pending')) run.status = 'completed'
  return state
}
