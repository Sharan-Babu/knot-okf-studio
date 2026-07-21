import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const root = await mkdtemp(path.join(os.tmpdir(), 'knot-cloud-host-'))
const port = 19000 + Math.floor(Math.random() * 1000)
const endpoint = `http://127.0.0.1:${port}`
const recipientToken = 'recipient-capability-for-probe'
const mcpToken = 'mcp-capability-for-probe'
const hash = (value) => createHash('sha256').update(value).digest('hex')
const document = {
  id: 'launch-decision', path: 'launch-decision.md', title: 'Launch decision', type: 'Decision',
  description: 'An intentionally shared decision.', tags: ['launch'], body: '# Launch\n\nProceed after review.',
  raw: '---\ntype: Decision\ntitle: Launch decision\n---\n\n# Launch\n\nProceed after review.\n', outboundIds: [], modifiedAt: new Date().toISOString()
}
const share = (id, slug, visibility, grants, allowDownload = false) => ({
  id, name: visibility === 'public' ? 'Public brief' : 'Partner room', slug, visibility, allowDownload,
  grants, bundle: { name: 'Probe', version: '0.1', documents: [document] }, revisions: { 'launch-decision': 'abc123' }
})
await writeFile(path.join(root, 'workspace-bundle.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), workspace: 'Probe workspace', shares: [
    share('public-share', 'public-brief', 'public', [{ id: 'public', label: 'Public', kind: 'public' }], true),
    share('private-share', 'partner-room', 'workspace', [
      { id: 'recipient', label: 'Partner', kind: 'recipient', tokenHash: hash(recipientToken) },
      { id: 'mcp', label: 'Agent', kind: 'mcp', tokenHash: hash(mcpToken) }
    ])
  ]
}), 'utf8')

const child = spawn(process.execPath, [path.resolve('out/services/knot-cloud-host.cjs')], {
  env: { ...process.env, PORT: String(port), KNOT_HOST_ROOT: root },
  stdio: ['ignore', 'ignore', 'pipe']
})
let stderr = ''
child.stderr.on('data', (chunk) => { stderr += String(chunk) })

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${endpoint}/health`)).ok) return } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Cloud host did not start: ${stderr}`)
}

async function rpc(id, method, params = {}, token = mcpToken, origin) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` }
  if (origin) headers.origin = origin
  return fetch(`${endpoint}/mcp/private-share`, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, params }) })
}

try {
  await waitForHealth()
  assert.equal((await fetch(`${endpoint}/share/public-brief`)).status, 200)
  const publicHtml = await (await fetch(`${endpoint}/share/public-brief`)).text()
  assert.match(publicHtml, /Public brief/)
  assert.match(publicHtml, /Download portable OKF/)
  assert.equal((await fetch(`${endpoint}/share/public-brief/download`)).headers.get('content-type'), 'application/zip')

  assert.equal((await fetch(`${endpoint}/share/partner-room`)).status, 404)
  assert.equal((await fetch(`${endpoint}/share/partner-room?access=wrong`)).status, 404)
  assert.equal((await fetch(`${endpoint}/share/partner-room?access=${recipientToken}`)).status, 200)
  assert.equal((await fetch(`${endpoint}/share/partner-room/concept/launch-decision?access=${recipientToken}`)).status, 200)
  assert.equal((await fetch(`${endpoint}/share/partner-room/download?access=${recipientToken}`)).status, 404)

  assert.equal((await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } }, 'wrong')).status, 401)
  assert.equal((await fetch(`${endpoint}/mcp/private-share?access=${mcpToken}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } } })
  })).status, 401)
  assert.equal((await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } }, recipientToken)).status, 401)
  assert.equal((await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } }, mcpToken, 'https://evil.example')).status, 403)
  const initialized = await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } })
  assert.equal(initialized.status, 200)
  assert.equal((await initialized.json()).result.serverInfo.name, 'knot-knowledge')
  await rpc(undefined, 'notifications/initialized')
  const tools = await rpc(2, 'tools/list')
  const toolsBody = await tools.text()
  assert.equal(tools.status, 200, toolsBody || stderr)
  const toolNames = JSON.parse(toolsBody).result.tools.map((tool) => tool.name)
  assert.ok(toolNames.includes('search_knowledge'))
  assert.ok(toolNames.includes('propose_update'))
  const proposed = await rpc(3, 'tools/call', { name: 'propose_update', arguments: { targetDocumentId: 'launch-decision', title: 'Clarify the gate', body: '# Launch\n\nProceed after accessibility review.', reason: 'Quality criteria should be explicit.' } })
  const proposedBody = await proposed.text()
  assert.equal(proposed.status, 200, proposedBody || stderr)
  assert.equal(JSON.parse(proposedBody).result.structuredContent.status, 'awaiting-human-review')
  assert.match(await readFile(path.join(root, 'mcp-proposals.jsonl'), 'utf8'), /Clarify the gate/)
  process.stdout.write('Cloud host probe passed: public/private portals, scoped downloads, header-only bearer MCP, Origin defense, tools, and proposal inbox.\n')
} finally {
  child.kill()
  await rm(root, { recursive: true, force: true })
}
