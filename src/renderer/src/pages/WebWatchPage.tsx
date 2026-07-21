import { useEffect, useMemo, useState } from 'react'
import {
  Bot, CheckCircle2, Clock3, ExternalLink, EyeOff, KeyRound, ListPlus, LoaderCircle,
  Plus, Radar, RefreshCw, Rss, ShieldCheck, StopCircle, Wifi
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import type { WebWatchDashboard } from '@shared/types'

type WebWatchView = 'updates' | 'watches' | 'connection'

export function WebWatchPage(): React.JSX.Element {
  const addToast = useAppStore((state) => state.addToast)
  const codex = useAppStore((state) => state.codexStatus)
  const [dashboard, setDashboard] = useState<WebWatchDashboard | null>(null)
  const [view, setView] = useState<WebWatchView>('updates')
  const [composerOpen, setComposerOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [query, setQuery] = useState('')
  const [frequency, setFrequency] = useState<'1h' | '6h' | '12h' | '1d' | '7d' | '30d'>('1d')
  const [processor, setProcessor] = useState<'lite' | 'base'>('lite')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    void window.knot.webWatch.getDashboard().then((next) => {
      setDashboard(next)
      setView(next.credential.configured ? 'updates' : 'connection')
    }).catch((error) => addToast({ title: 'Could not load web watch', description: String(error), tone: 'danger' }))
  }, [addToast])

  const active = dashboard?.state.monitors.filter((monitor) => monitor.status === 'active') ?? []
  const newUpdates = useMemo(() => dashboard?.state.updates.filter((update) => update.status === 'new') ?? [], [dashboard])
  const run = async (name: string, operation: () => Promise<WebWatchDashboard>, success: string): Promise<WebWatchDashboard | undefined> => {
    setBusy(name)
    try {
      const next = await operation()
      setDashboard(next)
      await useAppStore.getState().reloadWorkspaceState()
      addToast({ title: success, tone: 'success' })
      return next
    } catch (error) {
      addToast({ title: `${success} failed`, description: error instanceof Error ? error.message : String(error), tone: 'danger' })
      return undefined
    } finally { setBusy('') }
  }

  if (!dashboard) return <div className="page-loading"><LoaderCircle className="spin" size={19} /> Loading web watch…</div>

  const createWatch = async (): Promise<void> => {
    const next = await run('create', () => window.knot.webWatch.createMonitor({ query, frequency, processor }), 'Web watch created')
    if (next) { setQuery(''); setComposerOpen(false); setView('watches') }
  }

  return <div className="page web-watch-page" data-testid="web-watch-page">
    <section className="page-heading">
      <div><span className="eyebrow"><Radar size={14} /> Web watch</span><h1>Turn relevant change into reviewed knowledge</h1><p>Watch focused public topics, keep their sources, and decide what enters OKF.</p></div>
      <div className="heading-actions"><Button disabled={!dashboard.credential.configured || Boolean(busy)} onClick={() => void run('refresh', () => window.knot.webWatch.refresh(), 'Web updates checked').then((next) => { if (next?.state.updates.some((update) => update.status === 'new')) setView('updates') })}><RefreshCw className={busy === 'refresh' ? 'spin' : ''} size={15} /> Check now</Button><Button variant="primary" disabled={!dashboard.credential.configured} onClick={() => { setView('watches'); setComposerOpen(true) }}><Plus size={15} /> New watch</Button></div>
    </section>

    <section className="web-watch-command panel" aria-label="Web watch navigation">
      <div className="web-watch-summary"><span className={newUpdates.length ? 'attention' : ''}><strong>{newUpdates.length}</strong><small>new updates</small></span><span><strong>{active.length}</strong><small>active watches</small></span><span><strong>{dashboard.credential.configured ? 'Ready' : 'Setup'}</strong><small>Parallel connection</small></span></div>
      <div className="web-watch-tabs" role="tablist" aria-label="Web watch sections">
        <button role="tab" aria-selected={view === 'updates'} className={view === 'updates' ? 'active' : ''} onClick={() => setView('updates')}><Rss size={16} /> Updates{newUpdates.length > 0 && <em>{newUpdates.length}</em>}</button>
        <button role="tab" aria-selected={view === 'watches'} className={view === 'watches' ? 'active' : ''} onClick={() => setView('watches')}><Radar size={16} /> Watches</button>
        <button role="tab" aria-selected={view === 'connection'} className={view === 'connection' ? 'active' : ''} onClick={() => setView('connection')}><Wifi size={16} /> Connection</button>
      </div>
    </section>

    {view === 'updates' && <section className="panel web-update-inbox web-watch-focus" role="tabpanel">
      <div className="panel-heading"><div><span className="panel-kicker"><Rss size={13} /> Review inbox</span><h2>Material updates</h2><p>Evidence is never written automatically. Prepare a reviewable proposal or dismiss it.</p></div><span className="section-count">{newUpdates.length} new</span></div>
      <div className="web-update-list">{dashboard.state.updates.map((update) => { const monitor = dashboard.state.monitors.find((item) => item.id === update.monitorId); return <article key={update.id} className={`web-update-item status-${update.status}`}><div className="web-update-meta"><Badge className={update.status === 'new' ? 'badge-warning' : update.status === 'queued' ? 'badge-success' : ''}>{update.status}</Badge><span><Clock3 size={13} /> {update.eventDate ?? new Date(update.detectedAt).toLocaleDateString()}</span><small>{monitor?.query ?? 'Canceled watch'}</small></div><p>{update.content}</p>{update.citations.length > 0 && <div className="web-citations">{update.citations.map((citation, index) => <button key={citation.url} onClick={() => void window.knot.shell.openExternal(citation.url)}><ExternalLink size={12} /> Source {index + 1}{citation.confidence ? ` · ${citation.confidence}` : ''}</button>)}</div>}{update.status === 'new' && <div className="web-update-actions"><Button size="sm" disabled={Boolean(busy)} onClick={() => void (async () => { setBusy(update.id); try { const result = await window.knot.webWatch.prepareUpdate(update.id, false); setDashboard(result.dashboard); await useAppStore.getState().reloadWorkspaceState(); addToast({ title: 'Draft ready in Workflows', description: 'Review and approve it before it is written.', tone: 'success' }) } catch (error) { addToast({ title: 'Could not prepare update', description: String(error), tone: 'danger' }) } finally { setBusy('') } })()}><CheckCircle2 size={14} /> Prepare draft</Button><Button size="sm" disabled={!codex?.authenticated || Boolean(busy)} title={codex?.authenticated ? 'Use your signed-in Codex subscription' : 'Connect Codex to enable AI preparation'} onClick={() => void (async () => { setBusy(update.id); try { const result = await window.knot.webWatch.prepareUpdate(update.id, true); setDashboard(result.dashboard); await useAppStore.getState().reloadWorkspaceState(); addToast({ title: 'AI-assisted draft ready', description: 'Review and approve it in Workflows.', tone: 'success' }) } catch (error) { addToast({ title: 'Could not prepare with AI', description: String(error), tone: 'danger' }) } finally { setBusy('') } })()}><Bot size={14} /> Prepare with AI</Button><Button size="sm" disabled={Boolean(busy)} onClick={() => void run(update.id, () => window.knot.webWatch.dismissUpdate(update.id), 'Update dismissed')}><EyeOff size={14} /> Dismiss</Button></div>}</article> })}{!dashboard.state.updates.length && <div className="web-watch-empty"><Rss size={24} /><strong>Your update inbox is clear</strong><p>Create a focused watch, then check now. New evidence and citations will appear here for review.</p><Button onClick={() => { setView('watches'); setComposerOpen(true) }}><Plus size={15} /> Create a watch</Button></div>}</div>
    </section>}

    {view === 'watches' && <section className="web-watch-focus" role="tabpanel">
      {composerOpen && <article className="panel web-watch-composer"><div className="panel-heading"><div><span className="panel-kicker"><ListPlus size={13} /> New watch</span><h2>What should stay current?</h2><p>Be specific enough that a material change is easy to distinguish from general news.</p></div><button className="text-button" onClick={() => setComposerOpen(false)}>Cancel</button></div><label className="field-label">Focused topic<textarea autoFocus rows={3} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Example: Material changes to the Model Context Protocol specification and official SDKs" /></label><div className="web-watch-controls"><label className="field-label">Check frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)}><option value="1h">Every hour</option><option value="6h">Every 6 hours</option><option value="12h">Every 12 hours</option><option value="1d">Daily</option><option value="7d">Weekly</option><option value="30d">Monthly</option></select></label><label className="field-label">Coverage<select value={processor} onChange={(event) => setProcessor(event.target.value as typeof processor)}><option value="lite">Focused · lower usage</option><option value="base">Broader · higher recall</option></select></label></div><div className="cloud-trust-note"><ShieldCheck size={17} /><span><strong>Review before knowledge</strong><small>Results become inbox items with citations. You decide whether to prepare, use AI, or dismiss.</small></span></div><div className="composer-actions"><Button onClick={() => setComposerOpen(false)}>Cancel</Button><Button variant="primary" disabled={query.trim().length < 8 || Boolean(busy)} onClick={() => void createWatch()}>{busy === 'create' ? <LoaderCircle className="spin" size={16} /> : <Radar size={16} />} Start watching</Button></div></article>}
      <article className="panel active-monitor-card"><div className="panel-heading"><div><span className="panel-kicker">Watchlist</span><h2>Topics and schedule</h2><p>Only active watches consume scheduled search usage.</p></div>{!composerOpen && <Button variant="primary" onClick={() => setComposerOpen(true)}><Plus size={15} /> Add watch</Button>}</div><div className="active-monitor-list">{dashboard.state.monitors.map((monitor) => <div key={monitor.id}><span className={`status-dot ${monitor.status === 'active' ? 'online' : ''}`} /><span><strong>{monitor.query}</strong><small>{monitor.frequency} · {monitor.processor}{monitor.lastCheckedAt ? ` · checked ${new Date(monitor.lastCheckedAt).toLocaleDateString()}` : ''}</small>{monitor.lastError && <em>{monitor.lastError}</em>}</span>{monitor.status === 'active' && <Button size="sm" aria-label={`Cancel ${monitor.query}`} disabled={Boolean(busy)} onClick={() => { if (confirm('Cancel this watch? Parallel will stop future scheduled runs.')) void run(monitor.id, () => window.knot.webWatch.cancelMonitor(monitor.id), 'Web watch canceled') }}><StopCircle size={14} /> Cancel</Button>}</div>)}{!dashboard.state.monitors.length && !composerOpen && <div className="web-watch-empty compact"><Radar size={22} /><strong>No topics are being watched</strong><p>Add one focused public topic to begin.</p></div>}</div></article>
    </section>}

    {view === 'connection' && <section className="web-watch-focus" role="tabpanel">
      {!dashboard.credential.configured ? <article className="panel web-watch-connect connection-setup"><span className="connection-orb"><KeyRound size={22} /></span><span className="panel-kicker">Bring your own search</span><h2>Connect Parallel</h2><p>Your key is encrypted by the operating system and never placed in the OKF folder. Knot sends monitor queries—not private workspace content.</p><div className="key-entry"><input aria-label="Parallel API key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Parallel API key" /><Button variant="primary" disabled={apiKey.length < 20 || Boolean(busy)} onClick={() => void (async () => { setBusy('key'); try { const credential = await window.knot.webWatch.saveApiKey(apiKey); setDashboard({ ...dashboard, credential }); setApiKey(''); setView('watches'); setComposerOpen(true); addToast({ title: 'Parallel key secured', tone: 'success' }) } catch (error) { addToast({ title: 'Could not save key', description: String(error), tone: 'danger' }) } finally { setBusy('') } })()}>Save and continue</Button></div><div className="connection-boundary"><ShieldCheck size={17} /><span><strong>Clear data boundary</strong><small>Public topic queries go to Parallel. Private concept content does not.</small></span></div></article>
        : <article className="panel credential-actions connection-ready"><span className="connection-orb ready"><Wifi size={22} /></span><span className="panel-kicker">Connection</span><h2>Parallel is ready</h2><p>{dashboard.credential.detail}</p><div className="connection-boundary"><ShieldCheck size={17} /><span><strong>Protected locally</strong><small>The credential is kept outside every OKF workspace and protected by this operating system.</small></span></div><div className="connection-actions"><Button disabled={Boolean(busy)} onClick={() => void run('test', () => window.knot.webWatch.testConnection().then((credential) => ({ ...dashboard, credential })), 'Parallel connection verified')}><RefreshCw size={14} /> Test connection</Button><Button disabled={Boolean(busy)} onClick={() => void (async () => { const credential = await window.knot.webWatch.removeApiKey(); setDashboard({ ...dashboard, credential }); addToast({ title: 'Parallel key removed', tone: 'success' }) })()}><KeyRound size={14} /> Remove API key</Button></div></article>}
    </section>}
  </div>
}
