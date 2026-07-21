import { useMemo, useState } from 'react'
import { Archive, BellRing, Check, CheckCircle2, ChevronDown, Clock3, Download, Eye, EyeOff, FileText, Globe2, History, LockKeyhole, PackageCheck, Search, ShieldCheck, UsersRound, Zap } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Switch from '@radix-ui/react-switch'
import { audiences } from '@/lib/audiences'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime, typeTone } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ShareUpdateMode, Visibility } from '@shared/types'

const visibilityData = {
  private: { label: 'Private', icon: LockKeyhole, detail: 'Only this device' },
  workspace: { label: 'Workspace', icon: UsersRound, detail: 'Marked for named recipients' },
  public: { label: 'Public', icon: Globe2, detail: 'Anyone with export' }
}

export function SharingPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const savePolicy = useAppStore((state) => state.savePolicy)
  const addToast = useAppStore((state) => state.addToast)
  const workspaceState = useAppStore((state) => state.workspaceState)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(bundle.documents.filter((document) => document.kind === 'concept' && document.visibility !== 'private').map((document) => document.id)))
  const [packageName, setPackageName] = useState('Atlas collaboration brief')
  const [packageVisibility, setPackageVisibility] = useState<Visibility>('workspace')
  const [selectedAudiences, setSelectedAudiences] = useState<Set<string>>(new Set())
  const [includeDependencies, setIncludeDependencies] = useState(true)
  const [allowDownload, setAllowDownload] = useState(true)
  const [busy, setBusy] = useState(false)
  const documents = bundle.documents.filter((document) => document.kind === 'concept' && `${document.title} ${document.type} ${document.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const counts = useMemo(() => ({ private: bundle.documents.filter((document) => document.kind === 'concept' && document.visibility === 'private').length, workspace: bundle.documents.filter((document) => document.visibility === 'workspace').length, public: bundle.documents.filter((document) => document.visibility === 'public').length }), [bundle.documents])
  const pendingUpdates = workspaceState.notifications.filter((notification) => !notification.resolvedAt)
  const blockedExport = useMemo(() => {
    const included = new Set(selected)
    if (includeDependencies) {
      const byId = new Map(bundle.documents.map((document) => [document.id, document]))
      const queue = [...included]
      while (queue.length) {
        for (const target of byId.get(queue.shift()!)?.outboundIds ?? []) {
          if (byId.has(target) && !included.has(target)) { included.add(target); queue.push(target) }
        }
      }
    }
    const rank = { private: 0, workspace: 1, public: 2 }
    const required = rank[packageVisibility]
    return bundle.documents.filter((document) => document.kind === 'concept' && included.has(document.id) && rank[document.visibility] < required)
  }, [bundle.documents, includeDependencies, packageVisibility, selected])

  const updateVisibility = async (documentId: string, visibility: Visibility): Promise<void> => {
    try {
      const document = bundle.documents.find((item) => item.id === documentId)
      if (visibility === 'workspace' && !selectedAudiences.size) {
        addToast({ title: 'Choose an audience first', description: 'Use the export composer to select the intended people or groups, then mark this concept for workspace sharing.', tone: 'danger' })
        return
      }
      if (visibility === 'workspace') {
        const names = [...selectedAudiences].map((id) => audiences.find((audience) => audience.id === id)?.name ?? id).join(', ')
        if (!confirm(`Mark “${document?.title ?? documentId}” for sharing with ${names}? Nothing is sent until you export or publish.`)) return
      }
      if (visibility === 'public' && !confirm(`Mark “${document?.title ?? documentId}” as eligible for public publication? Nothing is sent yet.`)) return
      const existing = workspaceState.policies.find((policy) => policy.documentId === documentId)
      await savePolicy({ documentId, visibility, audienceIds: visibility === 'workspace' ? [...selectedAudiences] : [], allowDownload, updateMode: existing?.updateMode ?? 'review', updatedAt: new Date().toISOString(), lastSharedAt: existing?.lastSharedAt, lastSharedRevision: existing?.lastSharedRevision, lastAcknowledgedRevision: existing?.lastAcknowledgedRevision })
      addToast({ title: `Visibility changed to ${visibility}`, tone: 'success' })
    } catch (error) { addToast({ title: 'Could not update visibility', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
  }
  const toggleSelected = (id: string): void => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const updateMode = async (documentId: string, mode: ShareUpdateMode): Promise<void> => {
    const policy = workspaceState.policies.find((item) => item.documentId === documentId)
    if (!policy) return
    await savePolicy({ ...policy, updateMode: mode, updatedAt: new Date().toISOString() })
    addToast({ title: mode === 'review' ? 'Updates require review' : 'Future updates will be auto-prepared', tone: 'success' })
  }
  const exportPackage = async (): Promise<void> => {
    if (!selected.size) return
    if (blockedExport.length) {
      addToast({ title: 'Sharing intent blocks this export', description: `${blockedExport.slice(0, 3).map((document) => document.title).join(', ')}${blockedExport.length > 3 ? ` and ${blockedExport.length - 3} more` : ''} must be marked for ${packageVisibility} sharing first.`, tone: 'danger' })
      return
    }
    if (packageVisibility === 'workspace' && !selectedAudiences.size) {
      addToast({ title: 'Choose at least one audience', tone: 'danger' })
      return
    }
    setBusy(true)
    try {
      const result = await window.knot.sharing.export({ documentIds: [...selected], name: packageName, visibility: packageVisibility, audienceIds: [...selectedAudiences], includeDependencies, allowDownload })
      if (!result.canceled) {
        await useAppStore.getState().reloadWorkspaceState()
        useAppStore.getState().replaceBundle(await window.knot.workspace.refresh())
        addToast({ title: 'Share package exported', description: `${result.count} concepts written to ${result.path}`, tone: 'success' })
      }
    } catch (error) { addToast({ title: 'Export failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
    finally { setBusy(false) }
  }
  const publishUpdate = async (notificationId: string): Promise<void> => {
    const notification = pendingUpdates.find((item) => item.id === notificationId)
    if (!notification) return
    const policy = workspaceState.policies.find((item) => item.documentId === notification.documentId)
    const document = bundle.documents.find((item) => item.id === notification.documentId)
    if (!policy || !document) return
    setBusy(true)
    try {
      const result = await window.knot.sharing.export({ documentIds: [document.id], name: `${document.title} update`, visibility: policy.visibility, audienceIds: policy.audienceIds, includeDependencies: false, allowDownload: policy.allowDownload })
      if (!result.canceled) {
        await useAppStore.getState().reloadWorkspaceState()
        useAppStore.getState().replaceBundle(await window.knot.workspace.refresh())
        addToast({ title: 'Update package exported', description: `The share ledger now records ${document.title} as current.`, tone: 'success' })
      }
    } catch (error) { addToast({ title: 'Update export failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
    finally { setBusy(false) }
  }
  const keepPrivate = async (notificationId: string): Promise<void> => {
    try {
      await useAppStore.getState().keepUpdatePrivate(notificationId)
      addToast({ title: 'Update kept private', description: 'Recipients remain on the previously shared revision.', tone: 'success' })
    } catch (error) { addToast({ title: 'Could not resolve update', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
  }

  return <div className="page sharing-page">
    <section className="page-heading"><div><span className="eyebrow"><ShieldCheck size={14} /> Privacy by default</span><h1>Sharing center</h1><p>Choose exactly what leaves your device, then inspect and export a portable package.</p></div><Button variant="primary" disabled={!selected.size || blockedExport.length > 0 || (packageVisibility === 'workspace' && !selectedAudiences.size)} onClick={() => void exportPackage()}><PackageCheck size={17} /> Export {selected.size || ''} selected</Button></section>
    <section className="privacy-overview">{(['private', 'workspace', 'public'] as const).map((visibility) => { const item = visibilityData[visibility]; return <article key={visibility}><span className={`privacy-icon ${visibility}`}><item.icon size={19} /></span><div><strong>{counts[visibility]}</strong><span>{item.label}</span><small>{item.detail}</small></div></article> })}<div className="privacy-principle"><ShieldCheck size={21} /><span><strong>Local policy, clean source</strong><small>Knot never writes recipients or access rules into your Markdown bundle.</small></span></div></section>
    <section className="share-intelligence-grid">
      <article className="panel updates-panel">
        <div className="panel-heading"><div><span className="panel-kicker"><BellRing size={13} /> Update queue</span><h2>{pendingUpdates.length ? `${pendingUpdates.length} shared ${pendingUpdates.length === 1 ? 'concept changed' : 'concepts changed'}` : 'Every shared concept is current'}</h2></div>{pendingUpdates.length ? <Badge className="badge-warning">{pendingUpdates.filter((item) => !item.readAt).length} new</Badge> : <Badge className="badge-success"><CheckCircle2 size={13} /> Current</Badge>}</div>
        <p className="updates-explainer">Knot compares the current file revision with the last exported revision, so you always know who may have stale information.</p>
        <div className="update-queue">{pendingUpdates.slice(0, 4).map((notification) => {
          const policy = workspaceState.policies.find((item) => item.documentId === notification.documentId)
          const audienceNames = notification.audienceIds.map((id) => audiences.find((audience) => audience.id === id)?.name ?? id)
          return <div className={`update-card ${notification.readAt ? '' : 'is-unread'}`} key={notification.id}>
            <span className="notification-icon"><BellRing size={16} /></span><span><strong>{notification.documentTitle}</strong><small>{audienceNames.length ? `Shared with ${audienceNames.join(', ')}` : policy?.visibility === 'public' ? 'Public share' : 'Shared export'} · changed {formatRelativeTime(notification.detectedAt)}</small><em>{notification.updateMode === 'auto-prepare' ? <><Zap size={12} /> Auto-prepare</> : <><Eye size={12} /> Review first</>}</em></span>
            <div><Button size="sm" onClick={() => void keepPrivate(notification.id)}><EyeOff size={14} /> Keep private</Button><Button size="sm" variant="primary" disabled={busy} onClick={() => void publishUpdate(notification.id)}><PackageCheck size={14} /> Export update</Button></div>
          </div>
        })}{!pendingUpdates.length && <div className="updates-empty"><CheckCircle2 size={23} /><span><strong>No recipients are behind</strong><small>Editing a previously exported concept will create an item here.</small></span></div>}</div>
      </article>
      <article className="panel ledger-panel">
        <div className="panel-heading"><div><span className="panel-kicker"><History size={13} /> Share ledger</span><h2>What left your device</h2></div><Badge>{workspaceState.deliveries.length} publications</Badge></div>
        <div className="delivery-list">{workspaceState.deliveries.slice(0, 4).map((delivery) => <div key={delivery.id}><span className="delivery-icon"><Archive size={15} /></span><span><strong>{delivery.name}</strong><small>{delivery.documentIds.length} concepts · {delivery.channel === 'synced-folder' ? 'synced folder' : delivery.channel === 'self-host' ? 'self-host kit' : 'ZIP package'} · {delivery.audienceIds.length ? delivery.audienceIds.map((id) => audiences.find((audience) => audience.id === id)?.name ?? id).join(', ') : delivery.visibility}</small><time><Clock3 size={12} /> {formatRelativeTime(delivery.exportedAt)}</time></span></div>)}{!workspaceState.deliveries.length && <div className="ledger-empty"><Archive size={20} /><span><strong>No publications yet</strong><small>Your first package or destination will establish the shared revision baseline.</small></span></div>}</div>
      </article>
    </section>
    <div className="sharing-layout">
      <section className="panel access-table-panel">
        <div className="panel-heading"><div><span className="panel-kicker">Concept access</span><h2>Select and classify</h2></div><div className="table-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter concepts" /></div></div>
        <div className="access-table">
          <div className="access-row access-header"><span><input aria-label="Select all concepts" type="checkbox" checked={selected.size === documents.length && documents.length > 0} onChange={() => setSelected(selected.size === documents.length ? new Set() : new Set(documents.map((document) => document.id)))} /></span><span>Concept</span><span>Access</span><span>Audience</span></div>
          {documents.map((document) => { const data = visibilityData[document.visibility]; const policy = workspaceState.policies.find((item) => item.documentId === document.id); return <div className="access-row" key={document.id}>
            <span><input aria-label={`Select ${document.title}`} type="checkbox" checked={selected.has(document.id)} onChange={() => toggleSelected(document.id)} /></span>
            <span className="access-concept"><span className={`doc-glyph tone-${typeTone(document.type)}`}><FileText size={16} /></span><span><strong>{document.title}</strong><small>{document.type} · {document.path}</small></span></span>
            <span><DropdownMenu.Root><DropdownMenu.Trigger className={`visibility-trigger visibility-${document.visibility}`}><data.icon size={15} />{data.label}<ChevronDown size={13} /></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>{(['private','workspace','public'] as const).map((visibility) => { const option = visibilityData[visibility]; return <DropdownMenu.Item key={visibility} onSelect={() => void updateVisibility(document.id, visibility)}><option.icon size={15} /><span>{option.label}<small>{option.detail}</small></span>{document.visibility === visibility && <Check size={14} />}</DropdownMenu.Item> })}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></span>
            <span className="audience-stack">{document.visibility === 'private' ? <small>Just you</small> : <>{document.visibility === 'public' ? <small>Open export</small> : <>{(policy?.audienceIds ?? []).slice(0,3).map((id) => { const person = audiences.find((item) => item.id === id); return person && <Avatar key={id} name={person.name} color={person.color} size="sm" /> })}<small>{policy?.audienceIds.length ?? 0} audience</small></>} {policy?.lastSharedAt && <DropdownMenu.Root><DropdownMenu.Trigger className="update-mode-trigger" aria-label={`Update mode for ${document.title}`}>{policy.updateMode === 'auto-prepare' ? <Zap size={12} /> : <Eye size={12} />}</DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="menu-content" align="end" sideOffset={5}><DropdownMenu.Label>When this concept changes</DropdownMenu.Label><DropdownMenu.Item onSelect={() => void updateMode(document.id, 'review')}><Eye size={15} /><span><strong>Review first</strong><small>Notify me before redistributing</small></span>{policy.updateMode === 'review' && <Check size={14} />}</DropdownMenu.Item><DropdownMenu.Item onSelect={() => void updateMode(document.id, 'auto-prepare')}><Zap size={15} /><span><strong>Auto-prepare</strong><small>Queue the next update automatically</small></span>{policy.updateMode === 'auto-prepare' && <Check size={14} />}</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>}</>}</span>
          </div>})}
        </div>
      </section>
      <aside className="panel publish-panel">
        <div className="publish-icon"><Archive size={22} /></div><span className="panel-kicker">Export composer</span><h2>Package preview</h2><p>Create a ZIP that contains only the selected OKF concepts, a generated index, and a transparent JSON manifest.</p>
        <label className="field-label">Package name<input value={packageName} onChange={(event) => setPackageName(event.target.value)} /></label>
        <div className="visibility-segments">{(['private','workspace','public'] as const).map((visibility) => { const item = visibilityData[visibility]; return <button key={visibility} aria-pressed={packageVisibility === visibility} className={packageVisibility === visibility ? 'active' : ''} onClick={() => setPackageVisibility(visibility)}><item.icon size={15} />{item.label}</button> })}</div>
        {packageVisibility === 'workspace' && <div className="audience-picker"><span className="field-label">People and groups</span>{audiences.map((audience) => <button key={audience.id} aria-pressed={selectedAudiences.has(audience.id)} className={selectedAudiences.has(audience.id) ? 'selected' : ''} onClick={() => setSelectedAudiences((current) => { const next = new Set(current); next.has(audience.id) ? next.delete(audience.id) : next.add(audience.id); return next })}><Avatar name={audience.name} color={audience.color} size="sm" /><span><strong>{audience.name}</strong><small>{audience.detail}</small></span>{selectedAudiences.has(audience.id) && <Check size={15} />}</button>)}</div>}
        <div className="switch-row"><span><strong>Include linked dependencies</strong><small>Follow internal links into the package</small></span><Switch.Root aria-label="Include linked dependencies" checked={includeDependencies} onCheckedChange={setIncludeDependencies} className="switch"><Switch.Thumb /></Switch.Root></div>
        <div className="switch-row"><span><strong>Allow recipients to download</strong><small>Recorded in the share manifest</small></span><Switch.Root aria-label="Allow recipients to download" checked={allowDownload} onCheckedChange={setAllowDownload} className="switch"><Switch.Thumb /></Switch.Root></div>
        <div className="package-summary"><div><Eye size={16} /><span><strong>{selected.size} selected concepts</strong><small>{includeDependencies ? 'Linked concepts will be included' : 'No linked concepts added'}</small></span></div><Badge className="badge-success">OKF v{bundle.version}</Badge></div>
        {blockedExport.length > 0 && <div className="capability-disclosure"><LockKeyhole size={15} /><span><strong>{blockedExport.length} concept{blockedExport.length === 1 ? '' : 's'} need broader sharing intent</strong><small>Classification also applies to linked dependencies. Update them in the table before export.</small></span></div>}
        <Button variant="primary" size="lg" disabled={!selected.size || !packageName || blockedExport.length > 0 || (packageVisibility === 'workspace' && !selectedAudiences.size) || busy} onClick={() => void exportPackage()}>{busy ? 'Building package…' : <><Download size={17} /> Review & export</>}</Button>
      </aside>
    </div>
  </div>
}
