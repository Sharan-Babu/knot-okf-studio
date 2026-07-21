import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useAppStore, type AppPage } from '@/store'

interface TourStep {
  page: AppPage
  title: string
  body: string
  detail: string
}

const steps: TourStep[] = [
  { page: 'overview', title: 'Welcome to your example workspace', body: 'Knot opened Atlas Product Intelligence: a safe, local OKF bundle with connected concepts, people, customers, and playbooks.', detail: 'Your own workspace is untouched. Use the workspace menu whenever you want to return to it.' },
  { page: 'overview', title: 'Start with a useful overview', body: 'See knowledge health, recent work, sharing posture, and the next actions that need attention.', detail: 'Overview is the fastest way to understand a workspace before editing or sharing it.' },
  { page: 'library', title: 'Write portable knowledge', body: 'Browse the OKF tree, read rendered Markdown, edit metadata and content, and inspect backlinks without leaving the workspace.', detail: 'Knot preserves unknown frontmatter so the files remain portable and interoperable.' },
  { page: 'graph', title: 'Follow the relationships', body: 'The graph arranges concepts automatically. Search, filter by type, inspect incoming and outgoing links, or open a concept.', detail: 'Use Fit view at any time to bring the current network back into frame.' },
  { page: 'quality', title: 'Keep the bundle trustworthy', body: 'Quality checks OKF structure, required metadata, and internal links, with precise paths for anything that needs work.', detail: 'Warnings are advisory; errors identify format problems that can break consumers.' },
  { page: 'sharing', title: 'Share only what you intend', body: 'Visibility is set per concept. Choose people or groups, preview the exact scope, and control whether later edits require review.', detail: 'The update inbox reminds you when shared knowledge changes locally.' },
  { page: 'cloud', title: 'Publish or connect agents', body: 'Deliver durable folders, export a self-host kit, publish an on-demand Daytona room, or connect the local MCP server.', detail: 'Named links are revocable bearer capabilities; they are not account sign-ins.' },
  { page: 'workflows', title: 'Ingest through a review boundary', body: 'Choose deterministic or AI-assisted extraction. Every source becomes a proposal before any OKF file is written.', detail: 'Approve and publish, or reject without changing the source knowledge base.' },
  { page: 'web-watch', title: 'Track selected topics', body: 'Web Watch separates new evidence, active watches, and the Parallel connection so each task stays focused.', detail: 'Results keep their citations and wait for you before becoming a knowledge proposal.' },
  { page: 'activity', title: 'See the local audit trail', body: 'Activity records edits, sharing, exports, ingestion, and connections in a readable chronological history.', detail: 'Collaboration metadata stays local and outside the portable OKF bundle.' },
  { page: 'assistant', title: 'Use your own Codex subscription', body: 'Knot Assist can summarize, improve, and structure knowledge through your signed-in Codex installation.', detail: 'The app does not store an OpenAI API key and never silently writes an answer.' },
  { page: 'settings', title: 'You are ready to explore', body: 'Adjust appearance and authoring behavior, switch workspaces, or restart this walkthrough whenever you want.', detail: 'The example remains available from the workspace menu.' }
]

interface TourRect { left: number; top: number; right: number; bottom: number; width: number; height: number }

export function GuidedTour(): React.JSX.Element | null {
  const open = useAppStore((state) => state.tourOpen)
  const index = useAppStore((state) => state.tourStep)
  const currentPage = useAppStore((state) => state.page)
  const navigate = useAppStore((state) => state.navigate)
  const setStep = useAppStore((state) => state.setTourStep)
  const close = useAppStore((state) => state.closeTour)
  const [rect, setRect] = useState<TourRect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const step = steps[index]

  useEffect(() => {
    if (!open || !step) return
    navigate(step.page)
    const timer = window.setTimeout(() => nextRef.current?.focus(), 120)
    return () => window.clearTimeout(timer)
  }, [open, step, navigate])

  useLayoutEffect(() => {
    if (!open || !step) return
    let frame = 0
    const update = (): void => {
      const selector = index === 0 ? '[data-tour="workspace-switcher"]' : `[data-tour-page="${step.page}"]`
      const target = document.querySelector<HTMLElement>(selector)
      const bounds = target?.getBoundingClientRect()
      setRect(bounds && bounds.width > 0 && bounds.height > 0 ? {
        left: Math.max(8, bounds.left - 4), top: Math.max(8, bounds.top - 4),
        right: Math.min(window.innerWidth - 8, bounds.right + 4), bottom: Math.min(window.innerHeight - 8, bounds.bottom + 4),
        width: Math.min(window.innerWidth - 16, bounds.width + 8), height: Math.min(window.innerHeight - 16, bounds.height + 8)
      } : null)
    }
    frame = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', update) }
  }, [open, index, step, currentPage])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowRight' && index < steps.length - 1) setStep(index + 1)
      if (event.key === 'ArrowLeft' && index > 0) setStep(index - 1)
      if (event.key === 'Tab') {
        const controls = [...(cardRef.current?.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])') ?? [])]
        if (!controls.length) return
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, index, close, setStep])

  if (!open || !step) return null
  const cardWidth = 390
  const cardLeft = rect
    ? Math.max(18, Math.min(window.innerWidth - cardWidth - 18, index === 0 ? rect.right + 18 : rect.right - cardWidth - 24))
    : Math.max(18, window.innerWidth - cardWidth - 28)
  const cardTop = rect
    ? Math.max(18, Math.min(window.innerHeight - 300, index === 0 ? rect.top : rect.top + 24))
    : 72

  return <div className="guided-tour" aria-live="polite">
    {rect && <>
      <div className="tour-scrim tour-scrim-top" style={{ height: rect.top }} />
      <div className="tour-scrim tour-scrim-bottom" style={{ top: rect.bottom }} />
      <div className="tour-scrim tour-scrim-left" style={{ top: rect.top, width: rect.left, height: rect.height }} />
      <div className="tour-scrim tour-scrim-right" style={{ top: rect.top, left: rect.right, height: rect.height }} />
      <div className="tour-focus" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />
    </>}
    <section ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{ left: cardLeft, top: cardTop }}>
      <div className="tour-card-head"><span><Compass size={17} /> Guided example</span><button aria-label="Close walkthrough" onClick={close}><X size={17} /></button></div>
      <div className="tour-progress"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
      <small>Step {index + 1} of {steps.length}</small>
      <h2 id="tour-title">{step.title}</h2>
      <p>{step.body}</p>
      <div className="tour-detail"><Check size={15} /><span>{step.detail}</span></div>
      <div className="tour-actions">
        <button className="tour-skip" onClick={close}>Skip tour</button>
        {index > 0 && <Button onClick={() => setStep(index - 1)}><ArrowLeft size={15} /> Back</Button>}
        <Button ref={nextRef} variant="primary" onClick={() => index === steps.length - 1 ? close() : setStep(index + 1)}>
          {index === steps.length - 1 ? 'Finish' : 'Next'} {index < steps.length - 1 && <ArrowRight size={15} />}
        </Button>
      </div>
    </section>
  </div>
}
