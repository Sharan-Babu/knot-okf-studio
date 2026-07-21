import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './fixtures'

test.describe('UI and UX release audit', () => {
  test('workspace menu actions operate and the example tour covers every product area', async ({ knot }) => {
    const page = knot.window
    const bundle = await page.evaluate(() => window.knot.workspace.refresh())
    const menuTrigger = page.getByRole('button', { name: /Workspace: Atlas Product Intelligence/ })

    await menuTrigger.click()
    for (const item of ['Open workspace', 'Create workspace', 'Reload from disk', 'Guided example tour', 'Reveal in file browser']) {
      await expect(page.getByRole('menuitem', { name: new RegExp(item) })).toBeVisible()
    }
    await page.getByRole('menuitem', { name: /Reload from disk/ }).click()
    await expect(page.getByText('Workspace refreshed', { exact: true })).toBeVisible()

    await knot.application.evaluate(({ dialog }, root) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] }) as Awaited<ReturnType<typeof dialog.showOpenDialog>>
    }, bundle.rootPath)
    await menuTrigger.click()
    await page.getByRole('menuitem', { name: /Open workspace/ }).click()
    await expect(page.getByText('Workspace opened', { exact: true })).toBeVisible()

    const createRoot = path.join(knot.userData, 'Menu Created Workspace')
    await mkdir(createRoot)
    await knot.application.evaluate(({ dialog }, root) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] }) as Awaited<ReturnType<typeof dialog.showOpenDialog>>
    }, createRoot)
    await page.getByRole('button', { name: /Workspace: Atlas Product Intelligence/ }).click()
    await page.getByRole('menuitem', { name: /Create workspace/ }).click()
    await expect(page.getByText('Workspace ready', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Workspace: Menu Created Workspace/ })).toBeVisible()

    await page.getByRole('button', { name: 'Guided tour', exact: true }).click()
    const tour = page.getByRole('dialog', { name: 'Welcome to your example workspace' })
    await expect(tour).toBeVisible()
    await expect(page.getByRole('button', { name: /Workspace: Atlas Product Intelligence/ })).toBeVisible()
    const titles = [
      'Welcome to your example workspace', 'Start with a useful overview', 'Write portable knowledge',
      'Follow the relationships', 'Keep the bundle trustworthy', 'Share only what you intend',
      'Publish or connect agents', 'Ingest through a review boundary', 'Track selected topics',
      'See the local audit trail', 'Use your own Codex subscription', 'You are ready to explore'
    ]
    for (let index = 0; index < titles.length; index += 1) {
      await expect(page.getByRole('dialog').getByRole('heading', { name: titles[index] })).toBeVisible()
      await expect(page.getByRole('dialog')).toContainText(`Step ${index + 1} of ${titles.length}`)
      if (index < titles.length - 1) await page.getByRole('dialog').getByRole('button', { name: /Next/ }).click()
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('graph auto-layout is bounded, separated, connected, and fully controllable', async ({ knot }) => {
    const page = knot.window
    await page.getByRole('button', { name: 'Graph', exact: true }).click()
    const canvas = page.getByTestId('graph-canvas')
    await expect(canvas).toBeVisible()
    const geometry = await page.locator('.graph-node-svg').evaluateAll((nodes) => nodes.map((node) => {
      const matrix = (node as SVGGElement).getCTM()
      return matrix ? { x: matrix.e, y: matrix.f } : { x: 0, y: 0 }
    }))
    expect(geometry.length).toBeGreaterThan(4)
    for (let first = 0; first < geometry.length; first += 1) {
      for (let second = first + 1; second < geometry.length; second += 1) {
        expect(Math.hypot(geometry[first].x - geometry[second].x, geometry[first].y - geometry[second].y)).toBeGreaterThan(18)
      }
    }
    await expect(page.locator('.graph-edges path')).not.toHaveCount(0)
    const before = await page.locator('.graph-node-svg').count()
    await page.getByRole('button', { name: 'All concepts' }).click()
    await expect(page.getByRole('button', { name: 'Connected only' })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.locator('.graph-node-svg').count()).toBeLessThanOrEqual(before)
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(page.locator('.zoom-control')).toContainText('110%')
    await page.getByRole('button', { name: 'Reset zoom' }).click()
    await expect(page.locator('.zoom-control')).toContainText('100%')
  })

  test('dense pages use progressive disclosure and compact cards', async ({ knot }) => {
    const page = knot.window
    await page.getByRole('button', { name: 'Web watch', exact: true }).click()
    await expect(page.getByLabel('Focused topic')).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'New watch' }).click()
    await expect(page.getByLabel('Focused topic')).toBeVisible()
    await page.locator('.web-watch-composer').getByRole('button', { name: 'Cancel' }).first().click()
    await expect(page.getByLabel('Focused topic')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Connection' }).click()
    await expect(page.getByRole('heading', { name: 'Parallel is ready' })).toBeVisible()

    await page.getByRole('button', { name: 'Workflows', exact: true }).click()
    const cards = page.locator('.workflow-definition')
    await expect(cards).toHaveCount(2)
    const heights = await cards.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height))
    expect(Math.max(...heights)).toBeLessThan(190)
    await expect(page.locator('.workflow-review')).toHaveCount(0)
  })

  test('every primary page remains aligned at standard and minimum desktop sizes', async ({ knot }, testInfo) => {
    const page = knot.window
    const destinations = ['Overview', 'Knowledge', 'Graph', 'Quality', 'Sharing', 'Cloud & MCP', 'Workflows', 'Web watch', 'Activity', 'Knot Assist', 'Settings']
    for (const viewport of [{ width: 1480, height: 940, label: 'standard' }, { width: 1120, height: 720, label: 'minimum' }]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      for (const destination of destinations) {
        await page.getByRole('button', { name: destination, exact: true }).click()
        await page.waitForTimeout(60)
        const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.body.clientWidth }))
        expect(overflow, `${destination} at ${viewport.label}`).toEqual({ document: 0, body: 0 })
        await testInfo.attach(`${viewport.label}-${destination.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.png`, { body: await page.screenshot(), contentType: 'image/png' })
      }
    }
  })
})
