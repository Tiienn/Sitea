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
    name: 'desktop-build-house-garage',
    viewport: 'desktop',
    prompt: 'Build a house with a garage',
    expectedPromptText: 'I can lay out a medium house and a garage three ways',
    clickActionLabel: 'Use option 1: Balanced',
    expectedStoredText: 'I used Option 1: Balanced layout',
    expectedToast: 'Balanced layout placed',
    expectedLayout: 'homeGarage',
    expectedLayoutVariant: 'default',
    expectChatVisibleAfterClick: false,
  },
  {
    name: 'mobile-simple-home-layout',
    viewport: 'mobile',
    prompt: 'Make a simple home layout',
    expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
    clickActionLabel: 'Use option 1: Balanced',
    expectedStoredText: 'I used Option 1: Balanced layout',
    expectedToast: 'Balanced layout placed',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'default',
    expectChatVisibleAfterClick: false,
  },
  {
    name: 'desktop-layout-option-click',
    viewport: 'desktop',
    prompt: 'Build a house with a garage',
    expectedPromptText: 'I can lay out a medium house and a garage three ways',
    clickActionLabel: 'Use option 2: More backyard space',
    expectedStoredText: 'I used Option 2: More backyard space',
    expectedToast: 'More backyard space placed',
    expectedLayout: 'homeGarage',
    expectedLayoutVariant: 'open_backyard',
    reloadBeforeClick: true,
    expectChatVisibleAfterClick: false,
  },
  {
    name: 'mobile-layout-option-text',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
      },
    ],
    reloadAfterSetup: true,
    prompt: 'Choose privacy',
    expectedStoredText: 'I used Option 3: More privacy',
    expectedToast: 'More privacy placed',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'privacy',
    expectChatVisible: false,
  },
  {
    name: 'desktop-layout-privacy-intent',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Build a house with a garage',
        expectedPromptText: 'I can lay out a medium house and a garage three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Make this more private',
    expectedStoredText: 'I made the layout more private',
    expectedToast: 'More privacy placed',
    expectedLayout: 'homeGarage',
    expectedLayoutVariant: 'privacy',
    expectChatVisible: false,
  },
  {
    name: 'mobile-layout-open-backyard-intent',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Leave the backyard open',
    expectedStoredText: 'I opened up more backyard space',
    expectedToast: 'More backyard space placed',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'open_backyard',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'desktop-garage-road-access',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Build a house with a garage',
        expectedPromptText: 'I can lay out a medium house and a garage three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Put the garage near the road',
    expectedStoredText: 'I moved the garage toward the road/front edge',
    expectedToast: 'garage moved',
    expectedToolActionName: 'move_structure',
    expectedMoveDirection: 'front',
    expectedIntentLabel: 'parking access',
    expectChatVisible: false,
  },
  {
    name: 'mobile-pool-backyard-placement',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Put the pool in the backyard',
    expectedStoredText: 'I moved the swimming pool behind',
    expectedToast: 'swimming pool moved',
    expectedToolActionName: 'move_structure',
    expectedMoveDirection: 'behind',
    expectChatVisible: false,
  },
  {
    name: 'desktop-explain-last-layout-change',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 2: More backyard space',
        expectedStoredText: 'I used Option 2: More backyard space',
      },
    ],
    prompt: 'What changed?',
    expectedStoredText: 'I last applied Option 2: More backyard space',
    expectedToolActionName: 'explain_last_layout_change',
    expectChatVisible: true,
  },
  {
    name: 'mobile-compare-privacy-backyard',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
      },
    ],
    prompt: 'Compare privacy vs backyard',
    expectedStoredText: 'Option 2 keeps the most backyard',
    expectedToolActionName: 'compare_layout_options',
    expectChatVisible: true,
  },
  {
    name: 'desktop-open-land-recommendation',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
      },
    ],
    prompt: 'Which option gives more open land?',
    expectedPromptText: 'Option 2 gives you the most open land',
    clickActionLabel: 'Use option 2: More backyard space',
    expectedStoredText: 'I used Option 2: More backyard space',
    expectedToast: 'More backyard space placed',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'open_backyard',
    allowPoolAhead: true,
    expectChatVisibleAfterClick: false,
  },
  {
    name: 'desktop-move-garage-behind-house',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Build a house with a garage',
        expectedPromptText: 'I can lay out a medium house and a garage three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Move the garage behind the house',
    expectedStoredText: 'I moved the garage behind',
    expectedToast: 'garage moved',
    expectChatVisible: false,
  },
  {
    name: 'desktop-rotate-house',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Build a house with a garage',
        expectedPromptText: 'I can lay out a medium house and a garage three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Rotate the house',
    expectedStoredText: 'I rotated the medium house 90 degrees',
    expectedToast: 'medium house rotated',
    expectChatVisible: false,
  },
  {
    name: 'mobile-make-house-bigger',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Build a house with a garage',
        expectedPromptText: 'I can lay out a medium house and a garage three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Make the house bigger',
    expectedStoredText: 'I changed the medium house to a large house',
    expectedToast: 'medium house updated',
    expectChatVisible: false,
  },
  {
    name: 'mobile-replace-pool-greenhouse',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Replace the pool with a greenhouse',
    expectedStoredText: 'I replaced the swimming pool with a greenhouse',
    expectedToast: 'swimming pool updated',
    expectChatVisible: false,
  },
  {
    name: 'desktop-undo-agent-change',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Build a house with a garage',
        expectedPromptText: 'I can lay out a medium house and a garage three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
      { prompt: 'Move the garage behind the house', expectedStoredText: 'I moved the garage behind' },
    ],
    prompt: 'Undo that',
    expectedStoredText: 'I undid the last agent layout change',
    expectedToast: 'Agent change undone',
    expectChatVisible: false,
  },
  {
    name: 'mobile-try-again-layout',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Try again',
    expectedStoredText: 'I tried another safe layout',
    expectedToast: 'Tried another layout',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'mirror_x',
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
    const toolActions = messages.flatMap(message => message.toolActions || [])
    const latestToolAction = [...toolActions].reverse().find(action =>
      action.name === 'move_structure' ||
      action.name === 'explain_last_layout_change' ||
      action.name === 'compare_layout_options' ||
      action.name === 'apply_structure_layout_option' ||
      action.name === 'place_structure_layout' ||
      action.name === 'retry_structure_layout'
    )
    const latestLayoutAction = [...toolActions].reverse().find(action =>
      action.name === 'place_structure_layout' ||
      action.name === 'retry_structure_layout' ||
      action.name === 'apply_structure_layout_option'
    )

    return {
      canvasCount: document.querySelectorAll('canvas').length,
      chatVisible: visible(document.querySelector('.sitea-agent-panel')),
      expectedToastVisible: toastText ? hasText(toastText) : true,
      horizontalOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
      storedText,
      latestToolActionName: latestToolAction?.name || null,
      latestToolActionInput: latestToolAction?.input || {},
      layoutActionName: latestLayoutAction?.name || null,
      layoutVariant: latestLayoutAction?.input?.layoutVariant || 'default',
      layoutPlacements: latestLayoutAction?.input?.placements || [],
      visibleText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500),
    }
  }, expectedToast || '')
}

