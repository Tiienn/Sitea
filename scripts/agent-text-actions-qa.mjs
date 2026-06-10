import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const OUTPUT_DIR = 'output/playwright/agent-text-actions'

const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true },
  desktop: { width: 1280, height: 720, isMobile: false },
}

const QA_GENERATED_BUILDING = {
  id: 'qa-generated-plan-1',
  position: { x: 0, z: 0 },
  rotation: 0,
  stats: { wallCount: 4, doorCount: 1, windowCount: 2, roomCount: 1 },
  sourcePlan: {
    sourceFileName: 'qa-floor-plan.png',
    readiness: { state: 'ready', label: 'Ready for 3D' },
    counts: { wallCount: 4, doorCount: 1, windowCount: 2, roomCount: 1 },
    corrections: { hiddenCount: 0, addedCount: 0, wallEditCount: 0, openingEditCount: 0 },
  },
  walls: [
    { id: 'qa-wall-1', start: { x: -4, z: -3 }, end: { x: 4, z: -3 }, height: 2.7, thickness: 0.15, isExterior: true, openings: [{ id: 'qa-window-1', type: 'window', position: 4, width: 1.2, height: 1.2, sillHeight: 0.9 }] },
    { id: 'qa-wall-2', start: { x: 4, z: -3 }, end: { x: 4, z: 3 }, height: 2.7, thickness: 0.15, isExterior: true, openings: [] },
    { id: 'qa-wall-3', start: { x: 4, z: 3 }, end: { x: -4, z: 3 }, height: 2.7, thickness: 0.15, isExterior: true, openings: [{ id: 'qa-door-1', type: 'door', position: 4, width: 0.9, height: 2.1, sillHeight: 0 }] },
    { id: 'qa-wall-4', start: { x: -4, z: 3 }, end: { x: -4, z: -3 }, height: 2.7, thickness: 0.15, isExterior: true, openings: [{ id: 'qa-window-2', type: 'window', position: 3, width: 1.2, height: 1.2, sillHeight: 0.9 }] },
  ],
  rooms: [{ id: 'qa-room-1', name: 'Living room', center: { x: 0, z: 0 } }],
  stairs: [],
}

const QA_SECOND_GENERATED_BUILDING = {
  ...QA_GENERATED_BUILDING,
  id: 'qa-generated-plan-2',
  position: { x: 12, z: 0 },
  sourcePlan: {
    ...QA_GENERATED_BUILDING.sourcePlan,
    sourceFileName: 'qa-second-floor-plan.png',
  },
  walls: QA_GENERATED_BUILDING.walls.map(wall => ({ ...wall, id: `${wall.id}-second` })),
  rooms: [{ id: 'qa-room-2', name: 'Bedroom', center: { x: 0, z: 0 } }],
}

const QA_SCENE_WITH_GENERATED_BUILDING = {
  dimensions: { length: 55, width: 50 },
  shapeMode: 'rectangle',
  polygonPoints: [],
  confirmedPolygon: null,
  placedBuildings: [],
  activeComparisons: {},
  generatedBuildings: [QA_GENERATED_BUILDING],
}

