import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const capturePath = path.join(root, 'artifacts', 'build-week-video', 'capture', 'capture-frames.json')
const outputPath = path.join(root, 'artifacts', 'build-week-video', 'capture', 'frames.ffconcat')
const capture = JSON.parse(await readFile(capturePath, 'utf8'))
const frames = capture.frames

if (!Array.isArray(frames) || frames.length < 2) throw new Error('The demo capture does not contain enough frames.')

const firstTimestamp = frames[0].timestamp
const lines = ['ffconcat version 1.0']
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`

for (let index = 0; index < frames.length; index += 1) {
  const frame = frames[index]
  const absolute = path.join(capture.framesDir, frame.file)
  const nextTimestamp = frames[index + 1]?.timestamp
  const relativeTimestamp = frame.timestamp - firstTimestamp
  const duration = nextTimestamp === undefined
    ? Math.max(0.05, capture.audioDurationSeconds - relativeTimestamp)
    : Math.max(0.001, nextTimestamp - frame.timestamp)
  lines.push(`file ${quote(absolute)}`)
  lines.push(`duration ${duration.toFixed(6)}`)
}

// The concat demuxer requires the final file to be repeated for its duration to apply.
lines.push(`file ${quote(path.join(capture.framesDir, frames.at(-1).file))}`)
await writeFile(outputPath, `${lines.join('\n')}\n`)
console.log(JSON.stringify({
  concat: outputPath,
  frames: frames.length,
  duration: capture.audioDurationSeconds,
  sourceSpan: frames.at(-1).timestamp - firstTimestamp
}))
