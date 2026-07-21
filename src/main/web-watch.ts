import { getSecret, hasSecret, removeSecret, setSecret, vaultProtectionAvailable } from './credential-vault'
import type {
  ParallelMonitor,
  WebMonitorInput,
  WebUpdate,
  WebUpdateCitation,
  WebWatchCredentialStatus,
  WebWatchDashboard,
  WebWatchState
} from '../shared/types'

const SECRET_ID = 'parallel-api-key'
const API_ROOT = 'https://api.parallel.ai/v1'

interface ParallelEvent {
  event_id?: string
  event_group_id?: string
  event_date?: string
  output?: {
    content?: string
    basis?: Array<{
      citations?: Array<{ url?: string }>
      reasoning?: string
      confidence?: string
    }>
  }
}

export function defaultWebWatchState(): WebWatchState {
  return { monitors: [], updates: [] }
}

export function normalizeWebWatchState(state?: Partial<WebWatchState>): WebWatchState {
  return {
    monitors: Array.isArray(state?.monitors) ? state.monitors.slice(0, 100) : [],
    updates: Array.isArray(state?.updates) ? state.updates.slice(0, 1_000) : []
  }
}

async function credentialStatus(detail?: string): Promise<WebWatchCredentialStatus> {
  const configured = await hasSecret(SECRET_ID)
  return {
    configured,
    protectedByOs: vaultProtectionAvailable(),
    detail: detail ?? (configured
      ? 'Parallel is connected. The key is encrypted outside this OKF workspace.'
      : 'Add a Parallel API key to monitor selected topics on the public web.')
  }
}

export async function saveParallelApiKey(apiKey: string): Promise<WebWatchCredentialStatus> {
  const trimmed = apiKey.trim()
  if (trimmed.length < 20 || trimmed.length > 500) throw new Error('Enter a valid Parallel API key.')
  await setSecret(SECRET_ID, trimmed)
  return credentialStatus('Parallel key saved in the operating-system protected vault.')
}

export async function removeParallelApiKey(): Promise<WebWatchCredentialStatus> {
  await removeSecret(SECRET_ID)
  return credentialStatus('Parallel key removed from this device.')
}

async function request<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const apiKey = await getSecret(SECRET_ID)
  if (!apiKey) throw new Error('Connect Parallel before using web watch.')
  const response = await fetch(`${API_ROOT}${pathname}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...init.headers
    },
    signal: AbortSignal.timeout(30_000)
  })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const nested = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : undefined
    throw new Error(String(nested?.message ?? body.message ?? `Parallel request failed (${response.status}).`))
  }
  return body as T
}

function isMock(): boolean {
  return process.env.KNOT_TEST_PARALLEL === '1'
}

export async function testParallelConnection(): Promise<WebWatchCredentialStatus> {
  if (!(await hasSecret(SECRET_ID))) throw new Error('Add a Parallel API key first.')
  if (!isMock()) await request<{ monitors?: unknown[] }>('/monitors')
  return credentialStatus('Connected to Parallel Monitor API. No workspace content was sent.')
}

export async function createParallelMonitor(state: WebWatchState, input: WebMonitorInput): Promise<WebWatchState> {
  const query = input.query.trim()
  if (query.length < 8 || query.length > 500) throw new Error('Describe a focused topic in 8–500 characters.')
  const createdAt = new Date().toISOString()
  let monitor: ParallelMonitor
  if (isMock()) {
    monitor = {
      id: `monitor_${crypto.randomUUID().replaceAll('-', '')}`,
      query,
      frequency: input.frequency,
      processor: input.processor,
      status: 'active',
      createdAt
    }
  } else {
    const result = await request<Record<string, unknown>>('/monitors', {
      method: 'POST',
      body: JSON.stringify({
        type: 'event_stream',
        frequency: input.frequency,
        processor: input.processor,
        settings: { query },
        metadata: { product: 'knot', workspace: 'local-okf' }
      })
    })
    monitor = {
      id: String(result.monitor_id),
      query,
      frequency: input.frequency,
      processor: input.processor,
      status: result.status === 'active' ? 'active' : 'error',
      createdAt: typeof result.created_at === 'string' ? result.created_at : createdAt
    }
  }
  return { ...normalizeWebWatchState(state), monitors: [monitor, ...state.monitors] }
}

function citationsFor(event: ParallelEvent): WebUpdateCitation[] {
  const citations: WebUpdateCitation[] = []
  for (const basis of event.output?.basis ?? []) {
    for (const citation of basis.citations ?? []) {
      if (!citation.url || !/^https:\/\//i.test(citation.url)) continue
      if (citations.some((item) => item.url === citation.url)) continue
      citations.push({ url: citation.url, reasoning: basis.reasoning, confidence: basis.confidence })
    }
  }
  return citations.slice(0, 20)
}

export async function refreshParallelMonitors(state: WebWatchState): Promise<WebWatchState> {
  const next = normalizeWebWatchState(state)
  const now = new Date().toISOString()
  for (const monitor of next.monitors.filter((item) => item.status === 'active')) {
    try {
      let events: ParallelEvent[]
      if (isMock()) {
        const mockId = `mock_${monitor.id}`
        events = next.updates.some((item) => item.id === mockId) ? [] : [{
          event_id: mockId,
          event_date: now.slice(0, 10),
          output: {
            content: `A material update was detected for ${monitor.query}. Review the cited evidence before adding it to the knowledge base.`,
            basis: [{ citations: [{ url: 'https://example.com/material-update' }], reasoning: 'The source directly reports the change.', confidence: 'high' }]
          }
        }]
      } else {
        const result = await request<{ events?: ParallelEvent[] }>(`/monitors/${encodeURIComponent(monitor.id)}/events`)
        events = result.events ?? []
      }
      for (const event of events) {
        const id = event.event_id ?? `${monitor.id}:${event.event_group_id ?? crypto.randomUUID()}`
        const content = event.output?.content?.trim()
        if (!content || next.updates.some((item) => item.id === id)) continue
        const update: WebUpdate = {
          id,
          monitorId: monitor.id,
          content: content.slice(0, 500_000),
          eventDate: event.event_date,
          citations: citationsFor(event),
          status: 'new',
          detectedAt: now
        }
        next.updates.unshift(update)
      }
      monitor.lastCheckedAt = now
      monitor.lastError = undefined
    } catch (error) {
      monitor.lastCheckedAt = now
      monitor.lastError = error instanceof Error ? error.message : String(error)
    }
  }
  next.updates = next.updates.slice(0, 1_000)
  return next
}

export async function cancelParallelMonitor(state: WebWatchState, monitorId: string): Promise<WebWatchState> {
  const next = normalizeWebWatchState(state)
  const monitor = next.monitors.find((item) => item.id === monitorId)
  if (!monitor) throw new Error('This web monitor no longer exists.')
  if (monitor.status === 'active' && !isMock()) {
    await request(`/monitors/${encodeURIComponent(monitorId)}/cancel`, { method: 'POST', body: '{}' })
  }
  monitor.status = 'canceled'
  return next
}

export async function webWatchDashboard(state: WebWatchState): Promise<WebWatchDashboard> {
  return { credential: await credentialStatus(), state: normalizeWebWatchState(state) }
}
