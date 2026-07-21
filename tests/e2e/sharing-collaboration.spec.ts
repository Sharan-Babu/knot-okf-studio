import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { test, expect, getBundle, getSharingState, restartSession } from './fixtures'

async function exportBaseline(page: any, name: string, updateMode: 'review' | 'auto-prepare' = 'review'): Promise<any> {
  await page.evaluate(async (mode: string) => {
    const bundle = await window.knot.workspace.refresh()
    for (const document of bundle.documents.filter((item) => item.kind === 'concept')) {
      await window.knot.sharing.savePolicy({
        documentId: document.id, visibility: 'workspace', audienceIds: ['leadership', 'maya'], allowDownload: true,
        updateMode: mode as any, updatedAt: new Date().toISOString()
      })
    }
  }, updateMode)
  return page.evaluate((packageName: string) => window.knot.sharing.export({
    documentIds: ['product/north-star'], name: packageName, visibility: 'workspace', audienceIds: ['leadership', 'maya'],
    includeDependencies: true, allowDownload: true
  }), name)
}

async function editNorthStar(page: any, marker: string): Promise<void> {
  await page.getByRole('button', { name: 'Knowledge', exact: true }).click()
  await page.getByRole('button', { name: 'Weekly Activated Teams', exact: true }).click()
  await page.getByRole('tab', { name: 'Edit' }).click()
  const editor = page.getByLabel('Markdown body')
  await editor.fill(`${await editor.inputValue()}\n\n## ${marker}\n\nThis revision was prepared by the editor persona.`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.toast').getByText('Saved', { exact: true })).toBeVisible()
}

test.describe('recipient-aware collaboration lifecycle', () => {
  test('privacy auditor inspects an exact portable ZIP, dependency closure, and share ledger', async ({ knot }) => {
    const result = await exportBaseline(knot.window, 'Leadership activation brief')
    expect(result).toMatchObject({ canceled: false })
    expect(result.count).toBeGreaterThan(1)

    const archive = unzipSync(new Uint8Array(await readFile(result.path)))
    const names = Object.keys(archive).sort()
    expect(names).toEqual(expect.arrayContaining(['index.md', 'share-manifest.json', 'product/north-star.md', 'projects/atlas.md', 'data/accounts.md']))
    expect(names).not.toContain('product/roadmap.md')
    expect(names).not.toContain('playbooks/incident-response.md')
    const manifest = JSON.parse(strFromU8(archive['share-manifest.json']))
    expect(manifest).toMatchObject({
      format: 'Open Knowledge Format', okf_version: '0.1', name: 'Leadership activation brief', visibility: 'workspace',
      audience_ids: ['leadership', 'maya'], allow_download: true, delivery_id: result.deliveryId
    })
    expect(manifest.documents).toEqual(expect.arrayContaining(['product/north-star.md', 'projects/atlas.md', 'data/accounts.md']))

    const state = await getSharingState(knot.window)
    expect(state.deliveries[0]).toMatchObject({ id: result.deliveryId, name: 'Leadership activation brief', audienceIds: ['leadership', 'maya'] })
    expect(state.deliveries[0].documentIds.length).toBe(result.count)
    expect((await readdir(knot.exportDir)).some((entry) => entry.endsWith('.zip'))).toBe(true)

    await restartSession(knot)
    await knot.window.getByRole('button', { name: 'Sharing', exact: true }).click()
    await expect(knot.window.getByText('Leadership activation brief')).toBeVisible()
    await expect(knot.window.getByText(/Leadership, Maya Chen/)).toBeVisible()
  })

  test('author, editor, and reviewer personas see a stale-recipient notification across app restarts', async ({ knot }) => {
    let page = knot.window
    await exportBaseline(page, 'Reviewer lifecycle baseline', 'auto-prepare')

    await restartSession(knot)
    page = knot.window
    await editNorthStar(page, 'Editor persona update')
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sharing', exact: true }).locator('em')).toHaveText('1')

    await restartSession(knot)
    page = knot.window
    await page.getByRole('button', { name: 'Notifications, 1 unread' }).click()
    const notification = page.getByRole('menuitem', { name: /Weekly Activated Teams changed/ })
    await expect(notification).toContainText('Previously shared with Leadership, Maya Chen')
    await expect(notification).toContainText('Auto-prepare ready')
    await notification.click()
    await expect(page.getByRole('heading', { name: 'Sharing center' })).toBeVisible()
    await expect(page.getByText('1 shared concept changed')).toBeVisible()
    await expect(page.locator('.update-card')).toContainText('Shared with Leadership, Maya Chen')
    await expect(page.locator('.update-card')).toContainText('Auto-prepare')
    await expect(page.getByRole('button', { name: 'Notifications, 0 unread' })).toBeVisible()

    await page.getByRole('button', { name: 'Keep private' }).click()
    await expect(page.getByText('Every shared concept is current')).toBeVisible()
    let state = await getSharingState(page)
    expect(state.notifications[0]).toMatchObject({ resolution: 'kept-private' })
    expect(state.notifications[0].resolvedAt).toBeTruthy()

    await editNorthStar(page, 'Later editor correction')
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible()
    state = await getSharingState(page)
    expect(state.notifications.filter((item: any) => !item.resolvedAt)).toHaveLength(1)
  })

  test('publishing an update advances the delivery revision and clears the recipient queue', async ({ knot }) => {
    const page = knot.window
    await exportBaseline(page, 'Initial customer-safe metric')
    await editNorthStar(page, 'Publishable correction')
    await page.getByRole('button', { name: 'Sharing', exact: true }).click()
    await expect(page.getByText('1 shared concept changed')).toBeVisible()
    await page.getByRole('button', { name: 'Export update' }).click()
    await expect(page.getByText('Every shared concept is current')).toBeVisible()

    const state = await getSharingState(page)
    expect(state.deliveries).toHaveLength(2)
    expect(state.deliveries[0].name).toBe('Weekly Activated Teams update')
    expect(state.notifications[0]).toMatchObject({ resolution: 'published' })
    expect(state.policies.find((item: any) => item.documentId === 'product/north-star').lastSharedRevision)
      .toBe(state.deliveries[0].revisions['product/north-star'])

    await page.getByRole('button', { name: 'Activity', exact: true }).click()
    await expect(page.getByText('Share package exported').first()).toBeVisible()
    await expect(page.locator('.activity-timeline')).toContainText('Concept updated')
  })

  test('sharing policy can be revoked without contaminating the portable Markdown source', async ({ knot }) => {
    const page = knot.window
    await exportBaseline(page, 'Temporary partner brief')
    const before = await getBundle(page)
    const raw = before.documents.find((item: any) => item.id === 'product/north-star').raw
    await page.evaluate(() => window.knot.sharing.savePolicy({
      documentId: 'product/north-star', visibility: 'private', audienceIds: [], allowDownload: false,
      updateMode: 'review', updatedAt: new Date().toISOString()
    }))
    const after = await getBundle(page)
    expect(after.documents.find((item: any) => item.id === 'product/north-star').raw).toBe(raw)
    expect(after.documents.find((item: any) => item.id === 'product/north-star').visibility).toBe('private')
    expect(raw).not.toMatch(/audience|visibility|recipient|allow_download/i)
  })

  test('publisher completes the full share composer workflow through visible controls', async ({ knot }) => {
    const page = knot.window
    await page.getByRole('button', { name: 'Sharing', exact: true }).click()
    const composer = page.locator('.publish-panel')
    await composer.getByRole('button', { name: /Product team/ }).click()
    await composer.getByRole('button', { name: /Maya Chen/ }).click()
    const row = page.locator('.access-row').filter({ hasText: 'Weekly Activated Teams' })
    await row.getByRole('checkbox', { name: 'Select Weekly Activated Teams' }).check()
    await row.locator('.visibility-trigger').click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('menuitem', { name: /Workspace/ }).click()
    await expect(row.locator('.visibility-trigger')).toContainText('Workspace')

    await composer.getByLabel('Package name').fill('UI composed metric brief')
    await composer.getByRole('switch', { name: 'Include linked dependencies' }).click()
    await composer.getByRole('switch', { name: 'Allow recipients to download' }).click()
    await composer.getByRole('button', { name: 'Review & export' }).click()
    await expect(page.locator('.toast').filter({ hasText: 'Share package exported' })).toBeVisible()
    await expect(page.locator('.ledger-panel')).toContainText('UI composed metric brief')

    const state = await getSharingState(page)
    expect(state.deliveries[0]).toMatchObject({
      name: 'UI composed metric brief', documentIds: ['product/north-star'], audienceIds: ['product', 'maya'], allowDownload: false
    })
  })
})
