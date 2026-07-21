import { test, expect, getBundle } from './fixtures'

test.describe('Parallel web update collaboration', () => {
  test('researcher monitors, reviews, prepares deterministically, and approves before OKF changes', async ({ knot }) => {
    const page = knot.window
    const initialCount = (await getBundle(page)).stats.concepts
    await page.getByRole('button', { name: 'Web watch', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Turn relevant change into reviewed knowledge' })).toBeVisible()
    await page.getByRole('button', { name: 'New watch' }).click()
    await page.getByLabel('Focused topic').fill('Material changes to the official Model Context Protocol specification')
    await page.getByLabel('Check frequency').selectOption('7d')
    await page.getByRole('button', { name: 'Start watching' }).click()
    await expect(page.getByText('Web watch created', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Check now' }).click()
    await expect(page.getByText(/A material update was detected for Material changes/)).toBeVisible()
    expect((await getBundle(page)).stats.concepts).toBe(initialCount)

    await page.getByRole('button', { name: 'Prepare draft' }).click()
    await expect(page.getByText('Draft ready in Workflows', { exact: true })).toBeVisible()
    expect((await getBundle(page)).stats.concepts).toBe(initialCount)
    const watch = await page.evaluate(() => window.knot.webWatch.getDashboard())
    expect(watch.state.updates[0]).toMatchObject({ status: 'queued' })
    expect(watch.state.updates[0].citations[0].url).toBe('https://example.com/material-update')

    await page.getByRole('button', { name: 'Workflows', exact: true }).click()
    const proposal = page.locator('.proposal-list > button').filter({ hasText: 'A material update was detected' }).first()
    await expect(proposal).toBeVisible()
    await proposal.click()
    await expect(page.locator('.proposal-preview')).toContainText('https://example.com/material-update')
    await page.getByRole('button', { name: 'Approve & publish' }).click()
    await expect(page.getByText('Proposal published to OKF', { exact: true })).toBeVisible()
    expect((await getBundle(page)).stats.concepts).toBe(initialCount + 1)
  })

  test('researcher can dismiss an update and cancel future scheduled usage', async ({ knot }) => {
    const page = knot.window
    await page.getByRole('button', { name: 'Web watch', exact: true }).click()
    await page.getByRole('button', { name: 'New watch' }).click()
    await page.getByLabel('Focused topic').fill('Important changes to the official Open Knowledge Format specification')
    await page.getByRole('button', { name: 'Start watching' }).click()
    await page.getByRole('button', { name: 'Check now' }).click()
    const dismiss = page.getByTestId('web-watch-page').getByRole('button', { name: 'Dismiss' })
    await expect(dismiss).toBeVisible()
    await dismiss.click()
    await expect(page.getByText('dismissed', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Watches' }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.locator('.active-monitor-list').getByRole('button', { name: /Cancel Important changes/ }).click()
    await expect(page.getByText('Web watch canceled', { exact: true })).toBeVisible()
    expect((await page.evaluate(() => window.knot.webWatch.getDashboard())).state.monitors[0].status).toBe('canceled')
  })
})
