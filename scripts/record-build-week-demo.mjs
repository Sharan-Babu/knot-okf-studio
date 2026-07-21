import { _electron as electron } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const outputRoot = path.join(root, 'artifacts', 'build-week-video')
const captureDir = path.join(outputRoot, 'capture')
const userData = await mkdtemp(path.join(os.tmpdir(), 'knot-build-week-demo-'))
const exportDir = path.join(userData, 'exports')
const audioDurationSeconds = 179.12
const captureWidth = 1400
const captureHeight = 788

await mkdir(exportDir, { recursive: true })
await mkdir(captureDir, { recursive: true })

const environment = {
  ...process.env,
  NODE_ENV: 'test',
  KNOT_TEST_EXPORT_PATH: exportDir,
  KNOT_TEST_AVAILABILITY_PATH: exportDir,
  KNOT_TEST_CLOUD: '1',
  KNOT_TEST_DAYTONA_API_KEY: 'dtn_demo_fixture_not_a_real_credential_000000000',
  KNOT_TEST_PARALLEL: '1',
  KNOT_TEST_PARALLEL_API_KEY: 'parallel_demo_fixture_not_a_real_credential_000000000'
}

async function waitForKnot(page) {
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor({ timeout: 30_000 })
}

async function prepareDemoState() {
  const application = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`],
    env: environment
  })

  try {
    const page = await application.firstWindow()
    await page.setViewportSize({ width: captureWidth, height: captureHeight })
    await waitForKnot(page)

    await page.evaluate(async () => {
      const bundle = await window.knot.workspace.refresh()
      const concepts = bundle.documents.filter((document) => document.kind === 'concept')
      for (const document of concepts) {
        await window.knot.sharing.savePolicy({
          documentId: document.id,
          visibility: 'workspace',
          audienceIds: ['leadership', 'maya'],
          allowDownload: true,
          updateMode: 'review',
          updatedAt: new Date().toISOString()
        })
      }

      await window.knot.sharing.export({
        documentIds: ['product/north-star'],
        name: 'Atlas launch baseline',
        visibility: 'workspace',
        audienceIds: ['leadership', 'maya'],
        includeDependencies: true,
        allowDownload: true
      })

      for (const document of concepts) {
        if (document.id === 'product/north-star' || document.id === 'projects/atlas') continue
        await window.knot.sharing.savePolicy({
          documentId: document.id,
          visibility: 'private',
          audienceIds: [],
          allowDownload: false,
          updateMode: 'review',
          updatedAt: new Date().toISOString()
        })
      }

      await window.knot.cloud.publish({
        name: 'Atlas partner knowledge room',
        documentIds: ['product/north-star', 'projects/atlas'],
        visibility: 'workspace',
        audienceIds: ['product', 'maya'],
        includeDependencies: false,
        allowDownload: false,
        autoStopMinutes: 15
      })

      const current = await window.knot.workspace.refresh()
      const target = current.documents.find((document) => document.id === 'product/north-star')
      if (target) {
        await window.knot.workspace.saveDocument({
          path: target.path,
          frontmatter: target.frontmatter,
          body: `${target.body}\n\n## Customer research update\n\nActivation target revised after the latest customer interviews.`
        })
      }
    })

    await page.getByRole('button', { name: 'Web watch', exact: true }).click()
    await page.getByRole('button', { name: 'New watch' }).click()
    await page.getByLabel('Focused topic').fill('Material changes to competitor pricing before the Project Atlas launch')
    await page.getByLabel('Check frequency').selectOption('7d')
    await page.getByRole('button', { name: 'Start watching' }).click()
    await page.getByRole('button', { name: 'Check now' }).click()
    await page.getByText(/A material update was detected/).waitFor()
    const readiness = await page.evaluate(async () => {
      const [sharing, cloud, webWatch] = await Promise.all([
        window.knot.sharing.getState(),
        window.knot.cloud.getDashboard(),
        window.knot.webWatch.getDashboard()
      ])
      return {
        pendingUpdates: sharing.notifications.filter((item) => !item.resolvedAt).length,
        cloudShares: cloud.shares.length,
        webUpdates: webWatch.state.updates.filter((item) => item.status === 'new').length
      }
    })
    if (readiness.pendingUpdates !== 1 || readiness.cloudShares < 1 || readiness.webUpdates < 1) {
      throw new Error(`Demo state is incomplete: ${JSON.stringify(readiness)}`)
    }
    console.log(`Demo state ready: ${JSON.stringify(readiness)}`)
  } finally {
    await application.close()
  }
}

