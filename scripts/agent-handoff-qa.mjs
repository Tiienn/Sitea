import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const OUTPUT_DIR = 'output/playwright/agent-handoff'
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, isMobile: true },
  { name: 'desktop', width: 1280, height: 720, isMobile: false },
]

const CASES = [
  {
    name: 'floor-plan',
    actionLabel: 'Place this in 3D',
    expectedToast: 'Preview ready',
    messages: [{
      role: 'assistant',
      content: 'I found 24 walls, 6 doors, 8 windows, and 5 rooms.\n\nI prepared a 3D building preview from your plan. It is ready to review on the land.',
      nextSteps: [
        { label: 'Plan geometry detected', state: 'done' },
        { label: '3D preview prepared', state: 'done' },
        { label: 'Review placement in 3D', state: 'current' },
      ],
      suggestedActions: [{
        type: 'handoff_to_scene',
        label: 'Place this in 3D',
        toast: 'Preview ready • click the land to place it • R to rotate',
      }],
    }],
  },
  {
    name: 'site-plan',
    actionLabel: 'Show tennis court in 3D',
    expectedToast: 'Object selected',
    messages: [{
      role: 'assistant',
      content: 'I prepared the land workspace from your uploaded plan. I can add a tennis court comparison so the scale is visible immediately.',
      nextSteps: [
        { label: 'Site plan recognized', state: 'done' },
        { label: 'Land workspace prepared', state: 'done' },
        { label: 'Review scale in 3D', state: 'current' },
      ],
      suggestedActions: [{
        type: 'activate_comparison',
        comparisonId: 'tennisCourt',
        label: 'Show tennis court in 3D',
        objectName: 'tennis court',
        handoff: true,
        toast: 'Tennis court added • drag or rotate it to compare scale',
      }],
    }],
  },
]

function fail(message, details = {}) {
  const error = new Error(message)
  error.details = details
  throw error
}

function getLocalUrl(server) {
  const urls = server.resolvedUrls?.local || []
  return urls.find(url => url.includes('127.0.0.1')) || urls[0] || 'http://127.0.0.1:5173/'
}

async function runCase(browser, baseUrl, testCase, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
  })

  await context.addInitScript((messages) => {
    localStorage.setItem('sitea-ai-chat', JSON.stringify(messages))
    localStorage.setItem('landVisualizerIntroSeen', 'true')
    localStorage.setItem('fsmCompleted', 'true')
  }, testCase.messages)

  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.sitea-agent-panel', { state: 'visible', timeout: 15000 })
  await page.getByRole('button', { name: testCase.actionLabel }).click()
  await page.waitForTimeout(900)

  const audit = await page.evaluate((expectedToast) => {
    const visible = (el) => {
      if (!el) return false
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0.01 &&
        rect.width > 0 &&
        rect.height > 0
    }

    const hasText = (text) => Array.from(document.querySelectorAll('body *'))
      .some(el => visible(el) && (el.innerText || '').includes(text))

    const overlays = Array.from(document.querySelectorAll('.sitea-agent-panel, .build-sidebar.open, .fixed.inset-0'))
      .filter(visible)
      .map(el => ({
        className: el.className || '',
        text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
      }))

    return {
      canvasCount: document.querySelectorAll('canvas').length,
      chatVisible: visible(document.querySelector('.sitea-agent-panel')),
      viewControlsVisible: hasText('3D') || hasText('2D') || hasText('1P'),
      expectedToastVisible: hasText(expectedToast),
      horizontalOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
      overlays,
    }
  }, testCase.expectedToast)

  await page.screenshot({
    path: `${OUTPUT_DIR}/${viewport.name}-${testCase.name}.png`,
    fullPage: false,
  })

  await context.close()

  if (consoleErrors.length > 0) {
    fail('Browser console errors found', { consoleErrors, testCase: testCase.name, viewport: viewport.name })
  }
  if (audit.chatVisible) {
    fail('Agent chat stayed visible after visual handoff', { audit, testCase: testCase.name, viewport: viewport.name })
  }
  if (!audit.viewControlsVisible) {
    fail('Scene controls were not restored after visual handoff', { audit, testCase: testCase.name, viewport: viewport.name })
  }
  if (!audit.expectedToastVisible) {
    fail('Expected handoff toast was not visible', { audit, testCase: testCase.name, viewport: viewport.name })
  }
  if (audit.horizontalOverflow > 1) {
    fail('Horizontal overflow detected after visual handoff', { audit, testCase: testCase.name, viewport: viewport.name })
  }
  if (audit.canvasCount < 1) {
    fail('3D canvas was not rendered', { audit, testCase: testCase.name, viewport: viewport.name })
  }

  return { viewport: viewport.name, case: testCase.name, ...audit }
}

await mkdir(OUTPUT_DIR, { recursive: true })

const server = await createServer({
  logLevel: 'error',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
})

let browser
try {
  await server.listen()
  const baseUrl = getLocalUrl(server)
  browser = await chromium.launch({ headless: true })
  const results = []

  for (const viewport of VIEWPORTS) {
    for (const testCase of CASES) {
      results.push(await runCase(browser, baseUrl, testCase, viewport))
    }
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    outputDir: OUTPUT_DIR,
    results,
  }, null, 2))
} finally {
  if (browser) await browser.close()
  await server.close()
}
