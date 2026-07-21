import { lazy, Suspense, useEffect } from 'react'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { ToastRegion } from '@/components/ToastRegion'
import { GuidedTour } from '@/components/GuidedTour'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'

const OverviewPage = lazy(async () => ({ default: (await import('@/pages/OverviewPage')).OverviewPage }))
const LibraryPage = lazy(async () => ({ default: (await import('@/pages/LibraryPage')).LibraryPage }))
const GraphPage = lazy(async () => ({ default: (await import('@/pages/GraphPage')).GraphPage }))
const QualityPage = lazy(async () => ({ default: (await import('@/pages/QualityPage')).QualityPage }))
const SharingPage = lazy(async () => ({ default: (await import('@/pages/SharingPage')).SharingPage }))
const CloudPage = lazy(async () => ({ default: (await import('@/pages/CloudPage')).CloudPage }))
const WorkflowsPage = lazy(async () => ({ default: (await import('@/pages/WorkflowsPage')).WorkflowsPage }))
const WebWatchPage = lazy(async () => ({ default: (await import('@/pages/WebWatchPage')).WebWatchPage }))
const ActivityPage = lazy(async () => ({ default: (await import('@/pages/ActivityPage')).ActivityPage }))
const AssistantPage = lazy(async () => ({ default: (await import('@/pages/AssistantPage')).AssistantPage }))
const SettingsPage = lazy(async () => ({ default: (await import('@/pages/SettingsPage')).SettingsPage }))

export default function App(): React.JSX.Element {
  const initialize = useAppStore((state) => state.initialize)
  const loading = useAppStore((state) => state.loading)
  const error = useAppStore((state) => state.error)
  const page = useAppStore((state) => state.page)

  useEffect(() => { void initialize() }, [initialize])

  if (loading) return <div className="launch-screen"><Logo /><div className="launch-loader"><LoaderCircle className="spin" size={19} /><span>Opening your knowledge workspace…</span></div></div>
  if (error) return <div className="error-screen"><div className="error-mark"><AlertTriangle size={24} /></div><h1>We couldn’t open Knot</h1><p>{error}</p><Button variant="primary" onClick={() => void initialize()}>Try again</Button></div>

  const content = {
    overview: <OverviewPage />,
    library: <LibraryPage />,
    graph: <GraphPage />,
    quality: <QualityPage />,
    sharing: <SharingPage />,
    cloud: <CloudPage />,
    workflows: <WorkflowsPage />,
    'web-watch': <WebWatchPage />,
    activity: <ActivityPage />,
    assistant: <AssistantPage />,
    settings: <SettingsPage />
  }[page]

  return <div className="app-shell"><Sidebar /><div className="app-main"><Topbar /><main className="content" tabIndex={0} aria-label="Page content"><div className="page-stage" data-tour-page={page}><Suspense fallback={<div className="page-loading"><LoaderCircle className="spin" size={19} /> Loading view…</div>}>{content}</Suspense></div></main></div><ToastRegion /><GuidedTour /></div>
}