async function installPresentationLayer(page) {
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.dataset.knotDemo = 'true'
    style.textContent = `
      #knot-demo-cursor {
        position: fixed; left: 0; top: 0; width: 24px; height: 30px;
        pointer-events: none; z-index: 2147483647; opacity: 0;
        transform: translate(-3px, -2px); transition: opacity 160ms ease;
        filter: drop-shadow(0 2px 4px rgba(20, 16, 38, .32));
      }
      #knot-demo-cursor svg { width: 24px; height: 30px; display: block; }
      .knot-demo-ripple {
        position: fixed; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border: 2px solid rgba(105, 78, 215, .75); border-radius: 50%;
        pointer-events: none; z-index: 2147483646;
        animation: knot-demo-ripple 520ms ease-out forwards;
      }
      @keyframes knot-demo-ripple { from { transform: scale(.35); opacity: 1; } to { transform: scale(1.25); opacity: 0; } }
      #knot-demo-chapter {
        position: fixed; right: 28px; top: 78px; z-index: 2147483600;
        min-width: 260px; max-width: 440px; padding: 14px 18px;
        color: #fff; background: rgba(27, 25, 32, .92); border: 1px solid rgba(255,255,255,.14);
        border-radius: 12px; box-shadow: 0 18px 50px rgba(20, 16, 38, .2);
        opacity: 0; transform: translateY(-10px); transition: opacity 220ms ease, transform 220ms ease;
        pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      #knot-demo-chapter.visible { opacity: 1; transform: translateY(0); }
      #knot-demo-chapter small { display: block; margin-bottom: 5px; color: #bfb4ff; font-size: 10px; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; }
      #knot-demo-chapter strong { display: block; font-size: 18px; line-height: 1.25; letter-spacing: -.01em; }
      .knot-demo-fullscreen {
        position: fixed; inset: 0; z-index: 2147483500; display: grid; place-items: center;
        color: #f8f7fb; background: #201e25; opacity: 0; transition: opacity 420ms ease;
        pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .knot-demo-fullscreen.visible { opacity: 1; }
      .knot-demo-proof { width: min(980px, calc(100vw - 100px)); }
      .knot-demo-proof .eyebrow { color: #b9aaff; font-size: 12px; font-weight: 760; letter-spacing: .16em; text-transform: uppercase; }
      .knot-demo-proof h2 { margin: 13px 0 14px; font-size: 52px; line-height: 1.04; letter-spacing: -.045em; }
      .knot-demo-proof > p { margin: 0 0 32px; color: #c9c5d2; font-size: 20px; line-height: 1.55; }
      .knot-demo-proof-grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid rgba(255,255,255,.16); border-left: 1px solid rgba(255,255,255,.16); }
      .knot-demo-proof-grid div { padding: 22px 24px; border-right: 1px solid rgba(255,255,255,.16); border-bottom: 1px solid rgba(255,255,255,.16); }
      .knot-demo-proof-grid strong { display: block; margin-bottom: 7px; color: #fff; font-size: 17px; }
      .knot-demo-proof-grid span { color: #aaa5b3; font-size: 14px; line-height: 1.45; }
      .knot-demo-outro { text-align: center; }
      .knot-demo-mark { width: 58px; height: 58px; margin: 0 auto 22px; display: grid; place-items: center; border-radius: 17px; background: #7456df; box-shadow: 0 20px 70px rgba(116, 86, 223, .4); }
      .knot-demo-mark svg { width: 31px; height: 31px; }
      .knot-demo-outro h2 { margin: 0; font-size: 68px; letter-spacing: -.055em; }
      .knot-demo-outro p { margin: 14px 0 0; color: #c7c2cf; font-size: 22px; }
      .knot-demo-outro small { display: block; margin-top: 35px; color: #9e96aa; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
    `
    document.head.appendChild(style)

    const cursor = document.createElement('div')
    cursor.id = 'knot-demo-cursor'
    cursor.innerHTML = '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M3 2.7v20.5l5.8-5.1 4.2 8.2 4.2-2.2-4.2-7.7h7.6L3 2.7Z" fill="#fff" stroke="#2a2438" stroke-width="1.7" stroke-linejoin="round"/></svg>'
    document.body.appendChild(cursor)

    const chapter = document.createElement('div')
    chapter.id = 'knot-demo-chapter'
    document.body.appendChild(chapter)

    document.addEventListener('mousemove', (event) => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
      cursor.style.opacity = '1'
    }, true)
    document.addEventListener('mousedown', (event) => {
      const ripple = document.createElement('div')
      ripple.className = 'knot-demo-ripple'
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      document.body.appendChild(ripple)
      window.setTimeout(() => ripple.remove(), 650)
    }, true)

    window.__knotDemo = {
      chapter(kicker, title, duration = 2100) {
        chapter.innerHTML = `<small>${kicker}</small><strong>${title}</strong>`
        chapter.classList.add('visible')
        window.setTimeout(() => chapter.classList.remove('visible'), duration)
      },
      proof() {
        document.querySelectorAll('.knot-demo-fullscreen').forEach((element) => element.remove())
        const overlay = document.createElement('section')
        overlay.className = 'knot-demo-fullscreen'
        overlay.innerHTML = `<div class="knot-demo-proof"><span class="eyebrow">Built during OpenAI Build Week</span><h2>Codex + GPT-5.6<br/>as engineering collaborators</h2><p>From open-format research to a release-grade desktop product.</p><div class="knot-demo-proof-grid"><div><strong>Specification research</strong><span>OKF and MCP semantics verified against primary sources.</span></div><div><strong>Security decisions</strong><span>Privacy, capabilities, sandbox lifecycle, and human approval challenged directly.</span></div><div><strong>Collaborator simulation</strong><span>Authors, recipients, reviewers, publishers, and external agents exercised with Playwright.</span></div><div><strong>Release evidence</strong><span>Accessibility, failure paths, packages, and live provider boundaries tested.</span></div></div></div>`
        document.body.appendChild(overlay)
        requestAnimationFrame(() => overlay.classList.add('visible'))
      },
      outro() {
        document.querySelectorAll('.knot-demo-fullscreen').forEach((element) => element.remove())
        const overlay = document.createElement('section')
        overlay.className = 'knot-demo-fullscreen'
        overlay.innerHTML = `<div class="knot-demo-outro"><div class="knot-demo-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 10.5h9.5a5.5 5.5 0 0 1 0 11H14" stroke="white" stroke-width="3" stroke-linecap="round"/><path d="M24 21.5h-9.5a5.5 5.5 0 0 1 0-11H18" stroke="white" stroke-width="3" stroke-linecap="round"/></svg></div><h2>Knot</h2><p>Open knowledge. Carefully controlled.</p><small>For people and agents — by choice</small></div>`
        document.body.appendChild(overlay)
        requestAnimationFrame(() => overlay.classList.add('visible'))
      }
    }
  })
}