const QA_SCENE_WITH_TWO_GENERATED_BUILDINGS = {
  ...QA_SCENE_WITH_GENERATED_BUILDING,
  generatedBuildings: [QA_GENERATED_BUILDING, QA_SECOND_GENERATED_BUILDING],
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
    name: 'desktop-recommendation-follow-through',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
      },
      {
        prompt: 'Which option gives more open land?',
        expectedStoredText: 'Option 2 gives you the most open land',
      },
    ],
    prompt: 'Do that',
    expectedStoredText: 'I used Option 2: More backyard space',
    expectedToast: 'More backyard space placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'open_backyard',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'mobile-recommendation-follow-through-reload',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
      },
      {
        prompt: 'Which option gives more open land?',
        expectedStoredText: 'Option 2 gives you the most open land',
      },
    ],
    reloadAfterSetup: true,
    prompt: 'Yes please',
    expectedStoredText: 'I used Option 2: More backyard space',
    expectedToast: 'More backyard space placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'open_backyard',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'desktop-recommendation-follow-through-empty',
    viewport: 'desktop',
    prompt: 'Do that',
    expectedStoredText: 'I do not have a layout recommendation waiting yet',
    expectedToolActionName: 'apply_latest_layout_recommendation',
    expectChatVisible: true,
  },
  {
    name: 'desktop-visual-plan-option-number',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'visual plan',
      },
    ],
    prompt: 'Option 2',
    expectedStoredText: 'I used Option 2: More backyard space',
    expectedToast: 'More backyard space placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'open_backyard',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'mobile-visual-plan-do-it',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'Pick an option, or say "do it"',
      },
    ],
    prompt: 'Do it',
    expectedStoredText: 'I used Option 1: Balanced layout',
    expectedToast: 'Balanced layout placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'default',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'mobile-visual-plan-do-it-reload',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'Pick an option, or say "do it"',
      },
    ],
    reloadAfterSetup: true,
    prompt: 'Do it',
    expectedStoredText: 'I used Option 1: Balanced layout',
    expectedToast: 'Balanced layout placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'default',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'desktop-visual-plan-natural-privacy',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedStoredText: 'visual plan',
      },
    ],
    prompt: 'Make it more private',
    expectedStoredText: 'I made the layout more private',
    expectedToast: 'More privacy placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'privacy',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'desktop-scene-summary-empty',
    viewport: 'desktop',
    prompt: 'What is on my land?',
    expectedStoredText: 'Placed structures: none yet',
    expectedToolActionName: 'summarize_scene',
    expectChatVisible: true,
  },
  {
    name: 'desktop-site-brief-empty',
    viewport: 'desktop',
    prompt: 'What do you know about my site?',
    expectedStoredText: 'Site Brief',
    expectedToolActionName: 'site_brief',
    expectChatVisible: true,
  },
  {
    name: 'desktop-capture-privacy-goal',
    viewport: 'desktop',
    prompt: 'I want privacy',
    expectedStoredText: 'Goal saved: Privacy',
    expectedToolActionName: 'capture_project_goals',
    expectChatVisible: true,
  },
  {
    name: 'mobile-site-brief-with-goals',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'I need a family home with parking',
        expectedStoredText: 'Goal saved: Family home and Parking',
      },
    ],
    prompt: 'Site brief',
    expectedStoredText: 'Goals: Family home and Parking',
    expectedToolActionName: 'site_brief',
    expectChatVisible: true,
  },
  {
    name: 'desktop-goal-follow-through-empty',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'I want privacy',
        expectedStoredText: 'Best move: make a privacy-focused home layout',
      },
    ],
    prompt: 'Do it',
    expectedStoredText: 'I used Option 3: More privacy',
    expectedToast: 'More privacy placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'privacy',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'desktop-vague-empty-asks-priority',
    viewport: 'desktop',
    prompt: 'Design my site',
    expectedStoredText: 'Missing next: land size',
    expectedToolActionName: 'clarify_or_act',
    expectChatVisible: true,
  },
  {
    name: 'desktop-vague-empty-use-demo-land',
    viewport: 'desktop',
    prompt: 'Help me plan this',
    expectedPromptText: 'Missing next: land size',
    clickActionLabel: 'Use demo land',
    expectedStoredText: 'I set up demo land',
    expectedToast: 'Demo land ready',
    expectedToolActionName: 'set_demo_land',
    expectChatVisibleAfterClick: false,
  },
  {
    name: 'mobile-site-brief-missing-land',
    viewport: 'mobile',
    prompt: 'Site brief',
    expectedStoredText: 'Missing next: land size',
    expectedToolActionName: 'site_brief',
    expectChatVisible: true,
    expectMobileHudHidden: true,
  },
  {
    name: 'mobile-agent-close-restores-controls',
    viewport: 'mobile',
    prompt: 'Site brief',
    expectedStoredText: 'Missing next: land size',
    expectedToolActionName: 'site_brief',
    closeChatAfterPrompt: true,
    expectChatVisible: false,
    expectMobileRibbonVisible: true,
    expectMobileViewControlsVisible: true,
  },
  {
    name: 'mobile-vague-goal-follow-through',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Use demo land',
        expectedStoredText: 'I set up demo land',
      },
      {
        prompt: 'I want privacy',
        expectedStoredText: 'Goal saved: Privacy',
      },
      {
        prompt: 'Make it better',
        expectedStoredText: 'Best move: make a privacy-focused home layout',
      },
    ],
    prompt: 'Do it',
    expectedStoredText: 'I used Option 3: More privacy',
    expectedToast: 'More privacy placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'privacy',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'mobile-site-brief-follow-through-empty',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'Site brief',
        expectedStoredText: 'Best next move: define the land first',
      },
    ],
    prompt: 'Do it',
    expectedStoredText: 'I set up demo land',
    expectedToast: 'Demo land ready',
    expectedToolActionName: 'set_demo_land',
    expectChatVisible: false,
  },
  {
    name: 'mobile-scene-next-step-empty',
    viewport: 'mobile',
    prompt: 'What should I do next?',
    expectedStoredText: 'Best move: make a simple home layout',
    expectedToolActionName: 'recommend_next_step',
    expectChatVisible: true,
  },
  {
    name: 'desktop-decision-best-move-empty',
    viewport: 'desktop',
    prompt: 'What would you do next?',
    expectedStoredText: 'Best move: make a simple home layout',
    expectedToolActionName: 'recommend_next_step',
    expectChatVisible: true,
  },
  {
    name: 'mobile-decision-follow-through-empty',
    viewport: 'mobile',
    setupPrompts: [
      {
        prompt: 'What should I do next?',
        expectedStoredText: 'Best move: make a simple home layout',
      },
    ],
    prompt: 'Show me',
    expectedStoredText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
    expectedToolActionName: 'offer_structure_layout_options',
    expectChatVisible: true,
  },
  {
    name: 'desktop-decision-follow-through-after-layout',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
      {
        prompt: 'What would you do?',
        expectedStoredText: 'Best move: open up more backyard space',
      },
    ],
    prompt: 'Do that',
    expectedStoredText: 'I used Option 2: More backyard space',
    expectedToast: 'More backyard space placed',
    expectedToolActionName: 'apply_structure_layout_option',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'open_backyard',
    allowPoolAhead: true,
    expectChatVisible: false,
  },
  {
    name: 'desktop-vague-post-layout-recommends-context',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 1: Balanced',
        expectedStoredText: 'I used Option 1: Balanced layout',
      },
    ],
    prompt: 'Make it better',
    expectedStoredText: 'Best move: open up more backyard space',
    expectedToolActionName: 'clarify_or_act',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'default',
    allowPoolAhead: true,
    expectChatVisible: true,
  },
  {
    name: 'desktop-upload-floor-follow-through',
    viewport: 'desktop',
    seedMessages: [{
      role: 'assistant',
      content: 'I read sample-floor-plan.pdf as a floor plan and found 24 walls, 6 doors, 8 windows, 5 rooms.\n\nThis is a visual extraction, so review the detected overlay before trusting exact geometry.\n\nReadiness: Needs quick review.\nThe plan is usable, but one or two signals need a look before trusting the 3D result.\n\nWhat I would check first:\n- Wall count looks usable for a first 3D pass.\n- Check that doors sit on the correct wall and swing/opening positions look right.\n- Check window positions, especially on exterior walls.\n\nBest visual move: review the overlay first.\nWhy: The plan is usable, but one or two signals need a look before trusting the 3D result. The overlay shows what Sitea found first, then the detected building can become a real object on the land for scale, access, and outdoor space decisions.',
      decision: {
        label: 'Upload decision',
        title: 'Review the overlay first',
        body: 'The plan is usable, but one or two signals need a look before trusting the 3D result. The overlay shows what Sitea found first, then the detected building can become a real object on the land for scale, access, and outdoor space decisions.',
        detail: 'I read sample-floor-plan.pdf as a floor plan and found 24 walls, 6 doors, 8 windows, 5 rooms. Wall count looks usable for a first 3D pass.',
      },
      toolActions: [{
        name: 'analyze_floor_plan',
        input: {
          fileName: 'sample-floor-plan.pdf',
          planKind: 'floor_plan',
          wallCount: 24,
          doorCount: 6,
          windowCount: 8,
          roomCount: 5,
          recommendedAction: {
            type: 'handoff_to_scene',
            label: 'Review overlay first',
            toast: 'Preview ready • click the land to place it • R to rotate',
          },
          readiness: {
            state: 'review',
            label: 'Needs quick review',
            action: 'Review the highlighted checks, then place in 3D.',
          },
        },
        success: true,
      }],
      suggestedActions: [{
        type: 'handoff_to_scene',
        label: 'Review overlay first',
        toast: 'Preview ready • click the land to place it • R to rotate',
      }],
    }],
    prompt: 'Do it',
    expectedStoredText: 'opened the prepared scene',
    expectedAdditionalStoredText: [
      'I read sample-floor-plan.pdf as a floor plan',
      'Best visual move: review the overlay first',
    ],
    expectedToast: 'Preview ready',
    expectedToolActionName: 'handoff_to_scene',
    expectChatVisible: false,
  },
  {
    name: 'mobile-upload-site-follow-through',
    viewport: 'mobile',
    seedMessages: [{
      role: 'assistant',
      content: 'I read sample-site-plan.png as a site plan with 88% confidence. About 10 tennis courts can fit inside 2750m² before setbacks, house footprint, and access space.\n\nThe land workspace is ready enough for a scale comparison.\n\nBest visual move: show a tennis court in 3D.\nWhy: a real-world scale object makes the land size immediately understandable before you decide where buildings or open space should go.',
      decision: {
        label: 'Upload decision',
        title: 'show a tennis court in 3D',
        body: 'a real-world scale object makes the land size immediately understandable before you decide where buildings or open space should go.',
        detail: 'I read sample-site-plan.png as a site plan with 88% confidence. About 10 tennis courts can fit inside 2750m² before setbacks, house footprint, and access space. The land workspace is ready enough for a scale comparison.',
      },
      toolActions: [{
        name: 'review_site_plan',
        input: {
          fileName: 'sample-site-plan.png',
          planKind: 'site_plan',
          landArea: 2750,
          tennisCourtFit: 10,
          detectionType: 'site-plan',
          detectionConfidence: 0.88,
          recommendedAction: {
            type: 'activate_comparison',
            comparisonId: 'tennisCourt',
            label: 'Show tennis court in 3D',
            objectName: 'tennis court',
            handoff: true,
            toast: 'Tennis court added • drag or rotate it to compare scale',
          },
        },
        success: true,
      }],
      suggestedActions: [{
        type: 'activate_comparison',
        comparisonId: 'tennisCourt',
        label: 'Show tennis court in 3D',
        objectName: 'tennis court',
        handoff: true,
        toast: 'Tennis court added • drag or rotate it to compare scale',
      }],
    }],
    prompt: 'Compare it',
    expectedStoredText: 'I added a tennis court',
    expectedAdditionalStoredText: [
      'I read sample-site-plan.png as a site plan',
      'Best visual move: show a tennis court in 3D',
    ],
    expectedToolActionName: 'activate_comparison',
    expectChatVisible: false,
  },
  {
    name: 'desktop-scene-summary-after-layout',
    viewport: 'desktop',
    setupPrompts: [
      {
        prompt: 'Make a simple home layout',
        expectedPromptText: 'I can lay out a medium house, a garage, and a swimming pool three ways',
        clickActionLabel: 'Use option 2: More backyard space',
        expectedStoredText: 'I used Option 2: More backyard space',
      },
    ],
    prompt: 'Summarize the site',
    expectedStoredText: 'Placed structures: a medium house, a garage, and a swimming pool',
    expectedToolActionName: 'summarize_scene',
    expectedLayout: 'homeGaragePool',
    expectedLayoutVariant: 'open_backyard',
    allowPoolAhead: true,
    expectChatVisible: true,
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
  {
    name: 'desktop-select-uploaded-floor-plan',
    viewport: 'desktop',
    seedScene: QA_SCENE_WITH_GENERATED_BUILDING,
    prompt: 'Select the uploaded plan',
    expectedStoredText: 'I selected the uploaded floor-plan building',
    expectedToolActionName: 'select_generated_building',
    expectedToolActionBuildingId: 'qa-generated-plan-1',
    expectedToolActionTargetSource: 'only',
    expectChatVisible: false,
  },
  {
    name: 'desktop-rotate-uploaded-floor-plan-auto-target',
    viewport: 'desktop',
    seedScene: QA_SCENE_WITH_GENERATED_BUILDING,
    prompt: 'Rotate the uploaded plan',
    expectedStoredText: 'I rotated the uploaded floor-plan building 90 degrees',
    expectedToolActionName: 'rotate_selected_generated_building',
    expectedToolActionBuildingId: 'qa-generated-plan-1',
    expectedToolActionTargetSource: 'only',
    expectChatVisible: false,
  },
  {
    name: 'mobile-edit-uploaded-floor-plan-auto-target',
    viewport: 'mobile',
    seedScene: QA_SCENE_WITH_GENERATED_BUILDING,
    prompt: 'Make the uploaded plan editable',
    expectedStoredText: 'turned the uploaded floor-plan building into editable walls',
    expectedToolActionName: 'explode_selected_generated_building',
    expectedToolActionBuildingId: 'qa-generated-plan-1',
    expectedToolActionTargetSource: 'only',
    expectChatVisible: false,
  },
  {
    name: 'desktop-rotate-latest-floor-plan-auto-target',
    viewport: 'desktop',
    seedScene: QA_SCENE_WITH_TWO_GENERATED_BUILDINGS,
    prompt: 'Rotate the floor plan',
    expectedStoredText: 'I rotated the latest uploaded floor-plan building 90 degrees',
    expectedAdditionalStoredText: ['There are 2; I used the latest placed one.'],
    expectedToolActionName: 'rotate_selected_generated_building',
    expectedToolActionBuildingId: 'qa-generated-plan-2',
    expectedToolActionTargetSource: 'latest',
    expectChatVisible: false,
  },
  {
    name: 'desktop-deselect-floor-plan-empty-scene',
    viewport: 'desktop',
    prompt: 'Deselect it',
    expectedStoredText: 'No uploaded floor-plan building is placed yet',
    expectedToolActionName: 'deselect_selected_generated_building',
    expectChatVisible: true,
  },
]

