import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import readline from 'node:readline'

const root = await mkdtemp(path.join(os.tmpdir(), 'knot-mcp-'))
await mkdir(path.join(root, 'research'))
await writeFile(path.join(root, 'alpha.md'), [
  '---', 'type: Decision', 'title: Alpha strategy', 'description: The launch decision.',
  'tags: [launch, strategy]', 'timestamp: 2026-07-17T00:00:00.000Z', '---', '',
  '# Alpha', '', 'Ship the private beta after the quality gate. See [Evidence](research/evidence.md).', ''
].join('\n'))
await writeFile(path.join(root, 'research', 'evidence.md'), [
  '---', 'type: Evidence', 'title: Beta evidence', 'description: Research supporting launch.',
  'tags: [research]', 'timestamp: 2026-07-17T00:00:00.000Z', '---', '',
  '# Evidence', '', 'Five teams completed the workflow.', ''
].join('\n'))

const child = spawn(process.execPath, [path.resolve('out/services/knot-mcp.cjs'), '--workspace', root], { stdio: ['pipe', 'pipe', 'pipe'] })
const lines = readline.createInterface({ input: child.stdout })
const pending = new Map()
let nextId = 1
let stderr = ''
child.stderr.on('data', (chunk) => { stderr += String(chunk) })
lines.on('line', (line) => {
  const message = JSON.parse(line)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
})

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`MCP timeout for ${method}: ${stderr}`)) }, 10_000)
  pending.set(id, (message) => { clearTimeout(timeout); resolve(message) })
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
})

try {
  const initialized = await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'knot-release-probe', version: '1.0.0' } })
  assert.equal(initialized.result.serverInfo.name, 'knot-knowledge')
  assert.match(initialized.result.instructions, /human-review proposal/i)
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`)

  const tools = await send('tools/list')
  assert.deepEqual(tools.result.tools.map((tool) => tool.name).sort(), ['get_concept', 'list_knowledge_types', 'propose_update', 'search_knowledge', 'trace_connections'])
  assert.equal(tools.result.tools.find((tool) => tool.name === 'search_knowledge').annotations.readOnlyHint, true)
  assert.equal(tools.result.tools.find((tool) => tool.name === 'propose_update').annotations.readOnlyHint, false)

  const search = await send('tools/call', { name: 'search_knowledge', arguments: { query: 'launch quality', limit: 5 } })
  assert.equal(search.result.structuredContent.count, 2)
  assert.ok(search.result.structuredContent.results.some((result) => result.id === 'alpha'))

  const graph = await send('tools/call', { name: 'trace_connections', arguments: { id: 'alpha', depth: 2 } })
  assert.equal(graph.result.structuredContent.edges[0].to, 'research/evidence')

  const resources = await send('resources/list')
  assert.equal(resources.result.resources.length, 2)
  assert.ok(resources.result.resources.some((resource) => resource.uri === 'okf://concept/alpha'))

  const proposal = await send('tools/call', { name: 'propose_update', arguments: { targetDocumentId: 'alpha', title: 'Clarify quality gate', body: '# Alpha\n\nAdd an accessibility gate.', reason: 'The launch checklist is incomplete.' } })
  assert.equal(proposal.result.structuredContent.status, 'awaiting-human-review')
  const inbox = await readFile(path.join(root, '.knot', 'mcp-proposals.jsonl'), 'utf8')
  assert.match(inbox, /Clarify quality gate/)
  assert.match(inbox, /targetDocumentId/)
  process.stdout.write('MCP probe passed: handshake, instructions, resources, read tools, graph, structured content, and proposal inbox.\n')
} finally {
  child.kill()
  await rm(root, { recursive: true, force: true })
}
