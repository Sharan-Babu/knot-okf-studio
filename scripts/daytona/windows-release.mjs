import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Daytona } from '@daytona/sdk'
import { zipSync } from 'fflate'

const apiKey = process.env.DAYTONA_API_KEY
if (!apiKey) throw new Error('DAYTONA_API_KEY is required for native Windows release validation.')
const windowsSnapshot = process.env.KNOT_DAYTONA_WINDOWS_SNAPSHOT ?? 'windows-small'
const createAttempts = Math.min(30, Math.max(1, Number(process.env.KNOT_DAYTONA_CREATE_ATTEMPTS ?? 6)))
const daytonaTarget = process.env.DAYTONA_TARGET ?? 'us'

const localRoot = process.cwd()
const artifactRoot = path.join(localRoot, 'artifacts', 'windows')
const managedLabels = {
  project: 'knot-release-validation',
  purpose: 'native-windows-release',
  managedBy: 'knot-release-script'
}
const excludedDirectories = new Set([
  '.git',
  '.tools',
  'artifacts',
  'coverage',
  'node_modules',
  'out',
  'playwright-report',
  'release',
  'test-results'
])
const excludedFiles = new Set(['.DS_Store', 'windows-release-evidence.zip'])
const releaseExtensions = new Set(['.exe', '.zip', '.yml', '.yaml'])

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const log = (message) => process.stdout.write(`[windows-release] ${message}\n`)
const toPosix = (value) => value.replaceAll('\\', '/')
const toWindows = (value) => value.replaceAll('/', '\\')
const quotePowerShell = (value) => `'${value.replaceAll("'", "''")}'`

async function collectSourceFiles(directory = localRoot, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    if (entry.name === '.env' || entry.name.startsWith('.env.')) continue
    if (excludedFiles.has(entry.name) || entry.name.endsWith('.tsbuildinfo')) continue
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath, relativePath)))
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath })
    }
  }
  return files
}

async function makeSourceArchive(temporaryDirectory) {
  const sourceFiles = await collectSourceFiles()
  const archiveEntries = {}
  for (const sourceFile of sourceFiles) {
    archiveEntries[sourceFile.relativePath] = new Uint8Array(await readFile(sourceFile.absolutePath))
  }
  const archivePath = path.join(temporaryDirectory, 'knot-source.zip')
  await writeFile(archivePath, zipSync(archiveEntries, { level: 6 }))
  log(`Prepared a source-only archive with ${sourceFiles.length} files.`)
  return archivePath
}

async function createWindowsSandbox(daytona) {
  let lastError
  for (let attempt = 1; attempt <= createAttempts; attempt += 1) {
    try {
      log(`Requesting disposable Windows sandbox (attempt ${attempt}/${createAttempts}).`)
      const sandbox = await daytona.create(
        {
          name: `knot-release-${Date.now()}`,
          snapshot: windowsSnapshot,
          labels: managedLabels,
          autoStopInterval: 15,
          autoArchiveInterval: 60,
          autoDeleteInterval: 60
        },
        { timeout: 180 }
      )
      return { sandbox, attempt }
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!/no available runners/i.test(message) || attempt === createAttempts) break
      const backoff = Math.min(10_000, attempt * 2_000)
      log(`Windows capacity is not ready; retrying in ${backoff / 1000}s.`)
      await sleep(backoff)
    }
  }
  throw lastError
}

