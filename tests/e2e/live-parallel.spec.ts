import { test, expect } from './fixtures'

test.describe('live Parallel monitor lifecycle', () => {
  test.skip(process.env.KNOT_LIVE_PARALLEL !== '1', 'Set KNOT_LIVE_PARALLEL=1 with a temporary key to run the live web-watch gate.')

  test('real product IPC verifies, creates, polls, and cancels a monitor', async ({ knot }) => {
    const page = knot.window
    let monitorId: string | undefined
    try {
      const credential = await page.evaluate(() => window.knot.webWatch.testConnection())
      expect(credential.configured).toBe(true)
      let dashboard = await page.evaluate(() => window.knot.webWatch.createMonitor({
        query: 'Official Open Knowledge Format specification announcements from Google Cloud repositories',
        frequency: '30d',
        processor: 'lite'
      }))
      monitorId = dashboard.state.monitors[0].id
      expect(monitorId).toMatch(/^monitor_/)
      expect(dashboard.state.monitors[0].status).toBe('active')
      dashboard = await page.evaluate(() => window.knot.webWatch.refresh())
      expect(dashboard.state.monitors.find((monitor) => monitor.id === monitorId)?.lastError).toBeUndefined()
      dashboard = await page.evaluate((id) => window.knot.webWatch.cancelMonitor(id), monitorId)
      expect(dashboard.state.monitors.find((monitor) => monitor.id === monitorId)?.status).toBe('canceled')
      monitorId = undefined
    } finally {
      if (monitorId) await page.evaluate((id) => window.knot.webWatch.cancelMonitor(id), monitorId).catch(() => undefined)
    }
  })
})
