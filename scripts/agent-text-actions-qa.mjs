import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const OUTPUT_DIR = 'output/playwright/agent-text-actions'

const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true },
  desktop: { width: 1280, height: 720, isMobile: false },
}

const CASES = [
  {
    name: 'mobile-set-land',
    viewport: 'mobile',
    prompt: 'Set my land to 40m by 30m',
    expectedStoredText: 'I set the land to 40.0m x 30.0m',
    expectedToast: 'Land set',
    expectChatVisible: false,
  },
  {
    name: 'desktop-fit-check',
    viewport: 'desktop',
    prompt: 'What can fit on my land?',
    expectedStoredText: 'quick area-only fit check',
    expectChatVisible: true,
    clickActionLabel: 'Show tennis court in 3D',
    expectedToast: 'Object selected',
    expectChatVisibleAfterClick: false,
  },
  {
    name: 'desktop-add-soccer',
    viewport: 'desktop',
    prompt: 'Show me a soccer field',
    expectedStoredText: 'I added a soccer field',
    expectedToast: 'Object selected',
    expectChatVisible: false,
  },
  {
    name: 'mobile-set-area',
    viewport: 'mobile',
    prompt: 'Make my land 800m2',
    expectedStoredText: 'square 800m² plot',
    expectedToast: 'Land set to 800m²',
    expectChatVisible: false,
  },
  {
    name: 'desktop-add-pool',
    viewport: 'desktop',
    prompt: 'Show me a pool',
    expectedStoredText: 'I added a swimming pool',
    expectedToast: 'Object selected',
    expectChatVisible: false,
  },
  {
    name: 'desktop-replace-object',
    viewport: 'desktop',
    prompt: 'Replace the tennis court with a garage',
    expectedStoredText: 'I replaced the tennis court with a garage',
    expectedToast: 'Object selected',
    expectChatVisible: false,
  },
  {
    name: 'desktop-remove-object',
    viewport: 'desktop',
    prompt: 'Hide the pool comparison',
    expectedStoredText: 'I removed the swimming pool',
    expectedToast: 'Swimming pool removed',
    expectChatVisible: false,
  },
  {
    name: 'mobile-clear-comparisons',
    viewport: 'mobile',
    prompt: 'Clear all comparisons',
    expectedStoredText: 'cleared the comparison objects',
    expectedToast: 'Comparison objects cleared',
    expectChatVisible: false,
  },
  {
    name: 'desktop-reset-object',
    viewport: 'desktop',
    prompt: 'Reset the garage position',
    expectedStoredText: 'I reset the garage position',
    expectedToast: 'Object selected',
    expectChatVisible: false,
  },
  {
    name: 'desktop-build-garage',
    viewport: 'desktop',
    prompt: 'Build a garage',
    expectedStoredText: 'I placed a garage',
    expectedToast: 'Garage placed',
    expectChatVisible: false,
  },
  {
    name: 'mobile-add-shed',
    viewport: 'mobile',
    prompt: 'Add a shed',
    expectedStoredText: 'I placed a shed',
    expectedToast: 'Shed placed',
    expectChatVisible: false,
  },
  {
    name: 'desktop-remove-structure',
    viewport: 'desktop',
    setupPrompts: [
      { prompt: 'Build a garage', expectedStoredText: 'I placed a garage' },
    ],
    prompt: 'Remove the garage',
    expectedStoredText: 'I removed the garage',
    expectedToast: 'Garage removed',
    expectChatVisible: false,
  },
  {
    name: 'mobile-clear-structures',
    viewport: 'mobile',
    setupPrompts: [
      { prompt: 'Build a garage', expectedStoredText: 'I placed a garage' },
      { prompt: 'Add a shed', expectedStoredText: 'I placed a shed' },
    ],
    prompt: 'Clear all structures',
    expectedStoredText: 'cleared 2 placed structures',
    expectedToast: 'Placed structures cleared',
    expectChatVisible: false,
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

async function readAudit(page, expectedToast) {
  return page.evaluate((toastText) => {
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

    const messages = JSON.parse(localStorage.getItem('sitea-ai-chat') || '[]')
    const storedText = messages.map(message => message.content || message.displayText || '').join('\n')

    return {
      canvasCount: document.querySelectorAll('canvas').length,
      chatVisible: visible(document.querySelector('.sitea-agent-panel')),
      expectedToastVisible: toastText ? hasText(toastText) : true,
      horizontalOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
      storedText,
      visibleText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500),
    }
  }, expectedToast || '')
}

async function ensureChatOpen(page) {
  const panel = page.locator('.sitea-agent-panel')
  if (await panel.isVisible().catch(() => false)) return
  const launcher = page.locator('.sitea-agent-launcher')
  await launcher.waitFor({ state: 'visible', timeout: 5000 })
  await launcher.click()
  await page.waitForSelector('.sitea-agent-panel', { state: 'visible', timeout: 5000 })
}

async function submitPrompt(page, prompt, expectedStoredText) {
  await ensureChatOpen(page)
  const input = page.getByPlaceholder('Ask Sitea or upload a plan...')
  await input.fill(prompt)
  await input.press('Enter')
  await page.waitForFunction((expected) => {
    const messages = JSON.parse(localStorage.getItem('sitea-ai-chat') || '[]')
    return messages.some(message => String(message.content || '').includes(expected))
  }, expectedStoredText, { timeout: 5000 })
}

async function runCase(browser, baseUrl, testCase) {
  const viewport = VIEWPORTS[testCase.viewport]
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
  })

  await context.addInitScript(() => {
    localStorage.removeItem('sitea-ai-chat')
    localStorage.removeItem('landVisualizer')
    localStorage.setItem('landVisualizerIntroSeen', 'true')
    localStorage.setItem('fsmCompleted', 'true')
  })

  const page = await context.newPage()
  const consoleErrors = []
  const blockedApiCalls = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })
  await page.route('**/api/ai-chat', (route) => {
    blockedApiCalls.push(route.request().url())
    route.abort()
  })
  await page.route('**/api/analyze-floor-plan', (route) => {
    blockedApiCalls.push(route.request().url())
    route.abort()
  })
  await page.route('**/api/analyze-site-plan', (route) => {
    blockedApiCalls.push(route.request().url())
    route.abort()
  })

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.sitea-agent-panel', { state: 'visible', timeout: 15000 })

  for (const setup of testCase.setupPrompts || []) {
    await submitPrompt(page, setup.prompt, setup.expectedStoredText)
    await page.waitForTimeout(700)
  }

  await submitPrompt(page, testCase.prompt, testCase.expectedStoredText)

  let audit = await readAudit(page, testCase.expectedToast)

  if (testCase.clickActionLabel) {
    await page.getByRole('button', { name: testCase.clickActionLabel }).click()
    await page.waitForTimeout(900)
    audit = await readAudit(page, testCase.expectedToast)
  } else {
    await page.waitForTimeout(700)
    audit = await readAudit(page, testCase.expectedToast)
  }

  await page.screenshot({
    path: `${OUTPUT_DIR}/${testCase.name}.png`,
    fullPage: false,
  })

  await context.close()

  const expectedChatVisible = testCase.clickActionLabel
    ? testCase.expectChatVisibleAfterClick
    : testCase.expectChatVisible

  if (consoleErrors.length > 0) {
    fail('Browser console errors found', { consoleErrors, testCase: testCase.name })
  }
  if (blockedApiCalls.length > 0) {
    fail('Text action made an API call', { blockedApiCalls, testCase: testCase.name })
  }
  if (!audit.storedText.includes(testCase.expectedStoredText)) {
    fail('Expected assistant response was not stored', { audit, testCase: testCase.name })
  }
  if (audit.chatVisible !== expectedChatVisible) {
    fail('Unexpected chat visibility after text action', { audit, testCase: testCase.name, expectedChatVisible })
  }
  if (testCase.expectedToast && !audit.expectedToastVisible) {
    fail('Expected toast was not visible', { audit, testCase: testCase.name })
  }
  if (audit.horizontalOverflow > 1) {
    fail('Horizontal overflow detected after text action', { audit, testCase: testCase.name })
  }
  if (audit.canvasCount < 1) {
    fail('3D canvas was not rendered', { audit, testCase: testCase.name })
  }

  return {
    case: testCase.name,
    viewport: testCase.viewport,
    chatVisible: audit.chatVisible,
    horizontalOverflow: audit.horizontalOverflow,
    canvasCount: audit.canvasCount,
  }
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

  for (const testCase of CASES) {
    results.push(await runCase(browser, baseUrl, testCase))
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
