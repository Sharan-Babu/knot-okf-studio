import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Daytona, type Sandbox } from '@daytona/sdk'
import { z } from 'zod'
import { getSecret, hasSecret, removeSecret, setSecret, vaultProtectionAvailable } from './credential-vault'
import type {
  BundleDocument,
  CloudAccessLink,
  CloudAccessGrant,
  CloudCredentialStatus,
  CloudDashboard,
  CloudPublishInput,
  CloudShare,
  CloudShareView,
  CloudSyncReport,
  CloudSyncItem,
  CloudWorkspaceState,
  IngestionProposal,
  WorkflowWorkspaceState,
  WorkspaceBundle
} from '../shared/types'
import { normalizeWorkflowState } from './workflows'

const HOST_PORT = 8787
const API_KEY_SECRET = 'daytona-api-key'

const publishSchema = z.object({
  shareId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  documentIds: z.array(z.string().min(1).max(500)).min(1).max(10_000),
  visibility: z.enum(['workspace', 'public']),
  audienceIds: z.array(z.string().min(1).max(100)).max(100),
  includeDependencies: z.boolean(),
  allowDownload: z.boolean(),
  expiresAt: z.string().max(40).optional(),
  autoStopMinutes: z.number().int().min(0).max(240)
})

export function defaultCloudState(): CloudWorkspaceState {
  return { runtime: 'not-configured', autoStopMinutes: 15, shares: [] }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'knowledge-share'
}

function revision(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function workspaceKey(root: string): string {
  return createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 12)
}

function grantSecretId(root: string, grantId: string): string {
  return `cloud-grant:${workspaceKey(root)}:${grantId}`
}

function addDependencies(selected: Set<string>, documents: BundleDocument[]): Set<string> {
  const byId = new Map(documents.map((document) => [document.id, document]))
  const queue = [...selected]
  while (queue.length) {
    const id = queue.shift()!
    for (const target of byId.get(id)?.outboundIds ?? []) {
      if (!byId.has(target) || selected.has(target)) continue
      selected.add(target)
      queue.push(target)
    }
  }
  return selected
}

export function buildRemoteBundle(state: CloudWorkspaceState, bundle: WorkspaceBundle): Record<string, unknown> {
  return {
    format: 'knot-cloud-bundle',
    version: 1,
    generatedAt: new Date().toISOString(),
    workspace: bundle.name,
    shares: state.shares.map((share) => {
      let selected = new Set(share.documentIds)
      if (share.includeDependencies) selected = addDependencies(selected, bundle.documents)
      const documents = bundle.documents.filter((document) => document.kind === 'concept' && selected.has(document.id))
      return {
        id: share.id,
        name: share.name,
        slug: share.slug,
        visibility: share.visibility,
        allowDownload: share.allowDownload,
        expiresAt: share.expiresAt,
        grants: share.accessGrants.map((grant) => ({
          id: grant.id,
          label: grant.label,
          kind: grant.kind,
          tokenHash: grant.tokenHash,
          revokedAt: grant.revokedAt
        })),
        bundle: { name: share.name, version: bundle.version, documents },
        revisions: Object.fromEntries(documents.map((document) => [document.id, revision(document.raw)]))
      }
    })
  }
}

async function credentialStatus(detail?: string): Promise<CloudCredentialStatus> {
  const configured = await hasSecret(API_KEY_SECRET)
  return {
    configured,
    protectedByOs: vaultProtectionAvailable(),
    detail: detail ?? (configured ? 'Daytona key is protected by the operating-system credential vault.' : 'Add your Daytona API key to enable cloud sharing.')
  }
}

export async function saveDaytonaApiKey(apiKey: string): Promise<CloudCredentialStatus> {
  const parsed = z.string().trim().min(20).max(500).regex(/^\S+$/, 'API keys cannot contain spaces.').parse(apiKey)
  await setSecret(API_KEY_SECRET, parsed)
  return credentialStatus('Daytona key saved securely. Knot never places it in a workspace or share bundle.')
}

export async function removeDaytonaApiKey(): Promise<CloudCredentialStatus> {
  await removeSecret(API_KEY_SECRET)
  return credentialStatus('Daytona key removed from this device.')
}

