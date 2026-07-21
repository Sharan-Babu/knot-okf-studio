import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeFileAtomically } from '../src/main/atomic-file'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe('atomic file writes', () => {
  it('serializes concurrent writes without sharing or leaking a staging path', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'knot-atomic-file-'))
    roots.push(root)
    const target = path.join(root, 'state.json')
    await Promise.all(Array.from({ length: 40 }, (_, index) => writeFileAtomically(target, JSON.stringify({ index }), { encoding: 'utf8', mode: 0o600 })))
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual({ index: 39 })
    expect(await readdir(root)).toEqual(['state.json'])
  })
})
