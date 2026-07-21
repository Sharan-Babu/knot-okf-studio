import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { dialog } from 'electron'
import { strToU8, zipSync } from 'fflate'
import { z } from 'zod'
import type {
  AvailabilityExportInput,
  AvailabilityExportResult,
  BundleDocument,
  WorkspaceBundle
} from '../shared/types'

const availabilitySchema = z.object({
  target: z.enum(['synced-folder', 'self-host']),
  provider: z.enum(['google-drive', 'dropbox', 'box', 'other']).optional(),
  name: z.string().trim().min(1).max(120).regex(/^[^\r\n\0]+$/, 'Share names cannot contain control characters.'),
  documentIds: z.array(z.string().min(1).max(500)).min(1).max(10_000),
  visibility: z.enum(['workspace', 'public']),
  audienceIds: z.array(z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Audience identifiers contain unsupported characters.')).max(100),
  includeDependencies: z.boolean(),
  allowDownload: z.boolean(),
  expiresAt: z.string().max(40).optional()
})

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'knowledge-share'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function addDependencies(selected: Set<string>, documents: BundleDocument[]): Set<string> {
  const byId = new Map(documents.map((document) => [document.id, document]))
  const queue = [...selected]
  while (queue.length) {
    for (const target of byId.get(queue.shift()!)?.outboundIds ?? []) {
      if (byId.has(target) && !selected.has(target)) { selected.add(target); queue.push(target) }
    }
  }
  return selected
}

function selectDocuments(bundle: WorkspaceBundle, input: AvailabilityExportInput): BundleDocument[] {
  let selected = new Set(input.documentIds)
  if (input.includeDependencies) selected = addDependencies(selected, bundle.documents)
  const documents = bundle.documents.filter((document) => document.kind === 'concept' && selected.has(document.id))
  if (!documents.length) throw new Error('Choose at least one knowledge concept to publish.')
  const required = input.visibility === 'public' ? 2 : 1
  const rank = { private: 0, workspace: 1, public: 2 }
  const blocked = documents.filter((document) => rank[document.visibility] < required)
  if (blocked.length) {
    throw new Error(`Sharing intent blocks this publication: ${blocked.slice(0, 3).map((document) => document.title).join(', ')}${blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''}. Review sharing intent first.`)
  }
  return documents
}

function releaseRevision(documents: BundleDocument[], input: AvailabilityExportInput): string {
  const value = JSON.stringify({
    documentIds: documents.map((document) => document.id),
    revisions: documents.map((document) => createHash('sha256').update(document.raw).digest('hex')),
    visibility: input.visibility,
    audienceIds: input.audienceIds,
    allowDownload: input.allowDownload
  })
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function safeDocumentPath(relative: string): string[] {
  const pieces = relative.replaceAll('\\', '/').split('/').filter(Boolean)
  if (!pieces.length || pieces.includes('..')) throw new Error('A knowledge document has an unsafe path.')
  return pieces
}

function portalIndex(name: string, version: string, documents: BundleDocument[], revision: string): string {
  const rows = documents.map((document, index) => {
    const filename = `${String(index + 1).padStart(3, '0')}-${slug(document.title)}.html`
    return `<li><a href="concepts/${filename}"><span>${escapeHtml(document.type)}</span><strong>${escapeHtml(document.title)}</strong><small>${escapeHtml(document.description || 'Knowledge concept')}</small></a></li>`
  }).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(name)} · Knot</title><style>:root{font:15px/1.55 ui-sans-serif,system-ui;color:#242523;background:#f5f4f0}*{box-sizing:border-box}body{margin:0}header,main{max-width:920px;margin:auto;padding:42px 28px}header{padding-bottom:16px;border-bottom:1px solid #d9d8d2}p,small,header span{color:#696b67}h1{font-size:clamp(2rem,6vw,3.2rem);line-height:1.05;margin:.35rem 0 1rem}ul{list-style:none;padding:0;margin:0}li{border-bottom:1px solid #dddcd6}li a{display:grid;grid-template-columns:140px minmax(0,1fr);gap:5px 20px;padding:18px 4px;color:inherit;text-decoration:none}li a:hover strong{text-decoration:underline}li span{grid-row:1/3;color:#287267;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}li strong{font-size:1rem}li small{grid-column:2}@media(max-width:620px){li a{grid-template-columns:1fr}li span,li small{grid-column:1;grid-row:auto}}@media(prefers-color-scheme:dark){:root{color:#f1f0eb;background:#1e201f}p,small,header span{color:#adafa9}header,li{border-color:#3d3f3b}}</style></head><body><header><span>Knot durable knowledge</span><h1>${escapeHtml(name)}</h1><p>${documents.length} intentionally selected concepts · OKF ${escapeHtml(version)} · release ${revision}</p></header><main><ul>${rows}</ul></main></body></html>`
}

function conceptPage(document: BundleDocument, name: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(document.title)} · ${escapeHtml(name)}</title><style>:root{font:15px/1.65 ui-sans-serif,system-ui;color:#242523;background:#f5f4f0}body{max-width:820px;margin:auto;padding:38px 26px}a{color:#287267}p{color:#696b67}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;border:1px solid #d9d8d2;padding:22px;border-radius:8px;font:13px/1.65 ui-monospace,monospace}@media(prefers-color-scheme:dark){:root{color:#f1f0eb;background:#1e201f}p{color:#adafa9}pre{background:#282a28;border-color:#3d3f3b}}</style></head><body><a href="../index.html">← All concepts</a><h1>${escapeHtml(document.title)}</h1><p>${escapeHtml(document.type)} · ${document.tags.map(escapeHtml).join(' · ')}</p><pre>${escapeHtml(document.raw)}</pre></body></html>`
}

async function writeStaticRelease(root: string, bundle: WorkspaceBundle, documents: BundleDocument[], input: AvailabilityExportInput, revision: string): Promise<void> {
  const releaseRoot = path.join(root, 'releases', revision)
  await mkdir(path.join(releaseRoot, 'concepts'), { recursive: true })
  await mkdir(path.join(releaseRoot, 'okf'), { recursive: true })
  await Promise.all(documents.map(async (document, index) => {
    const filename = `${String(index + 1).padStart(3, '0')}-${slug(document.title)}.html`
    await writeFile(path.join(releaseRoot, 'concepts', filename), conceptPage(document, input.name), 'utf8')
    const target = path.join(releaseRoot, 'okf', ...safeDocumentPath(document.path))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, document.raw, 'utf8')
  }))
  const generatedAt = new Date().toISOString()
  const manifest = {
    format: 'Open Knowledge Format', okf_version: bundle.version, exported_by: 'Knot', exported_at: generatedAt,
    release: revision, name: input.name, visibility_intent: input.visibility, audience_labels: input.audienceIds,
    provider: input.provider ?? 'other', documents: documents.map((document) => document.path)
  }
  await writeFile(path.join(releaseRoot, 'index.html'), portalIndex(input.name, bundle.version, documents, revision), 'utf8')
  await writeFile(path.join(releaseRoot, 'share-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  await writeFile(path.join(root, 'current.json'), JSON.stringify({ release: revision, generated_at: generatedAt, path: `releases/${revision}/` }, null, 2), 'utf8')
  await writeFile(path.join(root, 'index.html'), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=releases/${revision}/index.html"><title>${escapeHtml(input.name)}</title><a href="releases/${revision}/index.html">Open the latest knowledge release</a>`, 'utf8')
  await writeFile(path.join(root, 'HOW-TO-SHARE.md'), `# Share this Knot publication\n\nThis folder contains immutable OKF releases. Share the whole folder from Google Drive, Dropbox, Box, or another sync provider. The provider—not Knot—enforces account identity, organization policy, link expiry, and revocation.\n\n- \`index.html\` opens the latest release.\n- \`current.json\` identifies the latest immutable revision.\n- \`releases/\` retains older revisions for recovery and audit.\n- Re-publish from Knot to update this folder without changing the folder you shared.\n\nA provider link is a bearer capability unless you configure the provider to require named sign-in. Do not publish this folder publicly unless every included concept is intended for public access.\n`, 'utf8')
}

function selfHostBundle(bundle: WorkspaceBundle, documents: BundleDocument[], input: AvailabilityExportInput, revision: string): { files: Record<string, Uint8Array>; access: string } {
  const shareId = crypto.randomUUID()
  const shareSlug = `${slug(input.name)}-${revision.slice(0, 6)}`
  const grants: Array<Record<string, unknown>> = []
  const accessLines: string[] = ['# Access links', '', 'Replace `https://YOUR_HOST` after deployment.', '']
  if (input.visibility === 'public') {
    grants.push({ id: crypto.randomUUID(), label: 'Public link', kind: 'public' })
    accessLines.push(`- Public portal: \`https://YOUR_HOST/share/${shareSlug}\``)
  } else {
    for (const audienceId of input.audienceIds) {
      const token = randomBytes(32).toString('base64url')
      grants.push({ id: crypto.randomUUID(), label: audienceId, kind: 'recipient', tokenHash: createHash('sha256').update(token).digest('hex') })
      accessLines.push(`- ${audienceId}: \`https://YOUR_HOST/share/${shareSlug}?access=${token}\``)
    }
  }
  const mcpToken = randomBytes(32).toString('base64url')
  grants.push({ id: crypto.randomUUID(), label: 'Agent access', kind: 'mcp', tokenHash: createHash('sha256').update(mcpToken).digest('hex') })
  accessLines.push('', `- MCP endpoint: \`https://YOUR_HOST/mcp/${shareId}\``, `- MCP authorization: \`Bearer ${mcpToken}\``)
  accessLines.push('', 'Anyone holding a private URL or bearer token can use or forward it. Rotate access by exporting and deploying a new kit.')
  const remoteBundle = {
    format: 'knot-cloud-bundle', version: 1, generatedAt: new Date().toISOString(), workspace: bundle.name,
    shares: [{ id: shareId, name: input.name, slug: shareSlug, visibility: input.visibility, allowDownload: input.allowDownload,
      expiresAt: input.expiresAt, grants, bundle: { name: input.name, version: bundle.version, documents },
      revisions: Object.fromEntries(documents.map((document) => [document.id, createHash('sha256').update(document.raw).digest('hex').slice(0, 16)])) }]
  }
  const files: Record<string, Uint8Array> = {
    'compose.yaml': strToU8(`services:\n  knot:\n    build: .\n    restart: unless-stopped\n    ports:\n      - "\${KNOT_PORT:-8787}:8787"\n    environment:\n      PORT: "8787"\n      KNOT_HOST_ROOT: /data\n      KNOT_ALLOWED_ORIGINS: "\${KNOT_ALLOWED_ORIGINS:-}"\n    volumes:\n      - ./data:/data\n    read_only: true\n    tmpfs:\n      - /tmp:size=16m\n    cap_drop:\n      - ALL\n    security_opt:\n      - no-new-privileges:true\n`),
    'Dockerfile': strToU8('FROM node:22-alpine\nWORKDIR /app\nCOPY knot-cloud-host.cjs ./\nUSER node\nEXPOSE 8787\nCMD ["node", "/app/knot-cloud-host.cjs"]\n'),
    '.env.example': strToU8('KNOT_PORT=8787\nKNOT_ALLOWED_ORIGINS=\n'),
    'data/workspace-bundle.json': strToU8(JSON.stringify(remoteBundle, null, 2)),
    'data/mcp-proposals.jsonl': strToU8(''),
    'ACCESS.md': strToU8(`${accessLines.join('\n')}\n`),
    'README.md': strToU8(`# Self-host ${input.name}\n\nThis release runs Knot's scoped portal and Streamable HTTP MCP server on a host you control.\n\n1. Extract this archive on a server with Docker Compose.\n2. Copy \`.env.example\` to \`.env\` and set the public port and allowed browser origins if needed.\n3. Run \`docker compose up -d --build\`.\n4. Put an HTTPS reverse proxy in front of the service before sharing any URL or token.\n5. Read \`ACCESS.md\` for the generated capabilities. Keep that file secret.\n\nThe container has a read-only root filesystem and writes proposals only to \`data/mcp-proposals.jsonl\`. Back up the data directory. To review remote proposals in Knot, securely copy that JSONL file to \`.knot/mcp-proposals.jsonl\` in the local OKF workspace, open Workflows, and approve or reject each item. Never apply proposal text directly.\n\nA user-controlled host determines uptime; unlike Daytona auto-stop, there is no Knot-managed sleep or wake behavior. Re-export and redeploy to update knowledge or rotate capabilities.\n`)
  }
  return { files, access: accessLines.join('\n') }
}

interface ExportOptions {
  window: BrowserWindow
  bundle: WorkspaceBundle
  input: AvailabilityExportInput
  hostBundlePath: string
}

export async function exportAvailability(options: ExportOptions): Promise<AvailabilityExportResult> {
  const input = availabilitySchema.parse(options.input)
  if (input.visibility === 'workspace' && !input.audienceIds.length) throw new Error('Choose at least one audience label for a private publication.')
  const documents = selectDocuments(options.bundle, input)
  const revision = releaseRevision(documents, input)
  const baseName = `Knot-${slug(input.name)}`
  const testRoot = process.env.NODE_ENV === 'test' ? process.env.KNOT_TEST_AVAILABILITY_PATH : undefined

  if (input.target === 'synced-folder') {
    let parent = testRoot
    if (!parent) {
      const result = await dialog.showOpenDialog(options.window, { title: 'Choose a synced folder', properties: ['openDirectory', 'createDirectory'] })
      if (result.canceled || !result.filePaths[0]) return { canceled: true, target: input.target }
      parent = result.filePaths[0]
    }
    const output = path.join(parent, baseName)
    await writeStaticRelease(output, options.bundle, documents, input, revision)
    return { canceled: false, target: input.target, path: output, count: documents.length, revision }
  }

  let output = testRoot ? path.join(testRoot, `${baseName}-self-host.zip`) : undefined
  if (!output) {
    const result = await dialog.showSaveDialog(options.window, { title: 'Export a Knot self-host kit', defaultPath: `${baseName}-self-host.zip`, filters: [{ name: 'ZIP archive', extensions: ['zip'] }] })
    if (result.canceled || !result.filePath) return { canceled: true, target: input.target }
    output = result.filePath
  }
  await mkdir(path.dirname(output), { recursive: true })
  const kit = selfHostBundle(options.bundle, documents, input, revision)
  kit.files['knot-cloud-host.cjs'] = new Uint8Array(await readFile(options.hostBundlePath))
  await writeFile(output, zipSync(kit.files, { level: 6 }))
  return { canceled: false, target: input.target, path: output, count: documents.length, revision }
}
