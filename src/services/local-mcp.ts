import { appendFile, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { parseConcept } from '../main/okf'
import { createKnowledgeMcpServer, type McpKnowledgeBundle, type McpUpdateProposal } from './knowledge-mcp'

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function markdownFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const absolute = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) await visit(absolute)
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(path.relative(root, absolute).split(path.sep).join('/'))
      if (files.length > 20_000) throw new Error('Workspace exceeds the 20,000-document MCP safety limit.')
    }
  }
  await visit(root)
  return files
}

async function loadBundle(root: string): Promise<McpKnowledgeBundle> {
  const rootStats = await stat(root)
  if (!rootStats.isDirectory()) throw new Error('MCP workspace is not a directory.')
  const documents = []
  for (const relative of await markdownFiles(root)) {
    const absolute = path.resolve(root, ...relative.split('/'))
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) continue
    const [raw, metadata] = await Promise.all([readFile(absolute, 'utf8'), stat(absolute)])
    const parsed = parseConcept(relative, raw, metadata.mtime.toISOString(), 'private').document
    if (parsed.kind === 'concept') documents.push(parsed)
  }
  return { name: path.basename(root), version: '0.1', documents }
}

async function writeProposal(root: string, proposal: McpUpdateProposal): Promise<void> {
  const inbox = path.join(root, '.knot')
  await mkdir(inbox, { recursive: true })
  await appendFile(path.join(inbox, 'mcp-proposals.jsonl'), `${JSON.stringify(proposal)}\n`, { encoding: 'utf8', mode: 0o600 })
}

async function main(): Promise<void> {
  const requested = argument('--workspace')
  if (!requested) throw new Error('Start Knot MCP with --workspace /absolute/path.')
  const root = path.resolve(requested)
  const bundle = await loadBundle(root)
  const server = createKnowledgeMcpServer(bundle, (proposal) => writeProposal(root, proposal))
  await server.connect(new StdioServerTransport())
}

main().catch((error) => {
  process.stderr.write(`Knot MCP failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
