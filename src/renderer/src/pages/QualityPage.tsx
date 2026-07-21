import { AlertTriangle, Check, CheckCircle2, ChevronRight, CircleAlert, FileText, Info, Link2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { useAppStore } from '@/store'

export function QualityPage(): React.JSX.Element {
  const bundle = useAppStore((state) => state.bundle)!
  const selectDocument = useAppStore((state) => state.selectDocument)
  const refresh = useAppStore((state) => state.refresh)
  const errors = bundle.issues.filter((issue) => issue.severity === 'error')
  const warnings = bundle.issues.filter((issue) => issue.severity === 'warning')
  const notes = bundle.issues.filter((issue) => issue.severity === 'info')
  const score = Math.max(0, Math.round(bundle.stats.coverage * .45 + (bundle.conformant ? 45 : Math.max(0, 45 - errors.length * 9)) + Math.min(10, bundle.stats.links)))

  const issueRow = (issue: typeof bundle.issues[number]): React.JSX.Element => <button key={issue.id} className="issue-row" onClick={() => selectDocument(issue.path.replace(/\.md$/i, ''))}>
    <span className={`issue-icon ${issue.severity}`}>{issue.severity === 'error' ? <CircleAlert size={18} /> : issue.severity === 'warning' ? <AlertTriangle size={18} /> : <Info size={18} />}</span>
    <span><strong>{issue.message}</strong><small>{issue.path} · {issue.code}</small></span><Badge className={`badge-${issue.severity}`}>{issue.severity}</Badge><ChevronRight size={16} />
  </button>

  return <div className="page quality-page">
    <section className="page-heading"><div><span className="eyebrow"><ShieldCheck size={14} /> OKF v{bundle.version}</span><h1>Quality & conformance</h1><p>Strict on portability, helpful on everything else.</p></div><Button onClick={() => void refresh()}><RefreshCw size={16} /> Run checks</Button></section>
    <section className={`conformance-banner ${bundle.conformant ? 'is-good' : 'needs-work'}`}>
      <div className="conformance-icon">{bundle.conformant ? <CheckCircle2 size={29} /> : <CircleAlert size={29} />}</div>
      <div><span>{bundle.conformant ? 'Conformant bundle' : 'Conformance blocked'}</span><h2>{bundle.conformant ? 'This workspace can travel anywhere.' : `${errors.length} required ${errors.length === 1 ? 'fix' : 'fixes'} before distribution.`}</h2><p>{bundle.conformant ? 'Every non-reserved concept has parseable YAML and a non-empty type; reserved files follow their structures.' : 'Address structural errors first. Advisory warnings never make an OKF consumer reject a bundle.'}</p></div>
      <div className="quality-score"><div className="score-ring small" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><span><strong>{score}</strong><small>quality</small></span></div></div>
    </section>
    <section className="quality-grid">
      <article className="panel check-summary"><div className="panel-heading"><div><span className="panel-kicker">Specification checks</span><h2>The three hard rules</h2></div><Badge className={bundle.conformant ? 'badge-success' : 'badge-warning'}>{errors.length ? `${errors.length} failed` : 'All passed'}</Badge></div>
        <div className="check-list">
          <div className={errors.some((issue) => ['missing-frontmatter', 'invalid-yaml'].includes(issue.code)) ? 'failed' : ''}><span>{errors.some((issue) => ['missing-frontmatter', 'invalid-yaml'].includes(issue.code)) ? <CircleAlert size={17} /> : <Check size={17} />}</span><p><strong>Parseable YAML frontmatter</strong><small>All non-reserved Markdown concepts</small></p></div>
          <div className={errors.some((issue) => issue.code === 'missing-type') ? 'failed' : ''}><span>{errors.some((issue) => issue.code === 'missing-type') ? <CircleAlert size={17} /> : <Check size={17} />}</span><p><strong>Non-empty type field</strong><small>Unknown type values remain valid</small></p></div>
          <div className={errors.some((issue) => ['invalid-index', 'invalid-log-date', 'reserved-frontmatter'].includes(issue.code)) ? 'failed' : ''}><span>{errors.some((issue) => ['invalid-index', 'invalid-log-date', 'reserved-frontmatter'].includes(issue.code)) ? <CircleAlert size={17} /> : <Check size={17} />}</span><p><strong>Reserved file structure</strong><small>index.md and log.md conventions</small></p></div>
        </div>
        <div className="coverage-block"><div><span>Recommended metadata coverage</span><strong>{bundle.stats.coverage}%</strong></div><Progress value={bundle.stats.coverage} /><p>Descriptions, tags, and timestamps improve retrieval but are never required for conformance.</p></div>
      </article>
      <article className="panel quality-stats"><span className="panel-kicker">Bundle signals</span><div className="quality-stat-grid"><div><span className="stat-icon violet"><FileText size={18} /></span><strong>{bundle.stats.concepts}</strong><small>Concepts scanned</small></div><div><span className="stat-icon aqua"><Link2 size={18} /></span><strong>{bundle.stats.links}</strong><small>Directed links</small></div><div><span className="stat-icon amber"><AlertTriangle size={18} /></span><strong>{warnings.length}</strong><small>Advisories</small></div><div><span className="stat-icon rose"><Info size={18} /></span><strong>{notes.length}</strong><small>Suggestions</small></div></div><div className="quality-tip"><Sparkles size={18} /><span><strong>Consumer-safe by design</strong>Broken links and unknown fields are reported without failing the bundle, matching OKF’s permissive contract.</span></div></article>
    </section>
    <section className="panel issues-panel"><div className="panel-heading"><div><span className="panel-kicker">Review queue</span><h2>{bundle.issues.length ? `${bundle.issues.length} opportunities to improve` : 'Everything looks excellent'}</h2></div><div className="issue-tabs"><span className="error">{errors.length} errors</span><span className="warning">{warnings.length} warnings</span><span>{notes.length} suggestions</span></div></div>
      <div className="issue-list">{[...errors, ...warnings, ...notes].map(issueRow)}{!bundle.issues.length && <div className="all-clear"><CheckCircle2 size={30} /><h3>No issues found</h3><p>This bundle is conformant and its recommended metadata is complete.</p></div>}</div>
    </section>
  </div>
}