async function client(): Promise<Daytona> {
  const apiKey = await getSecret(API_KEY_SECRET)
  if (!apiKey) throw new Error('Add a Daytona API key in Cloud settings first.')
  return new Daytona({ apiKey })
}

export async function testDaytonaConnection(): Promise<CloudCredentialStatus> {
  if (process.env.KNOT_TEST_CLOUD === '1') return { configured: true, protectedByOs: true, detail: 'Test cloud connection succeeded.' }
  const daytona = await client()
  for await (const _sandbox of daytona.list({ limit: 1 })) break
  await daytona[Symbol.asyncDispose]()
  return credentialStatus('Connection succeeded. Daytona is ready for Knot cloud sharing.')
}

async function newGrant(root: string, kind: CloudAccessGrant['kind'], label: string, audienceId?: string): Promise<CloudAccessGrant> {
  const grant: CloudAccessGrant = { id: crypto.randomUUID(), label, kind, audienceId, createdAt: new Date().toISOString() }
  if (kind !== 'public') {
    const secret = randomBytes(32).toString('base64url')
    const secretId = grantSecretId(root, grant.id)
    await setSecret(secretId, secret)
    grant.tokenHash = tokenHash(secret)
  }
  return grant
}

async function hydrateShare(root: string, endpoint: string | undefined, share: CloudShare): Promise<CloudShareView> {
  const base = endpoint?.replace(/\/$/, '')
  const links: CloudAccessLink[] = []
  if (base) {
    for (const grant of share.accessGrants.filter((item) => !item.revokedAt)) {
      if (grant.kind === 'public') {
        links.push({ grantId: grant.id, label: grant.label, kind: grant.kind, url: `${base}/share/${share.slug}` })
        continue
      }
      const token = await getSecret(grantSecretId(root, grant.id))
      if (!token) continue
      if (grant.kind === 'mcp') links.push({ grantId: grant.id, label: grant.label, kind: grant.kind, url: `${base}/mcp/${share.id}`, authorization: token })
      else links.push({ grantId: grant.id, label: grant.label, kind: grant.kind, url: `${base}/share/${share.slug}?access=${encodeURIComponent(token)}` })
    }
  }
  return { ...share, links }
}

export async function cloudDashboard(root: string, cloud: CloudWorkspaceState): Promise<CloudDashboard> {
  return {
    credential: await credentialStatus(),
    cloud,
    shares: await Promise.all(cloud.shares.map((share) => hydrateShare(root, cloud.endpoint, share)))
  }
}

interface CloudManagerOptions {
  root: string
  hostBundlePath: string
}

export class CloudManager {
  constructor(private readonly options: CloudManagerOptions) {}

