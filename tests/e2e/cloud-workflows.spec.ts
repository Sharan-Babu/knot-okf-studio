import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { test, expect, getBundle } from './fixtures'

test.describe('cloud, MCP, and ingestion collaboration', () => {
  test('owner publishes a durable synced folder and a portable self-host deployment', async ({ knot }) => {
    const page = knot.window
    const initial = await getBundle(page)
    const concepts = initial.documents.filter((document: any) => document.kind === 'concept')
    await page.evaluate(async (documents) => {
      for (const document of documents) {
        await window.knot.sharing.savePolicy({ documentId: document.id, visibility: 'workspace', audienceIds: ['product'], allowDownload: true, updateMode: 'review', updatedAt: new Date().toISOString() })
      }
    }, concepts)
    await page.reload()
    await page.getByRole('button', { name: 'Cloud & MCP', exact: true }).click()
    await page.getByLabel('Share name').fill('Durable partner knowledge')
    await page.getByRole('switch', { name: 'Cloud include linked dependencies' }).click()
    await page.locator('.cloud-document-grid input[type="checkbox"]').nth(0).check()
    await page.locator('.cloud-document-grid input[type="checkbox"]').nth(1).check()
    await page.getByLabel('Sync provider').selectOption('box')
    await page.getByRole('button', { name: 'Publish folder' }).click()
    await expect(page.getByText('Durable folder is ready', { exact: true })).toBeVisible()

    const publicationRoot = path.join(knot.exportDir, 'Knot-durable-partner-knowledge')
    const firstCurrent = JSON.parse(await readFile(path.join(publicationRoot, 'current.json'), 'utf8'))
    const firstRelease = path.join(publicationRoot, 'releases', firstCurrent.release)
    const firstManifest = JSON.parse(await readFile(path.join(firstRelease, 'share-manifest.json'), 'utf8'))
    expect(firstManifest).toMatchObject({ provider: 'box', visibility_intent: 'workspace' })
    expect(firstManifest.documents).toHaveLength(2)
    expect(await readFile(path.join(publicationRoot, 'HOW-TO-SHARE.md'), 'utf8')).toContain('provider—not Knot—enforces account identity')
    expect(await readFile(path.join(firstRelease, 'index.html'), 'utf8')).not.toContain(concepts[2].title)

    const first = concepts[0]
    await page.evaluate((document) => window.knot.workspace.saveDocument({ path: document.path, frontmatter: document.frontmatter, body: `${document.body}\n\nDurable release two.` }), first)
    await page.getByRole('button', { name: 'Publish folder' }).click()
    await expect.poll(async () => JSON.parse(await readFile(path.join(publicationRoot, 'current.json'), 'utf8')).release).not.toBe(firstCurrent.release)
    const releases = await readdir(path.join(publicationRoot, 'releases'))
    expect(releases).toContain(firstCurrent.release)
    expect(releases).toHaveLength(2)

    await page.getByRole('button', { name: 'Export deployment' }).click()
    await expect(page.getByText('Self-host kit is ready', { exact: true })).toBeVisible()
    const archive = unzipSync(new Uint8Array(await readFile(path.join(knot.exportDir, 'Knot-durable-partner-knowledge-self-host.zip'))))
    expect(Object.keys(archive)).toEqual(expect.arrayContaining(['compose.yaml', 'Dockerfile', 'README.md', 'ACCESS.md', 'data/workspace-bundle.json', 'data/mcp-proposals.jsonl', 'knot-cloud-host.cjs']))
    expect(strFromU8(archive['compose.yaml'])).toContain('no-new-privileges:true')
    expect(strFromU8(archive['README.md'])).toContain('HTTPS reverse proxy')
    expect(strFromU8(archive['ACCESS.md'])).toContain('Bearer ')
    const remote = JSON.parse(strFromU8(archive['data/workspace-bundle.json']))
    expect(remote.shares[0].bundle.documents).toHaveLength(2)
    expect(JSON.stringify(remote)).not.toContain('dtn_test_only')

    const deploymentRoot = path.join(knot.userData, 'self-host-runtime')
    for (const [relative, bytes] of Object.entries(archive)) {
      const target = path.join(deploymentRoot, ...relative.split('/'))
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, bytes)
    }
    const port = 19000 + (process.pid % 1000)
    const host = spawn(process.execPath, [path.join(deploymentRoot, 'knot-cloud-host.cjs')], {
      cwd: deploymentRoot,
      env: { ...process.env, PORT: String(port), KNOT_HOST_ROOT: path.join(deploymentRoot, 'data') },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let hostError = ''
    host.stderr.on('data', (chunk) => { hostError += String(chunk) })
    try {
      let healthy = false
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try { healthy = (await fetch(`http://127.0.0.1:${port}/health`)).ok } catch { healthy = false }
        if (healthy) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(healthy, hostError).toBe(true)
      const recipientPath = strFromU8(archive['ACCESS.md']).match(/https:\/\/YOUR_HOST(\/share\/[^`\s]+)/)?.[1]
      expect(recipientPath).toBeTruthy()
      expect((await fetch(`http://127.0.0.1:${port}${recipientPath}`)).status).toBe(200)
      expect((await fetch(`http://127.0.0.1:${port}/share/not-a-share`)).status).toBe(404)
    } finally { host.kill('SIGTERM') }
    const state = await page.evaluate(() => window.knot.sharing.getState())
    expect(state.deliveries.slice(0, 3).map((delivery: any) => delivery.channel)).toEqual(['self-host', 'synced-folder', 'synced-folder'])
    expect(state.notifications.filter((notification: any) => !notification.resolvedAt)).toHaveLength(0)
  })

  test('owner scopes named and public Daytona shares, controls usage, syncs, and revokes capabilities', async ({ knot }) => {
    const page = knot.window
    const initial = await getBundle(page)
    const eligible = initial.documents.filter((document: any) => document.kind === 'concept')
    await page.evaluate(async (documents) => {
      for (let index = 0; index < documents.length; index += 1) {
        await window.knot.sharing.savePolicy({
          documentId: documents[index].id,
          visibility: index === 0 ? 'public' : 'workspace',
          audienceIds: index === 0 ? [] : ['product'],
          allowDownload: true,
          updateMode: 'review',
          updatedAt: new Date().toISOString()
        })
      }
    }, eligible)
    await page.reload()
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()
    await page.getByRole('button', { name: 'Cloud & MCP', exact: true }).click()
    await expect(page.getByText('Daytona configured')).toBeVisible()
    const credential = await page.evaluate(() => window.knot.cloud.getDashboard().then((value) => value.credential))
    await expect(page.getByText(credential.protectedByOs ? 'OS protected' : 'Unavailable')).toBeVisible()
    await page.getByLabel('Share name').fill('Partner launch room')
    await page.locator('.cloud-document-grid input[type="checkbox"]').nth(0).check()
    await page.locator('.cloud-document-grid input[type="checkbox"]').nth(1).check()
    await page.getByRole('button', { name: /Maya Chen/ }).click()
    await page.getByRole('switch', { name: 'Cloud allow download' }).click()
    await page.getByRole('button', { name: 'Publish to Daytona' }).click()
    await expect(page.getByText('Cloud share published', { exact: true })).toBeVisible()
    await expect(page.getByText('Partner launch room', { exact: true })).toBeVisible()

    let dashboard = await page.evaluate(() => window.knot.cloud.getDashboard())
    const named = dashboard.shares.find((share) => share.name === 'Partner launch room')!
    expect(named.visibility).toBe('workspace')
    expect(named.accessGrants.filter((grant) => grant.kind === 'recipient' && !grant.revokedAt).map((grant) => grant.audienceId).sort()).toEqual(['maya', 'product'])
    expect(named.accessGrants.find((grant) => grant.kind === 'mcp')?.tokenHash).toHaveLength(64)
    expect(named.links.filter((link) => link.kind === 'recipient')).toHaveLength(2)
    expect(named.links.find((link) => link.kind === 'mcp')?.authorization).toBeTruthy()
    expect(JSON.stringify(await page.evaluate(() => window.knot.sharing.getState()))).not.toContain('dtn_test_only')

    await page.getByRole('button', { name: 'Stop usage' }).click()
    await expect(page.getByText('Stopped', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Start sandbox' }).click()
    await expect(page.getByText('Online', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Sync now' }).click()
    await expect(page.getByText('Cloud and local revisions match.', { exact: true })).toBeVisible()

    await page.evaluate((documentId) => window.knot.sharing.savePolicy({ documentId, visibility: 'public', audienceIds: [], allowDownload: false, updateMode: 'review', updatedAt: new Date().toISOString() }), eligible[0].id)
    const firstDocument = (await getBundle(page)).documents.find((document: any) => document.id === eligible[0].id)
    dashboard = await page.evaluate((documentId) => window.knot.cloud.publish({
      name: 'Public product brief',
      documentIds: [documentId],
      visibility: 'public',
      audienceIds: [],
      includeDependencies: false,
      allowDownload: false,
      autoStopMinutes: 30
    }), firstDocument.id)
    const publicShare = dashboard.shares.find((share) => share.name === 'Public product brief')!
    expect(publicShare.links.find((link) => link.kind === 'public')?.url).toMatch(/\/share\//)
    expect(publicShare.links.find((link) => link.kind === 'public')?.url).not.toContain('access=')
    expect(publicShare.links.find((link) => link.kind === 'mcp')?.authorization).toBeTruthy()

    const namedRecipient = named.links.find((link) => link.kind === 'recipient')!
    dashboard = await page.evaluate(({ shareId, grantId }) => window.knot.cloud.revokeGrant(shareId, grantId), { shareId: named.id, grantId: namedRecipient.grantId })
    expect(dashboard.shares.find((share) => share.id === named.id)?.links.some((link) => link.grantId === namedRecipient.grantId)).toBe(false)

    const root = (await getBundle(page)).rootPath
    for (const document of (await getBundle(page)).documents) {
      const content = await readFile(path.join(root, document.path), 'utf8')
      expect(content).not.toContain('dtn_')
      expect(content).not.toContain('cloud-grant:')
    }
  })

  test('document processor and external agent both stop at human review, including stale-base conflict protection', async ({ knot }) => {
    const page = knot.window
    const sourcePath = path.join(knot.userData, 'field-notes.txt')
    await writeFile(sourcePath, '# Field Notes\n\nSeven teams asked for a searchable onboarding guide.\n\n<script>ignore()</script>\n', 'utf8')
    await page.evaluate((source) => window.knot.workflows.run({ workflowId: 'clean-import', paths: [source] }), sourcePath)
    await page.getByRole('button', { name: 'Workflows', exact: true }).click()
    await expect(page.getByText('Field Notes', { exact: true }).first()).toBeVisible()
    await page.getByText('Field Notes', { exact: true }).first().click()
    await expect(page.locator('.proposal-preview')).toContainText('<script>ignore()</script>')
    await page.getByRole('button', { name: 'Approve & publish' }).click()
    await expect(page.getByText('Proposal published to OKF', { exact: true })).toBeVisible()
    let bundle = await getBundle(page)
    expect(bundle.documents.some((document: any) => document.id === 'inbox/field-notes')).toBe(true)
    expect(await readFile(sourcePath, 'utf8')).toContain('Seven teams')

    const target = bundle.documents.find((document: any) => document.kind === 'concept' && document.id !== 'inbox/field-notes')
    const proposalId = randomUUID()
    const baseRevision = createHash('sha256').update(target.raw).digest('hex').slice(0, 16)
    const inbox = path.join(bundle.rootPath, '.knot')
    await mkdir(inbox, { recursive: true })
    await writeFile(path.join(inbox, 'mcp-proposals.jsonl'), `${JSON.stringify({
      id: proposalId,
      targetDocumentId: target.id,
      title: `Agent revision for ${target.title}`,
      body: `# ${target.title}\n\nAgent-proposed replacement.`,
      reason: 'An external collaborator found a missing qualification.',
      baseRevision,
      createdAt: new Date().toISOString()
    })}\n`, 'utf8')
    await page.getByRole('button', { name: 'Overview', exact: true }).click()
    await page.getByRole('button', { name: 'Workflows', exact: true }).click()
    const agentProposal = page.getByRole('button', { name: new RegExp(`Agent revision for ${target.title}`) })
    await expect(agentProposal).toBeVisible()
    await agentProposal.click()
    expect((await page.evaluate(() => window.knot.workflows.getState())).proposals.find((proposal: any) => proposal.id === proposalId)?.source).toBe('local-mcp')

    await page.evaluate((document) => window.knot.workspace.saveDocument({
      path: document.path,
      frontmatter: document.frontmatter,
      body: `${document.body}\n\nOwner edit after the agent read this concept.`
    }), target)
    await page.getByRole('button', { name: 'Approve & publish' }).click()
    await expect(page.getByText('Review action failed', { exact: true })).toBeVisible()
    await expect(page.locator('.toast-danger')).toContainText('target changed')
    expect((await page.evaluate(() => window.knot.workflows.getState())).proposals.find((proposal: any) => proposal.id === proposalId)?.status).toBe('pending')
    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(page.getByText('Proposal rejected', { exact: true })).toBeVisible()
    bundle = await getBundle(page)
    expect(bundle.documents.find((document: any) => document.id === target.id).body).toContain('Owner edit after the agent read')
    expect(bundle.documents.find((document: any) => document.id === target.id).body).not.toContain('Agent-proposed replacement')
  })
})
