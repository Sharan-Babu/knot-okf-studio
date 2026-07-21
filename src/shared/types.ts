export type DocumentKind = 'concept' | 'index' | 'log'
export type IssueSeverity = 'error' | 'warning' | 'info'
export type Visibility = 'private' | 'workspace' | 'public'
export type ShareUpdateMode = 'review' | 'auto-prepare'
export type CloudRuntimeState = 'not-configured' | 'draft' | 'starting' | 'online' | 'stopped' | 'error'
export type WorkflowMode = 'deterministic' | 'ai-assisted'
export type ProposalStatus = 'pending' | 'approved' | 'rejected'
export type WebUpdateStatus = 'new' | 'queued' | 'dismissed'

export interface ValidationIssue {
  id: string
  path: string
  severity: IssueSeverity
  code: string
  message: string
  line?: number
}

export interface BundleDocument {
  id: string
  path: string
  filename: string
  kind: DocumentKind
  title: string
  type: string
  description: string
  resource?: string
  tags: string[]
  timestamp?: string
  frontmatter: Record<string, unknown>
  body: string
  raw: string
  links: string[]
  outboundIds: string[]
  wordCount: number
  modifiedAt: string
  visibility: Visibility
}

export interface BundleStats {
  concepts: number
  types: number
  links: number
  words: number
  coverage: number
  errors: number
  warnings: number
}

export interface WorkspaceBundle {
  rootPath: string
  name: string
  version: string
  documents: BundleDocument[]
  issues: ValidationIssue[]
  stats: BundleStats
  conformant: boolean
  loadedAt: string
}

export interface SaveDocumentInput {
  path: string
  frontmatter: Record<string, unknown>
  body: string
}

export interface CreateDocumentInput {
  directory?: string
  filename: string
  title: string
  type: string
  description?: string
  tags?: string[]
  visibility?: Visibility
  audienceIds?: string[]
  allowDownload?: boolean
  updateMode?: ShareUpdateMode
}

export interface SharePolicy {
  documentId: string
  visibility: Visibility
  audienceIds: string[]
  allowDownload: boolean
  updatedAt: string
  updateMode: ShareUpdateMode
  lastSharedAt?: string
  lastSharedRevision?: string
  lastAcknowledgedRevision?: string
}

export interface ShareUpdateNotification {
  id: string
  documentId: string
  documentTitle: string
  audienceIds: string[]
  updateMode: ShareUpdateMode
  previousRevision: string
  currentRevision: string
  detectedAt: string
  readAt?: string
  resolvedAt?: string
  resolution?: 'published' | 'kept-private'
}

export interface ShareDelivery {
  id: string
  name: string
  documentIds: string[]
  audienceIds: string[]
  visibility: Visibility
  allowDownload: boolean
  exportedAt: string
  outputPath: string
  revisions: Record<string, string>
  channel?: 'zip' | 'synced-folder' | 'self-host'
}

export interface ShareAudience {
  id: string
  name: string
  kind: 'person' | 'group'
  avatar: string
  detail: string
  color: string
}

export interface ShareExportInput {
  documentIds: string[]
  name: string
  visibility: Visibility
  audienceIds: string[]
  includeDependencies: boolean
  allowDownload: boolean
  expiresAt?: string
}

export interface ActivityEvent {
  id: string
  kind: 'created' | 'edited' | 'opened' | 'shared' | 'validated' | 'exported' | 'synced' | 'ingested' | 'connected'
  title: string
  detail: string
  at: string
  actor: string
}

export interface CodexStatus {
  installed: boolean
  authenticated: boolean
  version?: string
  detail: string
}

export interface AssistantInput {
  instruction: string
  documentPath?: string
  documentContent?: string
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system'
  compactNavigation: boolean
  checkLinksOnSave: boolean
  autoTimestamp: boolean
}

export interface CloudAccessGrant {
  id: string
  label: string
  kind: 'public' | 'recipient' | 'mcp'
  audienceId?: string
  tokenHash?: string
  createdAt: string
  revokedAt?: string
}