  async publish(previous: CloudWorkspaceState, workspace: WorkspaceBundle, input: CloudPublishInput): Promise<CloudWorkspaceState> {
    const parsed = publishSchema.parse(input)
    if (parsed.visibility === 'workspace' && !parsed.audienceIds.length) throw new Error('Choose at least one named private link.')
    let privacySelection = new Set(parsed.documentIds)
    if (parsed.includeDependencies) privacySelection = addDependencies(privacySelection, workspace.documents)
    const requiredVisibility = parsed.visibility === 'public' ? 2 : 1
    const visibilityRank = { private: 0, workspace: 1, public: 2 } as const
    const blocked = workspace.documents.filter((document) => privacySelection.has(document.id) && visibilityRank[document.visibility] < requiredVisibility)
    if (blocked.length) {
      throw new Error(`Sharing intent blocks this publication: ${blocked.slice(0, 3).map((document) => document.title).join(', ')}${blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''}. Mark each concept for ${parsed.visibility} sharing in Sharing first.`)
    }
    const cloud: CloudWorkspaceState = { ...previous, shares: [...previous.shares], autoStopMinutes: parsed.autoStopMinutes, runtime: 'starting', lastError: undefined }
    const existing = parsed.shareId ? cloud.shares.find((item) => item.id === parsed.shareId) : undefined
    const now = new Date().toISOString()
    const wantedAudience = parsed.visibility === 'workspace' ? new Set(parsed.audienceIds) : new Set<string>()
    const grants = existing ? existing.accessGrants.map((grant) => ({ ...grant })) : []

    for (const grant of grants.filter((item) => item.kind === 'recipient' && item.audienceId && !wantedAudience.has(item.audienceId))) {
      grant.revokedAt ??= now
    }
    for (const audienceId of wantedAudience) {
      if (!grants.some((grant) => grant.kind === 'recipient' && grant.audienceId === audienceId && !grant.revokedAt)) {
        grants.push(await newGrant(this.options.root, 'recipient', audienceId, audienceId))
      }
    }
    const activePublic = grants.find((grant) => grant.kind === 'public' && !grant.revokedAt)
    if (parsed.visibility === 'public' && !activePublic) grants.push(await newGrant(this.options.root, 'public', 'Public link'))
    if (parsed.visibility !== 'public' && activePublic) activePublic.revokedAt = now
    if (!grants.some((grant) => grant.kind === 'mcp' && !grant.revokedAt)) grants.push(await newGrant(this.options.root, 'mcp', 'Agent access'))

    let selected = new Set(parsed.documentIds)
    if (parsed.includeDependencies) selected = addDependencies(selected, workspace.documents)
    const revisions = Object.fromEntries(workspace.documents.filter((document) => selected.has(document.id)).map((document) => [document.id, revision(document.raw)]))
    const share: CloudShare = {
      id: existing?.id ?? crypto.randomUUID(),
      name: parsed.name,
      slug: existing?.slug ?? `${slug(parsed.name)}-${randomBytes(3).toString('hex')}`,
      documentIds: parsed.documentIds,
      audienceIds: [...wantedAudience],
      visibility: parsed.visibility,
      includeDependencies: parsed.includeDependencies,
      allowDownload: parsed.allowDownload,
      accessGrants: grants,
      revisions,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: parsed.expiresAt
    }
    cloud.shares = cloud.shares.filter((item) => item.id !== share.id)
    cloud.shares.unshift(share)

    const online = await this.pushBundle(cloud, workspace)
    share.lastPushedAt = new Date().toISOString()
    return online
  }

  async start(previous: CloudWorkspaceState, workspace: WorkspaceBundle): Promise<CloudWorkspaceState> {
    if (!previous.shares.length) throw new Error('Create a cloud share before starting its sandbox.')
    return this.pushBundle({ ...previous, runtime: 'starting', lastError: undefined }, workspace)
  }

  async stop(previous: CloudWorkspaceState): Promise<CloudWorkspaceState> {
    if (!previous.sandboxId) return { ...previous, runtime: 'stopped' }
    if (process.env.KNOT_TEST_CLOUD === '1') return { ...previous, runtime: 'stopped', lastCheckedAt: new Date().toISOString() }
    const daytona = await client()
    const sandbox = await daytona.get(previous.sandboxId)
    await daytona.stop(sandbox)
    await daytona[Symbol.asyncDispose]()
    return { ...previous, runtime: 'stopped', lastCheckedAt: new Date().toISOString() }
  }

  async revoke(previous: CloudWorkspaceState, workspace: WorkspaceBundle, shareId: string, grantId: string): Promise<CloudWorkspaceState> {
    const cloud = structuredClone(previous)
    const share = cloud.shares.find((item) => item.id === shareId)
    const grant = share?.accessGrants.find((item) => item.id === grantId)
    if (!share || !grant) throw new Error('This access grant no longer exists.')
    grant.revokedAt = new Date().toISOString()
    await removeSecret(grantSecretId(this.options.root, grant.id))
    share.updatedAt = grant.revokedAt
    return this.pushBundle(cloud, workspace)
  }

  async deleteShare(previous: CloudWorkspaceState, workspace: WorkspaceBundle, shareId: string): Promise<CloudWorkspaceState> {
    const cloud = structuredClone(previous)
    const share = cloud.shares.find((item) => item.id === shareId)
    if (!share) throw new Error('This cloud share no longer exists.')
    for (const grant of share.accessGrants) await removeSecret(grantSecretId(this.options.root, grant.id))
    cloud.shares = cloud.shares.filter((item) => item.id !== shareId)
    if (!cloud.shares.length) return this.disconnect(cloud)
    return this.pushBundle(cloud, workspace)
  }

