import { useEffect, useRef, useState } from 'react'
import { Command, FilePlus2, FolderOpen, Plus, Search, Sparkles } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from './ui/Button'
import { NewConceptDialog } from './NewConceptDialog'
import { NotificationCenter } from './NotificationCenter'
import { useAppStore } from '@/store'
import type { AppPage } from '@/store'

const pageNames: Record<AppPage, string> = {
  overview: 'Overview', library: 'Knowledge', graph: 'Knowledge graph', quality: 'Quality', sharing: 'Sharing',
  cloud: 'Cloud & MCP', workflows: 'Workflows', 'web-watch': 'Web watch',
  activity: 'Activity', assistant: 'Knot Assist', settings: 'Settings'
}

const quickNavigation: AppPage[] = [
  'overview', 'library', 'graph', 'quality', 'sharing', 'cloud', 'workflows', 'web-watch', 'activity', 'assistant', 'settings'
]

export function Topbar(): React.JSX.Element {
  const page = useAppStore((state) => state.page)
  const bundle = useAppStore((state) => state.bundle)
  const navigate = useAppStore((state) => state.navigate)
  const openWorkspace = useAppStore((state) => state.openWorkspace)
  const [newOpen, setNewOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const results = bundle?.documents.filter((document) => document.kind === 'concept' && `${document.title} ${document.description} ${document.type} ${document.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())).slice(0, 7) ?? []

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        window.setTimeout(() => searchRef.current?.focus(), 20)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setNewOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const chooseResult = (id: string): void => {
    useAppStore.getState().selectDocument(id)
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs"><span>{bundle?.name}</span><i>/</i><strong>{pageNames[page]}</strong></div>
        <button className="search-trigger" onClick={() => { setSearchOpen(true); window.setTimeout(() => searchRef.current?.focus(), 20) }}><Search size={16} /><span>Search knowledge…</span><kbd>⌘ K</kbd></button>
        <div className="topbar-actions">
          <NotificationCenter />
          <Button variant="ghost" size="icon" aria-label="Open assistant" onClick={() => navigate('assistant')}><Sparkles size={18} /></Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild><Button variant="primary"><Plus size={17} /> New</Button></DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content className="menu-content" align="end" sideOffset={8}>
              <DropdownMenu.Item onSelect={() => setNewOpen(true)}><FilePlus2 size={16} /> New concept <kbd>⌘N</kbd></DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => void openWorkspace()}><FolderOpen size={16} /> Open workspace</DropdownMenu.Item>
            </DropdownMenu.Content></DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      {searchOpen && <div className="command-overlay" onMouseDown={() => setSearchOpen(false)}>
        <div className="command-panel" onMouseDown={(event) => event.stopPropagation()}>
          <div className="command-input"><Search size={19} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, types, tags, and descriptions…" onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && results[0]) chooseResult(results[0].id) }} /><kbd>esc</kbd></div>
          <div className="command-results">
            <span className="command-label">{query ? `${results.length} results` : 'Quick navigation'}</span>
            {!query && <>{quickNavigation.map((item) => <button key={item} onClick={() => { navigate(item); setSearchOpen(false) }}><Command size={16} /><span>{pageNames[item]}</span><small>Go to page</small></button>)}</>}
            {query && results.map((document) => <button key={document.id} onClick={() => chooseResult(document.id)}><FilePlus2 size={16} /><span>{document.title}<em>{document.type}</em></span><small>{document.path}</small></button>)}
            {query && !results.length && <div className="command-empty">No knowledge matches “{query}”.</div>}
          </div>
        </div>
      </div>}
      <NewConceptDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  )
}
