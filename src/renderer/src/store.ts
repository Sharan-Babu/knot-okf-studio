import { create } from 'zustand'
import type {
  AppPreferences,
  CodexStatus,
  PersistedWorkspaceState,
  SharePolicy,
  WorkspaceBundle
} from '@shared/types'

export type AppPage = 'overview' | 'library' | 'graph' | 'quality' | 'sharing' | 'cloud' | 'workflows' | 'web-watch' | 'activity' | 'assistant' | 'settings'

interface ToastMessage {
  id: string
  title: string
  description?: string
  tone?: 'default' | 'success' | 'danger'
}

interface AppStore {
  bundle: WorkspaceBundle | null
  workspaceState: PersistedWorkspaceState
  preferences: AppPreferences
  codexStatus: CodexStatus | null
  page: AppPage
  selectedId: string | null
  globalQuery: string
  loading: boolean
  error: string | null
  toasts: ToastMessage[]
  tourOpen: boolean
  tourStep: number
  initialize: () => Promise<void>
  navigate: (page: AppPage) => void
  selectDocument: (id: string, navigate?: boolean) => void
  setGlobalQuery: (query: string) => void
  openWorkspace: () => Promise<void>
  createWorkspace: () => Promise<void>
  openExampleWorkspace: () => Promise<void>
  refresh: () => Promise<void>
  replaceBundle: (bundle: WorkspaceBundle) => void
  savePolicy: (policy: SharePolicy) => Promise<void>
  markUpdateRead: (notificationId: string) => Promise<void>
  keepUpdatePrivate: (notificationId: string) => Promise<void>
  reloadWorkspaceState: () => Promise<void>
  updatePreferences: (preferences: AppPreferences) => Promise<void>
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  dismissToast: (id: string) => void
  startTour: () => Promise<void>
  setTourStep: (step: number) => void
  closeTour: () => void
}

const defaultPreferences: AppPreferences = {
  theme: 'light',
  compactNavigation: false,
  checkLinksOnSave: true,
  autoTimestamp: true
}

export const useAppStore = create<AppStore>((set, get) => ({
  bundle: null,
  workspaceState: {
    policies: [], activities: [], notifications: [], deliveries: [],
    cloud: { runtime: 'not-configured', autoStopMinutes: 15, shares: [] },
    workflows: { definitions: [], runs: [], proposals: [] },
    webWatch: { monitors: [], updates: [] }
  },
  preferences: defaultPreferences,
  codexStatus: null,
  page: 'overview',
  selectedId: null,
  globalQuery: '',
  loading: true,
  error: null,
  toasts: [],
  tourOpen: false,
  tourStep: 0,
  initialize: async () => {
    set({ loading: true, error: null })
    try {
      const bundle = await window.knot.workspace.restore()
      const [workspaceState, preferences, codexStatus] = await Promise.all([
        window.knot.sharing.getState(),
        window.knot.preferences.get(),
        window.knot.assistant.status()
      ])
      set({
        bundle,
        workspaceState,
        preferences,
        codexStatus,
        selectedId: bundle.documents.find((document) => document.kind === 'concept')?.id ?? bundle.documents[0]?.id ?? null,
        loading: false
      })
      document.documentElement.dataset.theme = preferences.theme
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Unable to open the workspace.' })
    }
  },
  navigate: (page) => set({ page }),
  selectDocument: (selectedId, shouldNavigate = true) => set({ selectedId, page: shouldNavigate ? 'library' : get().page }),
  setGlobalQuery: (globalQuery) => set({ globalQuery }),
  openWorkspace: async () => {
    try {
      const bundle = await window.knot.workspace.open()
      if (!bundle) return
      const workspaceState = await window.knot.sharing.getState()
      set({ bundle, workspaceState, selectedId: bundle.documents.find((document) => document.kind === 'concept')?.id ?? null, page: 'overview' })
      get().addToast({ title: 'Workspace opened', description: bundle.rootPath, tone: 'success' })
    } catch (error) {
      get().addToast({ title: 'Could not open workspace', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  },
  createWorkspace: async () => {
    try {
      const bundle = await window.knot.workspace.create()
      if (!bundle) return
      set({
        bundle,
        workspaceState: {
          policies: [], activities: [], notifications: [], deliveries: [],
          cloud: { runtime: 'not-configured', autoStopMinutes: 15, shares: [] },
          workflows: { definitions: [], runs: [], proposals: [] },
          webWatch: { monitors: [], updates: [] }
        },
        selectedId: bundle.documents.find((document) => document.kind === 'concept')?.id ?? null,
        page: 'overview'
      })
      get().addToast({ title: 'Workspace ready', description: 'Your portable OKF bundle has been created.', tone: 'success' })
    } catch (error) {
      get().addToast({ title: 'Could not create workspace', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  },
  openExampleWorkspace: async () => {
    try {
      const bundle = await window.knot.workspace.example()
      const workspaceState = await window.knot.sharing.getState()
      set({ bundle, workspaceState, selectedId: bundle.documents.find((document) => document.kind === 'concept')?.id ?? null, page: 'overview' })
      get().addToast({ title: 'Example workspace ready', description: 'Atlas Product Intelligence is open for the guided tour.', tone: 'success' })
    } catch (error) {
      get().addToast({ title: 'Could not open the example', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
      throw error
    }
  },
  refresh: async () => {
    try {
      const bundle = await window.knot.workspace.refresh()
      set({ bundle })
      get().addToast({ title: 'Workspace refreshed', tone: 'success' })
    } catch (error) {
      get().addToast({ title: 'Refresh failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  },
  replaceBundle: (bundle) => set({ bundle }),
  savePolicy: async (policy) => {
    const workspaceState = await window.knot.sharing.savePolicy(policy)
    const bundle = await window.knot.workspace.refresh()
    set({ workspaceState, bundle })
  },
  markUpdateRead: async (notificationId) => set({ workspaceState: await window.knot.sharing.markUpdateRead(notificationId) }),
  keepUpdatePrivate: async (notificationId) => set({ workspaceState: await window.knot.sharing.keepUpdatePrivate(notificationId) }),
  reloadWorkspaceState: async () => set({ workspaceState: await window.knot.sharing.getState() }),
  updatePreferences: async (preferences) => {
    const saved = await window.knot.preferences.save(preferences)
    document.documentElement.dataset.theme = saved.theme
    set({ preferences: saved })
  },
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    window.setTimeout(() => get().dismissToast(id), 4500)
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  startTour: async () => {
    await get().openExampleWorkspace()
    set({ tourOpen: true, tourStep: 0, page: 'overview' })
  },
  setTourStep: (tourStep) => set({ tourStep }),
  closeTour: () => set({ tourOpen: false, tourStep: 0 })
}))