  async disconnect(previous: CloudWorkspaceState): Promise<CloudWorkspaceState> {
    for (const share of previous.shares) for (const grant of share.accessGrants) await removeSecret(grantSecretId(this.options.root, grant.id))
    if (previous.sandboxId && process.env.KNOT_TEST_CLOUD !== '1') {
      const daytona = await client()
      try { await daytona.delete(await daytona.get(previous.sandboxId), 90, true) } finally { await daytona[Symbol.asyncDispose]() }
    }
    return { ...defaultCloudState(), runtime: (await hasSecret(API_KEY_SECRET)) ? 'draft' : 'not-configured' }
  }

  async sync(previous: CloudWorkspaceState, workspace: WorkspaceBundle, workflows: WorkflowWorkspaceState): Promise<{ cloud: CloudWorkspaceState; workflows: WorkflowWorkspaceState; report: CloudSyncReport }> {
    const checkedAt = new Date().toISOString()
    const nextWorkflows = normalizeWorkflowState(workflows)
    if (!previous.sandboxId || process.env.KNOT_TEST_CLOUD === '1') {
      const items = previous.shares.flatMap((share) => share.documentIds.map((documentId) => {
        const document = workspace.documents.find((item) => item.id === documentId)
        const localRevision = document ? revision(document.raw) : undefined
        const remoteRevision = share.revisions[documentId]
        return { shareId: share.id, documentId, localRevision, remoteRevision, state: localRevision === remoteRevision ? 'in-sync' as const : 'local-newer' as const }
      }))
      return { cloud: { ...previous, lastCheckedAt: checkedAt }, workflows: nextWorkflows, report: { checkedAt, items, importedProposals: 0, summary: items.every((item) => item.state === 'in-sync') ? 'Cloud and local revisions match.' : 'Local changes are ready to publish.' } }
    }

    const daytona = await client()
    const sandbox = await daytona.get(previous.sandboxId)
    if (sandbox.state !== 'started') await daytona.start(sandbox, 90)
    const remote = JSON.parse((await sandbox.fs.downloadFile('/home/daytona/knot/workspace-bundle.json')).toString('utf8')) as any
    const items: CloudSyncItem[] = []
    for (const share of previous.shares) {
      const remoteShare = remote.shares?.find((item: any) => item.id === share.id)
      for (const documentId of new Set([...share.documentIds, ...Object.keys(remoteShare?.revisions ?? {})])) {
        const localDocument = workspace.documents.find((item) => item.id === documentId)
        const localRevision = localDocument ? revision(localDocument.raw) : undefined
        const remoteRevision = remoteShare?.revisions?.[documentId] as string | undefined
        const baseRevision = share.revisions[documentId]
        const state = !localRevision || !remoteRevision ? 'missing' : localRevision === remoteRevision ? 'in-sync' : localRevision === baseRevision ? 'remote-newer' : remoteRevision === baseRevision ? 'local-newer' : 'conflict'
        items.push({ shareId: share.id, documentId, localRevision, remoteRevision, state })
      }
    }

    let importedProposals = 0
    try {
      const lines = (await sandbox.fs.downloadFile('/home/daytona/knot/mcp-proposals.jsonl')).toString('utf8').split('\n').filter(Boolean)
      for (const line of lines) {
        const source = JSON.parse(line) as any
        if (!source.id || nextWorkflows.proposals.some((proposal) => proposal.id === source.id)) continue
        const target = workspace.documents.find((document) => document.id === source.targetDocumentId)
        const proposal: IngestionProposal = {
          id: source.id,
          runId: `cloud-mcp-${source.shareId ?? 'unknown'}`,
          source: 'cloud-mcp',
          sourceName: 'Daytona MCP client',
          filename: `${slug(source.title)}.md`,
          title: String(source.title).slice(0, 200),
          type: target?.type || 'Proposal',
          description: String(source.reason || 'Proposed by an external MCP client.').slice(0, 500),
          tags: ['mcp-proposal'],
          body: String(source.body).slice(0, 500_000),
          targetDocumentId: source.targetDocumentId,
          baseRevision: source.baseRevision,
          status: 'pending',
          createdAt: source.createdAt || checkedAt
        }
        nextWorkflows.proposals.unshift(proposal)
        importedProposals += 1
      }
    } catch { /* no proposal inbox yet */ }
    await daytona[Symbol.asyncDispose]()
    const summary = items.some((item) => item.state === 'conflict' || item.state === 'remote-newer')
      ? 'Review remote differences before publishing.'
      : items.some((item) => item.state === 'local-newer') ? 'Local changes are ready to publish.' : 'Cloud and local revisions match.'
    return { cloud: { ...previous, runtime: 'online', lastCheckedAt: checkedAt }, workflows: nextWorkflows, report: { checkedAt, items, importedProposals, summary } }
  }

