import { useEffect, useState } from 'react'
import {
  Bot, Check, CheckCircle2, ChevronRight, FileInput, FileText, GitPullRequest,
  LoaderCircle, Play, ShieldCheck, Sparkles, Trash2, UserCheck, WandSparkles, Workflow
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import type { IngestionProposal, WorkflowWorkspaceState } from '@shared/types'

export function WorkflowsPage(): React.JSX.Element {
  const addToast = useAppStore((state) => state.addToast)
  const codexStatus = useAppStore((state) => state.codexStatus)
  const [state, setState] = useState<WorkflowWorkspaceState | null>(null)
  const [busy, setBusy] = useState('')
  const [selected, setSelected] = useState<IngestionProposal | null>(null)

  const load = async (): Promise<void> => {
    const next = await window.knot.workflows.getState()
    setState(next)
    setSelected((current) => next.proposals.find((proposal) => proposal.id === current?.id) ?? next.proposals.find((proposal) => proposal.status === 'pending') ?? null)
  }
  useEffect(() => { void load().catch((error) => addToast({ title: 'Could not load workflows', description: String(error), tone: 'danger' })) }, [])

  const run = async (workflowId: string): Promise<void> => {
    setBusy(workflowId)
    try {
      const next = await window.knot.workflows.run({ workflowId })
      setState(next)
      setSelected(next.proposals.find((proposal) => proposal.status === 'pending') ?? null)
      addToast({ title: 'Sources are ready for review', description: 'No knowledge was written yet.', tone: 'success' })
    } catch (error) { addToast({ title: 'Workflow failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
    finally { setBusy('') }
  }
  const review = async (proposal: IngestionProposal, decision: 'approve' | 'reject'): Promise<void> => {
    setBusy(proposal.id)
    try {
      if (decision === 'approve') {
        const result = await window.knot.workflows.approve(proposal.id)
        setState(result.workflows)
        useAppStore.getState().replaceBundle(result.bundle)
        addToast({ title: 'Proposal published to OKF', description: proposal.filename, tone: 'success' })
      } else {
        setState(await window.knot.workflows.reject(proposal.id))
        addToast({ title: 'Proposal rejected', description: 'The source file was not modified.', tone: 'success' })
      }
      setSelected(null)
      await useAppStore.getState().reloadWorkspaceState()
    } catch (error) { addToast({ title: 'Review action failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' }) }
    finally { setBusy('') }
  }

  if (!state) return <div className="page-loading"><LoaderCircle className="spin" size={19} /> Loading ingestion workflows…</div>
  const pending = state.proposals.filter((proposal) => proposal.status === 'pending')

  return <div className="page workflows-page" data-testid="workflows-page">
    <section className="page-heading"><div><span className="eyebrow"><Workflow size={14} /> Ingestion workflows</span><h1>Turn documents into reviewed knowledge</h1><p>Deterministic extraction or subscription-backed AI assistance, with a person at the publishing boundary.</p></div><Badge className={pending.length ? 'badge-warning' : 'badge-success'}>{pending.length} awaiting review</Badge></section>

    <section className="workflow-pipeline" aria-label="Workflow pipeline"><div><span><FileInput size={16} /></span><strong>Choose source</strong></div><ChevronRight size={15} /><div><span><WandSparkles size={16} /></span><strong>Structure</strong></div><ChevronRight size={15} /><div><span><UserCheck size={16} /></span><strong>Review</strong></div><ChevronRight size={15} /><div><span><CheckCircle2 size={16} /></span><strong>Publish OKF</strong></div></section>

    <div className={`workflow-layout ${selected ? '' : 'workflow-layout-idle'}`}>
      <section className="workflow-main">
        <section className="workflow-definition-section"><div className="section-intro"><div><span className="panel-kicker">Start an ingestion</span><h2>Choose how to prepare the source</h2></div><p>Both paths stop at the same human approval boundary.</p></div><div className="workflow-definition-list">{state.definitions.map((workflow) => <article className="panel workflow-definition" key={workflow.id}><span className={`workflow-icon ${workflow.mode}`}>{workflow.mode === 'ai-assisted' ? <Bot size={20} /> : <Workflow size={20} />}</span><div className="workflow-definition-copy"><span className="panel-kicker">{workflow.mode === 'ai-assisted' ? 'Codex + review' : 'Deterministic'}</span><h2>{workflow.name}</h2><p>{workflow.description}</p><div className="workflow-steps">{workflow.steps.map((step) => <span key={step}><Check size={11} /> {step}</span>)}</div>{workflow.mode === 'ai-assisted' && <small className={codexStatus?.authenticated ? 'workflow-ready' : 'workflow-needs-auth'}><Sparkles size={13} /> {codexStatus?.authenticated ? 'Codex subscription ready' : 'Codex sign-in needed; deterministic fallback remains available'}</small>}</div><Button variant="primary" disabled={Boolean(busy)} onClick={() => void run(workflow.id)}>{busy === workflow.id ? <><LoaderCircle className="spin" size={15} /> Extracting…</> : <><Play size={15} /> Choose sources</>}</Button></article>)}</div></section>

        <article className="panel proposal-queue"><div className="panel-heading"><div><span className="panel-kicker"><GitPullRequest size={13} /> Approval queue</span><h2>Nothing enters knowledge silently</h2></div><Badge>{state.proposals.length} proposals</Badge></div><div className="proposal-list">{state.proposals.map((proposal) => <button key={proposal.id} className={`${selected?.id === proposal.id ? 'selected' : ''} proposal-${proposal.status}`} onClick={() => setSelected(proposal)}><span className="proposal-file"><FileText size={16} /></span><span><strong>{proposal.title}</strong><small>{proposal.sourceName} · {proposal.source.replace('-', ' ')}</small></span><Badge className={proposal.status === 'pending' ? 'badge-warning' : proposal.status === 'approved' ? 'badge-success' : ''}>{proposal.status}</Badge></button>)}{!state.proposals.length && <div className="workflow-empty"><FileInput size={23} /><strong>No proposals yet</strong><small>Run a workflow, or connect an MCP client and use propose_update.</small></div>}</div></article>

        <details className="panel workflow-history" open={state.runs.length > 0}><summary><span><span className="panel-kicker">Run history</span><strong>Traceable ingestion</strong></span><span>{state.runs.length} runs</span></summary><div className="workflow-history-list">{state.runs.slice(0, 8).map((run) => <div key={run.id}><span className={`run-dot ${run.status}`} /><span><strong>{state.definitions.find((workflow) => workflow.id === run.workflowId)?.name ?? run.workflowId}</strong><small>{run.sourceNames.join(', ')}</small></span><Badge>{run.status}</Badge></div>)}{!state.runs.length && <p className="history-empty">Workflow runs will appear here with their sources and review status.</p>}</div></details>
      </section>

      {selected && <aside className="workflow-review panel">
        {selected ? <><span className="review-orb"><GitPullRequest size={21} /></span><span className="panel-kicker">Proposal review</span><h2>{selected.title}</h2><p>{selected.description}</p><dl><div><dt>Source</dt><dd>{selected.sourceName}</dd></div><div><dt>Type</dt><dd>{selected.type}</dd></div><div><dt>Target</dt><dd>{selected.targetDocumentId ?? `inbox/${selected.filename}`}</dd></div></dl>{selected.warning && <div className="inline-alert"><Sparkles size={16} /><span><strong>Safe fallback used</strong><small>{selected.warning}</small></span></div>}<div className="proposal-preview"><span>Proposed Markdown</span><pre>{selected.body.slice(0, 12_000)}</pre></div>{selected.status === 'pending' ? <div className="review-actions"><Button onClick={() => void review(selected, 'reject')} disabled={busy === selected.id}><Trash2 size={14} /> Reject</Button><Button variant="primary" onClick={() => void review(selected, 'approve')} disabled={busy === selected.id}>{busy === selected.id ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} Approve & publish</Button></div> : <div className="review-complete"><CheckCircle2 size={17} /><span><strong>Review complete</strong><small>This proposal was {selected.status}.</small></span></div>}<div className="review-safety"><ShieldCheck size={15} /><span>External text is treated as data. AI runs read-only with network disabled. Approval checks the base revision before replacing an existing concept.</span></div></> : <div className="review-empty"><GitPullRequest size={28} /><h2>Select a proposal</h2><p>Inspect source, metadata, target, warnings, and Markdown before anything is written.</p></div>}
      </aside>}
    </div>
  </div>
}
