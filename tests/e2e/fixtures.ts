import { test as base, expect, _electron as electron, type ElectronApplication, type Page, type TestInfo } from '@playwright/test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export interface KnotSession {
  application: ElectronApplication
  window: Page
  userData: string
  exportDir: string
  runtimeErrors: string[]
}

async function openApplication(userData: string, exportDir: string, runtimeErrors: string[]): Promise<{ application: ElectronApplication; window: Page }> {
  const application = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      KNOT_TEST_EXPORT_PATH: exportDir,
      KNOT_TEST_AVAILABILITY_PATH: exportDir,
      KNOT_TEST_MEMORY_VAULT: '1',
      KNOT_TEST_CLOUD: process.env.KNOT_TEST_CLOUD ?? '1',
      KNOT_TEST_DAYTONA_API_KEY: process.env.KNOT_TEST_DAYTONA_API_KEY ?? 'dtn_test_only_not_a_real_credential_000000000',
      KNOT_TEST_PARALLEL: process.env.KNOT_TEST_PARALLEL ?? '1',
      KNOT_TEST_PARALLEL_API_KEY: process.env.KNOT_TEST_PARALLEL_API_KEY ?? 'parallel_test_only_not_a_real_credential_000000000'
    }
  })
  const window = await application.firstWindow()
  window.on('pageerror', (error) => runtimeErrors.push(error.stack ?? error.message))
  window.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`)
  })
  await expect(window).toHaveTitle(/Knot/)
  await expect(window.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()
  return { application, window }
}

export async function restartSession(session: KnotSession): Promise<void> {
  await session.application.close()
  const next = await openApplication(session.userData, session.exportDir, session.runtimeErrors)
  session.application = next.application
  session.window = next.window
}

export async function attachRuntimeErrors(testInfo: TestInfo, errors: string[]): Promise<void> {
  if (!errors.length) return
  await testInfo.attach('renderer-errors.txt', { body: errors.join('\n\n'), contentType: 'text/plain' })
}

export const test = base.extend<{ knot: KnotSession }>({
  knot: async ({}, use, testInfo) => {
    const userData = await mkdtemp(path.join(os.tmpdir(), 'knot-e2e-'))
    const exportDir = path.join(userData, 'exports')
    await mkdir(exportDir, { recursive: true })
    const runtimeErrors: string[] = []
    const opened = await openApplication(userData, exportDir, runtimeErrors)
    const session: KnotSession = { ...opened, userData, exportDir, runtimeErrors }
    try {
      await use(session)
    } finally {
      if (!session.application.windows().length) {
        // The app was already closed by a restart or failure path.
      } else {
        await session.application.close()
      }
      await attachRuntimeErrors(testInfo, runtimeErrors)
      await rm(userData, { recursive: true, force: true })
    }
    expect(runtimeErrors, 'renderer must not emit uncaught errors').toEqual([])
  }
})

export { expect }

export async function getBundle(page: Page): Promise<any> {
  return page.evaluate(() => window.knot.workspace.refresh())
}

export async function getSharingState(page: Page): Promise<any> {
  return page.evaluate(() => window.knot.sharing.getState())
}