  private async pushBundle(previous: CloudWorkspaceState, workspace: WorkspaceBundle): Promise<CloudWorkspaceState> {
    if (process.env.KNOT_TEST_CLOUD === '1') return { ...previous, sandboxId: previous.sandboxId ?? 'test-sandbox', sandboxName: 'knot-test', endpoint: 'https://knot-test.invalid', runtime: 'online', lastCheckedAt: new Date().toISOString() }
    const daytona = await client()
    let sandbox: Sandbox | undefined
    const provisioning = !previous.sandboxId
    try {
      sandbox = previous.sandboxId ? await daytona.get(previous.sandboxId) : await daytona.create({
        name: `knot-${workspaceKey(this.options.root)}`,
        language: 'typescript',
        public: true,
        autoStopInterval: previous.autoStopMinutes,
        autoArchiveInterval: 24 * 60,
        autoDeleteInterval: -1,
        labels: { project: 'knot-cloud', workspace: workspaceKey(this.options.root) }
      }, { timeout: 120 })
      if (sandbox.state !== 'started') await daytona.start(sandbox, 120)
      await sandbox.setAutostopInterval(previous.autoStopMinutes)
      const directory = await sandbox.process.executeCommand('mkdir -p /home/daytona/knot')
      if (directory.exitCode !== 0) throw new Error('Could not prepare the Daytona share directory.')
      const remoteBundle = buildRemoteBundle(previous, workspace)
      await Promise.all([
        sandbox.fs.uploadFile(await readFile(this.options.hostBundlePath), '/home/daytona/knot/knot-cloud-host.cjs'),
        sandbox.fs.uploadFile(Buffer.from(JSON.stringify(remoteBundle)), '/home/daytona/knot/workspace-bundle.json')
      ])
      const started = await sandbox.process.executeCommand("pkill -f '[k]not-cloud-host.cjs' >/dev/null 2>&1 || true; nohup node /home/daytona/knot/knot-cloud-host.cjs >/home/daytona/knot/host.log 2>&1 &", undefined, { PORT: String(HOST_PORT), KNOT_HOST_ROOT: '/home/daytona/knot' }, 30)
      if (started.exitCode !== 0) throw new Error('The Knot cloud host did not start.')
      const preview = await sandbox.getPreviewLink(HOST_PORT)
      const endpoint = preview.url.replace(/\/$/, '')
      let healthy = false
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          const response = await fetch(`${endpoint}/health`, { headers: { 'X-Daytona-Skip-Preview-Warning': 'true' }, signal: AbortSignal.timeout(5_000) })
          healthy = response.ok && (await response.json() as { ok?: boolean }).ok === true
        } catch { healthy = false }
        if (healthy) break
        await new Promise((resolve) => setTimeout(resolve, 1_000))
      }
      if (!healthy) throw new Error('The Daytona sandbox started, but its knowledge endpoint did not become healthy.')
      await daytona[Symbol.asyncDispose]()
      return { ...previous, sandboxId: sandbox.id, sandboxName: sandbox.name, endpoint, runtime: 'online', lastCheckedAt: new Date().toISOString(), lastError: undefined }
    } catch (error) {
      let sandboxId = previous.sandboxId ?? sandbox?.id
      let sandboxName = previous.sandboxName ?? sandbox?.name
      if (provisioning && sandbox) {
        try {
          await daytona.delete(sandbox, 90, true)
          sandboxId = undefined
          sandboxName = undefined
        } catch { /* retain the id so the user can retry cleanup */ }
      }
      await daytona[Symbol.asyncDispose]()
      return { ...previous, sandboxId, sandboxName, runtime: 'error', lastCheckedAt: new Date().toISOString(), lastError: error instanceof Error ? error.message : String(error) }
    }
  }
}