async function runCommand(sandbox, command, cwd, timeout, label) {
  log(label)
  const response = await sandbox.process.executeCommand(command, cwd, undefined, timeout)
  if (response.result?.trim()) process.stdout.write(`${response.result.trim()}\n`)
  if (response.exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${response.exitCode}.`)
  }
  return response.result.trim()
}

async function runReleaseAction(sandbox, projectRootWindows, action, timeout) {
  const command = [
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File',
    quotePowerShell(`${projectRootWindows}\\scripts\\windows\\run-release-action.ps1`),
    '-ProjectRoot',
    quotePowerShell(projectRootWindows),
    '-Action',
    action
  ].join(' ')
  return runCommand(sandbox, command, projectRootWindows, timeout, `Running Windows ${action} gate.`)
}

async function saveScreenshot(sandbox, filename) {
  const shot = await sandbox.computerUse.screenshot.takeCompressed({
    format: 'jpeg',
    quality: 86,
    scale: 0.9,
    showCursor: false
  })
  const encoded = shot.screenshot ?? shot.data ?? shot.image
  if (!encoded) throw new Error('Computer Use returned a screenshot without image data.')
  const target = path.join(artifactRoot, filename)
  await writeFile(target, Buffer.from(encoded, 'base64'))
  return target
}

async function waitForKnotWindow(sandbox) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await sandbox.computerUse.display.getWindows()
    const knotWindow = response.windows?.find((window) => /knot/i.test(window.title ?? ''))
    if (knotWindow) return knotWindow
    await sleep(1_000)
  }
  throw new Error('Knot did not expose a visible native window within 30 seconds.')
}

async function clickAccessibleLabel(sandbox, name) {
  const response = await sandbox.computerUse.accessibility.findNodes({
    scope: 'all',
    name,
    nameMatch: 'substring',
    limit: 10
  })
  const match = response.matches?.find((node) => node.id)
  if (!match?.id) throw new Error(`Could not find accessibility node: ${name}`)
  await sandbox.computerUse.accessibility.invokeNode(match.id, 'click')
  await sleep(1_000)
}

async function collectComputerUseEvidence(sandbox, projectRootWindows, remoteHomeWindows) {
  const evidence = { status: 'passed', screenshots: [] }
  try {
    log('Launching the packaged Electron application through native Windows Computer Use.')
    await sandbox.computerUse.start()
    await sandbox.computerUse.keyboard.press('r', ['win'])
    await sleep(500)
    const executable = `${projectRootWindows}\\release\\win-unpacked\\Knot.exe`
    const profile = `${remoteHomeWindows}\\knot-computer-use-profile`
    await sandbox.computerUse.keyboard.type(`"${executable}" --user-data-dir="${profile}"`, 1)
    await sandbox.computerUse.keyboard.press('enter')
    const knotWindow = await waitForKnotWindow(sandbox)
    evidence.windowTitle = knotWindow.title
    evidence.screenshots.push(await saveScreenshot(sandbox, 'windows-native-overview.jpg'))

    await clickAccessibleLabel(sandbox, 'Cloud & MCP')
    evidence.screenshots.push(await saveScreenshot(sandbox, 'windows-native-cloud.jpg'))
    await clickAccessibleLabel(sandbox, 'Workflows')
    evidence.screenshots.push(await saveScreenshot(sandbox, 'windows-native-workflows.jpg'))
  } catch (error) {
    evidence.status = 'best-effort-failed'
    evidence.error = error instanceof Error ? error.message : String(error)
    log(`Computer Use evidence was unavailable: ${evidence.error}`)
  } finally {
    try {
      await sandbox.computerUse.stop()
    } catch {
      // The release gates remain authoritative if the optional desktop recorder cannot stop.
    }
  }
  return evidence
}

async function downloadReleaseArtifacts(sandbox, projectRootPosix) {
  const downloaded = []
  const releaseFiles = await sandbox.fs.listFiles(`${projectRootPosix}/release`, { depth: 4 })
  for (const file of releaseFiles) {
    if (file.isDir) continue
    const extension = path.extname(file.name).toLowerCase()
    if (!releaseExtensions.has(extension) && file.name !== 'builder-effective-config.yaml') continue
    const target = path.join(artifactRoot, file.name)
    await sandbox.fs.downloadFile(file.path, target, 1_800)
    downloaded.push(target)
  }
  const evidenceTarget = path.join(artifactRoot, 'windows-release-evidence.zip')
  await sandbox.fs.downloadFile(`${projectRootPosix}/windows-release-evidence.zip`, evidenceTarget, 1_800)
  downloaded.push(evidenceTarget)
  return downloaded
}

await mkdir(artifactRoot, { recursive: true })
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'knot-windows-release-'))
const daytona = new Daytona({ apiKey, target: daytonaTarget })
let sandbox
let createAttemptsUsed
let summary

try {
  const sourceArchive = await makeSourceArchive(temporaryDirectory)
  const created = await createWindowsSandbox(daytona)
  sandbox = created.sandbox
  createAttemptsUsed = created.attempt
  log(`Created sandbox ${sandbox.id}.`)

  const remoteHomeWindows = await runCommand(
    sandbox,
    'powershell.exe -NoProfile -Command "(Get-Location).Path"',
    undefined,
    60,
    'Resolving the native Windows workspace.'
  )
  const remoteHomePosix = toPosix(remoteHomeWindows)
  const projectRootPosix = `${remoteHomePosix}/knot-okf-studio`
  const projectRootWindows = toWindows(projectRootPosix)
  const remoteArchive = `${remoteHomePosix}/knot-source.zip`
  await sandbox.fs.uploadFiles([{ source: sourceArchive, destination: remoteArchive }], 1_800)
  await runCommand(
    sandbox,
    `powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath ${quotePowerShell(toWindows(remoteArchive))} -DestinationPath ${quotePowerShell(projectRootWindows)} -Force; Remove-Item -LiteralPath ${quotePowerShell(toWindows(remoteArchive))} -Force"`,
    remoteHomeWindows,
    600,
    'Expanding the source-only project archive.'
  )

  await runCommand(
    sandbox,
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quotePowerShell(`${projectRootWindows}\\scripts\\windows\\bootstrap-node.ps1`)} -ProjectRoot ${quotePowerShell(projectRootWindows)}`,
    projectRootWindows,
    600,
    'Bootstrapping portable Node.js on Windows.'
  )
  const platformOutput = await runReleaseAction(sandbox, projectRootWindows, 'platform', 120)
  const platformLine = platformOutput.split(/\r?\n/).findLast((line) => line.trim().startsWith('{'))
  assert.ok(platformLine, 'Windows platform probe did not produce JSON.')
  const platform = JSON.parse(platformLine)
  assert.deepEqual({ platform: platform.platform, arch: platform.arch }, { platform: 'win32', arch: 'x64' })

  await runReleaseAction(sandbox, projectRootWindows, 'install', 1_800)
  await runReleaseAction(sandbox, projectRootWindows, 'ship', 3_600)
  await runReleaseAction(sandbox, projectRootWindows, 'dist', 2_400)
  await runReleaseAction(sandbox, projectRootWindows, 'packaged', 600)
  const computerUse = await collectComputerUseEvidence(sandbox, projectRootWindows, remoteHomeWindows)
  await runReleaseAction(sandbox, projectRootWindows, 'evidence', 600)
  const artifacts = await downloadReleaseArtifacts(sandbox, projectRootPosix)

  summary = {
    status: 'passed',
    completedAt: new Date().toISOString(),
    sandboxId: sandbox.id,
    snapshot: windowsSnapshot,
    target: daytonaTarget,
    createAttemptsRequested: createAttempts,
    createAttemptsUsed,
    platform,
    computerUse,
    artifacts: artifacts.map((artifact) => path.relative(localRoot, artifact))
  }
  log(`Native Windows validation passed with ${artifacts.length} downloaded artifacts.`)
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  summary = {
    status: 'failed',
    completedAt: new Date().toISOString(),
    sandboxId: sandbox?.id,
    snapshot: windowsSnapshot,
    target: daytonaTarget,
    createAttemptsRequested: createAttempts,
    createAttemptsUsed: createAttemptsUsed ?? (/no available runners/i.test(errorMessage) ? createAttempts : undefined),
    failureClass: sandbox
      ? 'native-validation'
      : /no available runners/i.test(errorMessage)
        ? 'provider-capacity'
        : /auth|credential|permission/i.test(errorMessage)
          ? 'authentication'
          : 'provisioning',
    providerStatusCode: typeof error === 'object' && error && 'statusCode' in error ? error.statusCode : undefined,
    error: error instanceof Error ? error.stack ?? error.message : String(error)
  }
  throw error
} finally {
  const cleanup = { required: Boolean(sandbox), status: sandbox ? 'pending' : 'not-created' }
  if (sandbox) {
    try {
      log(`Deleting disposable sandbox ${sandbox.id}.`)
      await daytona.delete(sandbox, 180, true)
      cleanup.status = 'deleted'
      log('Disposable Windows sandbox deleted.')
    } catch (error) {
      cleanup.status = 'failed'
      cleanup.error = error instanceof Error ? error.message : String(error)
      log(`Sandbox deletion needs attention: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (summary) {
    summary.cleanup = cleanup
    await writeFile(path.join(artifactRoot, 'windows-release-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  }
  await daytona[Symbol.asyncDispose]()
  await rm(temporaryDirectory, { recursive: true, force: true })
}
