import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const queues = new Map<string, Promise<void>>()

export function writeFileAtomically(
  target: string,
  content: string | Uint8Array,
  options: { encoding?: BufferEncoding; mode?: number } = {}
): Promise<void> {
  const previous = queues.get(target) ?? Promise.resolve()
  const operation = previous.catch(() => undefined).then(async () => {
    await mkdir(path.dirname(target), { recursive: true })
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, content, options)
      await rename(temporary, target)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  })
  queues.set(target, operation)
  operation.then(
    () => { if (queues.get(target) === operation) queues.delete(target) },
    () => { if (queues.get(target) === operation) queues.delete(target) }
  )
  return operation
}
