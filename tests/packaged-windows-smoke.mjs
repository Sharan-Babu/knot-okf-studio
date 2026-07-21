import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'

if (process.platform !== 'win32') throw new Error('The Windows packaged smoke test must run on Windows.')
const userData = await mkdtemp(path.join(os.tmpdir(), 'knot-packaged-win-'))
const exportDir = path.join(userData, 'exports')
const executablePath = path.resolve('release', 'win-unpacked', 'Knot.exe')
await mkdir(exportDir, { recursive: true })

let application
try {
  application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userData}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      KNOT_TEST_EXPORT_PATH: exportDir,
      KNOT_TEST_CLOUD: '1',
      KNOT_TEST_DAYTONA_API_KEY: 'dtn_windows_packaged_fixture_not_real_000000',
      KNOT_TEST_PARALLEL: '1',
      KNOT_TEST_PARALLEL_API_KEY: 'parallel_windows_packaged_fixture_not_real_000000'
    }
  })
  const page = await application.firstWindow()
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor({ timeout: 30_000 })
  const bundle = await page.evaluate(() => window.knot.workspace.refresh())
  assert.equal(bundle.conformant, true)
  assert.ok(bundle.stats.concepts > 0)
  const mcp = await page.evaluate(() => window.knot.mcp.getIntegrationInfo())
  assert.equal(mcp.enabled, true)
  assert.match(mcp.args[0], /resources[\\/]services[\\/]knot-mcp\.cjs$/)
  const publicDocument = bundle.documents.find((document) => document.kind === 'concept')
  await page.evaluate((documentId) => window.knot.sharing.savePolicy({ documentId, visibility: 'public', audienceIds: [], allowDownload: false, updateMode: 'review', updatedAt: new Date().toISOString() }), publicDocument.id)
  const dashboard = await page.evaluate((documentId) => window.knot.cloud.publish({
    name: 'Packaged Windows cloud probe', documentIds: [documentId], visibility: 'public', audienceIds: [],
    includeDependencies: false, allowDownload: false, autoStopMinutes: 15
  }), publicDocument.id)
  assert.equal(dashboard.cloud.runtime, 'online')
  assert.ok(dashboard.shares[0].links.some((link) => link.kind === 'mcp'))
  process.stdout.write(`${JSON.stringify({ platform: process.platform, arch: process.arch, title: await page.title(), concepts: bundle.stats.concepts, mcpBundled: mcp.enabled, cloudRuntime: dashboard.cloud.runtime })}\n`)
} finally {
  if (application) await application.close()
  await rm(userData, { recursive: true, force: true })
}
