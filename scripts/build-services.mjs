import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const output = path.join(root, 'out', 'services')
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })

await Promise.all([
  build({
    entryPoints: [path.join(root, 'src', 'services', 'local-mcp.ts')],
    outfile: path.join(output, 'knot-mcp.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    sourcemap: false,
    legalComments: 'none'
  }),
  build({
    entryPoints: [path.join(root, 'src', 'services', 'cloud-host.ts')],
    outfile: path.join(output, 'knot-cloud-host.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    sourcemap: false,
    legalComments: 'none'
  })
])