export interface CloudShare {
  id: string
  name: string
  slug: string
  documentIds: string[]
  audienceIds: string[]
  visibility: Exclude<Visibility, 'private'>
  includeDependencies: boolean
  allowDownload: boolean
  accessGrants: CloudAccessGrant[]
  revisions: Record<string, string>
  createdAt: string
  updatedAt: string
  lastPushedAt?: string
  expiresAt?: string
}

export interface CloudWorkspaceState {
  sandboxId?: string
  sandboxName?: string
  runtime: CloudRuntimeState
  endpoint?: string
  autoStopMinutes: number
  lastCheckedAt?: string
  lastError?: string
  shares: CloudShare[]
}

export interface ParallelMonitor {
  id: string
  query: string
  frequency: '1h' | '6h' | '12h' | '1d' | '7d' | '30d'
  processor: 'lite' | 'base'
  status: 'active' | 'canceled' | 'error'
  createdAt: string
  lastCheckedAt?: string
  lastError?: string
}

export interface WebUpdateCitation {
  url: string
  reasoning?: string
  confidence?: string
}

export interface WebUpdate {
  id: string
  monitorId: string
  content: string
  eventDate?: string
  citations: WebUpdateCitation[]
  status: WebUpdateStatus
  detectedAt: string
  proposalId?: string
}

export interface WebWatchState {
  monitors: ParallelMonitor[]
  updates: WebUpdate[]
}

export interface WebWatchCredentialStatus {
  configured: boolean
  protectedByOs: boolean
  detail: string
}

export interface WebWatchDashboard {
  credential: WebWatchCredentialStatus
  state: WebWatchState
}

export interface WebMonitorInput {
  query: string
  frequency: ParallelMonitor['frequency']
  processor: ParallelMonitor['processor']
}

export interface CloudCredentialStatus {
  configured: boolean
  protectedByOs: boolean
  detail: string
}

export interface CloudAccessLink {
  grantId: string
  label: string
  kind: CloudAccessGrant['kind']
  url: string
  authorization?: string
}

export interface CloudShareView extends CloudShare {
  links: CloudAccessLink[]
}

export interface CloudDashboard {
  credential: CloudCredentialStatus
  cloud: CloudWorkspaceState
  shares: CloudShareView[]
}

export interface CloudPublishInput {
  shareId?: string
  name: string
  documentIds: string[]
  visibility: Exclude<Visibility, 'private'>
  audienceIds: string[]
  includeDependencies: boolean
  allowDownload: boolean
  expiresAt?: string
  autoStopMinutes: number
}

export type AvailabilityTarget = 'synced-folder' | 'self-host'
export type SyncedFolderProvider = 'google-drive' | 'dropbox' | 'box' | 'other'

export interface AvailabilityExportInput {
  target: AvailabilityTarget
  provider?: SyncedFolderProvider
  name: string
  documentIds: string[]
  visibility: Exclude<Visibility, 'private'>
  audienceIds: string[]
  includeDependencies: boolean
  allowDownload: boolean
  expiresAt?: string
}

export interface AvailabilityExportResult {
  canceled: boolean
  target: AvailabilityTarget
  path?: string
  count?: number
  revision?: string
}

export interface CloudSyncItem {
  shareId: string
  documentId: string
  localRevision?: string
  remoteRevision?: string
  state: 'in-sync' | 'local-newer' | 'remote-newer' | 'conflict' | 'missing'
}

export interface CloudSyncReport {
  checkedAt: string
  items: CloudSyncItem[]
  importedProposals: number
  summary: string
}

export interface McpIntegrationInfo {
  enabled: boolean
  command: string
  args: string[]
  codexToml: string
  genericJson: string
  instructions: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  mode: WorkflowMode
  acceptedExtensions: string[]
  steps: Array<'extract' | 'normalize' | 'ai-enrich' | 'review' | 'publish'>
  builtIn: boolean
}

export interface IngestionProposal {
  id: string
  runId: string
  source: 'workflow' | 'local-mcp' | 'cloud-mcp' | 'web-watch'
  sourceName: string
  filename: string
  title: string
  type: string
  description: string
  tags: string[]
  body: string
  targetDocumentId?: string
  baseRevision?: string
  status: ProposalStatus
  createdAt: string
  reviewedAt?: string
  warning?: string
}

