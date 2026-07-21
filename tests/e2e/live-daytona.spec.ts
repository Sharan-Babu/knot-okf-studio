import { test, expect, getBundle } from './fixtures'

test.describe('live Daytona cloud lifecycle', () => {
  test.skip(process.env.KNOT_LIVE_DAYTONA !== '1', 'Set KNOT_LIVE_DAYTONA=1 with a temporary key to run the live cloud gate.')

  test('real product IPC provisions, serves, syncs, stops, restarts, and deletes its sandbox', async ({ knot }) => {
    const page = knot.window
    let dashboard: Awaited<ReturnType<typeof window.knot.cloud.getDashboard>> | undefined
    try {
      const bundle = await getBundle(page)
      const conceptIds = bundle.documents.filter((document: any) => document.kind === 'concept').map((document: any) => document.id)
      const selected = conceptIds.slice(0, 2)
      await page.evaluate(async (documentIds) => {
        for (const documentId of documentIds) await window.knot.sharing.savePolicy({ documentId, visibility: 'workspace', audienceIds: ['release-reviewer'], allowDownload: true, updateMode: 'review', updatedAt: new Date().toISOString() })
      }, conceptIds)
      dashboard = await page.evaluate((documentIds) => window.knot.cloud.publish({
        name: 'Knot live release probe', documentIds, visibility: 'workspace', audienceIds: ['release-reviewer'],
        includeDependencies: true, allowDownload: true, autoStopMinutes: 0
      }), selected)
      expect(dashboard.cloud.runtime, dashboard.cloud.lastError).toBe('online')
      expect(dashboard.cloud.sandboxId).toBeTruthy()
      expect(dashboard.cloud.autoStopMinutes).toBe(0)
      const share = dashboard.shares.find((item) => item.name === 'Knot live release probe')!
      const human = share.links.find((link) => link.kind === 'recipient')!
      const agent = share.links.find((link) => link.kind === 'mcp')!

      const health = await fetch(`${dashboard.cloud.endpoint}/health`, { headers: { 'X-Daytona-Skip-Preview-Warning': 'true' } })
      expect(health.status).toBe(200)
      expect((await health.json()).ok).toBe(true)
      const portal = await fetch(human.url, { headers: { 'X-Daytona-Skip-Preview-Warning': 'true' } })
      expect(portal.status).toBe(200)
      expect(await portal.text()).toContain('Knot live release probe')
      const deniedMcp = await fetch(agent.url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: '{}' })
      expect(deniedMcp.status).toBe(401)

      const rpc = async (id: number | undefined, method: string, params: Record<string, unknown> = {}): Promise<any> => {
        const response = await fetch(agent.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${agent.authorization}`,
            'X-Daytona-Skip-Preview-Warning': 'true'
          },
          body: JSON.stringify({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, params })
        })
        if (id === undefined) {
          expect([200, 202, 204], await response.clone().text()).toContain(response.status)
          return undefined
        }
        expect(response.status, await response.clone().text()).toBe(200)
        return response.json()
      }
      await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'knot-live-gate', version: '1.1.0' } })
      await rpc(undefined, 'notifications/initialized')
      const sharedConcept = await rpc(2, 'tools/call', { name: 'get_concept', arguments: { id: selected[0] } })
      const remoteRevision = sharedConcept.result.structuredContent.revision as string
      const beforeProposal = (await getBundle(page)).documents.find((document: any) => document.id === selected[0]).raw
      const proposed = await rpc(3, 'tools/call', {
        name: 'propose_update',
        arguments: {
          targetDocumentId: selected[0],
          title: 'Live cloud collaborator proposal',
          body: '# Reviewed cloud proposal\n\nThis must remain pending until the owner approves it.',
          reason: 'Validate Daytona-to-local review sync without an automatic write.',
          baseRevision: remoteRevision
        }
      })
      expect(proposed.result.structuredContent.status).toBe('awaiting-human-review')
      const proposalId = proposed.result.structuredContent.proposalId as string

      const sync = await page.evaluate(() => window.knot.cloud.sync())
      expect(sync.summary).toBe('Cloud and local revisions match.')
      expect(sync.importedProposals).toBe(1)
      const imported = (await page.evaluate(() => window.knot.workflows.getState())).proposals.find((proposal) => proposal.id === proposalId)
      expect(imported).toMatchObject({ source: 'cloud-mcp', status: 'pending', targetDocumentId: selected[0], baseRevision: remoteRevision })
      expect((await getBundle(page)).documents.find((document: any) => document.id === selected[0]).raw).toBe(beforeProposal)
      await page.evaluate((id) => window.knot.workflows.reject(id), proposalId)
      expect((await page.evaluate(() => window.knot.workflows.getState())).proposals.find((proposal) => proposal.id === proposalId)?.status).toBe('rejected')

      dashboard = await page.evaluate(() => window.knot.cloud.stop())
      expect(dashboard.cloud.runtime).toBe('stopped')
      dashboard = await page.evaluate(() => window.knot.cloud.start())
      expect(dashboard.cloud.runtime, dashboard.cloud.lastError).toBe('online')
    } finally {
      const current = await page.evaluate(() => window.knot.cloud.getDashboard()).catch(() => undefined)
      if (current?.cloud.sandboxId) {
        const cleaned = await page.evaluate(() => window.knot.cloud.disconnect())
        expect(cleaned.cloud.sandboxId).toBeUndefined()
        expect(cleaned.cloud.shares).toHaveLength(0)
      }
    }
  })
})
