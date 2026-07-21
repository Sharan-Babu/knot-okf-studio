import { useMemo, type MouseEvent } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { resolveDocumentLink } from '@/lib/utils'
import { useAppStore } from '@/store'

export function MarkdownView({ source, documentPath, compact = false }: { source: string; documentPath: string; compact?: boolean }): React.JSX.Element {
  const html = useMemo(() => renderMarkdown(source), [source])
  const selectDocument = useAppStore((state) => state.selectDocument)
  const bundle = useAppStore((state) => state.bundle)

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href') ?? ''
    if (/^https?:\/\//i.test(href)) {
      event.preventDefault()
      void window.knot.shell.openExternal(href)
      return
    }
    const targetId = resolveDocumentLink(documentPath, href)
    if (targetId && bundle?.documents.some((document) => document.id === targetId)) {
      event.preventDefault()
      selectDocument(targetId)
    }
  }

  return <div className={`markdown ${compact ? 'markdown-compact' : ''}`} onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
}