export interface WorkflowRun {
  id: string
  workflowId: string
  sourceNames: string[]
  status: 'extracting' | 'awaiting-review' | 'completed' | 'failed'
  proposalIds: string[]
  startedAt: string
  completedAt?: string
  error?: string
}

export interface WorkflowWorkspaceState {
  definitions: WorkflowDefinition[]
  runs: WorkflowRun[]
  proposals: IngestionProposal[]
}

export interface WorkflowRunInput {
  workflowId: string
  paths?: string[]
}

export interface PersistedWorkspaceState {
  policies: SharePolicy[]
  activities: ActivityEvent[]
  notifications: ShareUpdateNotification[]
  deliveries: ShareDelivery[]
  cloud: CloudWorkspaceState
  workflows: WorkflowWorkspaceState
  webWatch: WebWatchState
}

export interface KnotAPI {
  workspace: {
    restore: () => Promise<WorkspaceBundle>
    example: () => Promise<WorkspaceBundle>
    open: () => Promise<WorkspaceBundle | null>
    create: () => Promise<WorkspaceBundle | null>
    refresh: () => Promise<WorkspaceBundle>
    saveDocument: (input: SaveDocumentInput) => Promise<WorkspaceBundle>
    createDocument: (input: CreateDocumentInput) => Promise<WorkspaceBundle>
    reveal: () => Promise<void>
  }
  sharing: {
    getState: () => Promise<PersistedWorkspaceState>
    savePolicy: (policy: SharePolicy) => Promise<PersistedWorkspaceState>
    markUpdateRead: (notificationId: string) => Promise<PersistedWorkspaceState>
    keepUpdatePrivate: (notificationId: string) => Promise<PersistedWorkspaceState>
    export: (input: ShareExportInput) => Promise<{ canceled: boolean; path?: string; count?: number; deliveryId?: string }>
  }
  assistant: {
    status: () => Promise<CodexStatus>
    run: (input: AssistantInput) => Promise<string>
  }
  cloud: {
    getDashboard: () => Promise<CloudDashboard>
    saveApiKey: (apiKey: string) => Promise<CloudCredentialStatus>
    removeApiKey: () => Promise<CloudCredentialStatus>
    testConnection: () => Promise<CloudCredentialStatus>
    publish: (input: CloudPublishInput) => Promise<CloudDashboard>
    start: () => Promise<CloudDashboard>
    stop: () => Promise<CloudDashboard>
    sync: () => Promise<CloudSyncReport>
    revokeGrant: (shareId: string, grantId: string) => Promise<CloudDashboard>
    deleteShare: (shareId: string) => Promise<CloudDashboard>
    disconnect: () => Promise<CloudDashboard>
    exportAvailability: (input: AvailabilityExportInput) => Promise<AvailabilityExportResult>
  }
  mcp: {
    getIntegrationInfo: () => Promise<McpIntegrationInfo>
  }
  workflows: {
    getState: () => Promise<WorkflowWorkspaceState>
    run: (input: WorkflowRunInput) => Promise<WorkflowWorkspaceState>
    approve: (proposalId: string) => Promise<{ workflows: WorkflowWorkspaceState; bundle: WorkspaceBundle }>
    reject: (proposalId: string) => Promise<WorkflowWorkspaceState>
  }
  webWatch: {
    getDashboard: () => Promise<WebWatchDashboard>
    saveApiKey: (apiKey: string) => Promise<WebWatchCredentialStatus>
    removeApiKey: () => Promise<WebWatchCredentialStatus>
    testConnection: () => Promise<WebWatchCredentialStatus>
    createMonitor: (input: WebMonitorInput) => Promise<WebWatchDashboard>
    refresh: () => Promise<WebWatchDashboard>
    cancelMonitor: (monitorId: string) => Promise<WebWatchDashboard>
    prepareUpdate: (updateId: string, useAi: boolean) => Promise<{ dashboard: WebWatchDashboard; workflows: WorkflowWorkspaceState }>
    dismissUpdate: (updateId: string) => Promise<WebWatchDashboard>
  }
  preferences: {
    get: () => Promise<AppPreferences>
    save: (preferences: AppPreferences) => Promise<AppPreferences>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
    copyText: (text: string) => Promise<void>
  }
  system: {
    platform: 'darwin' | 'win32' | 'linux'
  }
}
