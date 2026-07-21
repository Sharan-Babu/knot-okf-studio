import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, CircleAlert, FileText, Globe2, Link2, LockKeyhole, Sparkles, UsersRound } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { formatNumber, formatRelativeTime, typeTone } from '@/lib/utils'
import { useAppStore } from '@/store'

function MiniGraph(): React.JSX.Element {
  return <svg className="mini-graph" viewBox="0 0 460 220" aria-label="Knowledge graph preview">
    <defs><linearGradient id="graph-fade" x1="0" x2="1"><stop offset="0" stopColor="#7567d4" /><stop offset="1" stopColor="#38a696" /></linearGradient></defs>
    <g className="mini-edges">
      <path d="M75 116 180 61M75 116l119 51M180 61l99 42m-85 64 85-64m0 0 102-49m-102 49 89 76M381 54l-13 125" />
    </g>
    {[
      [75,116,23,'Metric'], [180,61,18,'Project'], [194,167,17,'Person'], [279,103,27,'Atlas'], [381,54,17,'Customer'], [368,179,18,'Playbook']
    ].map(([x,y,r,label], index) => <g key={String(label)} className={`mini-node node-${index}`} transform={`translate(${x} ${y})`}>
      <circle r={r as number} /><text y={(r as number) + 18}>{label}</text>
    </g>)}
  </svg>
}

