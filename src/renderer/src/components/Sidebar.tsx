import {
  Activity, Bot, ChevronDown, CircleHelp, Cloud, Compass, FileText, FolderKanban, FolderOpen, FolderPlus,
  GitFork, LayoutDashboard, Radar, RefreshCw, ScanSearch, Settings, ShieldCheck, Sparkles, UsersRound, Workflow
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Logo } from './Logo'
import { useAppStore, type AppPage } from '@/store'

type NavBadge = 'issues' | 'sharing-updates' | 'workflow-updates' | 'web-updates'
const primary: Array<{ id: AppPage; label: string; icon: typeof LayoutDashboard; badge?: NavBadge }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'library', label: 'Knowledge', icon: FileText },
  { id: 'graph', label: 'Graph', icon: GitFork },
  { id: 'quality', label: 'Quality', icon: ShieldCheck, badge: 'issues' }
]
const collaboration: Array<{ id: AppPage; label: string; icon: typeof LayoutDashboard; badge?: NavBadge }> = [
  { id: 'sharing', label: 'Sharing', icon: UsersRound, badge: 'sharing-updates' },
  { id: 'cloud', label: 'Cloud & MCP', icon: Cloud },
  { id: 'workflows', label: 'Workflows', icon: Workflow, badge: 'workflow-updates' },
  { id: 'web-watch', label: 'Web watch', icon: Radar, badge: 'web-updates' },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'assistant', label: 'Knot Assist', icon: Bot }
]

export function Sidebar(): React.JSX.Element {
  const page = useAppStore((state) => state.page)
  const navigate = useAppStore((state) => state.navigate)
  const bundle = useAppStore((state) => state.bundle)
  const openWorkspace = useAppStore((state) => state.openWorkspace)
  const createWorkspace = useAppStore((state) => state.createWorkspace)
  const refresh = useAppStore((state) => state.refresh)
  const startTour = useAppStore((state) => state.startTour)
  const compact = useAppStore((state) => state.preferences.compactNavigation)
  const codexStatus = useAppStore((state) => state.codexStatus)
  const issueCount = (bundle?.stats.errors ?? 0) + (bundle?.stats.warnings ?? 0)
  const sharingUpdateCount = useAppStore((state) => state.workspaceState.notifications.filter((notification) => !notification.resolvedAt).length)
  const workflowUpdateCount = useAppStore((state) => state.workspaceState.workflows.proposals.filter((proposal) => proposal.status === 'pending').length)
  const webUpdateCount = useAppStore((state) => state.workspaceState.webWatch.updates.filter((update) => update.status === 'new').length)

  const navItem = (item: { id: AppPage; label: string; icon: typeof LayoutDashboard; badge?: NavBadge }): React.JSX.Element => {
    const badgeCount = item.badge === 'sharing-updates' ? sharingUpdateCount : item.badge === 'workflow-updates' ? workflowUpdateCount : item.badge === 'web-updates' ? webUpdateCount : 0
    const content = (
      <button key={item.id} aria-label={item.label} data-tour={`nav-${item.id}`} className={`sidebar-item ${page === item.id ? 'is-active' : ''}`} onClick={() => navigate(item.id)}>
        <item.icon size={18} strokeWidth={1.8} />
        {!compact && <><span>{item.label}</span>{item.badge === 'issues' && issueCount > 0 && <em>{issueCount}</em>}{item.badge !== 'issues' && badgeCount > 0 && <em className="update-badge">{badgeCount}</em>}</>}
      </button>
    )
    return compact ? <Tooltip.Root key={item.id}><Tooltip.Trigger asChild>{content}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip" side="right">{item.label}<Tooltip.Arrow /></Tooltip.Content></Tooltip.Portal></Tooltip.Root> : content
  }

  return (
    <Tooltip.Provider delayDuration={400}>
      <aside className={`sidebar ${compact ? 'sidebar-compact' : ''}`}>
        <div className="sidebar-drag"><Logo compact={compact} /></div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="workspace-switcher" data-tour="workspace-switcher" aria-label={`Workspace: ${bundle?.name ?? 'Loading'}`}>
              <span className="workspace-avatar"><FolderKanban size={17} /></span>
              {!compact && <span><strong>{bundle?.name ?? 'Loading…'}</strong><small>Local OKF · v{bundle?.version ?? '0.1'}</small></span>}
              {!compact && <ChevronDown size={15} />}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="menu-content workspace-menu" sideOffset={8} align="start" collisionPadding={12}>
              <div className="workspace-menu-head"><span className="workspace-avatar"><FolderKanban size={17} /></span><span><strong>{bundle?.name}</strong><small>{bundle?.rootPath}</small></span></div>
              <DropdownMenu.Label>Workspace actions</DropdownMenu.Label>
              <DropdownMenu.Item onSelect={() => window.setTimeout(() => void openWorkspace(), 80)}><FolderOpen size={16} /><span><strong>Open workspace</strong><small>Choose an existing OKF folder</small></span></DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => window.setTimeout(() => void createWorkspace(), 80)}><FolderPlus size={16} /><span><strong>Create workspace</strong><small>Start a portable OKF bundle</small></span></DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => window.setTimeout(() => void refresh(), 80)}><RefreshCw size={16} /><span><strong>Reload from disk</strong><small>Read external file changes</small></span></DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onSelect={() => window.setTimeout(() => void startTour(), 80)}><Compass size={16} /><span><strong>Guided example tour</strong><small>Explore every feature step by step</small></span></DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => window.setTimeout(() => void window.knot.workspace.reveal(), 80)}><ScanSearch size={16} /><span><strong>Reveal in file browser</strong><small>Open the active local folder</small></span></DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <nav className="sidebar-nav">
          {!compact && <span className="sidebar-label">Workspace</span>}
          {primary.map(navItem)}
          {!compact && <span className="sidebar-label sidebar-label-spaced">Tools</span>}
          {collaboration.map(navItem)}
        </nav>

        <div className="sidebar-bottom">
          {!compact && <button className="assist-status" onClick={() => navigate('assistant')}>
            <span className={`status-dot ${codexStatus?.authenticated ? 'online' : ''}`} />
            <span><strong>{codexStatus?.authenticated ? 'Codex connected' : 'Connect Codex'}</strong><small>{codexStatus?.authenticated ? 'Subscription ready' : 'Optional AI assistance'}</small></span>
            <Sparkles size={15} />
          </button>}
          {navItem({ id: 'settings', label: 'Settings', icon: Settings })}
          {!compact && <button className="sidebar-item subtle" onClick={() => void startTour()}><Compass size={18} /><span>Guided tour</span></button>}
          {!compact && <button className="sidebar-item subtle" onClick={() => void window.knot.shell.openExternal('https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md')}><CircleHelp size={18} /><span>OKF guide</span></button>}
          <div className="user-tile"><span className="avatar avatar-sm" style={{ '--avatar-color': '#2f786e' } as React.CSSProperties}>S</span>{!compact && <span><strong>Local workspace</strong><small>Your device</small></span>}</div>
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
