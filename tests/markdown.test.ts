import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/renderer/src/lib/markdown'
import { resolveDocumentLink } from '../src/renderer/src/lib/utils'

describe('safe Markdown presentation', () => {
  it('does not render embedded HTML', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('marks external links for a separate browser context', () => {
    const html = renderMarkdown('[Spec](https://example.com/spec)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  it('resolves reader links to concept ids', () => {
    expect(resolveDocumentLink('product/metric.md', '../data/accounts.md')).toBe('data/accounts')
    expect(resolveDocumentLink('product/metric.md', '/people/maya.md')).toBe('people/maya')
    expect(resolveDocumentLink('product/metric.md', 'https://example.com')).toBeNull()
  })
})
