import { Daytona } from '@daytona/sdk'

const apiKey = process.env.DAYTONA_API_KEY
if (!apiKey) throw new Error('DAYTONA_API_KEY is required.')

const apiUrl = (process.env.DAYTONA_API_URL ?? 'https://app.daytona.io/api').replace(/\/$/, '')
const daytona = new Daytona({ apiKey, target: process.env.DAYTONA_TARGET ?? 'us' })
const result = { checkedAt: new Date().toISOString(), mutations: ['one disposable Linux discovery sandbox, deleted in finally'] }
let sandbox

async function request(endpoint, organizationId) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(organizationId ? { 'X-Daytona-Organization-ID': organizationId } : {})
    },
    signal: AbortSignal.timeout(30_000)
  })
  const body = await response.json().catch(() => undefined)
  return { status: response.status, body }
}

function organizationSummary(response) {
  if (response.status !== 200) return { status: response.status, error: response.body?.message ?? response.body?.error }
  const source = response.body ?? {}
  return {
    status: response.status,
    name: source.name,
    personal: source.personal,
    suspended: source.suspended,
    defaultRegionId: source.defaultRegionId,
    maxCpuPerSandbox: source.maxCpuPerSandbox,
    maxMemoryPerSandbox: source.maxMemoryPerSandbox,
    maxDiskPerSandbox: source.maxDiskPerSandbox,
    tier: source.tier
  }
}

function usageSummary(response) {
  if (response.status !== 200) return { status: response.status, error: response.body?.message ?? response.body?.error }
  return { status: response.status, ...response.body }
}

function listSummary(response, fields) {
  if (response.status !== 200) return { status: response.status, error: response.body?.message ?? response.body?.error }
  const values = Array.isArray(response.body) ? response.body : response.body?.items ?? []
  return {
    status: response.status,
    count: values.length,
    items: values.map((value) => Object.fromEntries(fields.map((field) => [field, value?.[field]]).filter(([, fieldValue]) => fieldValue !== undefined)))
  }
}

try {
  sandbox = await daytona.create({
    name: `knot-account-audit-${Date.now()}`,
    language: 'typescript',
    labels: { project: 'knot-release-validation', purpose: 'account-audit', managedBy: 'knot-account-audit' },
    autoStopInterval: 5,
    autoArchiveInterval: 15,
    autoDeleteInterval: 30
  }, { timeout: 120 })

  const organizationId = sandbox.organizationId
  const [organization, usage, classes, regions, sharedRegions, runners] = await Promise.all([
    request(`/organizations/${organizationId}`, organizationId),
    request(`/organizations/${organizationId}/usage`, organizationId),
    request(`/organizations/${organizationId}/available-sandbox-classes`, organizationId),
    request('/regions', organizationId),
    request('/shared-regions', organizationId),
    request('/runners', organizationId)
  ])
  result.organization = organizationSummary(organization)
  result.usage = usageSummary(usage)
  result.availableSandboxClasses = listSummary(classes, ['sandboxClass', 'class', 'available', 'totalCpuQuota', 'totalMemoryQuota', 'totalDiskQuota'])
  result.regions = listSummary(regions, ['name', 'id', 'state', 'type', 'enabled', 'scheduling'])
  result.sharedRegions = listSummary(sharedRegions, ['name', 'id', 'state', 'type', 'enabled', 'scheduling'])
  result.runners = listSummary(runners, ['name', 'state', 'status', 'regionId', 'sandboxClass', 'class', 'scheduling', 'draining', 'full'])
} finally {
  if (sandbox) await daytona.delete(sandbox, 120, true)
  await daytona[Symbol.asyncDispose]()
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