function fail(message, details = {}) {
  const error = new Error(message)
  error.details = details
  throw error
}

function isKnownNonFatalConsoleError(text) {
  return /^THREE\.GLTFLoader: Couldn't load texture blob:http:\/\/127\.0\.0\.1:5173\//.test(text)
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
      action.name === 'apply_latest_layout_recommendation' ||
      action.name === 'capture_project_goals' ||
      action.name === 'clarify_or_act' ||
      action.name === 'site_brief' ||
      action.name === 'summarize_scene' ||
      action.name === 'recommend_next_step' ||
      action.name === 'set_demo_land' ||
      action.name === 'handoff_to_scene' ||
      action.name === 'activate_comparison' ||
      action.name === 'review_site_boundary' ||
      action.name === 'offer_structure_layout_options' ||
      action.name === 'apply_structure_layout_option' ||
      action.name === 'place_structure_layout' ||
      action.name === 'retry_structure_layout' ||
      action.name === 'select_generated_building' ||
      action.name === 'rotate_selected_generated_building' ||
      action.name === 'explode_selected_generated_building' ||
      action.name === 'deselect_selected_generated_building'
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
      mobileRibbonVisible: visible(document.querySelector('.ribbon-nav')),
      mobileMinimapVisible: visible(document.querySelector('.sitea-minimap')),
      mobileViewControlsVisible: visible(document.querySelector('.sitea-mobile-view-controls')),
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

async function submitPrompt(page, prompt, expectedStoredText, testCaseName = 'unknown') {
  await ensureChatOpen(page)
  const input = page.getByPlaceholder('Ask Sitea or upload a plan...')
  await input.fill(prompt)
  await input.press('Enter')
  await waitForStoredText(page, expectedStoredText, testCaseName)
}

async function waitForStoredText(page, expectedStoredText, testCaseName = 'unknown') {
  if (!expectedStoredText) return
  try {
    await page.waitForFunction((expected) => {
      const messages = JSON.parse(localStorage.getItem('sitea-ai-chat') || '[]')
      return messages.some(message => String(message.content || '').includes(expected))
    }, expectedStoredText, { timeout: 5000 })
  } catch (error) {
    const storedText = await page.evaluate(() => {
      const messages = JSON.parse(localStorage.getItem('sitea-ai-chat') || '[]')
      return messages.map(message => message.content || message.displayText || '').join('\n')
    })
    fail('Timed out waiting for expected stored text', {
      testCase: testCaseName,
      expectedStoredText,
      storedText,
      originalError: error.message,
    })
  }
}

async function clickActionAndWait(page, label, expectedStoredText) {
  const button = page.getByRole('button', { name: label }).last()
  await button.waitFor({ state: 'visible', timeout: 5000 })
  await button.click()
  await waitForStoredText(page, expectedStoredText, label)
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

  await context.addInitScript(({ seedMessages, seedScene }) => {
    if (sessionStorage.getItem('siteaQaInitialized') === 'true') return
    sessionStorage.setItem('siteaQaInitialized', 'true')
    localStorage.removeItem('sitea-ai-chat')
    localStorage.removeItem('landVisualizer')
    localStorage.setItem('landVisualizerIntroSeen', 'true')
    localStorage.setItem('fsmCompleted', 'true')
    if (seedScene) {
      localStorage.setItem('landVisualizer', JSON.stringify(seedScene))
    }
    if (Array.isArray(seedMessages) && seedMessages.length > 0) {
      localStorage.setItem('sitea-ai-chat', JSON.stringify(seedMessages))
    }
  }, {
    seedMessages: testCase.seedMessages || null,
    seedScene: testCase.seedScene || null,
  })

  const page = await context.newPage()
  const consoleErrors = []
  const blockedApiCalls = []

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isKnownNonFatalConsoleError(msg.text())) consoleErrors.push(msg.text())
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
    await submitPrompt(page, setup.prompt, setup.expectedPromptText || setup.expectedStoredText, testCase.name)
    if (setup.clickActionLabel) {
      await clickActionAndWait(page, setup.clickActionLabel, setup.expectedStoredText)
    }
    await page.waitForTimeout(700)
  }

  if (testCase.reloadAfterSetup) {
    await reloadApp(page)
  }

  await submitPrompt(page, testCase.prompt, testCase.expectedPromptText || testCase.expectedStoredText, testCase.name)

  if (testCase.reloadBeforeClick) {
    await reloadApp(page)
  }

  let audit = await readAudit(page, testCase.expectedToast)

  if (testCase.closeChatAfterPrompt) {
    await page.getByTitle('Close').last().click()
    await page.waitForTimeout(500)
    audit = await readAudit(page, testCase.expectedToast)
  } else if (testCase.clickActionLabel) {
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
  for (const expectedText of testCase.expectedAdditionalStoredText || []) {
    if (!audit.storedText.includes(expectedText)) {
      fail('Expected additional stored text was not found', { audit, testCase: testCase.name, expectedText })
    }
  }
  if (audit.chatVisible !== expectedChatVisible) {
    fail('Unexpected chat visibility after text action', { audit, testCase: testCase.name, expectedChatVisible })
  }
  if (testCase.expectMobileHudHidden && (audit.mobileRibbonVisible || audit.mobileMinimapVisible || audit.mobileViewControlsVisible)) {
    fail('Mobile HUD should be hidden while agent is focused', { audit, testCase: testCase.name })
  }
  if (testCase.expectMobileRibbonVisible === true && !audit.mobileRibbonVisible) {
    fail('Mobile ribbon should be visible after agent closes', { audit, testCase: testCase.name })
  }
  if (testCase.expectMobileViewControlsVisible === true && !audit.mobileViewControlsVisible) {
    fail('Mobile view controls should be visible after agent closes', { audit, testCase: testCase.name })
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
  if (testCase.expectedToolActionBuildingId && audit.latestToolActionInput.buildingId !== testCase.expectedToolActionBuildingId) {
    fail('Unexpected generated building target', { audit, testCase: testCase.name, expectedToolActionBuildingId: testCase.expectedToolActionBuildingId })
  }
  if (testCase.expectedToolActionTargetSource && audit.latestToolActionInput.targetSource !== testCase.expectedToolActionTargetSource) {
    fail('Unexpected generated building target source', { audit, testCase: testCase.name, expectedToolActionTargetSource: testCase.expectedToolActionTargetSource })
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
