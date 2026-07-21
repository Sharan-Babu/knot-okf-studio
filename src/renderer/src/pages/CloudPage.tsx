import { useEffect, useMemo, useState } from 'react'
import {
  Bot, Check, Cloud, CloudCog, Copy, ExternalLink, FolderSync, Globe2, HardDriveUpload, KeyRound, Link2,
  LoaderCircle, LockKeyhole, Pause, Play, RefreshCw, Search, Server, ShieldCheck, Trash2, UsersRound
} from 'lucide-react'
import * as Switch from '@radix-ui/react-switch'
import { audiences } from '@/lib/audiences'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import type { CloudDashboard, McpIntegrationInfo } from '@shared/types'

export function CloudPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const addToast = useAppStore((state) => state.addToast)
  const navigate = useAppStore((state) => state.navigate)
  const [dashboard, setDashboard] = useState<CloudDashboard | null>(null)
  const [mcp, setMcp] = useState<McpIntegrationInfo | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [name, setName] = useState(`${bundle.name} knowledge portal`)
  const [visibility, setVisibility] = useState<'workspace' | 'public'>('workspace')
  const [audienceIds, setAudienceIds] = useState<Set<string>>(new Set(['product']))
  const [documentIds, setDocumentIds] = useState<Set<string>>(new Set())
  const [includeDependencies, setIncludeDependencies] = useState(true)
  const [allowDownload, setAllowDownload] = useState(false)
  const [documentQuery, setDocumentQuery] = useState('')
  const [syncedProvider, setSyncedProvider] = useState<'google-drive' | 'dropbox' | 'box' | 'other'>('google-drive')
  const [autoStopMinutes, setAutoStopMinutes] = useState(15)
  const [busy, setBusy] = useState('')

  const load = async (): Promise<void> => {
    const [cloud, integration] = await Promise.all([window.knot.cloud.getDashboard(), window.knot.mcp.getIntegrationInfo()])
    setDashboard(cloud)
    setMcp(integration)
    setAutoStopMinutes(cloud.cloud.autoStopMinutes)
  }
  useEffect(() => { void load().catch((error) => addToast({ title: 'Could not load cloud settings', description: String(error), tone: 'danger' })) }, [])

  const concepts = useMemo(() => bundle.documents.filter((item) => item.kind === 'concept'), [bundle.documents])
  const visibleConcepts = useMemo(() => concepts.filter((document) => `${document.title} ${document.type} ${document.tags.join(' ')} ${document.path}`.toLowerCase().includes(documentQuery.toLowerCase())), [concepts, documentQuery])
  const blockedForPublish = useMemo(() => {
    const selected = new Set(documentIds)
    if (includeDependencies) {
      const byId = new Map(bundle.documents.map((document) => [document.id, document]))
      const queue = [...selected]
      while (queue.length) {
        for (const target of byId.get(queue.shift()!)?.outboundIds ?? []) {
          if (byId.has(target) && !selected.has(target)) { selected.add(target); queue.push(target) }
        }
      }
    }
    const required = visibility === 'public' ? 2 : 1
    const rank = { private: 0, workspace: 1, public: 2 }
    return bundle.documents.filter((document) => selected.has(document.id) && rank[document.visibility] < required)
  }, [bundle.documents, documentIds, includeDependencies, visibility])
  const act = async (label: string, operation: () => Promise<CloudDashboard>, success: string): Promise<void> => {
    setBusy(label)
    try {
      const next = await operation()
      setDashboard(next)
      await useAppStore.getState().reloadWorkspaceState()
      addToast({ title: success, description: next.cloud.lastError, tone: next.cloud.runtime === 'error' ? 'danger' : 'success' })
    } catch (error) { addToast({ title: `${success} failed`, description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
    finally { setBusy('') }
  }
  const copy = async (text: string, label: string): Promise<void> => {
    await window.knot.shell.copyText(text)
    addToast({ title: `${label} copied`, tone: 'success' })
  }
  const saveKey = async (): Promise<void> => {
    setBusy('key')
    try {
      const credential = await window.knot.cloud.saveApiKey(apiKey)
      setApiKey('')
      setDashboard((current) => current ? { ...current, credential } : current)
      addToast({ title: 'Daytona key secured', description: credential.detail, tone: 'success' })
    } catch (error) { addToast({ title: 'Could not save key', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
    finally { setBusy('') }
  }
  const testConnection = async (): Promise<void> => {
    setBusy('test')
    try {
      const credential = await window.knot.cloud.testConnection()
      setDashboard((current) => current ? { ...current, credential } : current)
      addToast({ title: 'Daytona connected', description: credential.detail, tone: 'success' })
    } catch (error) { addToast({ title: 'Connection failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
    finally { setBusy('') }
  }
  const publish = (): Promise<void> => {
    if (visibility === 'public' && !confirm(`Publish ${documentIds.size} selected concept${documentIds.size === 1 ? '' : 's'} to anyone on the internet? Linked dependencies may also be included. Review the selection before continuing.`)) return Promise.resolve()
    return act('publish', () => window.knot.cloud.publish({
    name,
    documentIds: [...documentIds],
    visibility,
    audienceIds: visibility === 'workspace' ? [...audienceIds] : [],
    includeDependencies,
    allowDownload,
    autoStopMinutes
    }), 'Cloud share published')
  }
  const publishAvailability = async (target: 'synced-folder' | 'self-host'): Promise<void> => {
    const destination = target === 'synced-folder' ? 'a durable synced folder' : 'a self-host deployment kit'
    if (visibility === 'public' && !confirm(`Export ${documentIds.size} selected concept${documentIds.size === 1 ? '' : 's'} for public access as ${destination}? Review the selection before continuing.`)) return
    setBusy(target)
    try {
      const result = await window.knot.cloud.exportAvailability({
        target,
        provider: target === 'synced-folder' ? syncedProvider : undefined,
        name,
        documentIds: [...documentIds],
        visibility,
        audienceIds: visibility === 'workspace' ? [...audienceIds] : [],
        includeDependencies,
        allowDownload
      })
      if (!result.canceled) addToast({
        title: target === 'synced-folder' ? 'Durable folder is ready' : 'Self-host kit is ready',
        description: `${result.count} concepts · release ${result.revision} · ${result.path}`,
        tone: 'success'
      })
    } catch (error) {
      addToast({ title: 'Could not prepare destination', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally { setBusy('') }
  }

  if (!dashboard || !mcp) return <div className="page-loading"><LoaderCircle className="spin" size={19} /> Loading cloud and agent access…</div>
  const runtimeTone = dashboard.cloud.runtime === 'online' ? 'badge-success' : dashboard.cloud.runtime === 'error' ? 'badge-error' : dashboard.credential.configured ? '' : 'badge-warning'
  const runtimeLabel = dashboard.cloud.runtime === 'online' ? 'Online'
    : dashboard.cloud.runtime === 'starting' ? 'Starting'
      : dashboard.cloud.runtime === 'stopped' ? 'Stopped'
        : dashboard.cloud.runtime === 'error' ? 'Needs attention'
          : dashboard.credential.configured ? 'Ready to publish' : 'Setup needed'

  return <div className="page cloud-page" data-testid="cloud-page">
    <section className="page-heading"><div><span className="eyebrow"><Cloud size={14} /> Availability & agents</span><h1>Put selected knowledge where it can stay useful</h1><p>Choose durable file delivery, your own host, or an on-demand Daytona portal and MCP server.</p></div><div className="heading-actions"><Badge className={runtimeTone}>{runtimeLabel}</Badge>{dashboard.cloud.runtime === 'online' ? <Button onClick={() => void act('stop', () => window.knot.cloud.stop(), 'Cloud sandbox stopped')} disabled={Boolean(busy)}><Pause size={16} /> Stop usage</Button> : dashboard.cloud.shares.length ? <Button variant="primary" onClick={() => void act('start', () => window.knot.cloud.start(), 'Cloud sandbox started')} disabled={Boolean(busy)}><Play size={16} /> Start sandbox</Button> : null}</div></section>

    <section className="cloud-status-grid panel" aria-label="Daytona status">
      <article className="cloud-status-card"><span className="cloud-status-icon"><KeyRound size={20} /></span><div><small>Credential vault</small><strong>{dashboard.credential.configured ? 'Daytona configured' : 'Connect Daytona'}</strong><p>{dashboard.credential.detail}</p></div><Badge className={dashboard.credential.configured ? 'badge-success' : 'badge-warning'}>{dashboard.credential.protectedByOs ? 'OS protected' : 'Unavailable'}</Badge></article>
      <article className="cloud-status-card"><span className="cloud-status-icon"><Server size={20} /></span><div><small>Availability</small><strong>{autoStopMinutes === 0 ? 'Always available' : `${autoStopMinutes} minute idle stop`}</strong><p>{autoStopMinutes === 0 ? 'No idle stop; cloud usage continues until you stop it.' : 'When stopped, the owner starts it from Knot; a link cannot wake it.'}</p></div><Badge>{dashboard.cloud.sandboxId ? 'Provisioned' : 'No sandbox'}</Badge></article>
      <article className="cloud-status-card"><span className="cloud-status-icon"><ShieldCheck size={20} /></span><div><small>Access model</small><strong>Revocable capability links</strong><p>Names help you manage links; anyone holding a private link can use or forward it.</p></div><Badge className="badge-success">Scoped</Badge></article>
    </section>

    <div className="cloud-layout">
      <section className="cloud-main">
        {!dashboard.credential.configured && <article className="panel cloud-key-card"><div className="panel-heading"><div><span className="panel-kicker"><KeyRound size={13} /> Bring your own cloud</span><h2>Connect Daytona securely</h2></div></div><p>The key is encrypted with the operating system credential vault and never written to this OKF folder.</p><div className="key-entry"><input aria-label="Daytona API key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="dtn_…" /><Button variant="primary" disabled={apiKey.length < 20 || busy === 'key'} onClick={() => void saveKey()}>{busy === 'key' ? 'Securing…' : 'Save key'}</Button></div></article>}

        <article className="panel cloud-composer"><div className="panel-heading"><div><span className="panel-kicker"><CloudCog size={13} /> Publication scope</span><h2>Choose the exact knowledge to publish</h2></div><Badge>{documentIds.size} selected</Badge></div>
          <label className="field-label">Share name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="visibility-segments cloud-visibility"><button className={visibility === 'workspace' ? 'active' : ''} aria-pressed={visibility === 'workspace'} onClick={() => setVisibility('workspace')}><UsersRound size={15} /> Named private links</button><button className={visibility === 'public' ? 'active' : ''} aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')}><Globe2 size={15} /> Public internet</button></div>
          {visibility === 'workspace' && <><div className="capability-disclosure"><LockKeyhole size={15} /><span><strong>These are links, not account sign-ins</strong><small>Each name receives a different revocable link. Anyone with that link can open or forward it.</small></span></div><div className="cloud-audiences">{audiences.map((audience) => <button key={audience.id} className={audienceIds.has(audience.id) ? 'selected' : ''} aria-pressed={audienceIds.has(audience.id)} onClick={() => setAudienceIds((current) => { const next = new Set(current); next.has(audience.id) ? next.delete(audience.id) : next.add(audience.id); return next })}><Avatar name={audience.name} color={audience.color} size="sm" /><span><strong>{audience.name}</strong><small>Label for one private link · {audience.detail}</small></span>{audienceIds.has(audience.id) && <Check size={14} />}</button>)}</div></>}
          <div className="cloud-document-toolbar"><div className="table-search"><Search size={15} /><input aria-label="Filter cloud concepts" value={documentQuery} onChange={(event) => setDocumentQuery(event.target.value)} placeholder="Filter concepts" /></div><Button size="sm" disabled={!visibleConcepts.length} onClick={() => setDocumentIds((current) => new Set([...current, ...visibleConcepts.map((document) => document.id)]))}>Select visible</Button><Button size="sm" disabled={!documentIds.size} onClick={() => setDocumentIds(new Set())}>Clear</Button></div>
          <div className="cloud-document-grid">{visibleConcepts.map((document) => <label key={document.id} className={documentIds.has(document.id) ? 'selected' : ''}><input type="checkbox" checked={documentIds.has(document.id)} onChange={() => setDocumentIds((current) => { const next = new Set(current); next.has(document.id) ? next.delete(document.id) : next.add(document.id); return next })} /><span><strong>{document.title}</strong><small>{document.visibility} · {document.type} · {document.path}</small></span></label>)}</div>
          <div className="cloud-options"><div className="switch-row"><span><strong>Include linked dependencies</strong><small>Close over the selected OKF graph</small></span><Switch.Root aria-label="Cloud include linked dependencies" checked={includeDependencies} onCheckedChange={setIncludeDependencies} className="switch"><Switch.Thumb /></Switch.Root></div><div className="switch-row"><span><strong>Portable download</strong><small>Let viewers download only this scoped OKF bundle</small></span><Switch.Root aria-label="Cloud allow download" checked={allowDownload} onCheckedChange={setAllowDownload} className="switch"><Switch.Thumb /></Switch.Root></div><label className="field-label">Availability<select value={autoStopMinutes} onChange={(event) => setAutoStopMinutes(Number(event.target.value))}><option value={15}>On demand · stop after 15 min</option><option value={30}>On demand · stop after 30 min</option><option value={60}>On demand · stop after 1 hour</option><option value={120}>On demand · stop after 2 hours</option><option value={0}>Always available · higher usage</option></select></label></div>
          <div className="cloud-trust-note"><LockKeyhole size={17} /><span><strong>Read-only publication</strong><small>External agents can search and read. Their update tool creates a review proposal; it cannot write into OKF directly.</small></span></div>
          {blockedForPublish.length > 0 && <button className="sharing-intent-warning" onClick={() => navigate('sharing')}><LockKeyhole size={17} /><span><strong>{blockedForPublish.length} concept{blockedForPublish.length === 1 ? '' : 's'} not marked for this audience</strong><small>Review sharing intent before publication. This also checks linked dependencies.</small></span><ExternalLink size={14} /></button>}
          <section className="availability-choices" aria-labelledby="availability-title"><div className="availability-intro"><span className="panel-kicker">Availability destination</span><h3 id="availability-title">Choose how this release stays online</h3><p>Permissions belong to the destination. Knot records sharing intent and exports only this selected scope.</p></div><div className="availability-row"><span className="availability-glyph"><FolderSync size={19} /></span><span><strong>Synced folder</strong><small>An immutable, versioned OKF folder for Drive, Dropbox, Box, or another sync provider. Share or revoke it with the provider.</small></span><label><span className="sr-only">Sync provider</span><select aria-label="Sync provider" value={syncedProvider} onChange={(event) => setSyncedProvider(event.target.value as typeof syncedProvider)}><option value="google-drive">Google Drive</option><option value="dropbox">Dropbox</option><option value="box">Box</option><option value="other">Other folder</option></select></label><Button disabled={!documentIds.size || !name || blockedForPublish.length > 0 || (visibility === 'workspace' && !audienceIds.size) || Boolean(busy)} onClick={() => void publishAvailability('synced-folder')}>{busy === 'synced-folder' ? <LoaderCircle className="spin" size={15} /> : <FolderSync size={15} />} Publish folder</Button></div><div className="availability-row"><span className="availability-glyph"><HardDriveUpload size={19} /></span><span><strong>Self-hosted portal & MCP</strong><small>A hardened Docker Compose kit for a VPS, NAS, or private server. Your host—not Knot—determines uptime.</small></span><Button disabled={!documentIds.size || !name || blockedForPublish.length > 0 || (visibility === 'workspace' && !audienceIds.size) || Boolean(busy)} onClick={() => void publishAvailability('self-host')}>{busy === 'self-host' ? <LoaderCircle className="spin" size={15} /> : <HardDriveUpload size={15} />} Export deployment</Button></div><div className="availability-row daytona-row"><span className="availability-glyph"><Cloud size={19} /></span><span><strong>Daytona portal & MCP</strong><small>Managed compute that starts from Knot. When auto-stop runs, links stay offline until you start the sandbox here; opening a link cannot wake it.</small></span><Button variant="primary" disabled={!dashboard.credential.configured || !documentIds.size || !name || blockedForPublish.length > 0 || (visibility === 'workspace' && !audienceIds.size) || Boolean(busy)} onClick={() => void publish()}>{busy === 'publish' ? <><LoaderCircle className="spin" size={16} /> Publishing…</> : <><Cloud size={17} /> Publish to Daytona</>}</Button></div></section>
        </article>

        <article className="panel cloud-shares"><div className="panel-heading"><div><span className="panel-kicker"><Link2 size={13} /> Active shares</span><h2>Links and agent endpoints</h2></div><Button size="sm" disabled={!dashboard.cloud.sandboxId || Boolean(busy)} onClick={() => void (async () => { setBusy('sync'); try { const report = await window.knot.cloud.sync(); await load(); await useAppStore.getState().reloadWorkspaceState(); addToast({ title: report.summary, description: `${report.importedProposals} new agent proposals`, tone: 'success' }) } catch (error) { addToast({ title: 'Sync failed', description: String(error), tone: 'danger' }) } finally { setBusy('') } })()}><RefreshCw className={busy === 'sync' ? 'spin' : ''} size={14} /> Sync now</Button></div>
          <div className="cloud-share-list">{dashboard.shares.map((share) => <article key={share.id}><div className="cloud-share-head"><span className={`cloud-share-glyph ${share.visibility}`} >{share.visibility === 'public' ? <Globe2 size={18} /> : <UsersRound size={18} />}</span><span><strong>{share.name}</strong><small>{share.documentIds.length} selected · {share.accessGrants.filter((grant) => !grant.revokedAt).length} live capabilities</small></span><Badge>{share.visibility}</Badge></div><div className="access-link-list">{share.links.map((link) => <div key={link.grantId}><span>{link.kind === 'mcp' ? <Bot size={15} /> : <Link2 size={15} />}</span><span><strong>{link.label}</strong><small>{link.kind === 'mcp' ? 'Streamable HTTP · bearer protected' : link.url}</small></span><Button size="sm" aria-label={`Copy ${link.label}`} onClick={() => void copy(link.kind === 'mcp' ? `${link.url}\nBearer token: ${link.authorization}` : link.url, link.label)}><Copy size={13} /></Button>{link.kind !== 'public' && <Button size="sm" aria-label={`Revoke ${link.label}`} onClick={() => { if (confirm(`Revoke ${link.label}? Existing copies of this capability will stop working.`)) void act('revoke', () => window.knot.cloud.revokeGrant(share.id, link.grantId), 'Access revoked') }}><LockKeyhole size={13} /></Button>}</div>)}</div><div className="cloud-share-actions">{share.links.find((link) => link.kind === 'public' || link.kind === 'recipient') && <Button size="sm" onClick={() => void window.knot.shell.openExternal(share.links.find((link) => link.kind === 'public' || link.kind === 'recipient')!.url)}><ExternalLink size={13} /> Open portal</Button>}<Button size="sm" onClick={() => { if (confirm(`Delete “${share.name}” and revoke every link?`)) void act('delete', () => window.knot.cloud.deleteShare(share.id), 'Cloud share deleted') }}><Trash2 size={13} /> Delete</Button></div></article>)}{!dashboard.shares.length && <div className="cloud-empty"><Cloud size={24} /><strong>No cloud shares yet</strong><small>Compose one above; Knot provisions only when you publish.</small></div>}</div>
        </article>
      </section>

      <aside className="cloud-aside">
        <article className="panel mcp-card"><span className="mcp-orb"><Bot size={22} /></span><span className="panel-kicker">Local MCP</span><h2>Your OKF as agent context</h2><p>Connect Codex, ChatGPT desktop, or another MCP client with a local stdio process. The workspace stays on this device.</p><div className="mcp-tool-list"><span>search_knowledge</span><span>get_concept</span><span>trace_connections</span><span>propose_update → review</span></div><Button onClick={() => void copy(mcp.codexToml, 'Codex MCP configuration')}><Copy size={14} /> Copy Codex config</Button><Button onClick={() => void copy(mcp.genericJson, 'Generic MCP configuration')}><Copy size={14} /> Copy JSON config</Button><div className="cloud-trust-note"><ShieldCheck size={16} /><span><strong>Human approval remains local</strong><small>{mcp.instructions}</small></span></div></article>
        {dashboard.credential.configured && <article className="panel credential-actions"><span className="panel-kicker">Connection</span><h2>Daytona account</h2><Button disabled={Boolean(busy)} onClick={() => void testConnection()}><RefreshCw size={14} /> Test connection</Button><Button disabled={Boolean(busy)} onClick={() => { if (confirm('Delete the Knot-managed cloud sandbox and revoke every cloud link?')) void act('disconnect', () => window.knot.cloud.disconnect(), 'Cloud disconnected') }}><Trash2 size={14} /> Delete cloud workspace</Button><Button disabled={Boolean(busy)} onClick={() => void (async () => { const credential = await window.knot.cloud.removeApiKey(); setDashboard((current) => current ? { ...current, credential } : current); addToast({ title: 'Daytona key removed', tone: 'success' }) })()}><KeyRound size={14} /> Remove API key</Button></article>}
      </aside>
    </div>
  </div>
}
