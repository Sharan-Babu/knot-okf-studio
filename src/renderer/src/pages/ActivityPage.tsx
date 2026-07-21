import { Activity, Archive, CheckCircle2, Clock3, FilePlus2, FileText, FolderOpen, Pencil, ShieldCheck, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ActivityEvent } from '@shared/types'

const iconByKind = { created: FilePlus2, edited: Pencil, opened: FolderOpen, shared: UsersRound, validated: ShieldCheck, exported: Archive }

export function ActivityPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const activity = useAppStore((state) => state.workspaceState.activities)
  const synthetic: ActivityEvent[] = bundle.documents.filter((document) => document.kind === 'concept').slice().sort((a,b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 6).map((document) => ({ id: `file-${document.id}`, kind: 'edited', title: document.title, detail: `Knowledge source · ${document.path}`, at: document.modifiedAt, actor: 'Local file' }))
  const events = activity.length ? activity : synthetic
  const today = events.filter((event) => Date.now() - new Date(event.at).getTime() < 86_400_000)
  const earlier = events.filter((event) => !today.includes(event))

  const group = (title: string, items: ActivityEvent[]): React.JSX.Element | null => items.length ? <div className="activity-group"><span className="activity-date">{title}</span>{items.map((event) => { const Icon = iconByKind[event.kind]; return <article className="activity-event" key={event.id}><span className={`activity-icon kind-${event.kind}`}><Icon size={17} /></span><div><div><strong>{event.title}</strong><Badge>{event.kind}</Badge></div><p>{event.detail}</p><span><Avatar name={event.actor} size="sm" /><small>{event.actor} · {formatRelativeTime(event.at)}</small></span></div></article> })}</div> : null

  return <div className="page activity-page">
    <section className="page-heading"><div><span className="eyebrow"><Activity size={14} /> Local audit trail</span><h1>Workspace activity</h1><p>A clear record of authoring, access decisions, checks, and exports.</p></div><Badge className="badge-muted"><Clock3 size={14} /> Device time</Badge></section>
    <div className="activity-layout">
      <section className="activity-timeline">{group('Today', today)}{group('Earlier', earlier)}{!events.length && <div className="all-clear"><Activity size={29} /><h3>Quiet for now</h3><p>Edits and sharing changes will appear here.</p></div>}</section>
      <aside className="activity-summary">
        <article className="panel"><span className="panel-kicker">This workspace</span><h2>Change summary</h2><div className="summary-bars"><div><span>Edits</span><i><b style={{ width: `${Math.min(100, events.filter((event) => event.kind === 'edited').length * 18 + 20)}%` }} /></i><strong>{events.filter((event) => event.kind === 'edited').length}</strong></div><div><span>Sharing</span><i><b style={{ width: `${Math.min(100, events.filter((event) => event.kind === 'shared').length * 22)}%` }} /></i><strong>{events.filter((event) => event.kind === 'shared').length}</strong></div><div><span>Exports</span><i><b style={{ width: `${Math.min(100, events.filter((event) => event.kind === 'exported').length * 24)}%` }} /></i><strong>{events.filter((event) => event.kind === 'exported').length}</strong></div></div></article>
        <article className="panel audit-note"><CheckCircle2 size={23} /><h3>Privacy-safe history</h3><p>This activity is stored in Knot’s app data, outside the portable OKF workspace. It is not included in exports unless represented by the generated share manifest.</p></article>
        <article className="panel"><span className="panel-kicker">Source of truth</span><div className="source-row"><FileText size={18} /><span><strong>{bundle.rootPath}</strong><small>{bundle.documents.length} Markdown files loaded</small></span></div></article>
      </aside>
    </div>
  </div>
}
