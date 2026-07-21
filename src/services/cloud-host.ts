import { createHash, timingSafeEqual } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { strToU8, zipSync } from 'fflate'
import { createKnowledgeMcpServer, type McpKnowledgeBundle, type McpUpdateProposal } from './knowledge-mcp'

interface RemoteGrant {
  id: string
  label: string
  kind: 'public' | 'recipient' | 'mcp'
  tokenHash?: string
  revokedAt?: string
}

interface RemoteShare {
  id: string
  name: string
  slug: string
  visibility: 'workspace' | 'public'
  allowDownload: boolean
  expiresAt?: string
  grants: RemoteGrant[]
  bundle: McpKnowledgeBundle
  revisions: Record<string, string>
}

interface RemoteWorkspaceBundle {
  generatedAt: string
  workspace: string
  shares: RemoteShare[]
}

const hostRoot = process.env.KNOT_HOST_ROOT || '/home/daytona/knot'
const port = Number(process.env.PORT || 8787)

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function safeHashEqual(provided: string, expected: string): boolean {
  const left = Buffer.from(hash(provided), 'hex')
  const right = Buffer.from(expected, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function expired(share: RemoteShare): boolean {
  return Boolean(share.expiresAt && Date.parse(share.expiresAt) <= Date.now())
}

function requestToken(request: Request, allowQuery: boolean): string {
  const authorization = request.header('authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7)
  return allowQuery && typeof request.query.access === 'string' ? request.query.access : ''
}

function canAccess(share: RemoteShare, request: Request, mcp = false): boolean {
  if (expired(share)) return false
  const publicGrant = share.grants.some((grant) => grant.kind === 'public' && !grant.revokedAt)
  if (!mcp && share.visibility === 'public' && publicGrant) return true
  // Human capability links need a query token so they remain openable in a browser.
  // MCP credentials are header-only to keep them out of URLs, history, and proxy logs.
  const token = requestToken(request, !mcp)
  return Boolean(token && share.grants.some((grant) => !grant.revokedAt && (mcp ? grant.kind === 'mcp' : grant.kind === 'recipient') && grant.tokenHash && safeHashEqual(token, grant.tokenHash)))
}

function securityHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Cache-Control', 'no-store')
  next()
}

async function main(): Promise<void> {
  const source = JSON.parse(await readFile(path.join(hostRoot, 'workspace-bundle.json'), 'utf8')) as RemoteWorkspaceBundle
  const app = express()
  app.disable('x-powered-by')
  app.use(securityHeaders)
  app.use(express.json({ limit: '1mb', type: ['application/json', 'application/*+json'] }))

  const requests = new Map<string, { count: number; resetAt: number }>()
  app.use((request, response, next) => {
    const key = request.ip || 'unknown'
    const now = Date.now()
    const entry = requests.get(key)
    const current = !entry || entry.resetAt < now ? { count: 1, resetAt: now + 60_000 } : { ...entry, count: entry.count + 1 }
    requests.set(key, current)
    if (current.count > 180) { response.status(429).json({ error: 'Too many requests' }); return }
    next()
  })

  app.get('/health', (_request, response) => response.json({ ok: true }))

  app.get('/share/:slug', (request, response) => {
    const share = source.shares.find((item) => item.slug === request.params.slug)
    if (!share || !canAccess(share, request)) { response.status(404).send('This knowledge share is unavailable.'); return }
    const access = typeof request.query.access === 'string' ? `?access=${encodeURIComponent(request.query.access)}` : ''
    const cards = share.bundle.documents.map((document) => `<article><span>${escapeHtml(document.type)}</span><h2><a href="/share/${encodeURIComponent(share.slug)}/concept/${encodeURIComponent(document.id)}${access}">${escapeHtml(document.title)}</a></h2><p>${escapeHtml(document.description || 'Knowledge concept')}</p><small>${document.tags.map(escapeHtml).join(' · ')}</small></article>`).join('')
    response.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(share.name)} · Knot</title><style>body{margin:0;background:#f4f3ef;color:#242523;font:15px/1.6 ui-sans-serif,system-ui}header,main{max-width:980px;margin:auto;padding:44px 28px}header{padding-bottom:18px}header b{color:#287267;letter-spacing:.12em;text-transform:uppercase;font-size:12px}h1{font-size:42px;line-height:1.1;margin:12px 0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;padding-top:18px}article{background:#fff;border:1px solid #deddd7;border-radius:18px;padding:22px;box-shadow:0 8px 28px #282c2410}article span,small{color:#6d706b}h2{font-size:19px;line-height:1.25}a{color:#242523;text-decoration:none}a:hover{text-decoration:underline}.download{display:inline-block;margin-top:12px;color:#287267}</style></head><body><header><b>Knot cloud knowledge</b><h1>${escapeHtml(share.name)}</h1><p>${share.bundle.documents.length} intentionally shared concepts · OKF ${escapeHtml(share.bundle.version)}</p>${share.allowDownload ? `<a class="download" href="/share/${encodeURIComponent(share.slug)}/download${access}">Download portable OKF</a>` : ''}</header><main>${cards}</main></body></html>`)
  })

  app.get('/share/:slug/concept/:id', (request, response) => {
    const share = source.shares.find((item) => item.slug === request.params.slug)
    if (!share || !canAccess(share, request)) { response.status(404).send('This concept is unavailable.'); return }
    const document = share.bundle.documents.find((item) => item.id === request.params.id)
    if (!document) { response.status(404).send('This concept is unavailable.'); return }
    response.type('text/markdown').send(document.raw)
  })

  app.get('/share/:slug/download', (request, response) => {
    const share = source.shares.find((item) => item.slug === request.params.slug)
    if (!share || !share.allowDownload || !canAccess(share, request)) { response.status(404).send('Download is unavailable.'); return }
    const files: Record<string, Uint8Array> = {}
    for (const document of share.bundle.documents) files[document.path] = strToU8(document.raw)
    files['share-manifest.json'] = strToU8(JSON.stringify({ format: 'Open Knowledge Format', okf_version: share.bundle.version, share_id: share.id, exported_at: source.generatedAt, documents: share.bundle.documents.map((document) => document.path) }, null, 2))
    response.attachment(`${share.slug}.zip`).type('application/zip').send(Buffer.from(zipSync(files, { level: 6 })))
  })

  app.all('/mcp/:shareId', async (request, response) => {
    const origin = request.header('origin')
    const allowedOrigins = (process.env.KNOT_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)
    if (origin && !allowedOrigins.includes(origin)) { response.status(403).json({ error: 'Origin not allowed' }); return }
    const share = source.shares.find((item) => item.id === request.params.shareId)
    if (!share || !canAccess(share, request, true)) {
      response.setHeader('WWW-Authenticate', 'Bearer realm="Knot knowledge"')
      response.status(401).json({ error: 'Unauthorized' })
      return
    }
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      const server = createKnowledgeMcpServer(share.bundle, async (proposal: McpUpdateProposal) => {
        await mkdir(hostRoot, { recursive: true })
        await appendFile(path.join(hostRoot, 'mcp-proposals.jsonl'), `${JSON.stringify({ ...proposal, shareId: share.id })}\n`, { encoding: 'utf8', mode: 0o600 })
      })
      await server.connect(transport)
      await transport.handleRequest(request, response, request.body)
      response.on('close', () => { void transport.close(); void server.close() })
    } catch (error) {
      process.stderr.write(`MCP request failed: ${error instanceof Error ? error.message : String(error)}\n`)
      if (!response.headersSent) response.status(500).json({ error: 'MCP request failed' })
    }
  })

  app.use((_request, response) => response.status(404).send('Not found'))
  app.listen(port, '0.0.0.0', () => process.stderr.write(`Knot cloud host ready on ${port}\n`))
}

main().catch((error) => {
  process.stderr.write(`Knot cloud host failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
