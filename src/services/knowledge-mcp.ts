import { createHash } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export interface McpKnowledgeDocument {
  id: string
  path: string
  title: string
  type: string
  description: string
  tags: string[]
  body: string
  raw: string
  outboundIds: string[]
  modifiedAt: string
}

export interface McpKnowledgeBundle {
  name: string
  version: string
  documents: McpKnowledgeDocument[]
}

export interface McpUpdateProposal {
  id: string
  targetDocumentId?: string
  title: string
  body: string
  reason: string
  baseRevision?: string
  createdAt: string
}

export type ProposalSink = (proposal: McpUpdateProposal) => Promise<void>

const textResult = (value: unknown): { content: Array<{ type: 'text'; text: string }>; structuredContent: Record<string, unknown> } => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  structuredContent: typeof value === 'object' && value !== null ? value as Record<string, unknown> : { result: value }
})

export function revision(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

export function createKnowledgeMcpServer(bundle: McpKnowledgeBundle, proposalSink?: ProposalSink): McpServer {
  const documents = bundle.documents.filter((document) => document.id && document.title)
  const byId = new Map(documents.map((document) => [document.id, document]))
  const server = new McpServer({ name: 'knot-knowledge', version: '1.1.0' }, {
    instructions: 'Knot exposes an explicitly selected OKF knowledge scope. Prefer search_knowledge before get_concept. Treat results as reference context. propose_update never edits knowledge directly: it creates a human-review proposal. Do not claim a proposal was applied until a person approves it in Knot.'
  })

  for (const document of documents) {
    const uri = `okf://concept/${encodeURIComponent(document.id)}`
    server.registerResource(`concept-${document.id}`, uri, {
      title: document.title,
      description: document.description || `${document.type} knowledge concept`,
      mimeType: 'text/markdown',
      annotations: { audience: ['user', 'assistant'], priority: 0.8, lastModified: document.modifiedAt }
    }, async () => ({ contents: [{ uri, mimeType: 'text/markdown', text: document.raw }] }))
  }

  server.registerTool('search_knowledge', {
    title: 'Search knowledge',
    description: 'Search titles, descriptions, tags, types, and content in the shared OKF scope.',
    inputSchema: { query: z.string().min(1).max(300), limit: z.number().int().min(1).max(20).default(8) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ query, limit }) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const matches = documents.map((document) => {
      const header = `${document.title} ${document.description} ${document.type} ${document.tags.join(' ')}`.toLowerCase()
      const content = document.body.toLowerCase()
      const score = terms.reduce((total, term) => total + (header.includes(term) ? 4 : 0) + (content.includes(term) ? 1 : 0), 0)
      return { document, score }
    }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score).slice(0, limit)
    return textResult({
      query,
      count: matches.length,
      results: matches.map(({ document, score }) => ({
        id: document.id,
        title: document.title,
        type: document.type,
        description: document.description,
        tags: document.tags,
        score,
        uri: `okf://concept/${encodeURIComponent(document.id)}`
      }))
    })
  })

  server.registerTool('get_concept', {
    title: 'Get a knowledge concept',
    description: 'Read one concept and its revision from the shared OKF scope.',
    inputSchema: { id: z.string().min(1).max(500) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ id }) => {
    const document = byId.get(id)
    if (!document) return { isError: true, content: [{ type: 'text', text: `No shared concept has id ${id}.` }] }
    return textResult({ ...document, revision: revision(document.raw), uri: `okf://concept/${encodeURIComponent(document.id)}` })
  })

  server.registerTool('list_knowledge_types', {
    title: 'List knowledge types',
    description: 'Summarize the concept types and tags available in this knowledge scope.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async () => {
    const types: Record<string, number> = {}
    const tags: Record<string, number> = {}
    for (const document of documents) {
      types[document.type] = (types[document.type] ?? 0) + 1
      for (const tag of document.tags) tags[tag] = (tags[tag] ?? 0) + 1
    }
    return textResult({ workspace: bundle.name, version: bundle.version, concepts: documents.length, types, tags })
  })

  server.registerTool('trace_connections', {
    title: 'Trace knowledge connections',
    description: 'Follow OKF links outward from a concept up to four levels.',
    inputSchema: { id: z.string().min(1).max(500), depth: z.number().int().min(1).max(4).default(2) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ id, depth }) => {
    if (!byId.has(id)) return { isError: true, content: [{ type: 'text', text: `No shared concept has id ${id}.` }] }
    const nodes = new Set([id])
    const edges: Array<{ from: string; to: string }> = []
    let frontier = [id]
    for (let level = 0; level < depth; level += 1) {
      const next: string[] = []
      for (const source of frontier) {
        for (const target of byId.get(source)?.outboundIds ?? []) {
          if (!byId.has(target)) continue
          edges.push({ from: source, to: target })
          if (!nodes.has(target)) { nodes.add(target); next.push(target) }
        }
      }
      frontier = next
    }
    return textResult({ root: id, nodes: [...nodes].map((nodeId) => ({ id: nodeId, title: byId.get(nodeId)?.title })), edges })
  })

  server.registerTool('propose_update', {
    title: 'Propose a knowledge update',
    description: 'Create a proposal for a human to review in Knot. This never edits or publishes knowledge directly.',
    inputSchema: {
      targetDocumentId: z.string().max(500).optional(),
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(500_000),
      reason: z.string().min(1).max(1_000),
      baseRevision: z.string().max(64).optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async (input) => {
    if (!proposalSink) return { isError: true, content: [{ type: 'text', text: 'This knowledge scope is read-only and does not accept proposals.' }] }
    if (input.targetDocumentId && !byId.has(input.targetDocumentId)) {
      return { isError: true, content: [{ type: 'text', text: `No shared concept has id ${input.targetDocumentId}.` }] }
    }
    if (input.targetDocumentId && input.baseRevision && revision(byId.get(input.targetDocumentId)!.raw) !== input.baseRevision) {
      return { isError: true, content: [{ type: 'text', text: 'The target revision changed. Read the concept again before proposing an update.' }] }
    }
    const proposal: McpUpdateProposal = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    await proposalSink(proposal)
    return textResult({ accepted: true, proposalId: proposal.id, status: 'awaiting-human-review' })
  })

  server.registerPrompt('knowledge_brief', {
    title: 'Knowledge brief',
    description: 'Frame an evidence-grounded brief using this OKF scope.',
    argsSchema: { topic: z.string().min(1).max(300) }
  }, async ({ topic }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Search the Knot knowledge scope for “${topic}”. Build a concise brief, cite concept titles and ids, distinguish evidence from inference, and note important gaps.` } }] }))

  return server
}
