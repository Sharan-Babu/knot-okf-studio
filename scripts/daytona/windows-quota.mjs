import assert from 'node:assert/strict'
import { Daytona } from '@daytona/sdk'

const apiKey = process.env.DAYTONA_API_KEY
const requestedDiskQuota = Number(process.env.KNOT_WINDOWS_TOTAL_DISK_QUOTA)
if (!apiKey) throw new Error('DAYTONA_API_KEY is required.')
if (!Number.isFinite(requestedDiskQuota) || requestedDiskQuota < 30 || requestedDiskQuota > 100) {
  throw new Error('KNOT_WINDOWS_TOTAL_DISK_QUOTA must be between 30 and 100 GiB.')
}

const apiUrl = (process.env.DAYTONA_API_URL ?? 'https://app.daytona.io/api').replace(/\/$/, '')
const target = process.env.DAYTONA_TARGET ?? 'us'
const daytona = new Daytona({ apiKey, target })
let discovery

async function request(endpoint, organizationId, init = {}) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'X-Daytona-Organization-ID': organizationId,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers
    },
    signal: AbortSignal.timeout(30_000)
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : undefined
  return { status: response.status, body }
}

try {
  discovery = await daytona.create({
    name: `knot-quota-discovery-${Date.now()}`,
    language: 'typescript',
    labels: { project: 'knot-release-validation', purpose: 'quota-discovery', managedBy: 'knot-windows-quota' },
    autoStopInterval: 5,
    autoArchiveInterval: 15,
    autoDeleteInterval: 30
  }, { timeout: 120 })
  const organizationId = discovery.organizationId
  const beforeResponse = await request(`/organizations/${organizationId}/usage`, organizationId)
  assert.equal(beforeResponse.status, 200, beforeResponse.body?.message ?? 'Could not read organization usage.')
  const before = beforeResponse.body.regionUsage.find((entry) => entry.regionId === target && entry.sandboxClass === 'windows')
  if (!before) throw new Error(`No Windows quota is configured in region ${target}.`)

  const update = {
    sandboxClass: 'windows',
    totalCpuQuota: before.totalCpuQuota,
    totalMemoryQuota: before.totalMemoryQuota,
    totalDiskQuota: requestedDiskQuota,
    totalGpuQuota: before.totalGpuQuota
  }
  const changed = await request(`/organizations/${organizationId}/quota/${target}`, organizationId, {
    method: 'PATCH',
    body: JSON.stringify(update)
  })
  if (changed.status !== 204) {
    throw new Error(`Daytona rejected the temporary quota update (${changed.status}): ${changed.body?.message ?? changed.body?.error ?? 'unknown response'}`)
  }

  const afterResponse = await request(`/organizations/${organizationId}/usage`, organizationId)
  assert.equal(afterResponse.status, 200, afterResponse.body?.message ?? 'Could not verify organization usage.')
  const after = afterResponse.body.regionUsage.find((entry) => entry.regionId === target && entry.sandboxClass === 'windows')
  assert.equal(after?.totalDiskQuota, requestedDiskQuota, 'Daytona accepted the request but did not apply the Windows disk quota.')
  process.stdout.write(`${JSON.stringify({
    changed: true,
    region: target,
    sandboxClass: 'windows',
    before: { cpu: before.totalCpuQuota, memory: before.totalMemoryQuota, disk: before.totalDiskQuota },
    after: { cpu: after.totalCpuQuota, memory: after.totalMemoryQuota, disk: after.totalDiskQuota }
  })}\n`)
} finally {
  if (discovery) await daytona.delete(discovery, 120, true)
  await daytona[Symbol.asyncDispose]()
}
