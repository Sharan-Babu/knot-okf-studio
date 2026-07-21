import { Daytona } from '@daytona/sdk'

if (!process.env.DAYTONA_API_KEY) throw new Error('DAYTONA_API_KEY is required.')
const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY })
let sandbox
const observations = []

try {
  sandbox = await daytona.create({
    name: `knot-wake-probe-${Date.now()}`,
    language: 'typescript',
    public: true,
    autoStopInterval: 1,
    autoArchiveInterval: 60,
    autoDeleteInterval: 60,
    labels: { project: 'knot-wake-research', managedBy: 'knot-wake-probe' }
  }, { timeout: 120 })
  const started = await sandbox.process.executeCommand("mkdir -p /tmp/knot-wake && printf 'ok' >/tmp/knot-wake/index.html && nohup python3 -m http.server 8787 --directory /tmp/knot-wake >/tmp/knot-wake.log 2>&1 &")
  if (started.exitCode !== 0) throw new Error('Could not start preview probe server.')
  const preview = await sandbox.getPreviewLink(8787)
  for (const elapsedSeconds of [0, 20, 40, 60, 80]) {
    if (elapsedSeconds) await new Promise((resolve) => setTimeout(resolve, 20_000))
    try {
      const response = await fetch(preview.url, { headers: { 'X-Daytona-Skip-Preview-Warning': 'true' }, signal: AbortSignal.timeout(8_000) })
      observations.push({ elapsedSeconds, status: response.status, body: (await response.text()).trim().slice(0, 20) })
    } catch (error) {
      observations.push({ elapsedSeconds, error: error instanceof Error ? error.message : String(error) })
    }
  }
  await sandbox.refreshData()
  const stateAfterPreviewTraffic = sandbox.state
  if (sandbox.state === 'started') await daytona.stop(sandbox)
  let stoppedFetchStatus
  try {
    const response = await fetch(preview.url, { headers: { 'X-Daytona-Skip-Preview-Warning': 'true' }, signal: AbortSignal.timeout(8_000) })
    stoppedFetchStatus = response.status
  } catch (error) {
    stoppedFetchStatus = error instanceof Error ? error.message : String(error)
  }
  await new Promise((resolve) => setTimeout(resolve, 8_000))
  await sandbox.refreshData()
  process.stdout.write(`${JSON.stringify({ observations, stateAfterPreviewTraffic, stoppedFetchStatus, stateAfterStoppedLinkRequest: sandbox.state })}\n`)
} finally {
  if (sandbox) await daytona.delete(sandbox, 120, true).catch(() => undefined)
  await daytona[Symbol.asyncDispose]()
}
