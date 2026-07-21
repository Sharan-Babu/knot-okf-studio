import { BookOpen, Compass, ExternalLink, FolderOpen, Monitor, Moon, RefreshCw, Settings, ShieldCheck, Sun } from 'lucide-react'
import * as Switch from '@radix-ui/react-switch'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'

export function SettingsPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const preferences = useAppStore((state) => state.preferences)
  const update = useAppStore((state) => state.updatePreferences)
  const refresh = useAppStore((state) => state.refresh)
  const codexStatus = useAppStore((state) => state.codexStatus)
  const startTour = useAppStore((state) => state.startTour)

  return <div className="page settings-page">
    <section className="page-heading"><div><span className="eyebrow"><Settings size={14} /> Preferences</span><h1>Settings</h1><p>Keep the interface calm, local, and tailored to your workflow.</p></div></section>
    <div className="settings-layout">
      <section>
        <article className="panel settings-card"><div className="settings-head"><span className="settings-icon"><Sun size={19} /></span><div><h2>Appearance</h2><p>Choose how Knot looks on this device.</p></div></div><div className="theme-picker">{(['light','dark','system'] as const).map((theme) => { const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor; return <button key={theme} aria-pressed={preferences.theme === theme} className={preferences.theme === theme ? 'active' : ''} onClick={() => void update({ ...preferences, theme })}><span><Icon size={19} /></span><strong>{theme[0].toUpperCase() + theme.slice(1)}</strong>{preferences.theme === theme && <i />}</button> })}</div></article>
        <article className="panel settings-card"><div className="settings-head"><span className="settings-icon"><BookOpen size={19} /></span><div><h2>Authoring</h2><p>Behavior while working with portable Markdown.</p></div></div>
          <div className="setting-row"><span><strong>Update timestamp on save</strong><small>Set the OKF timestamp after a meaningful edit.</small></span><Switch.Root aria-label="Update timestamp on save" checked={preferences.autoTimestamp} onCheckedChange={(value) => void update({ ...preferences, autoTimestamp: value })} className="switch"><Switch.Thumb /></Switch.Root></div>
          <div className="setting-row"><span><strong>Check internal links on save</strong><small>Show advisory warnings for unresolved knowledge paths.</small></span><Switch.Root aria-label="Check internal links on save" checked={preferences.checkLinksOnSave} onCheckedChange={(value) => void update({ ...preferences, checkLinksOnSave: value })} className="switch"><Switch.Thumb /></Switch.Root></div>
          <div className="setting-row"><span><strong>Compact navigation</strong><small>Use an icon-only sidebar for more writing space.</small></span><Switch.Root aria-label="Compact navigation" checked={preferences.compactNavigation} onCheckedChange={(value) => void update({ ...preferences, compactNavigation: value })} className="switch"><Switch.Thumb /></Switch.Root></div>
        </article>
        <article className="panel settings-card"><div className="settings-head"><span className="settings-icon"><ShieldCheck size={19} /></span><div><h2>AI connection</h2><p>Knot uses your local Codex installation; no API key is stored by this app.</p></div><Badge className={codexStatus?.authenticated ? 'badge-success' : 'badge-warning'}>{codexStatus?.authenticated ? 'Connected' : 'Not connected'}</Badge></div><div className="connection-detail"><span className={`status-dot ${codexStatus?.authenticated ? 'online' : ''}`} /><span><strong>{codexStatus?.version ?? 'Codex CLI not detected'}</strong><small>{codexStatus?.detail}</small></span></div></article>
      </section>
      <aside>
        <article className="panel workspace-settings"><span className="panel-kicker">Active workspace</span><h2>{bundle.name}</h2><p>{bundle.rootPath}</p><div><Badge>OKF v{bundle.version}</Badge><Badge className={bundle.conformant ? 'badge-success' : 'badge-warning'}>{bundle.conformant ? 'Conformant' : 'Needs review'}</Badge></div><Button onClick={() => void window.knot.workspace.reveal()}><FolderOpen size={16} /> Reveal folder</Button><Button onClick={() => void refresh()}><RefreshCw size={16} /> Reload from disk</Button></article>
        <article className="panel about-card"><div className="about-mark">K</div><h2>Knot 1.1</h2><p>Open knowledge, without lock-in.</p><Button variant="primary" onClick={() => void startTour()}><Compass size={15} /> Start guided example</Button><button onClick={() => void window.knot.shell.openExternal('https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md')}>Read the OKF specification <ExternalLink size={14} /></button><small>OKF is an open specification from Google Cloud. Knot is an independent product.</small></article>
      </aside>
    </div>
  </div>
}
