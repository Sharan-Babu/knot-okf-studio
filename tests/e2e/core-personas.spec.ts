import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect, getBundle, restartSession } from './fixtures'

test.describe('core desktop personas', () => {
  test('newcomer can traverse every primary workflow, search, and use the graph by keyboard', async ({ knot }) => {
    const page = knot.window
    await expect(page.getByText('OKF conformant')).toBeVisible()

    const destinations: Array<[string, RegExp]> = [
      ['Knowledge', /^Knowledge$/],
      ['Graph', /^Knowledge graph$/],
      ['Quality', /^Quality & conformance$/],
      ['Sharing', /^Sharing center$/],
      ['Cloud & MCP', /^Put selected knowledge where it can stay useful$/],
      ['Workflows', /^Turn documents into reviewed knowledge$/],
      ['Web watch', /^Turn relevant change into reviewed knowledge$/],
      ['Activity', /^Workspace activity$/],
      ['Knot Assist', /^Knot Assist$/],
      ['Settings', /^Settings$/],
      ['Overview', /Good (morning|afternoon|evening)/]
    ]
    for (const [label, heading] of destinations) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
    }

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
    const search = page.getByPlaceholder('Search titles, types, tags, and descriptions…')
    await expect(search).toBeFocused()
    for (const label of ['Overview', 'Knowledge', 'Knowledge graph', 'Quality', 'Sharing', 'Cloud & MCP', 'Workflows', 'Web watch', 'Activity', 'Knot Assist', 'Settings']) {
      await expect(page.locator('.command-results').getByRole('button', { name: `${label} Go to page`, exact: true })).toBeVisible()
    }
    await search.fill('Aurora Health')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Aurora Health', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Graph', exact: true }).click()
    await page.getByRole('button', { name: 'Inspect Project Atlas' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.graph-inspector').getByRole('heading', { name: 'Project Atlas' })).toBeVisible()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(page.locator('.zoom-control')).toContainText('110%')
    await page.getByRole('button', { name: 'Reset zoom' }).click()
    await expect(page.locator('.zoom-control')).toContainText('100%')
  })

  test('knowledge author creates private and recipient-scoped concepts at the point of entry', async ({ knot }) => {
    const page = knot.window
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+N' : 'Control+N')
    let dialog = page.getByRole('dialog', { name: 'New knowledge concept' })
    await dialog.getByLabel('Title').fill('Private pricing hypothesis')
    await dialog.getByLabel('One-line description').fill('Sensitive hypothesis before internal review.')
    await expect(dialog.getByRole('button', { name: 'Private' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('button', { name: 'Create concept' }).click()
    await expect(page.getByRole('heading', { name: 'Private pricing hypothesis' })).toBeVisible()

    let bundle = await getBundle(page)
    expect(bundle.documents.find((document: any) => document.id === 'private-pricing-hypothesis')?.visibility).toBe('private')

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+N' : 'Control+N')
    dialog = page.getByRole('dialog', { name: 'New knowledge concept' })
    await dialog.getByLabel('Title').fill('Launch decision record')
    await dialog.getByLabel('Type').fill('Decision')
    await dialog.getByRole('button', { name: 'Workspace' }).click()
    await dialog.getByRole('button', { name: /Leadership/ }).click()
    await dialog.getByRole('button', { name: /Maya Chen/ }).click()
    await dialog.getByLabel('When this concept changes').selectOption('auto-prepare')
    await dialog.getByRole('button', { name: 'Create concept' }).click()
    await expect(page.getByRole('heading', { name: 'Launch decision record' })).toBeVisible()

    bundle = await getBundle(page)
    const policy = (await page.evaluate(() => window.knot.sharing.getState())).policies.find((item: any) => item.documentId === 'launch-decision-record')
    expect(bundle.documents.find((document: any) => document.id === 'launch-decision-record')?.visibility).toBe('workspace')
    expect(policy).toMatchObject({ visibility: 'workspace', updateMode: 'auto-prepare' })
    expect(policy.audienceIds.sort()).toEqual(['leadership', 'maya'])
  })

  test('editor preserves custom OKF metadata, edits reserved files safely, and persists after restart', async ({ knot }) => {
    let page = knot.window
    await page.getByRole('button', { name: 'Knowledge', exact: true }).click()
    await page.getByRole('button', { name: 'Weekly Activated Teams' }).click()
    await page.getByRole('tab', { name: 'Edit' }).click()
    await page.getByLabel('Markdown body').fill('# Verification\n\nDesktop editing works and preserves producer metadata.')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.toast').getByText('Saved', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Metadata' }).click()
    await expect(page.locator('.metadata-table')).toContainText('owner')
    await expect(page.locator('.metadata-table')).toContainText('Growth & Insights')
    await expect(page.locator('.metadata-table')).toContainText('certified')

    await page.getByRole('button', { name: 'Log', exact: true }).click()
    await page.getByRole('tab', { name: 'Edit' }).click()
    await expect(page.getByText('Reserved OKF document')).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveCount(0)

    await restartSession(knot)
    page = knot.window
    await page.getByRole('button', { name: 'Knowledge', exact: true }).click()
    await page.getByRole('button', { name: 'Weekly Activated Teams' }).click()
    await expect(page.getByRole('heading', { name: 'Verification' })).toBeVisible()
  })

  test('quality steward detects an invalid disk edit and verifies its repair', async ({ knot }) => {
    const page = knot.window
    const bundle = await getBundle(page)
    await writeFile(path.join(bundle.rootPath, 'broken-concept.md'), '# Missing frontmatter\n', 'utf8')

    await page.getByRole('button', { name: 'Quality', exact: true }).click()
    await page.getByRole('button', { name: 'Run checks' }).click()
    await expect(page.getByText('Conformance blocked')).toBeVisible()
    await expect(page.getByText('broken-concept.md · missing-frontmatter')).toBeVisible()

    await page.evaluate(() => window.knot.workspace.saveDocument({
      path: 'broken-concept.md',
      frontmatter: { type: 'Concept', title: 'Repaired concept', description: 'Now portable.' },
      body: '# Repaired\n\nValid OKF again.'
    }))
    await page.getByRole('button', { name: 'Run checks' }).click()
    await expect(page.getByText('Conformant bundle')).toBeVisible()
    await expect(page.getByText('broken-concept.md · missing-frontmatter')).toHaveCount(0)
  })

  test('power user preferences persist and compact navigation remains operable', async ({ knot }) => {
    let page = knot.window
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Dark' }).click()
    await page.getByRole('switch', { name: 'Compact navigation' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.sidebar')).toHaveClass(/sidebar-compact/)
    await page.getByRole('button', { name: 'Overview' }).click()
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()

    await restartSession(knot)
    page = knot.window
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.sidebar')).toHaveClass(/sidebar-compact/)
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('switch', { name: 'Compact navigation' })).toHaveAttribute('data-state', 'checked')
  })
})
