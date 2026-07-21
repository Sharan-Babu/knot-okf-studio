import matter from 'gray-matter'
import path from 'node:path'
import YAML from 'yaml'
import type {
  BundleDocument,
  BundleStats,
  ValidationIssue,
  Visibility,
  WorkspaceBundle
} from '../shared/types'

const RESERVED = new Set(['index.md', 'log.md'])
const DATE_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/gm
const MARKDOWN_LINK = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

function safeTitle(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  return []
}

function countWords(body: string): number {
  const plain = body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`|\[\]()!-]/g, ' ')
  return plain.trim() ? plain.trim().split(/\s+/).length : 0
}

export function extractLinks(body: string, documentPath: string): { raw: string[]; resolved: string[] } {
  const raw: string[] = []
  const resolved: string[] = []
  for (const match of body.matchAll(MARKDOWN_LINK)) {
    const target = match[1]
    if (!target || /^(https?:|mailto:|tel:|#)/i.test(target)) continue
    raw.push(target)
    const withoutAnchor = target.split(/[?#]/, 1)[0]
    let normalized = withoutAnchor.startsWith('/')
      ? path.posix.normalize(withoutAnchor.slice(1))
      : path.posix.normalize(path.posix.join(path.posix.dirname(documentPath), withoutAnchor))
    if (normalized.endsWith('/')) normalized += 'index.md'
    if (!path.posix.extname(normalized)) normalized += '.md'
    resolved.push(normalized)
  }
  return { raw, resolved }
}

export function parseConcept(
  documentPath: string,
  raw: string,
  modifiedAt = new Date().toISOString(),
  visibility: Visibility = 'private'
): { document: BundleDocument; parseIssue?: ValidationIssue } {
  const filename = path.posix.basename(documentPath)
  const kind = filename === 'index.md' ? 'index' : filename === 'log.md' ? 'log' : 'concept'
  let frontmatter: Record<string, unknown> = {}
  let body = raw
  let parseIssue: ValidationIssue | undefined

  try {
    const parsed = matter(raw, {
      engines: { yaml: (source) => YAML.parse(source) as Record<string, unknown> },
      language: 'yaml'
    })
    frontmatter = (parsed.data ?? {}) as Record<string, unknown>
    body = parsed.content.replace(/^\n/, '')
  } catch (error) {
    parseIssue = {
      id: `${documentPath}:yaml`,
      path: documentPath,
      severity: 'error',
      code: 'invalid-yaml',
      message: error instanceof Error ? `Frontmatter is not valid YAML: ${error.message}` : 'Frontmatter is not valid YAML.'
    }
  }

  const linkData = extractLinks(body, documentPath)
  const type = typeof frontmatter.type === 'string' ? frontmatter.type.trim() : ''
  const title = typeof frontmatter.title === 'string' && frontmatter.title.trim()
    ? frontmatter.title.trim()
    : safeTitle(filename)
  const description = typeof frontmatter.description === 'string' ? frontmatter.description : ''
  const resource = typeof frontmatter.resource === 'string' ? frontmatter.resource : undefined
  const timestamp = frontmatter.timestamp ? String(frontmatter.timestamp) : undefined

  return {
    document: {
      id: documentPath.replace(/\.md$/i, ''),
      path: documentPath,
      filename,
      kind,
      title,
      type,
      description,
      resource,
      tags: normalizeTags(frontmatter.tags),
      timestamp,
      frontmatter,
      body,
      raw,
      links: linkData.raw,
      outboundIds: linkData.resolved.map((target) => target.replace(/\.md$/i, '')),
      wordCount: countWords(body),
      modifiedAt,
      visibility
    },
    parseIssue
  }
}

export function validateDocuments(documents: BundleDocument[], parseIssues: ValidationIssue[] = []): ValidationIssue[] {
  const issues = [...parseIssues]
  const paths = new Set(documents.map((document) => document.path))

  for (const document of documents) {
    if (document.kind === 'concept') {
      if (!document.raw.startsWith('---')) {
        issues.push({
          id: `${document.path}:frontmatter`,
          path: document.path,
          severity: 'error',
          code: 'missing-frontmatter',
          message: 'Concept documents must start with YAML frontmatter.'
        })
      }
      if (!document.type) {
        issues.push({
          id: `${document.path}:type`,
          path: document.path,
          severity: 'error',
          code: 'missing-type',
          message: 'Add a non-empty “type” field to the frontmatter.'
        })
      }
      if (!document.description) {
        issues.push({
          id: `${document.path}:description`,
          path: document.path,
          severity: 'info',
          code: 'missing-description',
          message: 'A one-line description improves indexes, search, and previews.'
        })
      }
    }

    if (document.kind === 'index') {
      const isRoot = document.path === 'index.md'
      const hasFrontmatter = document.raw.startsWith('---')
      if (hasFrontmatter && (!isRoot || !document.frontmatter.okf_version)) {
        issues.push({
          id: `${document.path}:reserved-frontmatter`,
          path: document.path,
          severity: 'error',
          code: 'reserved-frontmatter',
          message: 'Only the bundle-root index may use frontmatter, and it must declare okf_version.'
        })
      }
      if (document.body.trim() && !/^#\s+.+/m.test(document.body)) {
        issues.push({
          id: `${document.path}:index-heading`,
          path: document.path,
          severity: 'error',
          code: 'invalid-index',
          message: 'Index files group entries beneath Markdown section headings.'
        })
      }
    }

    if (document.kind === 'log') {
      if (document.raw.startsWith('---')) {
        issues.push({
          id: `${document.path}:log-frontmatter`,
          path: document.path,
          severity: 'error',
          code: 'reserved-frontmatter',
          message: 'log.md is a reserved document and cannot contain frontmatter.'
        })
      }
      const dateHeadings = [...document.body.matchAll(DATE_HEADING)]
      const allLevelTwo = [...document.body.matchAll(/^##\s+(.+)$/gm)]
      if (document.body.trim() && (dateHeadings.length === 0 || dateHeadings.length !== allLevelTwo.length)) {
        issues.push({
          id: `${document.path}:log-dates`,
          path: document.path,
          severity: 'error',
          code: 'invalid-log-date',
          message: 'Every log section must use an ISO 8601 date heading: ## YYYY-MM-DD.'
        })
      }
    }

    for (const targetId of document.outboundIds) {
      const targetPath = `${targetId}.md`
      if (!paths.has(targetPath)) {
        issues.push({
          id: `${document.path}:broken:${targetId}`,
          path: document.path,
          severity: 'warning',
          code: 'broken-link',
          message: `Linked concept “${targetPath}” is not present. OKF consumers must tolerate this, but readers may not.`
        })
      }
    }
  }

  return issues
}

export function calculateStats(documents: BundleDocument[], issues: ValidationIssue[]): BundleStats {
  const concepts = documents.filter((document) => document.kind === 'concept')
  const recommended = concepts.reduce((score, document) => {
    return score + Number(Boolean(document.title)) + Number(Boolean(document.description)) +
      Number(Boolean(document.tags.length)) + Number(Boolean(document.timestamp))
  }, 0)
  return {
    concepts: concepts.length,
    types: new Set(concepts.map((document) => document.type).filter(Boolean)).size,
    links: documents.reduce((sum, document) => sum + document.outboundIds.length, 0),
    words: concepts.reduce((sum, document) => sum + document.wordCount, 0),
    coverage: concepts.length ? Math.round((recommended / (concepts.length * 4)) * 100) : 100,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length
  }
}

export function createBundle(
  rootPath: string,
  documents: BundleDocument[],
  parseIssues: ValidationIssue[] = []
): WorkspaceBundle {
  const issues = validateDocuments(documents, parseIssues)
  const stats = calculateStats(documents, issues)
  const rootIndex = documents.find((document) => document.path === 'index.md')
  return {
    rootPath,
    name: rootIndex?.title !== 'Index' ? rootIndex?.title ?? path.basename(rootPath) : path.basename(rootPath),
    version: String(rootIndex?.frontmatter.okf_version ?? '0.1'),
    documents: documents.sort((a, b) => a.path.localeCompare(b.path)),
    issues,
    stats,
    conformant: stats.errors === 0,
    loadedAt: new Date().toISOString()
  }
}

export function serializeConcept(frontmatter: Record<string, unknown>, body: string): string {
  const normalized = { ...frontmatter }
  if (normalized.tags && Array.isArray(normalized.tags) && normalized.tags.length === 0) delete normalized.tags
  return matter.stringify(body.trimStart(), normalized, {
    language: 'yaml',
    engines: { yaml: {
      parse: (input) => YAML.parse(input) as Record<string, unknown>,
      stringify: (value) => YAML.stringify(value, { lineWidth: 0 }).trim()
    } }
  }).replace(/^---\n\n/, '---\n')
}

export function isReservedFilename(filename: string): boolean {
  return RESERVED.has(filename.toLowerCase())
}
