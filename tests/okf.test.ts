import { describe, expect, it } from 'vitest'
import { createBundle, extractLinks, parseConcept, serializeConcept, validateDocuments } from '../src/main/okf'

describe('OKF parser and validator', () => {
  it('parses the canonical fields while preserving producer extensions', () => {
    const source = `---
type: Metric
title: Retention
description: Weekly retained teams.
tags: [growth, certified]
owner: Analytics
confidence: 0.98
---

# Definition

See [accounts](/data/accounts.md).
`
    const { document, parseIssue } = parseConcept('metrics/retention.md', source)
    expect(parseIssue).toBeUndefined()
    expect(document.type).toBe('Metric')
    expect(document.tags).toEqual(['growth', 'certified'])
    expect(document.frontmatter.owner).toBe('Analytics')
    expect(document.frontmatter.confidence).toBe(0.98)
    expect(document.outboundIds).toEqual(['data/accounts'])
  })

  it('requires non-reserved concepts to have a non-empty type', () => {
    const document = parseConcept('untitled.md', `---\ntitle: Untitled\n---\nBody`).document
    expect(validateDocuments([document])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-type', severity: 'error' })
    ]))
  })

  it('accepts version frontmatter only on the root index', () => {
    const root = parseConcept('index.md', `---\nokf_version: "0.1"\ntitle: Demo\n---\n\n# Knowledge\n\n* [A](a.md) - A concept.`).document
    const concept = parseConcept('a.md', `---\ntype: Concept\ntitle: A\n---\nA`).document
    const bundle = createBundle('/demo', [root, concept])
    expect(bundle.version).toBe('0.1')
    expect(bundle.conformant).toBe(true)
  })

  it('validates log date headings', () => {
    const invalid = parseConcept('log.md', `# Log\n\n## Last week\n* Changed things.`).document
    expect(validateDocuments([invalid])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-log-date' })
    ]))
    const valid = parseConcept('log.md', `# Log\n\n## 2026-07-17\n* **Update**: Changed things.`).document
    expect(validateDocuments([valid])).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-log-date' })
    ]))
  })

  it('reports broken links as advisory without failing conformance', () => {
    const document = parseConcept('a.md', `---\ntype: Concept\n---\nSee [future](/future.md).`).document
    const bundle = createBundle('/demo', [document])
    expect(bundle.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'broken-link', severity: 'warning' })
    ]))
    expect(bundle.conformant).toBe(true)
  })

  it('resolves both relative and bundle-root links', () => {
    const result = extractLinks('[Sibling](./other.md) [Root](/root.md) [Web](https://example.com)', 'folder/here.md')
    expect(result.resolved).toEqual(['folder/other.md', 'root.md'])
  })

  it('round-trips unknown frontmatter fields', () => {
    const raw = serializeConcept({ type: 'Decision', title: 'Ship it', owner: 'Team A', reviewers: ['A', 'B'] }, '# Outcome\n\nApproved.')
    const reparsed = parseConcept('decision.md', raw).document
    expect(reparsed.frontmatter.owner).toBe('Team A')
    expect(reparsed.frontmatter.reviewers).toEqual(['A', 'B'])
    expect(reparsed.body).toContain('Approved.')
  })
})
