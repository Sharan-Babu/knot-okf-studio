import { test, expect } from './fixtures'

test.describe('live subscription-backed app-server', () => {
  test.skip(!process.env.KNOT_LIVE_AI, 'Set KNOT_LIVE_AI=1 to exercise the signed-in Codex app-server.')

  test('authenticated user receives a real, document-scoped response', async ({ knot }) => {
    test.setTimeout(180_000)
    const page = knot.window
    await page.getByRole('button', { name: 'Knot Assist', exact: true }).click()
    await expect(page.getByText('Codex connected', { exact: true }).first()).toBeVisible()
    const composer = page.getByLabel('Assistant instruction')
    await composer.fill('Reply with exactly KNOT_LIVE_AI_OK and no other text.')
    await page.getByRole('button', { name: 'Send to Knot Assist' }).click()
    await expect(page.locator('.chat-message.assistant').last()).toContainText('KNOT_LIVE_AI_OK', { timeout: 150_000 })
    await expect(page.locator('.toast').getByText('Assistant could not respond')).toHaveCount(0)
  })
})
