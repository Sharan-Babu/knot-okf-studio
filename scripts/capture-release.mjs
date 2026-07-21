import { _electron as electron } from '@playwright/test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const userData = await mkdtemp(path.join(os.tmpdir(), 'knot-capture-'))
const exportDir = path.join(userData, 'exports')
await mkdir(exportDir)
const source = path.join(userData, 'research-note.txt')
await writeFile(source, '# Research synthesis\n\nCustomers need clear ownership, privacy, and revision history before sharing organizational context.\n')
const application = await electron.launch({
  args: ['.', `--user-data-dir=${userData}`],
  env: {
    ...process.env,
    NODE_ENV: 'test',
    KNOT_TEST_EXPORT_PATH: exportDir,
    KNOT_TEST_CLOUD: '1',
    KNOT_TEST_DAYTONA_API_KEY: 'dtn_visual_fixture_not_a_real_credential_0000',
    KNOT_TEST_PARALLEL: '1',
    KNOT_TEST_PARALLEL_API_KEY: 'parallel_visual_fixture_not_a_real_credential_0000'
  }
})

try {
  const page = await application.firstWindow()
  await page.setViewportSize({ width: 1480, height: 940 })
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor({ timeout: 30_000 })
  await page.evaluate(async () => {
    const bundle = await window.knot.workspace.refresh()
    const ids = bundle.documents.filter((document) => document.kind === 'concept').map((document) => document.id)
    for (const documentId of ids) await window.knot.sharing.savePolicy({ documentId, visibility: 'workspace', audienceIds: ['product', 'maya'], allowDownload: false, updateMode: 'review', updatedAt: new Date().toISOString() })
  })
  await page.reload()
  await page.getByRole('button', { name: 'Graph', exact: true }).click()
  await page.getByRole('heading', { name: 'Knowledge graph', exact: true }).waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(root, 'docs', 'knot-graph.png'), fullPage: true })

  await page.getByRole('button', { name: 'Cloud & MCP', exact: true }).click()
  await page.getByLabel('Share name').fill('Atlas partner knowledge room')
  await page.locator('.cloud-document-grid input[type="checkbox"]').nth(0).check()
  await page.locator('.cloud-document-grid input[type="checkbox"]').nth(1).check()
  await page.getByRole('button', { name: /Maya Chen/ }).click()
  await page.getByRole('button', { name: 'Publish to Daytona' }).click()
  await page.getByText('Atlas partner knowledge room', { exact: true }).waitFor()
  await page.locator('.content').evaluate((element) => { element.scrollTop = 0 })
  await page.screenshot({ path: path.join(root, 'docs', 'knot-cloud.png'), fullPage: true })

  await page.getByRole('button', { name: 'Web watch', exact: true }).click()
  await page.getByRole('button', { name: 'New watch' }).click()
  await page.getByLabel('Focused topic').fill('Material changes to the official Model Context Protocol specification')
  await page.getByLabel('Check frequency').selectOption('7d')
  await page.getByRole('button', { name: 'Start watching' }).click()
  await page.getByRole('button', { name: 'Check now' }).click()
  await page.getByText(/A material update was detected/).waitFor()
  await page.locator('.content').evaluate((element) => { element.scrollTop = 0 })
  await page.screenshot({ path: path.join(root, 'docs', 'knot-web-watch.png'), fullPage: true })

  await page.evaluate((sourcePath) => window.knot.workflows.run({ workflowId: 'clean-import', paths: [sourcePath] }), source)
  await page.getByRole('button', { name: 'Workflows', exact: true }).click()
  await page.getByText('Research synthesis', { exact: true }).first().click()
  await page.screenshot({ path: path.join(root, 'docs', 'knot-workflows.png'), fullPage: true })

  await page.getByRole('button', { name: 'Guided tour', exact: true }).click()
  await page.getByRole('dialog', { name: 'Welcome to your example workspace' }).waitFor()
  await page.screenshot({ path: path.join(root, 'docs', 'knot-guided-tour.png'), fullPage: true })
} finally {
  await application.close()
  await rm(userData, { recursive: true, force: true })
}
