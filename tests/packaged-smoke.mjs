import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'

if (process.platform !== 'darwin') throw new Error('The macOS packaged smoke test must run on macOS.')

const userData = await mkdtemp(path.join(os.tmpdir(), 'knot-packaged-smoke-'))
const exportDir = path.join(userData, 'exports')
const outputDirectory = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
const executablePath = path.resolve('release', outputDirectory, 'Knot.app', 'Contents', 'MacOS', 'Knot')
await mkdir(exportDir, { recursive: true })

let application
try {
  application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'test', KNOT_TEST_EXPORT_PATH: exportDir }
  })
  const page = await application.firstWindow()
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor({ timeout: 20_000 })
  assert.match(await page.title(), /Knot/)

  const bundle = await page.evaluate(() => window.knot.workspace.refresh())
  assert.equal(bundle.conformant, true)
  assert.ok(bundle.stats.concepts > 0)

  const result = await page.evaluate((documentId) => window.knot.sharing.export({
    documentIds: [documentId],
    name: 'Packaged smoke export',
    visibility: 'private',
    audienceIds: [],
    includeDependencies: false,
    allowDownload: false
  }), bundle.documents.find((document) => document.kind === 'concept').id)
  assert.equal(result.canceled, false)
  assert.equal(result.count, 1)
  assert.ok(result.deliveryId)
  console.log(JSON.stringify({ title: await page.title(), concepts: bundle.stats.concepts, conformant: bundle.conformant, exportCount: result.count }))
} finally {
  if (application) await application.close()
  await rm(userData, { recursive: true, force: true })
}