export function OverviewPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const navigate = useAppStore((state) => state.navigate)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const policies = useAppStore((state) => state.workspaceState.policies)
  const activities = useAppStore((state) => state.workspaceState.activities)
  const notifications = useAppStore((state) => state.workspaceState.notifications)
  const pendingUpdates = notifications.filter((notification) => !notification.resolvedAt)
  const recent = [...bundle.documents].filter((document) => document.kind === 'concept').sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 4)
  const sharedCount = policies.filter((policy) => policy.visibility !== 'private').length
  const score = Math.max(0, Math.round((bundle.stats.coverage * 0.55) + (bundle.conformant ? 35 : Math.max(0, 35 - bundle.stats.errors * 8)) + Math.min(10, bundle.stats.links)))
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return <div className="page page-overview">
    <section className="welcome-row">
      <div><span className="eyebrow"><Sparkles size={14} /> Local knowledge, in good shape</span><h1>{greeting}.</h1><p>Your workspace is connected, conformant, and ready to grow.</p></div>
      <div className="welcome-actions"><Button onClick={() => navigate('library')}><BookOpen size={17} /> Browse knowledge</Button><Button variant="primary" onClick={() => navigate('sharing')}><UsersRound size={17} /> Share a collection</Button></div>
    </section>

    <section className="stat-grid">
      <article className="stat-card"><div className="stat-icon violet"><FileText size={18} /></div><span>Concepts</span><strong>{formatNumber(bundle.stats.concepts)}</strong><small><i className="trend-up">+3</i> this week</small></article>
      <article className="stat-card"><div className="stat-icon aqua"><Link2 size={18} /></div><span>Connections</span><strong>{formatNumber(bundle.stats.links)}</strong><small>{bundle.stats.types} knowledge types</small></article>
      <article className="stat-card"><div className="stat-icon amber"><CheckCircle2 size={18} /></div><span>Metadata coverage</span><strong>{bundle.stats.coverage}%</strong><small>{bundle.stats.coverage >= 85 ? 'Strong discoverability' : 'A few fields to complete'}</small></article>
      <article className="stat-card"><div className="stat-icon rose"><Globe2 size={18} /></div><span>Shared concepts</span><strong>{sharedCount}</strong><small>{bundle.stats.concepts - sharedCount} remain private</small></article>
    </section>

    <section className="overview-grid">
      <article className="panel graph-card">
        <div className="panel-heading"><div><span className="panel-kicker">Knowledge map</span><h2>How your ideas connect</h2></div><button className="text-button" onClick={() => navigate('graph')}>Explore graph <ArrowRight size={15} /></button></div>
        <MiniGraph />
        <div className="graph-legend"><span><i className="legend-violet" />Product</span><span><i className="legend-green" />Operations</span><span><i className="legend-amber" />People & customers</span></div>
      </article>

      <article className="panel health-card">
        <div className="panel-heading"><div><span className="panel-kicker">Workspace health</span><h2>Ready for agents</h2></div><Badge className={bundle.conformant ? 'badge-success' : 'badge-warning'}>{bundle.conformant ? 'OKF conformant' : 'Needs attention'}</Badge></div>
        <div className="health-score"><div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><span><strong>{score}</strong><small>/ 100</small></span></div><div><strong>{score >= 90 ? 'Excellent foundation' : score >= 75 ? 'Healthy workspace' : 'A good start'}</strong><p>{bundle.conformant ? 'Every concept meets the OKF v0.1 interoperability rules.' : 'Resolve required fields to restore conformance.'}</p></div></div>
        <div className="health-list">
          <div><span>Required structure</span><strong>{bundle.conformant ? 100 : Math.max(0, 100 - bundle.stats.errors * 12)}%</strong></div><Progress value={bundle.conformant ? 100 : Math.max(0, 100 - bundle.stats.errors * 12)} tone="green" />
          <div><span>Recommended metadata</span><strong>{bundle.stats.coverage}%</strong></div><Progress value={bundle.stats.coverage} />
          <div><span>Connected concepts</span><strong>{Math.min(100, Math.round(bundle.stats.links / Math.max(1, bundle.stats.concepts) * 48))}%</strong></div><Progress value={Math.min(100, Math.round(bundle.stats.links / Math.max(1, bundle.stats.concepts) * 48))} tone="amber" />
        </div>
        <button className="quality-callout" onClick={() => navigate('quality')}>{bundle.stats.errors ? <CircleAlert size={17} /> : <CheckCircle2 size={17} />}<span><strong>{bundle.stats.errors ? `${bundle.stats.errors} required fixes` : 'Core checks passed'}</strong><small>{bundle.stats.warnings} advisory {bundle.stats.warnings === 1 ? 'warning' : 'warnings'}</small></span><ChevronRight size={17} /></button>
      </article>

      <article className="panel recent-card">
        <div className="panel-heading"><div><span className="panel-kicker">Recently touched</span><h2>Keep the thread moving</h2></div><button className="text-button" onClick={() => navigate('activity')}>View activity</button></div>
        <div className="recent-list">{recent.map((document) => <button key={document.id} onClick={() => selectDocument(document.id)}>
          <span className={`doc-glyph tone-${typeTone(document.type)}`}><FileText size={17} /></span>
          <span><strong>{document.title}</strong><small>{document.description || document.path}</small></span>
          <Badge className={`type-badge tone-${typeTone(document.type)}`}>{document.type}</Badge>
          <time>{formatRelativeTime(document.modifiedAt)}</time>
          <ChevronRight size={16} />
        </button>)}</div>
      </article>

      <article className="panel privacy-card">
        <span className="panel-kicker">Privacy at a glance</span><h2>You decide what leaves</h2><p>Sharing policies live outside your OKF bundle until you explicitly publish a package.</p>
        <div className="privacy-counts"><div><span className="privacy-icon private"><LockKeyhole size={17} /></span><strong>{bundle.stats.concepts - sharedCount}</strong><small>Private</small></div><div><span className="privacy-icon team"><UsersRound size={17} /></span><strong>{policies.filter((policy) => policy.visibility === 'workspace').length}</strong><small>Workspace</small></div><div><span className="privacy-icon public"><Globe2 size={17} /></span><strong>{policies.filter((policy) => policy.visibility === 'public').length}</strong><small>Public</small></div></div>
        {pendingUpdates.length > 0 && <button className="share-update-callout" onClick={() => navigate('sharing')}><CircleAlert size={16} /><span><strong>{pendingUpdates.length} shared {pendingUpdates.length === 1 ? 'concept changed' : 'concepts changed'}</strong><small>Review who may need an update</small></span><ChevronRight size={15} /></button>}
        <Button onClick={() => navigate('sharing')}>Review sharing <ArrowRight size={16} /></Button>
      </article>
    </section>
    {activities.length === 0 && <div className="first-run-note"><Sparkles size={16} /> Your edits, validations, and exports will appear in Activity.</div>}
  </div>
}
