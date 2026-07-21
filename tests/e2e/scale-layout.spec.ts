import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect, getBundle } from './fixtures'

test.describe('scale and production layout', () => {
  test('large workspace stays searchable and graph rendering is deliberately bounded', async ({ knot }) => {
    const page = knot.window
    const bundle = await getBundle(page)
    const directory = path.join(bundle.rootPath, 'scale')
    await mkdir(directory, { recursive: true })
    await Promise.all(Array.from({ length: 180 }, async (_, index) => {
      const sequence = String(index).padStart(3, '0')
      await writeFile(path.join(directory, `generated-${sequence}.md`), `---\ntype: Reference\ntitle: Generated scale concept ${sequence}\ndescription: Deterministic load-test knowledge.\ntags: [scale, generated]\n---\n\n# Generated ${sequence}\n\nPortable test content.\n`, 'utf8')
    }))

    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Reload from disk' }).click()
    await page.getByRole('button', { name: 'Knowledge', exact: true }).click()
    await expect(page.locator('.library-footer')).toContainText('188 concepts')
    await page.getByPlaceholder('Filter concepts').fill('Generated scale concept 179')
    await expect(page.getByRole('button', { name: 'Generated scale concept 179' })).toBeVisible()

    await page.getByRole('button', { name: 'Graph', exact: true }).click()
    await expect(page.locator('.graph-node-svg')).toHaveCount(32)
    await page.getByPlaceholder('Find a node…').fill('Generated scale concept 179')
    await expect(page.locator('.graph-node-svg')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Inspect Generated scale concept 179' })).toBeVisible()
  })

  test('minimum supported window has no application-level horizontal overflow', async ({ knot }, testInfo) => {
    const page = knot.window
    await knot.application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.setSize(1120, 720)
    })
    await page.getByRole('button', { name: 'Sharing', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sharing center' })).toBeVisible()
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
    await testInfo.attach('minimum-window-sharing.png', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('long product surfaces are human-scrollable and aligned at the minimum supported window', async ({ knot }, testInfo) => {
    const page = knot.window
    await knot.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1120, 720))
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })
    for (const destination of ['Sharing', 'Cloud & MCP', 'Workflows', 'Web watch']) {
      await page.getByRole('button', { name: destination, exact: true }).click()
      await page.locator('.page').waitFor({ state: 'visible' })
      const content = page.locator('.content')
      const alignment = await content.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const visibleControls = [...element.querySelectorAll('button,input,select,textarea')].filter((candidate) => {
          const rect = candidate.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom
        })
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          escapedControls: visibleControls.filter((candidate) => {
            const rect = candidate.getBoundingClientRect()
            return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
          }).map((candidate) => `${candidate.tagName.toLowerCase()}:${candidate.getAttribute('aria-label') ?? candidate.textContent?.trim().slice(0, 40)}`)
        }
      })
      expect(alignment.scrollWidth).toBeLessThanOrEqual(alignment.clientWidth)
      expect(alignment.escapedControls).toEqual([])
      if (destination === 'Cloud & MCP') await testInfo.attach('minimum-window-cloud.png', { body: await page.screenshot(), contentType: 'image/png' })
      await expect.poll(() => content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
      await content.evaluate((element) => { element.scrollTop = 0; element.focus() })
      await content.hover()
      await page.mouse.wheel(0, 900)
      await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      await page.keyboard.press('End')
      await expect.poll(() => content.evaluate((element) => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThan(4)
    }
  })
})
