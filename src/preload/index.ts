import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppPreferences,
  AvailabilityExportInput,
  AssistantInput,
  CloudPublishInput,
  CreateDocumentInput,
  KnotAPI,
  SaveDocumentInput,
  ShareExportInput,
  SharePolicy,
  WebMonitorInput,
  WorkflowRunInput
} from '../shared/types'

const api: KnotAPI = {
  workspace: {
    restore: () => ipcRenderer.invoke('workspace:restore'),
    example: () => ipcRenderer.invoke('workspace:example'),
    open: () => ipcRenderer.invoke('workspace:open'),
    create: () => ipcRenderer.invoke('workspace:create'),
    refresh: () => ipcRenderer.invoke('workspace:refresh'),
    saveDocument: (input: SaveDocumentInput) => ipcRenderer.invoke('workspace:save-document', input),
    createDocument: (input: CreateDocumentInput) => ipcRenderer.invoke('workspace:create-document', input),
    reveal: () => ipcRenderer.invoke('workspace:reveal')
  },
  sharing: {
    getState: () => ipcRenderer.invoke('sharing:get-state'),
    savePolicy: (policy: SharePolicy) => ipcRenderer.invoke('sharing:save-policy', policy),
    markUpdateRead: (notificationId: string) => ipcRenderer.invoke('sharing:mark-update-read', notificationId),
    keepUpdatePrivate: (notificationId: string) => ipcRenderer.invoke('sharing:keep-update-private', notificationId),
    export: (input: ShareExportInput) => ipcRenderer.invoke('sharing:export', input)
  },
  assistant: {
    status: () => ipcRenderer.invoke('assistant:status'),
    run: (input: AssistantInput) => ipcRenderer.invoke('assistant:run', input)
  },
  cloud: {
    getDashboard: () => ipcRenderer.invoke('cloud:get-dashboard'),
    saveApiKey: (apiKey: string) => ipcRenderer.invoke('cloud:save-api-key', apiKey),
    removeApiKey: () => ipcRenderer.invoke('cloud:remove-api-key'),
    testConnection: () => ipcRenderer.invoke('cloud:test-connection'),
    publish: (input: CloudPublishInput) => ipcRenderer.invoke('cloud:publish', input),
    start: () => ipcRenderer.invoke('cloud:start'),
    stop: () => ipcRenderer.invoke('cloud:stop'),
    sync: () => ipcRenderer.invoke('cloud:sync'),
    revokeGrant: (shareId: string, grantId: string) => ipcRenderer.invoke('cloud:revoke-grant', shareId, grantId),
    deleteShare: (shareId: string) => ipcRenderer.invoke('cloud:delete-share', shareId),
    disconnect: () => ipcRenderer.invoke('cloud:disconnect'),
    exportAvailability: (input: AvailabilityExportInput) => ipcRenderer.invoke('cloud:export-availability', input)
  },
  mcp: {
    getIntegrationInfo: () => ipcRenderer.invoke('mcp:get-integration-info')
  },
  workflows: {
    getState: () => ipcRenderer.invoke('workflows:get-state'),
    run: (input: WorkflowRunInput) => ipcRenderer.invoke('workflows:run', input),
    approve: (proposalId: string) => ipcRenderer.invoke('workflows:approve', proposalId),
    reject: (proposalId: string) => ipcRenderer.invoke('workflows:reject', proposalId)
  },
  webWatch: {
    getDashboard: () => ipcRenderer.invoke('web-watch:get-dashboard'),
    saveApiKey: (apiKey: string) => ipcRenderer.invoke('web-watch:save-api-key', apiKey),
    removeApiKey: () => ipcRenderer.invoke('web-watch:remove-api-key'),
    testConnection: () => ipcRenderer.invoke('web-watch:test-connection'),
    createMonitor: (input: WebMonitorInput) => ipcRenderer.invoke('web-watch:create-monitor', input),
    refresh: () => ipcRenderer.invoke('web-watch:refresh'),
    cancelMonitor: (monitorId: string) => ipcRenderer.invoke('web-watch:cancel-monitor', monitorId),
    prepareUpdate: (updateId: string, useAi: boolean) => ipcRenderer.invoke('web-watch:prepare-update', updateId, useAi),
    dismissUpdate: (updateId: string) => ipcRenderer.invoke('web-watch:dismiss-update', updateId)
  },
  preferences: {
    get: () => ipcRenderer.invoke('preferences:get'),
    save: (preferences: AppPreferences) => ipcRenderer.invoke('preferences:save', preferences)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
    copyText: (text: string) => ipcRenderer.invoke('shell:copy-text', text)
  },
  system: {
    platform: process.platform as 'darwin' | 'win32' | 'linux'
  }
}

contextBridge.exposeInMainWorld('knot', api)
