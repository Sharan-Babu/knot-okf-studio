import axe from 'axe-core'
import { test, expect } from './fixtures'

test.describe('accessibility and desktop security', () => {
  test('all major application surfaces have no serious or critical axe violations', async ({ knot }) => {
    const page = knot.window
    const pages = ['Overview', 'Knowledge', 'Graph', 'Quality', 'Sharing', 'Cloud & MCP', 'Workflows', 'Web watch', 'Activity', 'Knot Assist', 'Settings']
    const violations: Array<{ theme: string; page: string; id: string; impact: string | null; nodes: number; targets: string[] }> = []
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })
    for (const theme of ['light', 'dark', 'system']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
      for (const destination of pages) {
        await page.getByRole('button', { name: destination, exact: true }).click()
        await page.waitForTimeout(70)
        await page.evaluate(axe.source)
        const result = await page.evaluate(async () => (window as any).axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
        }))
        violations.push(...result.violations
          .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
          .map((violation) => ({ theme, page: destination, id: violation.id, impact: violation.impact, nodes: violation.nodes.length, targets: violation.nodes.flatMap((node) => node.target).slice(0, 8) })))
      }
    }
    expect(violations).toEqual([])
  })

  test('keyboard shortcuts, dialog focus, and Escape dismissal are complete', async ({ knot }) => {
    const page = knot.window
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
    await expect(page.getByPlaceholder('Search titles, types, tags, and descriptions…')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder('Search titles, types, tags, and descriptions…')).toHaveCount(0)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+N' : 'Control+N')
    await expect(page.getByRole('dialog', { name: 'New knowledge concept' }).getByLabel('Title')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'New knowledge concept' })).toHaveCount(0)
  })

  test('renderer isolation, path containment, duplicate protection, and URL protocol allowlist hold', async ({ knot }) => {
    const page = knot.window
    expect(await page.evaluate(() => ({
      nodeProcess: typeof (window as any).process,
      nodeRequire: typeof (window as any).require,
      knot: typeof window.knot
    }))).toEqual({ nodeProcess: 'undefined', nodeRequire: 'undefined', knot: 'object' })

    const traversal = await page.evaluate(async () => {
      try {
        await window.knot.workspace.saveDocument({ path: '../escape.md', frontmatter: { type: 'Concept' }, body: 'blocked' })
        return 'unexpected success'
      } catch (error) { return String(error) }
    })
    expect(traversal).toContain('outside the active workspace')

    await page.evaluate(() => window.knot.workspace.createDocument({ title: 'Collision', filename: 'collision', type: 'Concept' }))
    const duplicate = await page.evaluate(async () => {
      try {
        await window.knot.workspace.createDocument({ title: 'Collision again', filename: 'collision', type: 'Concept' })
        return 'unexpected success'
      } catch (error) { return String(error) }
    })
    expect(duplicate).toContain('already exists')

    const protocol = await page.evaluate(async () => {
      try { await window.knot.shell.openExternal('file:///etc/passwd'); return 'unexpected success' }
      catch (error) { return String(error) }
    })
    expect(protocol).toContain('Only web links can be opened')
  })
})
