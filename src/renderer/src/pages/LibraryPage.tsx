import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, CircleEllipsis, Code2, ExternalLink, Eye, File, FileClock, FileText, Folder, Info, Link2, LockKeyhole, Pencil, Plus, Save, Search, Tag, UsersRound } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MarkdownView } from '@/components/MarkdownView'
import { NewConceptDialog } from '@/components/NewConceptDialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime, typeTone } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { BundleDocument, Visibility } from '@shared/types'

function DocumentTree({ documents, selectedId, onSelect }: { documents: BundleDocument[]; selectedId: string | null; onSelect: (id: string) => void }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const grouped = useMemo(() => {
    const map = new Map<string, BundleDocument[]>()
    for (const document of documents) {
      const [first, ...rest] = document.path.split('/')
      const group = rest.length ? first : 'Root'
      map.set(group, [...(map.get(group) ?? []), document])
    }
    return [...map.entries()].sort(([a], [b]) => a === 'Root' ? -1 : b === 'Root' ? 1 : a.localeCompare(b))
  }, [documents])

  return <div className="document-tree">{grouped.map(([group, items]) => <div key={group} className="tree-group">
    <button className="tree-folder" onClick={() => setCollapsed((value) => { const next = new Set(value); next.has(group) ? next.delete(group) : next.add(group); return next })}>
      {collapsed.has(group) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<Folder size={15} /><span>{group}</span><em>{items.length}</em>
    </button>
    {!collapsed.has(group) && items.map((document) => <button key={document.id} className={`tree-document ${selectedId === document.id ? 'is-selected' : ''}`} onClick={() => onSelect(document.id)} title={document.path}>
      {document.kind === 'index' ? <FileText size={15} /> : document.kind === 'log' ? <FileClock size={15} /> : <File size={15} />}<span>{document.title}</span>
      {document.visibility !== 'private' && <i className={`visibility-dot visibility-${document.visibility}`} />}
    </button>)}
  </div>)}</div>
}

function ReadView({ document }: { document: BundleDocument }): React.JSX.Element {
  const selectDocument = useAppStore((state) => state.selectDocument)
  const bundle = useAppStore((state) => state.bundle)!
  const backlinks = bundle.documents.filter((candidate) => candidate.outboundIds.includes(document.id))
  return <div className="reader-scroll">
    {document.description && <p className="document-lede">{document.description}</p>}
    <MarkdownView source={document.body} documentPath={document.path} />
    {(document.resource || document.tags.length > 0) && <div className="document-reference"><span className="panel-kicker">Reference details</span>{document.resource && <button onClick={() => void window.knot.shell.openExternal(document.resource!)}><ExternalLink size={15} />{document.resource}</button>}<div className="tag-row">{document.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}</div></div>}
    {backlinks.length > 0 && <div className="backlinks"><span className="panel-kicker"><Link2 size={14} /> Mentioned by</span>{backlinks.map((item) => <button key={item.id} onClick={() => selectDocument(item.id)}><span className={`doc-glyph tone-${typeTone(item.type)}`}><FileText size={15} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={15} /></button>)}</div>}
  </div>
}

function EditView({ document, onSaved }: { document: BundleDocument; onSaved: (bundle: Awaited<ReturnType<typeof window.knot.workspace.saveDocument>>) => void }): React.JSX.Element {
  const preferences = useAppStore((state) => state.preferences)
  const addToast = useAppStore((state) => state.addToast)
  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>(document.frontmatter)
  const [body, setBody] = useState(document.body)
  const [saving, setSaving] = useState(false)
  const dirty = body !== document.body || JSON.stringify(frontmatter) !== JSON.stringify(document.frontmatter)
  const reserved = document.kind !== 'concept'

  useEffect(() => { setFrontmatter(document.frontmatter); setBody(document.body) }, [document.id, document.raw])

  const update = (key: string, value: unknown): void => setFrontmatter((current) => ({ ...current, [key]: value }))
  const save = async (): Promise<void> => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      const nextFrontmatter = { ...frontmatter }
      if (preferences.autoTimestamp && document.kind === 'concept') nextFrontmatter.timestamp = new Date().toISOString()
      const bundle = await window.knot.workspace.saveDocument({ path: document.path, frontmatter: nextFrontmatter, body })
      onSaved(bundle)
      await useAppStore.getState().reloadWorkspaceState()
      addToast({ title: 'Saved', description: document.path, tone: 'success' })
    } catch (error) {
      addToast({ title: 'Save failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally { setSaving(false) }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return <div className="editor-layout">
    <div className="editor-pane">
      <div className="editor-toolbar"><span><Code2 size={15} /> Markdown</span><span className={dirty ? 'save-state dirty' : 'save-state'}>{dirty ? 'Unsaved changes' : <><Check size={14} /> Saved</>}</span><Button size="sm" variant="primary" disabled={!dirty || saving} onClick={() => void save()}><Save size={15} />{saving ? 'Saving…' : 'Save'}</Button></div>
      {!reserved && <div className="metadata-form">
        <div className="form-grid-2"><label className="field-label">Title<input value={String(frontmatter.title ?? '')} onChange={(event) => update('title', event.target.value)} /></label><label className="field-label">Type<input value={String(frontmatter.type ?? '')} onChange={(event) => update('type', event.target.value)} /></label></div>
        <label className="field-label">Description<textarea rows={2} value={String(frontmatter.description ?? '')} onChange={(event) => update('description', event.target.value)} /></label>
        <div className="form-grid-2"><label className="field-label">Tags<input value={Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : String(frontmatter.tags ?? '')} onChange={(event) => update('tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} placeholder="product, metric" /></label><label className="field-label">Canonical resource<input value={String(frontmatter.resource ?? '')} onChange={(event) => update('resource', event.target.value)} placeholder="https://…" /></label></div>
      </div>}
      {reserved && <div className="reserved-note"><Info size={16} /><span><strong>Reserved OKF document</strong>{document.kind === 'log' ? 'Use ISO date headings; frontmatter is intentionally disabled.' : 'Use headings and linked list entries for progressive disclosure.'}</span></div>}
      <textarea className="markdown-editor" spellCheck value={body} onChange={(event) => setBody(event.target.value)} aria-label="Markdown body" />
    </div>
    <div className="preview-pane"><div className="editor-toolbar"><span><Eye size={15} /> Live preview</span></div><div className="preview-scroll"><MarkdownView source={body} documentPath={document.path} /></div></div>
  </div>
}

function MetaView({ document }: { document: BundleDocument }): React.JSX.Element {
  return <div className="metadata-view">
    <div className="metadata-hero"><span className={`doc-glyph large tone-${typeTone(document.type || document.kind)}`}><Info size={22} /></span><div><span className="panel-kicker">Portable metadata</span><h3>{Object.keys(document.frontmatter).length} frontmatter fields</h3><p>Knot preserves producer-defined keys when this document is edited and saved.</p></div></div>
    <div className="metadata-table">{Object.entries(document.frontmatter).map(([key, value]) => <div key={key}><code>{key}</code><span>{Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>{['type', 'title', 'description', 'resource', 'tags', 'timestamp'].includes(key) ? <Badge>OKF</Badge> : <Badge className="badge-muted">Custom</Badge>}</div>)}</div>
    {document.kind === 'concept' && !document.frontmatter.type && <div className="inline-alert danger"><Info size={17} /><span><strong>Required field missing</strong>Add a non-empty type before distributing this bundle.</span></div>}
  </div>
}

export function LibraryPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const selectedId = useAppStore((state) => state.selectedId)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const replaceBundle = useAppStore((state) => state.replaceBundle)
  const savePolicy = useAppStore((state) => state.savePolicy)
  const addToast = useAppStore((state) => state.addToast)
  const policies = useAppStore((state) => state.workspaceState.policies)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('read')
  const [newOpen, setNewOpen] = useState(false)
  const selected = bundle.documents.find((document) => document.id === selectedId) ?? bundle.documents[0]
  const visibleDocs = bundle.documents.filter((document) => `${document.title} ${document.path} ${document.type}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => setTab('read'), [selected?.id])
  if (!selected) return <div className="empty-page"><FileText size={32} /><h2>No Markdown documents</h2><p>Create the first concept in this workspace.</p><Button variant="primary" onClick={() => setNewOpen(true)}>Create concept</Button></div>

  const changeVisibility = async (visibility: Visibility): Promise<void> => {
    try {
      const existing = policies.find((policy) => policy.documentId === selected.id)
      await savePolicy({
        documentId: selected.id,
        visibility,
        audienceIds: visibility === 'workspace' ? existing?.audienceIds.length ? existing.audienceIds : ['product'] : [],
        allowDownload: visibility !== 'private',
        updateMode: existing?.updateMode ?? 'review',
        updatedAt: new Date().toISOString(),
        lastSharedAt: existing?.lastSharedAt,
        lastSharedRevision: existing?.lastSharedRevision,
        lastAcknowledgedRevision: existing?.lastAcknowledgedRevision
      })
      addToast({ title: `Now ${visibility}`, description: selected.title, tone: 'success' })
    } catch (error) { addToast({ title: 'Sharing update failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
  }

  return <div className="library-page">
    <aside className="library-sidebar">
      <div className="library-title"><div><span className="panel-kicker">Bundle contents</span><h2>Knowledge</h2></div><Button size="icon" variant="ghost" onClick={() => setNewOpen(true)} aria-label="New concept"><Plus size={18} /></Button></div>
      <div className="tree-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter concepts" /></div>
      <DocumentTree documents={visibleDocs} selectedId={selected.id} onSelect={(id) => selectDocument(id, false)} />
      <div className="library-footer"><span>{bundle.stats.concepts} concepts</span><span>{formatNumber(bundle.stats.words)} words</span></div>
    </aside>
    <section className="document-stage">
      <div className="document-header">
        <div className="document-path"><span>{selected.path.split('/').slice(0, -1).join(' / ') || 'Bundle root'}</span><i>/</i><strong>{selected.filename}</strong></div>
        <div className="document-actions">
          <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button size="sm"><span className={`visibility-dot visibility-${selected.visibility}`} />{selected.visibility === 'private' ? 'Private' : selected.visibility === 'workspace' ? 'Workspace' : 'Public'}<ChevronDown size={14} /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="menu-content visibility-menu" align="end" sideOffset={7}>
            <DropdownMenu.Label>Who can access this concept?</DropdownMenu.Label>
            <DropdownMenu.Item onSelect={() => void changeVisibility('private')}><LockKeyhole size={16} /><span><strong>Private</strong><small>Only on this device</small></span>{selected.visibility === 'private' && <Check size={15} />}</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => void changeVisibility('workspace')}><UsersRound size={16} /><span><strong>Workspace</strong><small>Chosen teammates</small></span>{selected.visibility === 'workspace' && <Check size={15} />}</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => void changeVisibility('public')}><ExternalLink size={16} /><span><strong>Public</strong><small>Included in public exports</small></span>{selected.visibility === 'public' && <Check size={15} />}</DropdownMenu.Item>
          </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
          <Button size="icon" variant="ghost" aria-label={`More actions for ${selected.title}`}><CircleEllipsis size={18} /></Button>
        </div>
      </div>
      <div className="document-title-row"><div className={`doc-glyph document-icon tone-${typeTone(selected.type || selected.kind)}`}><FileText size={22} /></div><div><div className="title-badges"><Badge className={`type-badge tone-${typeTone(selected.type || selected.kind)}`}>{selected.type || selected.kind}</Badge>{selected.timestamp && <span>Updated {formatRelativeTime(selected.modifiedAt)}</span>}</div><h1>{selected.title}</h1></div></div>
      <Tabs.Root value={tab} onValueChange={setTab} className="document-tabs">
        <Tabs.List><Tabs.Trigger value="read"><Eye size={15} /> Read</Tabs.Trigger><Tabs.Trigger value="edit"><Pencil size={15} /> Edit</Tabs.Trigger><Tabs.Trigger value="metadata"><Tag size={15} /> Metadata</Tabs.Trigger></Tabs.List>
        <Tabs.Content value="read"><ReadView document={selected} /></Tabs.Content>
        <Tabs.Content value="edit"><EditView document={selected} onSaved={replaceBundle} /></Tabs.Content>
        <Tabs.Content value="metadata"><MetaView document={selected} /></Tabs.Content>
      </Tabs.Root>
    </section>
    <NewConceptDialog open={newOpen} onOpenChange={setNewOpen} />
  </div>
}

function formatNumber(value: number): string { return new Intl.NumberFormat().format(value) }
