import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'

if (process.platform !== 'linux') throw new Error('The Linux packaged smoke test must run on Linux.')

const userData = await mkdtemp(path.join(os.tmpdir(), 'knot-packaged-linux-'))
const exportDir = path.join(userData, 'exports')
const executablePath = path.resolve('release', 'linux-unpacked', 'knot-okf-studio')
await mkdir(exportDir, { recursive: true })

let application
try {
  application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'test', KNOT_TEST_EXPORT_PATH: exportDir }
  })
  const page = await application.firstWindow()
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor({ timeout: 30_000 })
  const bundle = await page.evaluate(() => window.knot.workspace.refresh())
  assert.equal(bundle.conformant, true)
  assert.ok(bundle.stats.concepts > 0)
  const concept = bundle.documents.find((document) => document.kind === 'concept')
  const result = await page.evaluate((documentId) => window.knot.sharing.export({
    documentIds: [documentId],
    name: 'Packaged Linux smoke export',
    visibility: 'private',
    audienceIds: [],
    includeDependencies: false,
    allowDownload: false
  }), concept.id)
  assert.equal(result.canceled, false)
  assert.equal(result.count, 1)
  process.stdout.write(`${JSON.stringify({ platform: process.platform, arch: process.arch, title: await page.title(), concepts: bundle.stats.concepts, conformant: bundle.conformant })}\n`)
} finally {
  if (application) await application.close()
  await rm(userData, { recursive: true, force: true })
}
