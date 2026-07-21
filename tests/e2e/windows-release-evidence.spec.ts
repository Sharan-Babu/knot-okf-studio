import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect, getBundle } from './fixtures'

test.describe('Windows release evidence', () => {
  test.skip(process.env.KNOT_WINDOWS_EVIDENCE !== '1', 'Runs only in the disposable Windows release sandbox.')

  test('native Windows renders cloud and workflow surfaces and reports win32', async ({ knot }, testInfo) => {
    expect(await knot.application.evaluate(() => process.platform)).toBe('win32')
    const page = knot.window
    const first = (await getBundle(page)).documents.find((document: any) => document.kind === 'concept')
    await page.evaluate((documentId) => window.knot.sharing.savePolicy({ documentId, visibility: 'workspace', audienceIds: ['product'], allowDownload: false, updateMode: 'review', updatedAt: new Date().toISOString() }), first.id)
    await page.reload()
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()
    await page.getByRole('button', { name: 'Cloud & MCP', exact: true }).click()
    await page.getByLabel('Share name').fill('Windows release knowledge room')
    await page.locator('.cloud-document-grid input[type="checkbox"]').first().check()
    await page.getByRole('switch', { name: 'Cloud include linked dependencies' }).click()
    await page.getByRole('button', { name: 'Publish to Daytona' }).click()
    await expect(page.getByText('Windows release knowledge room', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('knot-cloud-win32.png'), fullPage: true })

    const source = path.join(knot.userData, 'windows-source.txt')
    await writeFile(source, '# Windows validation\n\nNative Electron, workflow extraction, and approval UI passed on Windows.\n')
    await page.evaluate((sourcePath) => window.knot.workflows.run({ workflowId: 'clean-import', paths: [sourcePath] }), source)
    await page.getByRole('button', { name: 'Workflows', exact: true }).click()
    await expect(page.getByText('Windows validation', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('knot-workflows-win32.png'), fullPage: true })
    expect((await getBundle(page)).conformant).toBe(true)
  })
})