function validateExpectedLayout(audit, expectedLayout, testCaseName, { allowPoolAhead = false } = {}) {
  if (!expectedLayout) return

  const placements = audit.layoutPlacements || []
  const byId = Object.fromEntries(placements.map(item => [item.structureId, item]))
  const home = byId.mediumHouse || byId.largeHouse
  const garage = byId.garage
  const pool = byId.pool

  if (!home) fail('Expected layout is missing a home placement', { audit, testCase: testCaseName })
  if (!garage) fail('Expected layout is missing a garage placement', { audit, testCase: testCaseName })
  if (expectedLayout === 'homeGaragePool' && !pool) {
    fail('Expected layout is missing a pool placement', { audit, testCase: testCaseName })
  }
  if (placements.some(item => item.placementMode !== 'role_aware')) {
    fail('Expected role-aware placement without fallback', { audit, testCase: testCaseName })
  }
  if (Math.abs(garage.x - home.x) < 1 && Math.abs(garage.z - home.z) < 1) {
    fail('Garage was not separated from the home', { audit, testCase: testCaseName })
  }
  if (pool && !allowPoolAhead && pool.z <= home.z) {
    fail('Pool was not placed behind the home', { audit, testCase: testCaseName })
  }
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
  await waitForStoredText(page, expectedStoredText)
}

async function waitForStoredText(page, expectedStoredText) {
  if (!expectedStoredText) return
  await page.waitForFunction((expected) => {
    const messages = JSON.parse(localStorage.getItem('sitea-ai-chat') || '[]')
    return messages.some(message => String(message.content || '').includes(expected))
  }, expectedStoredText, { timeout: 5000 })
}

async function clickActionAndWait(page, label, expectedStoredText) {
  const button = page.getByRole('button', { name: label }).last()
  await button.waitFor({ state: 'visible', timeout: 5000 })
  await button.click()
  await waitForStoredText(page, expectedStoredText)
}

async function reloadApp(page) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.sitea-agent-panel', { state: 'visible', timeout: 15000 })
}

async function runCase(browser, baseUrl, testCase) {
  const viewport = VIEWPORTS[testCase.viewport]
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
  })

  await context.addInitScript(() => {
    if (sessionStorage.getItem('siteaQaInitialized') === 'true') return
    sessionStorage.setItem('siteaQaInitialized', 'true')
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
    await submitPrompt(page, setup.prompt, setup.expectedPromptText || setup.expectedStoredText)
    if (setup.clickActionLabel) {
      await clickActionAndWait(page, setup.clickActionLabel, setup.expectedStoredText)
    }
    await page.waitForTimeout(700)
  }

  if (testCase.reloadAfterSetup) {
    await reloadApp(page)
  }

  await submitPrompt(page, testCase.prompt, testCase.expectedPromptText || testCase.expectedStoredText)

  if (testCase.reloadBeforeClick) {
    await reloadApp(page)
  }

  let audit = await readAudit(page, testCase.expectedToast)

  if (testCase.clickActionLabel) {
    await clickActionAndWait(page, testCase.clickActionLabel, testCase.expectedStoredText)
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
  validateExpectedLayout(audit, testCase.expectedLayout, testCase.name, {
    allowPoolAhead: testCase.allowPoolAhead === true,
  })
  if (testCase.expectedLayoutVariant && audit.layoutVariant !== testCase.expectedLayoutVariant) {
    fail('Unexpected retry layout variant', { audit, testCase: testCase.name, expectedLayoutVariant: testCase.expectedLayoutVariant })
  }
  if (testCase.expectedToolActionName && audit.latestToolActionName !== testCase.expectedToolActionName) {
    fail('Unexpected latest tool action', { audit, testCase: testCase.name, expectedToolActionName: testCase.expectedToolActionName })
  }
  if (testCase.expectedMoveDirection && audit.latestToolActionInput.direction !== testCase.expectedMoveDirection) {
    fail('Unexpected move direction', { audit, testCase: testCase.name, expectedMoveDirection: testCase.expectedMoveDirection })
  }
  if (testCase.expectedIntentLabel && audit.latestToolActionInput.intentLabel !== testCase.expectedIntentLabel) {
    fail('Unexpected intent label', { audit, testCase: testCase.name, expectedIntentLabel: testCase.expectedIntentLabel })
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