async function recordDemo() {
  const application = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`],
    env: environment
  })

  const page = await application.firstWindow()
  page.setDefaultTimeout(4_000)
  await page.setViewportSize({ width: captureWidth, height: captureHeight })
  await application.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height)
  }, { width: captureWidth, height: captureHeight })
  await waitForKnot(page)
  await installPresentationLayer(page)
  await page.mouse.move(1335, 742, { steps: 8 })

  const framesDir = path.join(captureDir, `frames-${Date.now()}`)
  await mkdir(framesDir, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  let frameNumber = 0
  let writeChain = Promise.resolve()
  let resolveFirstFrame
  const firstFrame = new Promise((resolve) => { resolveFirstFrame = resolve })
  cdp.on('Page.screencastFrame', (event) => {
    frameNumber += 1
    const file = `frame-${String(frameNumber).padStart(6, '0')}.jpg`
    frames.push({ file, timestamp: event.metadata.timestamp })
    writeChain = writeChain.then(() => writeFile(path.join(framesDir, file), Buffer.from(event.data, 'base64')))
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
    if (frameNumber === 1) resolveFirstFrame()
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: captureWidth,
    maxHeight: captureHeight,
    everyNthFrame: 1
  })
  await Promise.race([
    firstFrame,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Electron screencast did not produce a first frame.')), 10_000))
  ])

  const startedAt = Date.now()
  const at = async (seconds, action) => {
    const remaining = Math.round(seconds * 1000 - (Date.now() - startedAt))
    if (remaining > 0) await page.waitForTimeout(remaining)
    try {
      await action()
    } catch (error) {
      console.warn(`Demo action at ${seconds.toFixed(1)}s failed:`, error instanceof Error ? error.message : String(error))
    }
  }
  const click = async (locator, settle = 450) => {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
    await page.waitForTimeout(180)
    await locator.click()
    await page.waitForTimeout(settle)
  }
  const hover = async (locator, settle = 500) => {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
    await page.waitForTimeout(settle)
  }
  const chapter = (kicker, title, duration) => page.evaluate(({ kicker, title, duration }) => window.__knotDemo.chapter(kicker, title, duration), { kicker, title, duration })

  await at(0.1, () => chapter('Knot', 'Knowledge for teams and AI agents', 3000))
  await at(2.8, () => hover(page.locator('.stat-card').filter({ hasText: 'Connections' }).first()))

  await at(7.1, async () => {
    await click(page.getByRole('button', { name: 'Knowledge', exact: true }))
    await chapter('Open Knowledge Format', 'Portable by design', 2500)
  })
  await at(10.0, () => click(page.getByRole('button', { name: 'Open Knowledge Format v0.1', exact: true })))
  await at(14.2, () => hover(page.getByRole('heading', { name: 'Open Knowledge Format v0.1', exact: true })))
  await at(18.5, () => click(page.getByRole('tab', { name: 'Edit' })))
  await at(22.0, () => hover(page.getByLabel('Markdown body')))
  await at(28.0, () => click(page.getByRole('tab', { name: 'Read' })))

  await at(34.4, async () => {
    await click(page.getByRole('button', { name: 'Overview', exact: true }))
    await chapter('Project Atlas', 'A real launch workspace', 2200)
  })
  await at(37.2, () => click(page.getByRole('button', { name: 'Graph', exact: true })))
  await at(41.0, () => hover(page.locator('.graph-node-svg').filter({ hasText: 'Project Atlas' }).first()))
  await at(43.0, () => click(page.locator('.graph-node-svg').filter({ hasText: 'Project Atlas' }).first()))
  await at(46.0, () => click(page.getByRole('button', { name: 'Zoom in' })))

  await at(49.2, async () => {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+N' : 'Control+N')
    await page.getByRole('dialog', { name: 'New knowledge concept' }).waitFor()
    await chapter('Authoring', 'Privacy starts with the idea', 2300)
  })
  await at(51.0, async () => {
    const dialog = page.getByRole('dialog', { name: 'New knowledge concept' })
    await dialog.getByLabel('Title').pressSequentially('Launch decision record', { delay: 28 })
    await dialog.getByLabel('Type').fill('Decision')
    await dialog.getByLabel('One-line description').fill('Customer-safe launch decision with internal pricing context.')
  })
  await at(55.2, () => click(page.getByRole('dialog', { name: 'New knowledge concept' }).getByRole('button', { name: 'Workspace' }), 260))
  await at(57.0, () => click(page.getByRole('dialog', { name: 'New knowledge concept' }).getByRole('button', { name: /Leadership/ }), 220))
  await at(58.5, () => click(page.getByRole('dialog', { name: 'New knowledge concept' }).getByRole('button', { name: /Maya Chen/ }), 220))
  await at(60.0, () => page.getByRole('dialog', { name: 'New knowledge concept' }).getByLabel('When this concept changes').selectOption('auto-prepare'))
  await at(63.0, () => click(page.getByRole('dialog', { name: 'New knowledge concept' }).getByRole('button', { name: 'Create concept' }), 700))

  await at(65.5, async () => {
    await click(page.getByRole('button', { name: 'Knowledge', exact: true }))
    await click(page.getByRole('button', { name: 'Weekly Activated Teams', exact: true }))
    await chapter('Revision-aware sharing', 'Know who may be out of date', 2400)
  })
  await at(68.0, () => click(page.getByRole('tab', { name: 'Edit' })))
  await at(70.2, () => hover(page.getByLabel('Markdown body')))
  await at(73.2, () => click(page.getByRole('button', { name: /Notifications, 1 unread/ }), 320))
  await at(75.0, () => hover(page.getByRole('menuitem', { name: /Weekly Activated Teams changed/ })))
  await at(76.8, () => click(page.getByRole('menuitem', { name: /Weekly Activated Teams changed/ }), 650))
  await at(79.0, () => hover(page.locator('.update-card').first()))
  await at(82.0, () => hover(page.getByRole('button', { name: 'Export update' })))
  await at(84.5, () => hover(page.getByRole('button', { name: 'Keep private' })))
  await at(86.7, () => hover(page.locator('.ledger-panel').first()))

  await at(89.8, async () => {
    await click(page.getByRole('button', { name: 'Web watch', exact: true }))
    await chapter('Web Watch', 'Evidence enters through review', 2400)
  })
  await at(94.0, () => hover(page.locator('.web-update-item').first()))
  await at(97.0, () => hover(page.getByRole('button', { name: /Source 1/ })))
  await at(99.0, () => hover(page.getByRole('button', { name: 'Dismiss' })))
  await at(100.3, () => hover(page.getByRole('button', { name: 'Prepare with AI' })))
  await at(102.3, () => hover(page.getByRole('button', { name: 'Prepare draft' })))
  await at(104.5, () => click(page.getByRole('button', { name: 'Prepare draft' }), 650))
  await at(106.2, () => click(page.getByRole('button', { name: 'Workflows', exact: true }), 500))
  await at(108.0, () => click(page.locator('.proposal-list > button').first(), 350))
  await at(109.5, () => hover(page.getByRole('button', { name: 'Approve & publish' })))

  await at(111.7, async () => {
    await click(page.getByRole('button', { name: 'Cloud & MCP', exact: true }), 650)
    await chapter('Model Context Protocol', 'Useful to agents, controlled by people', 2600)
  })
  await at(115.0, () => hover(page.getByText('search_knowledge', { exact: true })))
  await at(117.0, () => hover(page.getByText('get_concept', { exact: true })))
  await at(119.0, () => hover(page.getByText('trace_connections', { exact: true })))
  await at(121.2, () => hover(page.getByText(/propose_update/).first()))

  await at(124.5, async () => {
    await page.locator('.content').evaluate((element) => { element.scrollTop = 0 })
    await chapter('Flexible publication', 'One allowlist, several destinations', 2500)
  })
  await at(127.2, () => hover(page.getByRole('button', { name: /Maya Chen/ }).first()))
  await at(129.0, () => hover(page.getByLabel('Share name')))
  await at(131.0, async () => {
    await page.getByRole('heading', { name: 'Choose how this release stays online' }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(550)
  })
  await at(132.2, () => hover(page.getByText('Synced folder', { exact: true })))
  await at(134.0, () => hover(page.getByText('Self-hosted portal & MCP', { exact: true })))
  await at(135.8, () => hover(page.getByText('Daytona portal & MCP', { exact: true })))
  await at(137.2, async () => {
    await page.getByRole('heading', { name: 'Links and agent endpoints' }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(450)
    await hover(page.getByText('Atlas partner knowledge room', { exact: true }))
  })

  await at(139.8, async () => {
    await click(page.getByRole('button', { name: 'Knot Assist', exact: true }), 550)
    await chapter('Knot Assist', 'Selected context. Read-only turn.', 2300)
  })
  await at(143.0, () => hover(page.getByRole('button', { name: 'Privacy review' })))
  await at(145.0, () => click(page.getByRole('button', { name: 'Privacy review' }), 220))
  await at(148.0, () => hover(page.locator('.safety-details')))

  await at(153.8, async () => {
    await page.evaluate(() => window.__knotDemo.proof())
    await page.mouse.move(1335, 744, { steps: 18 })
  })
  await at(168.4, async () => {
    await page.evaluate(() => window.__knotDemo.outro())
    await page.mouse.move(1355, 758, { steps: 18 })
  })

  await at(audioDurationSeconds + 0.1, async () => page.waitForTimeout(180))
  const elapsedSeconds = (Date.now() - startedAt) / 1000
  await page.mouse.move(1360, 760, { steps: 2 })
  await page.waitForTimeout(250)
  await cdp.send('Page.stopScreencast')
  await writeChain
  await application.close()
  const target = path.join(captureDir, 'capture-frames.json')
  await writeFile(target, `${JSON.stringify({
    audioDurationSeconds,
    scriptedElapsedSeconds: elapsedSeconds,
    recordedAt: new Date().toISOString(),
    viewport: { width: captureWidth, height: captureHeight },
    framesDir,
    frameCount: frames.length,
    frames
  }, null, 2)}\n`)
  return target
}

try {
  await prepareDemoState()
  await new Promise((resolve) => setTimeout(resolve, 1_500))
  const recorded = await recordDemo()
  console.log(`Recorded demo to ${recorded}`)
} finally {
  await rm(userData, { recursive: true, force: true })
}
