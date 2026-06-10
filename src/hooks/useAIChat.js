import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertFloorPlanToWorld } from '../utils/floorPlanConverter'
import { buildFloorPlanReadout } from '../utils/floorPlanReadout'
import { analyzeImage } from '../services/imageAnalysis'

const MAX_TOOL_ITERATIONS = 5
const TENNIS_COURT = { id: 'tennisCourt', name: 'tennis court', width: 10.97, length: 23.77 }
const FLOOR_PLAN_TIMEOUT_ERROR = 'The floor-plan scan took too long. Please try again, or upload a smaller, clearer image.'
const TEXT_ACTION_COMPARISONS = [
  {
    id: 'tennisCourt',
    name: 'tennis court',
    displayName: 'Tennis court',
    pluralName: 'tennis courts',
    width: 10.97,
    length: 23.77,
    aliases: ['tennis court', 'tennis'],
  },
  {
    id: 'basketballCourt',
    name: 'basketball court',
    displayName: 'Basketball court',
    pluralName: 'basketball courts',
    width: 15,
    length: 28,
    aliases: ['basketball court', 'basketball'],
  },
  {
    id: 'soccerField',
    name: 'soccer field',
    displayName: 'Soccer field',
    pluralName: 'soccer fields',
    width: 68,
    length: 105,
    aliases: ['soccer field', 'soccer', 'football pitch'],
  },
  {
    id: 'swimmingPool',
    name: 'swimming pool',
    displayName: 'Swimming pool',
    pluralName: 'swimming pools',
    width: 25,
    length: 50,
    aliases: ['swimming pool', 'olympic pool', 'pool'],
  },
  {
    id: 'house',
    name: 'house',
    displayName: 'House',
    pluralName: 'houses',
    width: 10,
    length: 10,
    aliases: ['small house', '10m house', 'house', 'home'],
  },
  {
    id: 'mediumHouse',
    name: 'medium house',
    displayName: 'Medium house',
    pluralName: 'medium houses',
    width: 12,
    length: 15,
    aliases: ['medium house', 'medium home'],
  },
  {
    id: 'largeHouse',
    name: 'large house',
    displayName: 'Large house',
    pluralName: 'large houses',
    width: 15,
    length: 20,
    aliases: ['large house', 'large home'],
  },
  {
    id: 'garage',
    name: 'garage',
    displayName: 'Garage',
    pluralName: 'garages',
    width: 6,
    length: 6,
    aliases: ['garage'],
  },
  {
    id: 'parkingSpace',
    name: 'parking space',
    displayName: 'Parking space',
    pluralName: 'parking spaces',
    width: 2.5,
    length: 5,
    aliases: ['parking space', 'parking bay', 'parking spot', 'parking'],
  },
  {
    id: 'shippingContainer',
    name: 'shipping container',
    displayName: 'Shipping container',
    pluralName: 'shipping containers',
    width: 2.44,
    length: 6.06,
    aliases: ['shipping container', 'container'],
  },
  {
    id: 'carSedan',
    name: 'car',
    displayName: 'Car',
    pluralName: 'cars',
    width: 1.8,
    length: 4.5,
    aliases: ['car sedan', 'sedan', 'car'],
  },
  {
    id: 'shed',
    name: 'shed',
    displayName: 'Shed',
    pluralName: 'sheds',
    width: 3,
    length: 4,
    aliases: ['shed'],
  },
  {
    id: 'greenhouse',
    name: 'greenhouse',
    displayName: 'Greenhouse',
    pluralName: 'greenhouses',
    width: 4,
    length: 6,
    aliases: ['greenhouse'],
  },
]

async function readFloorPlanAnalysisResponse(response) {
  const text = await response.text()
  let data = {}

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      if (response.status === 504) {
        throw new Error(FLOOR_PLAN_TIMEOUT_ERROR)
      }
      if (!response.ok) {
        throw new Error(`Floor-plan analysis failed (${response.status}). Please try again.`)
      }
      throw new Error('Sitea received an invalid floor-plan analysis response. Please try again.')
    }
  }

  if (!response.ok || data.error) {
    if (data.code === 'FLOOR_PLAN_ANALYSIS_TIMEOUT') {
      throw new Error(data.error || FLOOR_PLAN_TIMEOUT_ERROR)
    }
    if (response.status === 504) {
      throw new Error(FLOOR_PLAN_TIMEOUT_ERROR)
    }
    throw new Error(data.error || `Analysis failed: ${response.status}`)
  }

  return data
}

const TEXT_ACTION_STRUCTURES = [
  {
    id: 'mediumHouse',
    name: 'medium house',
    displayName: 'Medium house',
    role: 'primary_home',
    width: 12,
    length: 15,
    aliases: ['medium house', 'medium home', 'house', 'home'],
  },
  {
    id: 'largeHouse',
    name: 'large house',
    displayName: 'Large house',
    role: 'primary_home',
    width: 15,
    length: 20,
    aliases: ['large house', 'large home'],
  },
  {
    id: 'shed',
    name: 'shed',
    displayName: 'Shed',
    role: 'small_accessory',
    width: 3,
    length: 4,
    aliases: ['shed'],
  },
  {
    id: 'garage',
    name: 'garage',
    displayName: 'Garage',
    role: 'vehicle_storage',
    width: 6,
    length: 6,
    aliases: ['garage'],
  },
  {
    id: 'barn',
    name: 'barn',
    displayName: 'Barn',
    role: 'work_agricultural',
    width: 10,
    length: 14,
    aliases: ['barn'],
  },
  {
    id: 'workshop',
    name: 'workshop',
    displayName: 'Workshop',
    role: 'work_agricultural',
    width: 6,
    length: 8,
    aliases: ['workshop'],
  },
  {
    id: 'greenhouse',
    name: 'greenhouse',
    displayName: 'Greenhouse',
    role: 'outdoor_amenity',
    width: 4,
    length: 6,
    aliases: ['greenhouse'],
  },
  {
    id: 'gazebo',
    name: 'gazebo',
    displayName: 'Gazebo',
    role: 'outdoor_amenity',
    width: 4,
    length: 4,
    aliases: ['gazebo'],
  },
  {
    id: 'carport',
    name: 'carport',
    displayName: 'Carport',
    role: 'vehicle_storage',
    width: 3,
    length: 6,
    aliases: ['carport'],
  },
  {
    id: 'pool',
    name: 'swimming pool',
    displayName: 'Swimming pool',
    role: 'outdoor_amenity',
    width: 5,
    length: 10,
    aliases: ['swimming pool', 'pool'],
  },
]

const DEFAULT_HOME_LAYOUT_STRUCTURE_IDS = ['mediumHouse', 'garage', 'pool']
const STRUCTURE_LAYOUT_OPTIONS = [
  {
    id: 'balanced',
    label: 'Option 1: Balanced layout',
    actionLabel: 'Use option 1: Balanced',
    layoutVariant: 'default',
    summary: 'A straightforward layout with the home near the center/front, vehicle access nearby, and amenities behind.',
    reason: 'I balanced access, outdoor space, and a simple home-first arrangement.',
    advisor: {
      bestFor: 'a safe first pass with simple access and room to adjust later',
      change: 'It keeps the home, access, and outdoor space in a middle-ground arrangement instead of pushing everything to one edge.',
      tradeoff: 'It is not the strongest choice if you want maximum privacy or the largest uninterrupted backyard.',
    },
  },
  {
    id: 'open_backyard',
    label: 'Option 2: More backyard space',
    actionLabel: 'Use option 2: More backyard space',
    layoutVariant: 'open_backyard',
    summary: 'Keeps the main building and access closer to the front/side so more open land remains behind.',
    reason: 'I pulled structures toward the front and side to keep the back of the land more open.',
    advisor: {
      bestFor: 'the most open backyard, garden space, or future outdoor use',
      change: 'It pulls the home and access toward the front/side so the rear of the land stays more open.',
      tradeoff: 'It can feel less private because more of the layout sits closer to the front or side access edge.',
    },
  },
  {
    id: 'privacy',
    label: 'Option 3: More privacy',
    actionLabel: 'Use option 3: More privacy',
    layoutVariant: 'privacy',
    summary: 'Pushes the home and outdoor areas deeper into the land, with access structures acting more like a front buffer.',
    reason: 'I pushed living and outdoor spaces deeper into the site while keeping access near the front.',
    advisor: {
      bestFor: 'more separation from the road/front edge and a quieter living zone',
      change: 'It pushes the home and outdoor space deeper into the site while keeping vehicle access closer to the front.',
      tradeoff: 'It uses more depth, so it gives up some of the simple open-backyard feel.',
    },
  },
]

const PROJECT_GOAL_DEFINITIONS = [
  {
    id: 'privacy',
    label: 'Privacy',
    summary: 'more separation from the front edge and a quieter living zone',
    layoutOptionId: 'privacy',
    actionLabel: 'Make more private',
    emptyActionLabel: 'Make a private home layout',
    emptyBestMove: 'make a privacy-focused home layout',
    activeBestMove: 'make the layout more private',
    why: 'privacy is your stated priority, so the safest next move is to push living space deeper into the site and use access structures as a buffer.',
    structureIds: DEFAULT_HOME_LAYOUT_STRUCTURE_IDS,
  },
  {
    id: 'open_backyard',
    label: 'Open backyard',
    summary: 'more uninterrupted outdoor land behind the main layout',
    layoutOptionId: 'open_backyard',
    actionLabel: 'Open backyard',
    emptyActionLabel: 'Make an open-backyard layout',
    emptyBestMove: 'make an open-backyard home layout',
    activeBestMove: 'open up more backyard space',
    why: 'you want usable open land, so the layout should keep buildings closer to the front or side and protect the rear outdoor zone.',
    structureIds: DEFAULT_HOME_LAYOUT_STRUCTURE_IDS,
  },
  {
    id: 'family_home',
    label: 'Family home',
    summary: 'a practical home-first layout with room to adjust',
    layoutOptionId: 'balanced',
    actionLabel: 'Make family layout',
    emptyActionLabel: 'Make a family home layout',
    emptyBestMove: 'make a family home layout',
    activeBestMove: 'review the balanced family layout',
    why: 'a family home needs a simple first arrangement before we tune privacy, parking, pool, or outdoor space.',
    structureIds: ['mediumHouse', 'garage'],
  },
  {
    id: 'parking',
    label: 'Parking',
    summary: 'vehicle access, parking, garage, or driveway space',
    layoutOptionId: 'balanced',
    actionLabel: 'Plan parking',
    emptyActionLabel: 'Make a home and parking layout',
    emptyBestMove: 'make a home and parking layout',
    activeBestMove: 'check access and parking',
    why: 'parking and access should be placed early because they affect where the home, garden, and outdoor amenities can safely go.',
    structureIds: ['mediumHouse', 'garage'],
  },
  {
    id: 'pool',
    label: 'Pool',
    summary: 'pool or outdoor amenity space',
    layoutOptionId: 'open_backyard',
    actionLabel: 'Protect pool space',
    emptyActionLabel: 'Make a home and pool layout',
    emptyBestMove: 'make a home and pool layout',
    activeBestMove: 'protect space for the pool',
    why: 'a pool needs clear outdoor space, so the next layout should reserve a usable backyard zone instead of filling the land randomly.',
    structureIds: DEFAULT_HOME_LAYOUT_STRUCTURE_IDS,
  },
  {
    id: 'demo_ready',
    label: 'Demo ready',
    summary: 'a clean, easy-to-explain first visual result',
    layoutOptionId: 'balanced',
    actionLabel: 'Make demo layout',
    emptyActionLabel: 'Make a demo-ready layout',
    emptyBestMove: 'make a demo-ready layout',
    activeBestMove: 'summarize and compare the current layout',
    why: 'a demo-ready project needs one clear baseline layout, then Sitea can explain the tradeoffs visually.',
    structureIds: DEFAULT_HOME_LAYOUT_STRUCTURE_IDS,
  },
]

const formatMeters = (value) => Number.isFinite(value) ? `${value.toFixed(1)}m` : 'unknown'
const formatArea = (value) => Number.isFinite(value) ? `${Math.round(value)}m²` : 'the current land'
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function formatNameList(names) {
  if (!names.length) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function formatStructureNameList(names) {
  return formatNameList(names.map(name => `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`))
}

function getLayoutOptionById(optionId) {
  return STRUCTURE_LAYOUT_OPTIONS.find(option => option.id === optionId) || STRUCTURE_LAYOUT_OPTIONS[0]
}

function getLayoutOptionByVariant(layoutVariant) {
  return STRUCTURE_LAYOUT_OPTIONS.find(option => option.layoutVariant === layoutVariant) || null
}

function createLayoutOptionAction(optionId, structures) {
  const option = getLayoutOptionById(optionId)
  return {
    type: 'apply_structure_layout_option',
    optionId: option.id,
    layoutVariant: option.layoutVariant,
    label: option.actionLabel,
    structures: structures.map(structure => ({ id: structure.id, role: structure.role })),
    handoff: true,
    toast: `${option.label.replace(/^Option \d+: /, '')} placed`,
  }
}

function getLayoutOptionActions(structures) {
  return STRUCTURE_LAYOUT_OPTIONS.map(option => createLayoutOptionAction(option.id, structures))
}

function formatVisualPlanOptions() {
  return STRUCTURE_LAYOUT_OPTIONS
    .map(option => `- ${option.label.replace(':', ' -')}: ${option.summary} Best for ${option.advisor.bestFor}.`)
    .join('\n')
}

function formatVisualPlanOffer(structures, source = 'direct_request') {
  const requestedNames = formatStructureNameList(structures.map(structure => structure.name))
  const intro = source === 'decision_follow_through'
    ? `I turned the recommended next move into a visual plan. I can lay out ${requestedNames} three ways.`
    : `I can lay out ${requestedNames} three ways as a visual plan.`

  return [
    intro,
    '',
    'Pick an option, or say "do it" and I will start with Option 1.',
    '',
    formatVisualPlanOptions(),
  ].join('\n')
}

function buildVisualPlanOfferInput(structures, source = 'direct_request') {
  return {
    source,
    structureIds: structures.map(structure => structure.id),
    structureNames: structures.map(structure => structure.name),
    optionIds: STRUCTURE_LAYOUT_OPTIONS.map(option => option.id),
    recommendedOptionId: 'balanced',
    optionDetails: STRUCTURE_LAYOUT_OPTIONS.map(option => ({
      id: option.id,
      label: option.label,
      summary: option.summary,
      bestFor: option.advisor.bestFor,
      tradeoff: option.advisor.tradeoff,
    })),
  }
}

function getOfferedLayoutStructuresFromMessages(messages) {
  const latestOffer = [...messages]
    .flatMap(message => message.toolActions || [])
    .reverse()
    .find(action => action.name === 'offer_structure_layout_options')
  const structureIds = latestOffer?.input?.structureIds || []
  return structureIds
    .map(structureId => TEXT_ACTION_STRUCTURES.find(structure => structure.id === structureId))
    .filter(Boolean)
    .map(structure => ({ id: structure.id, role: structure.role }))
}

function getLayoutStructuresFromAction(action) {
  const structureIds = action?.input?.structureIds || []
  return structureIds
    .map(structureId => TEXT_ACTION_STRUCTURES.find(structure => structure.id === structureId))
    .filter(Boolean)
    .map(structure => ({ id: structure.id, role: structure.role }))
}

function getAdvisorLayoutStructuresFromMessages(messages) {
  const offeredStructures = getOfferedLayoutStructuresFromMessages(messages)
  if (offeredStructures.length > 0) return offeredStructures

  const latestLayoutAction = [...messages]
    .flatMap(message => message.toolActions || [])
    .reverse()
    .find(action => (
      action.success !== false &&
      ['apply_structure_layout_option', 'place_structure_layout'].includes(action.name)
    ))

  return getLayoutStructuresFromAction(latestLayoutAction)
}

function getLatestLayoutToolAction(messages) {
  return [...messages]
    .flatMap(message => message.toolActions || [])
    .reverse()
    .find(action => (
      action.success !== false &&
      ['apply_structure_layout_option', 'place_structure_layout', 'retry_structure_layout'].includes(action.name)
    ))
}

function getLatestLayoutRecommendationAction(messages) {
  const latestAssistantMessage = [...messages]
    .reverse()
    .find(message => message.role === 'assistant' && !message.error && message.content)
  const comparisonAction = latestAssistantMessage?.toolActions?.find(action =>
    action.name === 'compare_layout_options' &&
    action.success !== false &&
    action.input?.canApplyRecommendation
  )
  if (!comparisonAction) return null

  const recommendationId = comparisonAction.input?.recommendationId
  return latestAssistantMessage?.suggestedActions?.find(action =>
    action.type === 'apply_structure_layout_option' &&
    action.optionId === recommendationId
  ) || null
}

function getLatestAgentDecisionAction(messages) {
  const latestAssistantMessage = [...messages]
    .reverse()
    .find(message => message.role === 'assistant' && !message.error && message.content)
  const decisionAction = latestAssistantMessage?.toolActions?.find(action =>
    ['recommend_next_step', 'clarify_or_act', 'site_brief', 'capture_project_goals', 'analyze_floor_plan', 'review_site_plan'].includes(action.name) &&
    action.success !== false &&
    action.input?.recommendedAction
  )
  return decisionAction?.input?.recommendedAction || null
}

function getLatestVisualPlanOfferAction(messages) {
  const latestAssistantMessage = [...messages]
    .reverse()
    .find(message => message.role === 'assistant' && !message.error && message.content)
  const offerAction = latestAssistantMessage?.toolActions?.find(action =>
    action.name === 'offer_structure_layout_options' &&
    action.success !== false &&
    action.input?.structureIds?.length
  )
  if (!offerAction) return null

  const structures = getLayoutStructuresFromAction(offerAction)
  if (!structures.length) return null

  const optionId = offerAction.input?.recommendedOptionId || offerAction.input?.optionIds?.[0] || 'balanced'
  return createLayoutOptionAction(optionId, structures)
}

const FLOOR_PLAN_PROCESS = {
  title: 'Reading your floor plan',
  subtitle: 'Detecting structure first, then preparing a 3D preview you can place on the land.',
  steps: [
    { label: 'Plan attached', state: 'done' },
    { label: 'Detect walls, doors, windows, and rooms', state: 'current' },
    { label: 'Prepare 3D placement preview', state: 'waiting' },
  ],
}

const SITE_PLAN_PROCESS = {
  title: 'Reading your site plan',
  subtitle: 'Checking the boundary and opening the land tools so the next step is visible.',
  steps: [
    { label: 'Plan attached', state: 'done' },
    { label: 'Review land boundary and scale', state: 'current' },
    { label: 'Offer a real-world comparison', state: 'waiting' },
  ],
}

function getTennisCourtFit(landArea) {
  const courtArea = TENNIS_COURT.width * TENNIS_COURT.length
  if (!Number.isFinite(landArea) || landArea <= 0) {
    return {
      count: null,
      text: 'I can compare it against a tennis court once your land area is confirmed.',
    }
  }

  const count = Math.floor(landArea / courtArea)
  if (count <= 0) {
    return {
      count,
      text: `A standard tennis court is about ${Math.round(courtArea)}m², so it is larger than ${formatArea(landArea)} before setbacks and access space.`,
    }
  }

  return {
    count,
    text: `About ${count} tennis court${count === 1 ? '' : 's'} can fit inside ${formatArea(landArea)} before setbacks, house footprint, and access space.`,
  }
}

function getObjectFit(object, landArea) {
  const objectArea = object.width * object.length
  if (!Number.isFinite(landArea) || landArea <= 0) {
    return {
      count: null,
      objectArea,
      text: `I can compare ${object.name} scale once your land area is confirmed.`,
    }
  }

  const count = Math.floor(landArea / objectArea)
  if (count <= 0) {
    return {
      count,
      objectArea,
      text: `A ${object.name} is about ${Math.round(objectArea)}m² (${formatMeters(object.width)} x ${formatMeters(object.length)}), so it is larger than ${formatArea(landArea)} before setbacks and access space.`,
    }
  }

  return {
    count,
    objectArea,
    text: `About ${count} ${count === 1 ? object.name : object.pluralName} can fit inside ${formatArea(landArea)} before setbacks, house footprint, and access space.`,
  }
}

function buildFitLineForArea(object, area, areaLabel = 'area') {
  const fit = getObjectFit(object, area)
  if (fit.count === null) {
    return `- ${object.displayName}: ${areaLabel} needed`
  }
  if (fit.count <= 0) {
    return `- ${object.displayName}: not enough ${areaLabel} (${Math.round(fit.objectArea)}m² footprint)`
  }
  return `- ${object.displayName}: about ${fit.count} ${fit.count === 1 ? object.name : object.pluralName} in the ${areaLabel}`
}

function estimateGeneratedBuildingFootprint(building) {
  const points = (building?.walls || []).flatMap(wall => [wall.start, wall.end])
    .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.z))
  if (points.length < 2) return null

  const xs = points.map(point => point.x)
  const zs = points.map(point => point.z)
  const width = Math.max(...xs) - Math.min(...xs)
  const length = Math.max(...zs) - Math.min(...zs)
  const area = width * length
  if (!Number.isFinite(area) || area <= 0) return null

  return { width, length, area }
}

function resolveGeneratedBuildingForFit(generatedBuildings = [], selectedGeneratedBuildingId = null) {
  if (!Array.isArray(generatedBuildings) || generatedBuildings.length === 0) return null

  if (selectedGeneratedBuildingId) {
    const selected = generatedBuildings.find(building => building.id === selectedGeneratedBuildingId)
    if (selected) {
      return { building: selected, targetSource: 'selected', generatedBuildingCount: generatedBuildings.length }
    }
  }

  if (generatedBuildings.length === 1) {
    return { building: generatedBuildings[0], targetSource: 'only', generatedBuildingCount: generatedBuildings.length }
  }

  return { building: generatedBuildings[generatedBuildings.length - 1], targetSource: 'latest', generatedBuildingCount: generatedBuildings.length }
}

function getGeneratedBuildingTargetLabel(target) {
  if (target?.targetSource === 'latest' && target.generatedBuildingCount > 1) {
    return 'the latest uploaded floor-plan building'
  }
  if (target?.targetSource === 'selected') {
    return 'the selected uploaded floor-plan building'
  }
  return 'the uploaded floor-plan building'
}

function isAroundGeneratedBuildingPlacementRequest(normalizedText) {
  const mentionsAround = /\b(around|beside|next to|near|nearby|outside|remaining|left over|leftover|else)\b/.test(normalizedText)
  const mentionsPlan = /\b(uploaded plan|floor plan|floor-plan|placed plan|source plan|this plan|that plan|uploaded floor-plan|generated building|this building|that building|building)\b/.test(normalizedText)
  return mentionsAround && mentionsPlan
}

function isFitAroundGeneratedBuildingRequest(normalizedText) {
  const mentionsFit = hasFitIntent(normalizedText) || /\b(compare|comparison|scale)\b/.test(normalizedText)
  return mentionsFit && isAroundGeneratedBuildingPlacementRequest(normalizedText)
}

function buildAroundGeneratedBuildingComparisonAction(object, {
  generatedBuildings,
  selectedGeneratedBuildingId,
  label = `Show ${object.name} beside plan`,
} = {}) {
  const target = resolveGeneratedBuildingForFit(generatedBuildings, selectedGeneratedBuildingId)
  if (!target?.building) return null

  return createComparisonAction(object, label, {
    placementMode: 'around_generated_building',
    targetBuildingId: target.building.id,
    targetSource: target.targetSource,
    generatedBuildingCount: target.generatedBuildingCount,
  })
}

function buildFitAroundGeneratedBuildingAction({ landArea, generatedBuildings, selectedGeneratedBuildingId }) {
  const target = resolveGeneratedBuildingForFit(generatedBuildings, selectedGeneratedBuildingId)
  if (!target?.building) return null

  const footprint = estimateGeneratedBuildingFootprint(target.building)
  if (!footprint) return null

  const remainingArea = Number.isFinite(landArea) ? Math.max(landArea - footprint.area, 0) : null
  const targetLabel = getGeneratedBuildingTargetLabel(target)
  const sourceFileName = target.building.sourcePlan?.sourceFileName || null
  const sourceCopy = sourceFileName ? ` (${sourceFileName})` : ''
  const latestCopy = target.targetSource === 'latest' && target.generatedBuildingCount > 1
    ? ` There are ${target.generatedBuildingCount}; I used the latest placed one.`
    : ''
  const remainingLabel = 'approximate remaining area'
  const fitLines = TEXT_ACTION_COMPARISONS
    .map(object => buildFitLineForArea(object, remainingArea, remainingLabel))
    .join('\n')
  const suggestedActions = TEXT_ACTION_COMPARISONS
    .filter(object => {
      const fit = getObjectFit(object, remainingArea)
      return fit.count === null || fit.count > 0
    })
    .slice(0, 2)
    .map(object => buildAroundGeneratedBuildingComparisonAction(object, {
      generatedBuildings,
      selectedGeneratedBuildingId,
      label: `Show ${object.name} beside plan`,
    }))
    .filter(Boolean)

  return {
    type: 'fit_around_generated_building',
    content: [
      `Using ${targetLabel}${sourceCopy}, I estimate the placed floor-plan footprint at about ${formatArea(footprint.area)} (${formatMeters(footprint.width)} x ${formatMeters(footprint.length)}).${latestCopy}`,
      '',
      `That leaves roughly ${formatArea(remainingArea)} of ${formatArea(landArea)} for outdoor space, access, comparisons, and future structures before setbacks and shape constraints.`,
      '',
      'Area-first fit around it:',
      fitLines,
      '',
      'This is an area-first estimate around the uploaded plan. Setbacks, driveway/access, slope, trees, and exact open-space packing can reduce what actually works.',
    ].join('\n'),
    suggestedActions,
    toolInput: {
      buildingId: target.building.id,
      targetSource: target.targetSource,
      generatedBuildingCount: target.generatedBuildingCount,
      sourceFileName,
      landArea: Math.round(landArea || 0),
      footprintArea: Math.round(footprint.area),
      footprintWidth: Number(footprint.width.toFixed(2)),
      footprintLength: Number(footprint.length.toFixed(2)),
      remainingArea: Number.isFinite(remainingArea) ? Math.round(remainingArea) : null,
      objects: TEXT_ACTION_COMPARISONS.map(object => ({
        id: object.id,
        count: getObjectFit(object, remainingArea).count,
      })),
    },
  }
}

function normalizeCommand(text) {
  return ` ${String(text || '')
    .toLowerCase()
    .replace(/[×*]/g, ' x ')
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()} `
}

function getAliasIndex(normalizedText, alias) {
  const pattern = escapeRegex(alias).replace(/\s+/g, '\\s+')
  return normalizedText.search(new RegExp(`\\b${pattern}\\b`))
}

function getObjectMatches(normalizedText, objects) {
  const matches = []
  for (const object of objects) {
    const aliasMatches = object.aliases
      .map(alias => ({ alias, index: getAliasIndex(normalizedText, alias) }))
      .filter(match => match.index >= 0)

    if (aliasMatches.length > 0) {
      aliasMatches.sort((a, b) => a.index - b.index || b.alias.length - a.alias.length)
      matches.push({ object, ...aliasMatches[0] })
    }
  }

  return matches.sort((a, b) => a.index - b.index || b.alias.length - a.alias.length)
}

function getComparisonMatches(normalizedText) {
  return getObjectMatches(normalizedText, TEXT_ACTION_COMPARISONS)
}

function getComparisonFromCommand(normalizedText) {
  return getComparisonMatches(normalizedText)[0]?.object
}

function getStructureMatches(normalizedText) {
  return getObjectMatches(normalizedText, TEXT_ACTION_STRUCTURES)
}

function getStructureFromCommand(normalizedText) {
  return getStructureMatches(normalizedText)[0]?.object
}

function getUniqueStructureMatches(normalizedText) {
  const matches = []
  for (const match of getStructureMatches(normalizedText)) {
    if (!matches.some(existing => existing.object.id === match.object.id)) {
      matches.push(match)
    }
  }

  const hasLargeHouse = matches.some(match => match.object.id === 'largeHouse')
  return matches.filter(match =>
    !(hasLargeHouse && match.object.id === 'mediumHouse' && ['house', 'home'].includes(match.alias))
  )
}

function getStructuresByIds(ids) {
  return ids
    .map(id => TEXT_ACTION_STRUCTURES.find(structure => structure.id === id))
    .filter(Boolean)
}

function getStructureById(id) {
  return TEXT_ACTION_STRUCTURES.find(structure => structure.id === id)
}

function getComparisonById(id) {
  return TEXT_ACTION_COMPARISONS.find(object => object.id === id)
}

function getProjectGoalById(id) {
  return PROJECT_GOAL_DEFINITIONS.find(goal => goal.id === id)
}

function getProjectGoalsByIds(ids = []) {
  return ids
    .map(id => getProjectGoalById(id))
    .filter(Boolean)
}

function getProjectGoalsFromMessages(messages = []) {
  const goalIds = []
  for (const message of messages) {
    for (const action of message.toolActions || []) {
      if (action.name !== 'capture_project_goals' || action.success === false) continue
      for (const goalId of action.input?.goalIds || []) {
        if (!goalIds.includes(goalId)) goalIds.push(goalId)
      }
    }
  }
  return getProjectGoalsByIds(goalIds)
}

function formatProjectGoals(goals = []) {
  if (!goals.length) return 'No saved goals yet'
  return formatNameList(goals.map(goal => goal.label))
}

function getProjectGoalStructureSet(goal) {
  return getStructuresByIds(goal?.structureIds?.length ? goal.structureIds : DEFAULT_HOME_LAYOUT_STRUCTURE_IDS)
}

function getPrimaryProjectGoal(goals = []) {
  const priority = ['privacy', 'open_backyard', 'pool', 'parking', 'family_home', 'demo_ready']
  return priority.map(goalId => goals.find(goal => goal.id === goalId)).find(Boolean) || goals[0] || null
}

function buildProjectGoalRecommendedAction(goal, { hasPlacedStructures = false, layoutStructures = [] } = {}) {
  if (!goal) return null
  const structures = layoutStructures.length > 0 ? layoutStructures : getProjectGoalStructureSet(goal)
  const label = hasPlacedStructures ? goal.actionLabel : goal.emptyActionLabel
  return createDecisionLayoutAction(goal.layoutOptionId, structures, label)
}

function buildProjectGoalRecommendation(goals = [], context = {}) {
  const primaryGoal = getPrimaryProjectGoal(goals)
  if (!primaryGoal) return null

  const recommendedAction = buildProjectGoalRecommendedAction(primaryGoal, context)
  const secondaryGoals = goals.filter(goal => goal.id !== primaryGoal.id).slice(0, 2)
  const options = [
    recommendedAction,
    ...secondaryGoals
      .map(goal => buildProjectGoalRecommendedAction(goal, context))
      .filter(Boolean),
    createPromptAction('Site brief', 'Site brief'),
  ].filter(Boolean)

  return {
    primaryGoal,
    bestMove: context.hasPlacedStructures ? primaryGoal.activeBestMove : primaryGoal.emptyBestMove,
    why: primaryGoal.why,
    recommendedAction,
    suggestedActions: options.slice(0, 3),
  }
}

function parseDistanceCommand(normalizedText) {
  const match = normalizedText.match(/\b(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres|ft|feet|foot)\b/)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value)) return null
  const unitMultiplier = /^(ft|feet|foot)$/.test(match[2]) ? 1 / 3.28084 : 1
  const distance = value * unitMultiplier
  return distance > 0 && distance <= 200 ? distance : null
}

function hasSceneAddIntent(normalizedText) {
  return /\b(add|show|place|put|display|compare|visualize|visualise|see)\b/.test(normalizedText)
}

function hasFitIntent(normalizedText) {
  return /\b(fit|fits|fitting|how many|what can fit|what fits|see what fits)\b/.test(normalizedText)
}

function isGeneralFitRequest(normalizedText) {
  return /\bwhat can fit\b/.test(normalizedText) ||
    /\bwhat fits\b/.test(normalizedText) ||
    /\bsee what fits\b/.test(normalizedText)
}

function hasRemoveIntent(normalizedText) {
  return /\b(remove|hide|delete|take away|take out)\b/.test(normalizedText)
}

function hasStructurePlaceIntent(normalizedText) {
  return /\b(build|construct|create|add|place|put|make)\b/.test(normalizedText) &&
    !/\b(compare|comparison|show|display|visualize|visualise|see)\b/.test(normalizedText)
}

function isStarterStructureLayoutRequest(normalizedText) {
  return /\b(layout|arrangement|starter plan|starter layout|home layout|site layout|simple layout)\b/.test(normalizedText) &&
    /\b(build|construct|create|add|place|put|make|design|draft|plan)\b/.test(normalizedText) &&
    !/\bfloor plan|uploaded plan|comparison|compare\b/.test(normalizedText)
}

function getStructureLayoutFromCommand(normalizedText) {
  const matchedStructures = getUniqueStructureMatches(normalizedText).map(match => match.object)
  if (matchedStructures.length >= 2) return matchedStructures
  if (isStarterStructureLayoutRequest(normalizedText)) return getStructuresByIds(DEFAULT_HOME_LAYOUT_STRUCTURE_IDS)
  return null
}

function hasStructureRemoveIntent(normalizedText) {
  return /\b(remove|delete|demolish|clear)\b/.test(normalizedText)
}

function hasStructureMoveIntent(normalizedText) {
  return /\b(move|shift|slide|put|place)\b/.test(normalizedText) &&
    /\b(left|right|front|behind|back|backyard|backward|forward|away)\b/.test(normalizedText)
}

function getStructureMoveDirection(normalizedText) {
  if (/\b(to the )?left\b/.test(normalizedText)) return 'left'
  if (/\b(to the )?right\b/.test(normalizedText)) return 'right'
  if (/\bbehind\b|\bback of\b|\bback\b|\bbackyard\b|\bbackward\b/.test(normalizedText)) return 'behind'
  if (/\bin front\b|\bfront of\b|\bfront\b|\bforward\b/.test(normalizedText)) return 'front'
  if (/\baway\b/.test(normalizedText)) return 'away'
  return null
}

function hasStructureRotateIntent(normalizedText) {
  return /\b(rotate|turn|spin)\b/.test(normalizedText)
}

function parseRotationDegrees(normalizedText) {
  const match = normalizedText.match(/\b(\d{1,3})\s*(degrees?|deg)?\b/)
  if (match) {
    const degrees = Number.parseInt(match[1], 10)
    if (Number.isFinite(degrees) && degrees > 0 && degrees <= 360) return degrees
  }
  if (/\bleft\b|\bcounterclockwise\b|\banticlockwise\b/.test(normalizedText)) return -90
  return 90
}

function hasStructureResizeIntent(normalizedText) {
  return /\b(make|resize|change|turn)\b/.test(normalizedText) &&
    /\b(bigger|larger|large|smaller|medium)\b/.test(normalizedText)
}

function getResizeReplacementStructure(normalizedText, targetStructure) {
  if (!targetStructure) return null
  if (/\b(bigger|larger|large)\b/.test(normalizedText) && ['mediumHouse'].includes(targetStructure.id)) {
    return getStructureById('largeHouse')
  }
  if (/\b(smaller|medium)\b/.test(normalizedText) && targetStructure.id === 'largeHouse') {
    return getStructureById('mediumHouse')
  }
  return null
}

function hasReplaceIntent(normalizedText) {
  return /\b(replace|swap|switch|change)\b/.test(normalizedText) &&
    /\b(with|for|to)\b/.test(normalizedText)
}

function hasResetIntent(normalizedText) {
  return /\b(reset|recenter|recentre|center|centre)\b/.test(normalizedText)
}

function isClearComparisonsRequest(normalizedText) {
  return /\b(clear|remove|hide|delete)\b/.test(normalizedText) &&
    /\b(all|everything|comparisons|objects|items)\b/.test(normalizedText) &&
    !/\bwall|walls|room|rooms|floor plan|plan\b/.test(normalizedText)
}

function isClearStructuresRequest(normalizedText) {
  return /\b(clear|remove|delete|demolish)\b/.test(normalizedText) &&
    /\b(all|everything|structures|buildings|builds)\b/.test(normalizedText) &&
    !/\bfloor plan|uploaded plan|generated building|comparison|comparisons|objects\b/.test(normalizedText)
}

function isUndoAgentStructureRequest(normalizedText) {
  return /\bundo\b/.test(normalizedText) &&
    /\b(that|last|change|layout|placement|move|adjustment|structure|building)\b/.test(normalizedText)
}

function isRetryStructureLayoutRequest(normalizedText) {
  return /\b(try again|retry|another layout|different layout|another option|try another|try a different)\b/.test(normalizedText)
}

function parseLayoutPreferenceSelection(normalizedText) {
  const isExplicitSelection = /\b(option\s*[123]|use|choose|select|pick|go with|take)\b/.test(normalizedText)
  const isRefinement = /\b(make it|make this|make the layout|change it|switch it|try|leave)\b/.test(normalizedText)

  if (/\b(option\s*1|use\s*1|choose\s*1|select\s*1|pick\s*1)\b/.test(normalizedText) ||
    (isExplicitSelection && /\b(balanced|balance|simple|default|straightforward)\b/.test(normalizedText)) ||
    /^(balanced|balance|simple|default|straightforward)$/.test(normalizedText)) {
    return { optionId: 'balanced', preferenceLabel: isExplicitSelection ? null : 'balanced' }
  }

  if (/\b(option\s*3|use\s*3|choose\s*3|select\s*3|pick\s*3)\b/.test(normalizedText) ||
    (isExplicitSelection && /\b(privacy|private|more private|secluded|seclusion|less exposed|privacy one|private one)\b/.test(normalizedText)) ||
    (isRefinement && /\b(privacy|private|more private|secluded|seclusion|less exposed)\b/.test(normalizedText)) ||
    /^(privacy|private|more private)$/.test(normalizedText)) {
    return { optionId: 'privacy', preferenceLabel: isExplicitSelection ? null : 'more private' }
  }

  if (/\b(option\s*2|use\s*2|choose\s*2|select\s*2|pick\s*2)\b/.test(normalizedText) ||
    (isExplicitSelection && /\b(backyard|open space|more space|more yard|open backyard|backyard open|outdoor space|garden space|backyard one|open one)\b/.test(normalizedText)) ||
    (isRefinement && /\b(backyard|open space|more space|more yard|open backyard|backyard open|outdoor space|garden space)\b/.test(normalizedText)) ||
    /^(more backyard|open backyard|backyard open|more open|more yard)$/.test(normalizedText)) {
    return { optionId: 'open_backyard', preferenceLabel: isExplicitSelection ? null : 'more open in the backyard' }
  }

  return null
}

function getLayoutPreferenceOpening(optionId, preferenceLabel) {
  if (!preferenceLabel) return null
  if (optionId === 'privacy') return 'Done. I made the layout more private.'
  if (optionId === 'open_backyard') return 'Done. I opened up more backyard space.'
  if (optionId === 'balanced') return 'Done. I made the layout balanced.'
  return `Done. I made the layout ${preferenceLabel}.`
}

function getLayoutAdvisorTopic(normalizedText) {
  const mentionsPrivacy = /\b(privacy|private|more private|secluded|seclusion|less exposed|quiet)\b/.test(normalizedText)
  const mentionsOpenLand = /\b(open land|open space|open backyard|backyard|yard|garden|outdoor space|more space|more yard)\b/.test(normalizedText)
  if (mentionsPrivacy && mentionsOpenLand) return 'privacy_vs_open_land'
  if (mentionsOpenLand) return 'open_land'
  if (mentionsPrivacy) return 'privacy'
  if (/\b(road|street|driveway|parking|park|vehicle access|car access|front access|access)\b/.test(normalizedText)) return 'access'
  if (/\b(balanced|balance|simple|default|straightforward)\b/.test(normalizedText)) return 'balanced'
  return 'general'
}

function getRecommendedLayoutOptionId(topic) {
  if (topic === 'privacy') return 'privacy'
  if (topic === 'open_land' || topic === 'privacy_vs_open_land') return 'open_backyard'
  return 'balanced'
}

function getMentionedLayoutOptionIds(normalizedText) {
  const optionIds = []
  const addOption = (optionId) => {
    if (!optionIds.includes(optionId)) optionIds.push(optionId)
  }

  if (/\b(option\s*1|balanced|balance|simple|default|straightforward)\b/.test(normalizedText)) {
    addOption('balanced')
  }
  if (/\b(option\s*2|backyard|open land|open space|more space|more yard|open backyard|backyard open|outdoor space|garden space)\b/.test(normalizedText)) {
    addOption('open_backyard')
  }
  if (/\b(option\s*3|privacy|private|more private|secluded|seclusion|less exposed)\b/.test(normalizedText)) {
    addOption('privacy')
  }

  return optionIds
}

function getAdvisorOptionIds(normalizedText) {
  const mentionedOptionIds = getMentionedLayoutOptionIds(normalizedText)
  const asksWhich = /\b(which|best|better|recommend|recommended|most)\b/.test(normalizedText)
  if (asksWhich) {
    return STRUCTURE_LAYOUT_OPTIONS.map(option => option.id)
  }
  if (mentionedOptionIds.length >= 2) return mentionedOptionIds
  if (mentionedOptionIds.length === 1) {
    return [...new Set([mentionedOptionIds[0], 'balanced'])]
  }
  return STRUCTURE_LAYOUT_OPTIONS.map(option => option.id)
}

function hasLayoutAdvisorSubject(normalizedText) {
  return /\b(option|layout|choice|privacy|private|backyard|yard|garden|open land|open space|outdoor space|access|parking|road|driveway|balanced)\b/.test(normalizedText)
}

function parseLayoutAdvisorRequest(normalizedText) {
  const asksWhatChanged = /\b(what changed|what did you change|what was changed|summari[sz]e the change|explain the change)\b/.test(normalizedText)
  const asksWhy = /\b(why|explain|reason|rationale)\b/.test(normalizedText) &&
    (hasLayoutAdvisorSubject(normalizedText) || /\b(this|that|better)\b/.test(normalizedText))
  if (asksWhatChanged || asksWhy) {
    return { type: 'explain_last_layout_change' }
  }

  const asksCompare = /\b(compare|comparison|difference|differences|versus|vs|tradeoff|trade off|trade-offs)\b/.test(normalizedText) &&
    hasLayoutAdvisorSubject(normalizedText)
  const asksWhich = /\b(which|best|better|recommend|recommended|most)\b/.test(normalizedText) &&
    hasLayoutAdvisorSubject(normalizedText)
  if (!asksCompare && !asksWhich) return null

  const topic = getLayoutAdvisorTopic(normalizedText)
  return {
    type: 'compare_layout_options',
    topic,
    optionIds: getAdvisorOptionIds(normalizedText),
    recommendationId: getRecommendedLayoutOptionId(topic),
  }
}

function parseLayoutRecommendationFollowThrough(normalizedText) {
  const cleanedText = normalizedText
    .trim()
    .replace(/\bplease\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleanedText) return null

  if (/^(yes|yeah|yep|ok|okay|sure|confirm|confirmed)$/.test(cleanedText)) {
    return { type: 'apply_latest_layout_recommendation' }
  }
  if (/^(do that|do it|apply it|apply that|go with that|go ahead|use that|use it|that one|looks good|sounds good|lets do it)$/.test(cleanedText)) {
    return { type: 'apply_latest_layout_recommendation' }
  }
  if (/^(use the recommendation|use recommendation|use the recommended option|apply the recommendation|apply recommendation|apply the recommended option)$/.test(cleanedText)) {
    return { type: 'apply_latest_layout_recommendation' }
  }
  if (/^(show me|show it|show that|show me that|compare it|compare that|compare them)$/.test(cleanedText)) {
    return { type: 'apply_latest_layout_recommendation' }
  }
  return null
}

function getProjectGoalIdsFromText(normalizedText) {
  const goalIds = []
  const addGoal = (goalId) => {
    if (!goalIds.includes(goalId)) goalIds.push(goalId)
  }

  if (/\b(privacy|private|more private|secluded|seclusion|less exposed|quiet)\b/.test(normalizedText)) {
    addGoal('privacy')
  }
  if (/\b(open backyard|backyard open|keep the backyard open|keep backyard open|open land|open space|more yard|more outdoor|garden space|outdoor space)\b/.test(normalizedText)) {
    addGoal('open_backyard')
  }
  if (/\b(family home|family house|home for (my )?family|kids|children|bedrooms?|home with)\b/.test(normalizedText)) {
    addGoal('family_home')
  }
  if (/\b(parking|garage|carport|driveway|vehicle access|car access|cars?|vehicles?)\b/.test(normalizedText)) {
    addGoal('parking')
  }
  if (/\b(pool|swimming pool)\b/.test(normalizedText)) {
    addGoal('pool')
  }
  if (/\b(demo ready|demo-ready|demo|presentation|showcase|polished|client ready|client-ready)\b/.test(normalizedText)) {
    addGoal('demo_ready')
  }

  return goalIds
}

function parseProjectGoalRequest(normalizedText) {
  const hasGoalIntent = /\b(i want|i need|we want|we need|my goal|our goal|goal is|priority|prioritize|prioritise|focus on|care about|important|must have|remember that|make it|keep)\b/.test(normalizedText)
  if (!hasGoalIntent) return null

  const goalIds = getProjectGoalIdsFromText(normalizedText)
  if (!goalIds.length) return null

  return {
    type: 'capture_project_goals',
    goalIds,
  }
}

function parseDecisionRequest(normalizedText) {
  if (/\b(what should i do next|what do i do next|recommend next step|recommend a next step|best next step|best move|next move|what would you do|what should we do|what now)\b/.test(normalizedText)) {
    return { type: 'recommend_next_step', intent: 'next_step' }
  }
  if (/\b(what next|whats next|what's next|next step)\b/.test(normalizedText) && !/\b(option|layout option)\b/.test(normalizedText)) {
    return { type: 'recommend_next_step', intent: 'next_step' }
  }
  return null
}

function parseClarifyOrActRequest(normalizedText) {
  const vaguePlanning = /\b(make it better|make this better|make the site better|improve it|improve this|improve the site|improve my site|improve the land|design my site|design this site|design the site|help me plan|help plan this|plan my site|plan this site|plan the site|start planning|make a plan|i do not know what to do|i dont know what to do|i don t know what to do|not sure what to do|what would you build|what should i build|what can you do for me)\b/.test(normalizedText)
  if (!vaguePlanning) return null
  return { type: 'clarify_or_act', intent: 'vague_planning' }
}

function parseSiteBriefRequest(normalizedText) {
  if (/\b(site brief|project brief|site memory|project memory|brief my site|brief this site)\b/.test(normalizedText)) {
    return { type: 'site_brief', intent: 'brief' }
  }
  if (/\b(what do you know|what have you learned|what do you remember).*\b(my|this|the).*\b(site|land|plot|property|project)\b/.test(normalizedText)) {
    return { type: 'site_brief', intent: 'memory' }
  }
  if (/\b(summari[sz]e|review|describe).*\b(my|this|the).*\b(project|site brief|project brief)\b/.test(normalizedText)) {
    return { type: 'site_brief', intent: 'brief' }
  }
  return null
}

function parseSceneAwarenessRequest(normalizedText) {
  if (/\b(what is|whats|what's|what do i have|show me|tell me).*\b(on my|on the|in my|in the).*\b(land|site|plot|property)\b/.test(normalizedText)) {
    return { type: 'summarize_scene', intent: 'summary' }
  }
  if (/\bwhat did you place\b|\bwhat have you placed\b|\bwhat did sitea place\b|\bplaced on (my|the) (land|site|plot)\b/.test(normalizedText)) {
    return { type: 'summarize_scene', intent: 'summary' }
  }
  if (/\b(summari[sz]e|review|describe).*\b(site|land|plot|property|scene|layout)\b/.test(normalizedText)) {
    return { type: 'summarize_scene', intent: 'summary' }
  }
  if (/\b(what should i do next|what do i do next|what next|whats next|what's next|next step|next move|what is next)\b/.test(normalizedText)) {
    return { type: 'summarize_scene', intent: 'next_step' }
  }
  return null
}

function getActiveComparisonNames(activeComparisons = {}) {
  return Object.entries(activeComparisons)
    .filter(([, isActive]) => isActive)
    .map(([comparisonId]) => {
      const comparison = TEXT_ACTION_COMPARISONS.find(object => object.id === comparisonId)
      return comparison?.displayName || comparisonId
    })
}

function formatSceneObjectName(value) {
  return String(value || '').trim().toLowerCase()
}

function getPlacedStructureNames(placedBuildings = []) {
  return placedBuildings
    .map((building, index) => formatSceneObjectName(building.type?.name || building.type?.id || `structure ${index + 1}`))
    .filter(Boolean)
}

function getLatestLayoutOptionFromMessages(messages) {
  const latestLayoutAction = getLatestLayoutToolAction(messages)
  const input = latestLayoutAction?.input || {}
  if (input.optionId) return getLayoutOptionById(input.optionId)
  if (input.layoutVariant) return getLayoutOptionByVariant(input.layoutVariant)
  return null
}

function getSceneSummaryRecommendation({ hasPlacedStructures, hasGeneratedBuildings, hasRooms, latestLayoutOption }) {
  if (!hasPlacedStructures && !hasGeneratedBuildings && !hasRooms) {
    return 'Next best step: ask me for a simple home layout or ask what can fit, then I can start shaping the land with you.'
  }
  if (latestLayoutOption) {
    return `Next best step: review ${latestLayoutOption.label} and decide whether you want more privacy, more open backyard space, or a more balanced layout.`
  }
  if (hasGeneratedBuildings) {
    return 'Next best step: review the uploaded floor-plan building in 3D, then ask me what else fits around it.'
  }
  return 'Next best step: ask me to compare privacy vs backyard space, or ask what to improve next.'
}

function getSceneSummarySuggestedActions({ hasPlacedStructures, hasGeneratedBuildings, latestLayoutOption }) {
  if (!hasPlacedStructures && !hasGeneratedBuildings) {
    return [
      { label: 'Make a simple home layout', prompt: 'Make a simple home layout' },
      { label: 'See what fits', prompt: 'What can fit on my land?' },
    ]
  }

  if (hasGeneratedBuildings) {
    return [
      { label: 'See what fits around it', prompt: 'What fits around the uploaded plan?' },
      { label: 'Rotate plan', prompt: 'Rotate the uploaded plan' },
      { label: 'Edit walls', prompt: 'Make the uploaded plan editable' },
    ]
  }

  const actions = [
    { label: 'Explain this layout', prompt: 'What changed?' },
    { label: 'Compare privacy vs backyard', prompt: 'Compare privacy vs backyard' },
  ]
  if (latestLayoutOption?.id !== 'privacy') {
    actions.push({ label: 'Make more private', prompt: 'Make this more private' })
  }
  if (latestLayoutOption?.id !== 'open_backyard') {
    actions.push({ label: 'Open backyard', prompt: 'Leave the backyard open' })
  }
  return actions.slice(0, 3)
}

function buildProjectGoalCapture({ capturedGoals, previousGoals, placedBuildings, messages }) {
  const layoutStructures = getAdvisorLayoutStructuresFromMessages(messages)
  const hasPlacedStructures = placedBuildings.length > 0
  const allGoals = [...previousGoals]
  for (const goal of capturedGoals) {
    if (!allGoals.some(existing => existing.id === goal.id)) allGoals.push(goal)
  }
  const recommendation = buildProjectGoalRecommendation(allGoals, {
    hasPlacedStructures,
    layoutStructures,
  })
  const goalLine = formatProjectGoals(capturedGoals)
  const allGoalLine = formatProjectGoals(allGoals)

  return {
    content: [
      `Goal saved: ${goalLine}.`,
      `Current goals: ${allGoalLine}.`,
      '',
      `Best move: ${recommendation.bestMove}.`,
      `Why: ${recommendation.why}`,
    ].join('\n'),
    decision: {
      label: 'Project goal',
      title: recommendation.bestMove,
      body: recommendation.why,
      detail: `Saved goals: ${allGoalLine}.`,
    },
    nextSteps: [
      { label: 'Goal saved', state: 'done' },
      { label: 'Recommendation aligned', state: 'done' },
      { label: 'Say do it or choose an action', state: 'current' },
    ],
    suggestedActions: recommendation.suggestedActions,
    toolInput: {
      goalIds: allGoals.map(goal => goal.id),
      capturedGoalIds: capturedGoals.map(goal => goal.id),
      goalLabels: allGoals.map(goal => goal.label),
      capturedGoalLabels: capturedGoals.map(goal => goal.label),
      primaryGoalId: recommendation.primaryGoal.id,
      recommendedAction: recommendation.recommendedAction,
      optionLabels: recommendation.suggestedActions.map(action => action.label),
    },
  }
}

function buildClarifyOrAct({
  hasLand,
  dimensions,
  landArea,
  shapeMode,
  confirmedPolygon,
  placedBuildings,
  generatedBuildings,
  walls,
  rooms,
  activeComparisons,
  messages,
}) {
  const projectGoals = getProjectGoalsFromMessages(messages)
  const placedStructureNames = getPlacedStructureNames(placedBuildings)
  const layoutStructures = getAdvisorLayoutStructuresFromMessages(messages)
  const hasPlacedStructures = placedStructureNames.length > 0
  const hasGeneratedBuildings = generatedBuildings.length > 0
  const hasRooms = rooms.length > 0 || walls.length > 0
  const hasSceneContext = hasPlacedStructures || hasGeneratedBuildings || hasRooms
  const goalRecommendation = buildProjectGoalRecommendation(projectGoals, {
    hasPlacedStructures,
    layoutStructures,
  })

  if (!hasLand && !hasSceneContext) {
    const demoLandAction = createDemoLandAction()
    const suggestedActions = [
      { label: 'Upload a plan', action: 'upload' },
      createPromptAction('Set land size', 'Set my land to 40m by 30m'),
      demoLandAction,
    ]

    return {
      content: [
        'I can help plan this, but first I need the land.',
        '',
        'Missing next: land size.',
        '',
        'Choose how you want to start:',
        ...suggestedActions.map(action => `- ${action.label}`),
      ].join('\n'),
      decision: {
        label: 'Start here',
        title: 'Define the land first',
        body: 'Once the land is known, I can recommend what to place, compare scale, and build toward your goal.',
        detail: 'Upload a plan if you have one, enter dimensions if you know them, or use demo land to start immediately.',
      },
      nextSteps: [
        { label: 'Vague request understood', state: 'done' },
        { label: 'Land needed first', state: 'current' },
      ],
      suggestedActions,
      toolInput: {
        mode: 'ask_for_land',
        hasLand,
        landArea: Math.round(landArea || 0),
        recommendedAction: demoLandAction,
        optionLabels: suggestedActions.map(action => action.label),
      },
    }
  }

  if (goalRecommendation && !hasGeneratedBuildings && !hasRooms) {
    return {
      content: [
        `I can act from your saved goals: ${formatProjectGoals(projectGoals)}.`,
        '',
        `Best move: ${goalRecommendation.bestMove}.`,
        `Why: ${goalRecommendation.why}`,
      ].join('\n'),
      decision: {
        label: 'I can act',
        title: goalRecommendation.bestMove,
        body: goalRecommendation.why,
        detail: `Saved goals: ${formatProjectGoals(projectGoals)}.`,
      },
      nextSteps: [
        { label: 'Vague request understood', state: 'done' },
        { label: 'Saved goals used', state: 'done' },
        { label: 'Say do it or choose an action', state: 'current' },
      ],
      suggestedActions: goalRecommendation.suggestedActions,
      toolInput: {
        mode: 'act_from_goals',
        projectGoalIds: projectGoals.map(goal => goal.id),
        projectGoalLabels: projectGoals.map(goal => goal.label),
        recommendedAction: goalRecommendation.recommendedAction,
        optionLabels: goalRecommendation.suggestedActions.map(action => action.label),
      },
    }
  }

  if (hasPlacedStructures || hasGeneratedBuildings || hasRooms) {
    const decision = buildAgentDecision({
      hasLand,
      dimensions,
      landArea,
      shapeMode,
      confirmedPolygon,
      placedBuildings,
      generatedBuildings,
      walls,
      rooms,
      activeComparisons,
      messages,
    })
    return {
      content: [
        'I can improve this from the current site context.',
        '',
        `Best move: ${decision.decision.title}.`,
        `Why: ${decision.decision.body}`,
      ].join('\n'),
      decision: {
        label: 'I can act',
        title: decision.decision.title,
        body: decision.decision.body,
        detail: decision.decision.detail,
      },
      nextSteps: [
        { label: 'Vague request understood', state: 'done' },
        { label: 'Current scene inspected', state: 'done' },
        { label: 'Say do it or choose an action', state: 'current' },
      ],
      suggestedActions: decision.suggestedActions,
      toolInput: {
        mode: 'act_from_context',
        ...decision.toolInput,
      },
    }
  }

  const suggestedActions = [
    createPromptAction('Prioritize privacy', 'I want privacy'),
    createPromptAction('Keep backyard open', 'Keep the backyard open'),
    createPromptAction('Make demo ready', 'Make it demo ready'),
  ]

  return {
    content: [
      'I can help, but I need one direction before I change the site.',
      '',
      'Question: what should Sitea optimize first?',
      '',
      'Options:',
      ...suggestedActions.map(action => `- ${action.label}`),
    ].join('\n'),
    decision: {
      label: 'Quick question',
      title: 'What should Sitea optimize first?',
      body: 'Choose one priority and I will turn it into the next safe site action.',
      detail: hasLand
        ? `Land is ready at ${formatArea(landArea)}, but no project goal is saved yet.`
        : 'Land and project goals are not clear yet.',
    },
    nextSteps: [
      { label: 'Vague request understood', state: 'done' },
      { label: 'Direction needed', state: 'current' },
    ],
    suggestedActions,
    toolInput: {
      mode: 'ask_for_priority',
      hasLand,
      landArea: Math.round(landArea || 0),
      projectGoalIds: [],
      recommendedAction: null,
      optionLabels: suggestedActions.map(action => action.label),
    },
  }
}

function buildSceneSummary({
  hasLand,
  dimensions,
  landArea,
  shapeMode,
  confirmedPolygon,
  setbacksEnabled,
  setbackDistanceM,
  placedBuildings,
  generatedBuildings,
  walls,
  rooms,
  furnitureItems,
  activeComparisons,
  messages,
}) {
  const placedStructureNames = getPlacedStructureNames(placedBuildings)
  const comparisonNames = getActiveComparisonNames(activeComparisons)
  const latestLayoutOption = getLatestLayoutOptionFromMessages(messages)
  const hasPlacedStructures = placedStructureNames.length > 0
  const hasGeneratedBuildings = generatedBuildings.length > 0
  const hasRooms = rooms.length > 0 || walls.length > 0
  const landShape = shapeMode === 'upload' ? 'uploaded boundary' : shapeMode || 'rectangle'
  const landLine = hasLand
    ? `Land: ${formatArea(landArea)}, ${landShape}, about ${formatMeters(dimensions?.width)} wide x ${formatMeters(dimensions?.length)} long.`
    : 'Land: not confirmed yet.'
  const boundaryLine = confirmedPolygon?.length >= 3
    ? `Boundary: ${confirmedPolygon.length} points.`
    : null
  const setbackLine = setbacksEnabled
    ? `Setbacks: ${formatMeters(setbackDistanceM)} from the land boundary.`
    : null
  const structuresLine = hasPlacedStructures
    ? `Placed structures: ${formatStructureNameList(placedStructureNames)}.`
    : 'Placed structures: none yet.'
  const latestLayoutLine = latestLayoutOption
    ? `Latest agent layout: ${latestLayoutOption.label}.`
    : null
  const generatedLine = hasGeneratedBuildings
    ? `Uploaded floor-plan buildings: ${generatedBuildings.length} preview${generatedBuildings.length === 1 ? '' : 's'} prepared.`
    : 'Uploaded floor-plan buildings: none.'
  const drawingLine = hasRooms
    ? `Floor-plan drawing: ${walls.length} wall${walls.length === 1 ? '' : 's'} and ${rooms.length} room${rooms.length === 1 ? '' : 's'}.`
    : 'Floor-plan drawing: no rooms or walls yet.'
  const furnitureLine = furnitureItems.length > 0
    ? `Furniture: ${furnitureItems.length} item${furnitureItems.length === 1 ? '' : 's'}.`
    : null
  const comparisonLine = comparisonNames.length > 0
    ? `Scale comparisons: ${formatNameList(comparisonNames)}.`
    : 'Scale comparisons: none active.'
  const recommendation = getSceneSummaryRecommendation({
    hasPlacedStructures,
    hasGeneratedBuildings,
    hasRooms,
    latestLayoutOption,
  })
  const lines = [
    'Here is what I see on your land right now:',
    '',
    `- ${landLine}`,
    boundaryLine ? `- ${boundaryLine}` : null,
    setbackLine ? `- ${setbackLine}` : null,
    `- ${structuresLine}`,
    latestLayoutLine ? `- ${latestLayoutLine}` : null,
    `- ${generatedLine}`,
    `- ${drawingLine}`,
    furnitureLine ? `- ${furnitureLine}` : null,
    `- ${comparisonLine}`,
    '',
    recommendation,
  ].filter(Boolean)

  return {
    content: lines.join('\n'),
    nextSteps: [
      { label: 'Scene inspected', state: 'done' },
      { label: hasPlacedStructures || hasGeneratedBuildings || hasRooms ? 'Current plan summarized' : 'Empty land confirmed', state: 'done' },
      { label: 'Choose a next step or ask for an improvement', state: 'current' },
    ],
    suggestedActions: getSceneSummarySuggestedActions({
      hasPlacedStructures,
      hasGeneratedBuildings,
      latestLayoutOption,
    }),
    toolInput: {
      landArea: Math.round(landArea || 0),
      hasLand,
      shapeMode: landShape,
      placedStructureCount: placedStructureNames.length,
      placedStructureNames,
      generatedBuildingCount: generatedBuildings.length,
      wallCount: walls.length,
      roomCount: rooms.length,
      furnitureCount: furnitureItems.length,
      activeComparisonCount: comparisonNames.length,
      activeComparisonNames: comparisonNames,
      latestLayoutOptionId: latestLayoutOption?.id || null,
    },
  }
}

function createPromptAction(label, prompt) {
  return { label, prompt }
}

function getFloorPlanBuildingFollowUpActions() {
  return [
    createPromptAction('Rotate plan', 'Rotate the uploaded plan'),
    createPromptAction('Edit walls', 'Make the uploaded plan editable'),
    createPromptAction('See what fits around it', 'What fits around the uploaded plan?'),
    createPromptAction('Summarize site', 'Summarize the site'),
  ]
}

function createDecisionLayoutAction(optionId, structures, label) {
  const action = createLayoutOptionAction(optionId, structures)
  return { ...action, label: label || action.label }
}

function buildAgentDecision({
  hasLand,
  dimensions,
  landArea,
  shapeMode,
  confirmedPolygon,
  placedBuildings,
  generatedBuildings,
  walls,
  rooms,
  activeComparisons,
  messages,
}) {
  const placedStructureNames = getPlacedStructureNames(placedBuildings)
  const comparisonNames = getActiveComparisonNames(activeComparisons)
  const latestLayoutOption = getLatestLayoutOptionFromMessages(messages)
  const layoutStructures = getAdvisorLayoutStructuresFromMessages(messages)
  const projectGoals = getProjectGoalsFromMessages(messages)
  const goalRecommendation = buildProjectGoalRecommendation(projectGoals, {
    hasPlacedStructures: placedStructureNames.length > 0,
    layoutStructures,
  })
  const hasPlacedStructures = placedStructureNames.length > 0
  const hasGeneratedBuildings = generatedBuildings.length > 0
  const hasRooms = rooms.length > 0 || walls.length > 0
  const tennisCourt = getComparisonById('tennisCourt')
  const landShape = shapeMode === 'upload' ? 'uploaded boundary' : shapeMode || 'rectangle'
  const landCopy = hasLand
    ? `${formatArea(landArea)} ${landShape}${dimensions?.width && dimensions?.length ? `, about ${formatMeters(dimensions.width)} x ${formatMeters(dimensions.length)}` : ''}`
    : 'land that is not confirmed yet'
  const boundaryCopy = confirmedPolygon?.length >= 3
    ? `${confirmedPolygon.length}-point boundary`
    : 'default boundary'

  let observation = ''
  let bestMove = ''
  let why = ''
  let recommendedAction = null
  let options = []
  let state = 'empty_land'

  if (goalRecommendation && !hasGeneratedBuildings && !hasRooms) {
    state = hasPlacedStructures ? 'goal_agent_layout' : 'goal_empty_land'
    observation = hasPlacedStructures
      ? `${formatStructureNameList(placedStructureNames)} on ${landCopy}. Saved goals: ${formatProjectGoals(projectGoals)}.`
      : `clear ${landCopy} with saved goals: ${formatProjectGoals(projectGoals)}.`
    bestMove = goalRecommendation.bestMove
    why = goalRecommendation.why
    recommendedAction = goalRecommendation.recommendedAction
    options = goalRecommendation.suggestedActions
  } else if (!hasPlacedStructures && !hasGeneratedBuildings && !hasRooms) {
    observation = `clear ${landCopy} with no placed structures yet.`
    bestMove = 'make a simple home layout'
    why = 'it gives you a real starting point, then we can compare privacy, open yard, and access instead of guessing from an empty site.'
    recommendedAction = createPromptAction('Make a simple home layout', 'Make a simple home layout')
    options = [
      recommendedAction,
      createPromptAction('See what fits', 'What can fit on my land?'),
      tennisCourt ? createComparisonAction(tennisCourt, 'Show tennis court in 3D') : null,
    ].filter(Boolean)
  } else if (hasPlacedStructures) {
    state = 'agent_layout'
    observation = `${formatStructureNameList(placedStructureNames)} on ${landCopy}.`
    if (latestLayoutOption?.id !== 'open_backyard' && layoutStructures.length > 0) {
      bestMove = 'open up more backyard space'
      why = 'it usually makes the site easier to understand because the outdoor zone becomes one clear, usable area behind the main layout.'
      recommendedAction = createDecisionLayoutAction('open_backyard', layoutStructures, 'Open backyard')
      options = [
        recommendedAction,
        createPromptAction('Compare privacy vs backyard', 'Compare privacy vs backyard'),
        createPromptAction('Make more private', 'Make this more private'),
      ]
    } else {
      bestMove = 'compare privacy against the open-yard version'
      why = 'you already have a strong open-yard arrangement, so the next useful decision is whether privacy matters more than maximum open space.'
      recommendedAction = createPromptAction('Compare privacy vs backyard', 'Compare privacy vs backyard')
      options = [
        recommendedAction,
        createPromptAction('Make more private', 'Make this more private'),
        createPromptAction('Explain this layout', 'What changed?'),
      ]
    }
  } else if (hasGeneratedBuildings) {
    state = 'uploaded_building'
    observation = `${generatedBuildings.length} uploaded floor-plan building preview${generatedBuildings.length === 1 ? '' : 's'} prepared on ${landCopy}.`
    bestMove = 'check what fits around the uploaded building'
    why = 'the building footprint is now the anchor, so the next decision should be about outdoor space, access, and scale around it.'
    recommendedAction = createPromptAction('See what fits', 'What can fit on my land?')
    options = [
      recommendedAction,
      tennisCourt ? createComparisonAction(tennisCourt, 'Show tennis court in 3D') : null,
      createPromptAction('Summarize the site', 'Summarize the site'),
    ].filter(Boolean)
  } else {
    state = 'floor_plan_drawing'
    observation = `${walls.length} wall${walls.length === 1 ? '' : 's'} and ${rooms.length} room${rooms.length === 1 ? '' : 's'} in the floor-plan drawing.`
    bestMove = 'turn the plan context into a land-scale fit check'
    why = 'the drawing is useful, but the land decision needs scale, setbacks, and outdoor comparisons next.'
    recommendedAction = createPromptAction('See what fits', 'What can fit on my land?')
    options = [
      recommendedAction,
      tennisCourt ? createComparisonAction(tennisCourt, 'Show tennis court in 3D') : null,
      createPromptAction('Summarize the site', 'Summarize the site'),
    ].filter(Boolean)
  }

  if (comparisonNames.length > 0) {
    observation += ` Active scale comparison: ${formatNameList(comparisonNames)}.`
  } else if (hasLand) {
    observation += ` Boundary reference: ${boundaryCopy}.`
  }

  const content = [
    `I see: ${observation}`,
    '',
    `Best move: ${bestMove}.`,
    `Why: ${why}`,
    '',
    'Options:',
    ...options.slice(0, 3).map(action => `- ${action.label}`),
  ].join('\n')

  return {
    content,
    decision: {
      label: 'Recommended next move',
      title: bestMove,
      body: why,
      detail: observation,
    },
    nextSteps: [
      { label: 'Scene inspected', state: 'done' },
      { label: 'Best move chosen', state: 'done' },
      { label: 'Choose an option or say do that', state: 'current' },
    ],
    suggestedActions: options.slice(0, 3),
    toolInput: {
      state,
      landArea: Math.round(landArea || 0),
      hasLand,
      latestLayoutOptionId: latestLayoutOption?.id || null,
      placedStructureCount: placedStructureNames.length,
      generatedBuildingCount: generatedBuildings.length,
      wallCount: walls.length,
      roomCount: rooms.length,
      activeComparisonCount: comparisonNames.length,
      projectGoalIds: projectGoals.map(goal => goal.id),
      projectGoalLabels: projectGoals.map(goal => goal.label),
      recommendedAction,
      optionLabels: options.slice(0, 3).map(action => action.label),
    },
  }
}

function buildSiteBrief({
  hasLand,
  dimensions,
  landArea,
  shapeMode,
  confirmedPolygon,
  setbacksEnabled,
  setbackDistanceM,
  placedBuildings,
  generatedBuildings,
  walls,
  rooms,
  furnitureItems,
  activeComparisons,
  messages,
}) {
  const placedStructureNames = getPlacedStructureNames(placedBuildings)
  const comparisonNames = getActiveComparisonNames(activeComparisons)
  const latestLayoutOption = getLatestLayoutOptionFromMessages(messages)
  const projectGoals = getProjectGoalsFromMessages(messages)
  const decision = buildAgentDecision({
    hasLand,
    dimensions,
    landArea,
    shapeMode,
    confirmedPolygon,
    placedBuildings,
    generatedBuildings,
    walls,
    rooms,
    activeComparisons,
    messages,
  })
  const landShape = shapeMode === 'upload' ? 'uploaded boundary' : shapeMode || 'rectangle'
  const landLine = hasLand
    ? `${formatArea(landArea)} ${landShape}${dimensions?.width && dimensions?.length ? `, about ${formatMeters(dimensions.width)} x ${formatMeters(dimensions.length)}` : ''}`
    : 'Not confirmed yet'
  const boundaryLine = confirmedPolygon?.length >= 3
    ? `${confirmedPolygon.length}-point boundary`
    : 'Default boundary'
  const setbackLine = setbacksEnabled
    ? `${formatMeters(setbackDistanceM)} setbacks are on`
    : 'Setbacks are off'
  const planParts = []
  if (generatedBuildings.length > 0) {
    planParts.push(`${generatedBuildings.length} uploaded floor-plan building preview${generatedBuildings.length === 1 ? '' : 's'}`)
  }
  if (walls.length > 0 || rooms.length > 0) {
    planParts.push(`${walls.length} wall${walls.length === 1 ? '' : 's'} and ${rooms.length} room${rooms.length === 1 ? '' : 's'} in the floor-plan drawing`)
  }
  const plansLine = planParts.length > 0 ? planParts.join('; ') : 'No uploaded building or room drawing in the scene yet'
  const objectParts = []
  if (placedStructureNames.length > 0) objectParts.push(formatStructureNameList(placedStructureNames))
  if (comparisonNames.length > 0) objectParts.push(`scale comparisons: ${formatNameList(comparisonNames)}`)
  if (furnitureItems.length > 0) objectParts.push(`${furnitureItems.length} furniture item${furnitureItems.length === 1 ? '' : 's'}`)
  const objectsLine = objectParts.length > 0 ? objectParts.join('; ') : 'No structures or scale objects placed yet'
  const hasSceneContext = placedStructureNames.length > 0 || generatedBuildings.length > 0 || walls.length > 0 || rooms.length > 0
  const layoutLine = latestLayoutOption
    ? `${latestLayoutOption.label} is the latest agent layout`
    : 'No agent layout option has been applied yet'
  const goalsLine = projectGoals.length > 0
    ? `${formatProjectGoals(projectGoals)}. ${projectGoals.map(goal => goal.summary).join('; ')}`
    : 'No saved goals yet'
  const missingNextLine = !hasLand && !hasSceneContext
    ? 'land size'
    : projectGoals.length === 0
      ? 'project goal'
      : null
  const landIntakeActions = [
    { label: 'Upload a plan', action: 'upload' },
    createPromptAction('Set land size', 'Set my land to 40m by 30m'),
    createDemoLandAction(),
  ]
  const needsLandFirst = !hasLand && !hasSceneContext
  const siteBriefTitle = needsLandFirst ? 'define the land first' : decision.decision.title
  const siteBriefBody = needsLandFirst
    ? 'the land needs to be known before I can make useful placement promises.'
    : decision.decision.body
  const siteBriefActions = needsLandFirst ? landIntakeActions : decision.suggestedActions

  return {
    content: [
      'Site Brief',
      '',
      `Site: ${landLine}. ${boundaryLine}. ${setbackLine}.`,
      `Goals: ${goalsLine}.`,
      missingNextLine ? `Missing next: ${missingNextLine}.` : null,
      `Plans: ${plansLine}.`,
      `Scene: ${objectsLine}.`,
      `Agent memory: ${layoutLine}.`,
      '',
      `Best next move: ${siteBriefTitle}.`,
      `Why: ${siteBriefBody}`,
    ].filter(Boolean).join('\n'),
    decision: {
      label: 'Site brief',
      title: siteBriefTitle,
      body: siteBriefBody,
      detail: `Sitea knows ${hasLand ? formatArea(landArea) : 'unconfirmed land'}, ${projectGoals.length ? `goals for ${formatProjectGoals(projectGoals).toLowerCase()}` : 'no saved goals yet'}, ${plansLine.toLowerCase()}, and ${objectsLine.toLowerCase()}.`,
    },
    nextSteps: [
      { label: 'Project memory checked', state: 'done' },
      { label: hasLand ? 'Site context summarized' : 'Land still needs confirmation', state: 'done' },
      { label: 'Choose the next action or say do it', state: 'current' },
    ],
    suggestedActions: siteBriefActions,
    toolInput: {
      ...decision.toolInput,
      landArea: Math.round(landArea || 0),
      hasLand,
      landShape,
      boundaryPointCount: confirmedPolygon?.length || 0,
      setbacksEnabled,
      setbackDistanceM,
      placedStructureNames,
      generatedBuildingCount: generatedBuildings.length,
      wallCount: walls.length,
      roomCount: rooms.length,
      furnitureCount: furnitureItems.length,
      activeComparisonNames: comparisonNames,
      projectGoalIds: projectGoals.map(goal => goal.id),
      projectGoalLabels: projectGoals.map(goal => goal.label),
      missingNext: missingNextLine,
      recommendedAction: needsLandFirst ? landIntakeActions[2] : decision.toolInput.recommendedAction,
      optionLabels: siteBriefActions.map(action => action.label),
      latestLayoutOptionId: latestLayoutOption?.id || null,
    },
  }
}

function getUploadUserDisplayText(text, fileMeta = {}) {
  const fileName = fileMeta?.fileName || 'plan'
  const prompt = String(text || '').trim()
  if (!prompt) return `Uploaded ${fileName}`
  return `${prompt}\nAttached: ${fileName}`
}

function buildFloorPlanUploadDecision(stats, fileMeta = {}, readout = null) {
  const fileName = fileMeta?.fileName || 'your plan'
  const floorPlanReadout = readout?.readiness ? readout : buildFloorPlanReadout({ stats, fileName })
  const readinessCopy = floorPlanReadout.readiness
  const primaryActionLabel = readinessCopy.state === 'needs_corrections'
    ? 'Fix overlay first'
    : readinessCopy.state === 'review'
      ? 'Review overlay first'
      : 'Review and place in 3D'
  const primaryAction = createFloorPlanPlacementAction(primaryActionLabel)
  const suggestedActions = [
    primaryAction,
    createPromptAction('See what fits around it', 'What can fit on my land?'),
    createPromptAction('Summarize the site', 'Summarize the site'),
  ]
  const foundCopy = floorPlanReadout.summary
  const caveatCopy = floorPlanReadout.caveat
  const reviewCopy = floorPlanReadout.reviewNotes.slice(0, 3).map(note => `- ${note}`).join('\n')
  const bestMove = readinessCopy.title.toLowerCase()
  const why = `${readinessCopy.detail} The overlay shows what Sitea found first, then the detected building can become a real object on the land for scale, access, and outdoor space decisions.`

  return {
    content: `${foundCopy}\n\n${caveatCopy}\n\nReadiness: ${readinessCopy.label}.\n${readinessCopy.detail}\n\nWhat I would check first:\n${reviewCopy}\n\nBest visual move: ${bestMove}.\nWhy: ${why}\n\nOptions:\n${suggestedActions.map(action => `- ${action.label}`).join('\n')}`,
    decision: {
      label: 'Upload decision',
      title: readinessCopy.title,
      body: why,
      detail: `${foundCopy} ${floorPlanReadout.reviewNotes[0] || caveatCopy}`,
    },
    nextSteps: [
      { label: 'Floor plan understood', state: 'done' },
      { label: 'Walls, doors, windows, and rooms extracted', state: 'done' },
      { label: readinessCopy.label, state: readinessCopy.state === 'ready' ? 'done' : 'current' },
      { label: readinessCopy.action, state: readinessCopy.state === 'ready' ? 'current' : 'pending' },
    ],
    suggestedActions,
    toolInput: {
      ...stats,
      fileName: fileMeta?.fileName || null,
      planKind: 'floor_plan',
      recommendedAction: primaryAction,
      optionLabels: suggestedActions.map(action => action.label),
      reviewNotes: floorPlanReadout.reviewNotes,
      readiness: floorPlanReadout.readiness,
    },
  }
}

function buildSitePlanUploadDecision({ fit, detection, landArea, fileMeta = {} }) {
  const confidenceText = detection?.confidence
    ? ` with ${Math.round(detection.confidence * 100)}% confidence`
    : ''
  const countLabel = fit.count === 1 ? 'Show 1 tennis court in 3D' : 'Show tennis court in 3D'
  const scaleAction = createComparisonAction(TENNIS_COURT, countLabel)
  const boundaryAction = createBoundaryReviewAction()
  const primaryAction = Number.isFinite(landArea) && landArea > 0 ? scaleAction : boundaryAction
  const suggestedActions = [
    primaryAction,
    primaryAction.type === boundaryAction.type ? scaleAction : boundaryAction,
    createPromptAction('Make a simple home layout', 'Make a simple home layout'),
  ]
  const fileName = fileMeta?.fileName || 'your plan'
  const foundCopy = `I read ${fileName} as a site plan${confidenceText}. ${fit.text}`
  const boundaryCopy = primaryAction.type === 'activate_comparison'
    ? 'The land workspace is ready enough for a scale comparison.'
    : 'The boundary should be reviewed before I make placement promises.'
  const bestMove = primaryAction.type === 'activate_comparison'
    ? 'show a tennis court in 3D'
    : 'review the boundary first'
  const why = primaryAction.type === 'activate_comparison'
    ? 'a real-world scale object makes the land size immediately understandable before you decide where buildings or open space should go.'
    : 'the uploaded plan needs a boundary check before I can make useful placement promises.'

  return {
    content: `${foundCopy}\n\n${boundaryCopy}\n\nBest visual move: ${bestMove}.\nWhy: ${why}\n\nOptions:\n${suggestedActions.map(action => `- ${action.label}`).join('\n')}`,
    decision: {
      label: 'Upload decision',
      title: bestMove,
      body: why,
      detail: `${foundCopy} ${boundaryCopy}`,
    },
    nextSteps: [
      { label: 'Site plan recognized', state: 'done' },
      { label: primaryAction.type === 'activate_comparison' ? 'Scale readout prepared' : 'Boundary review needed', state: 'done' },
      { label: 'Say do it or choose a scale/boundary action', state: 'current' },
    ],
    suggestedActions,
    toolInput: {
      landArea: Math.round(landArea || 0),
      fileName: fileMeta?.fileName || null,
      planKind: 'site_plan',
      tennisCourtFit: fit.count,
      detectionType: detection?.type || 'site-plan',
      detectionConfidence: detection?.confidence || null,
      recommendedAction: primaryAction,
      optionLabels: suggestedActions.map(action => action.label),
    },
  }
}

function formatLayoutOptionComparisonLine(option) {
  return `- ${option.label.replace(':', ' -')}: best for ${option.advisor.bestFor}. Tradeoff: ${option.advisor.tradeoff}`
}

function formatLayoutComparison({ optionIds, recommendationId, topic }) {
  const options = optionIds
    .map(optionId => getLayoutOptionById(optionId))
    .filter((option, index, allOptions) => allOptions.findIndex(candidate => candidate.id === option.id) === index)
  const recommendation = getLayoutOptionById(recommendationId)
  const comparisonLines = options.map(formatLayoutOptionComparisonLine).join('\n')

  const opening = (() => {
    if (topic === 'open_land') return 'Option 2 gives you the most open land because it keeps more of the rear of the site clear.'
    if (topic === 'privacy') return 'Option 3 gives you the strongest privacy because it moves the living zone deeper into the land.'
    if (topic === 'privacy_vs_open_land') return 'Option 2 keeps the most backyard; Option 3 gives more privacy. The right choice depends on what matters more for this site.'
    if (topic === 'access') return 'Option 1 is the safest access-first choice because it keeps the layout simple and easy to adjust.'
    if (topic === 'balanced') return 'Option 1 is the cleanest balanced choice because it avoids over-optimizing for only one goal.'
    return `${recommendation.label} is the safest recommendation from the current options.`
  })()

  return `${opening}\n\n${comparisonLines}\n\nMy recommendation: ${recommendation.label}. ${recommendation.reason}`
}

function formatLastLayoutExplanation(messages) {
  const latestAction = getLatestLayoutToolAction(messages)
  if (!latestAction) {
    return {
      success: false,
      content: 'I have not changed the layout yet. Ask me for a simple home layout first, then I can explain what I changed and why.',
      input: { reason: 'no_layout_action' },
    }
  }

  const input = latestAction.input || {}
  const option = input.optionId
    ? getLayoutOptionById(input.optionId)
    : getLayoutOptionByVariant(input.layoutVariant)
  const placementNames = (input.placements || [])
    .map(item => item.structureName)
    .filter(Boolean)
  const placedCopy = placementNames.length > 0
    ? `It placed ${formatStructureNameList(placementNames)} inside the buildable area.`
    : input.placedCount
      ? `It placed ${input.placedCount} structure${input.placedCount === 1 ? '' : 's'} inside the buildable area.`
      : 'It checked the available buildable area before changing the scene.'

  if (option) {
    return {
      success: true,
      content: `I last applied ${option.label}. ${option.advisor.change}\n\nWhy: this is best for ${option.advisor.bestFor}. ${option.advisor.tradeoff}\n\n${placedCopy}`,
      input: {
        latestAction: latestAction.name,
        optionId: option.id,
        optionLabel: option.label,
        layoutVariant: option.layoutVariant,
        placedCount: input.placedCount || placementNames.length || 0,
      },
    }
  }

  return {
    success: true,
    content: `I last changed the structure layout with a safe scene adjustment. ${placedCopy} Uploaded plans, comparison objects, land dimensions, and floor-plan geometry were left alone.`,
    input: {
      latestAction: latestAction.name,
      layoutVariant: input.layoutVariant,
      placedCount: input.placedCount || placementNames.length || 0,
    },
  }
}

function isAccessParkingRequest(normalizedText) {
  return /\b(road|street|driveway|parking|park|vehicle access|car access|front access)\b/.test(normalizedText) &&
    /\b(make|put|place|move|shift|bring|keep|near|closer|easy|easier|access)\b/.test(normalizedText)
}

function parseAccessStructureCommand(normalizedText, matches) {
  if (!isAccessParkingRequest(normalizedText)) return null
  const targetStructure = matches.find(match => ['garage', 'carport'].includes(match.object.id))?.object ||
    getStructureById('garage')
  if (!targetStructure) return null

  return {
    type: 'move_structure',
    structure: targetStructure,
    referenceStructure: null,
    direction: 'front',
    distanceM: parseDistanceCommand(normalizedText),
    intentLabel: 'parking access',
    intentCopy: 'toward the road/front edge for easier parking access',
  }
}

function isResetAllComparisonsRequest(normalizedText) {
  return hasResetIntent(normalizedText) &&
    /\b(all|everything|comparisons|objects|items)\b/.test(normalizedText)
}

function parseReplaceCommand(normalizedText) {
  if (!hasReplaceIntent(normalizedText)) return null
  const matches = getComparisonMatches(normalizedText)
  const uniqueMatches = []
  for (const match of matches) {
    if (!uniqueMatches.some(existing => existing.object.id === match.object.id)) {
      uniqueMatches.push(match)
    }
  }
  if (uniqueMatches.length < 2) return null
  return { fromObject: uniqueMatches[0].object, toObject: uniqueMatches[1].object }
}

function parseStructureRefinementCommand(normalizedText) {
  const matches = getUniqueStructureMatches(normalizedText)
  const targetStructure = matches[0]?.object || null

  if (hasReplaceIntent(normalizedText) && matches.length >= 2) {
    return {
      type: 'replace_structure',
      structure: matches[0].object,
      replacement: matches[1].object,
    }
  }

  if (hasStructureResizeIntent(normalizedText)) {
    const replacement = getResizeReplacementStructure(normalizedText, targetStructure)
    if (replacement) {
      return { type: 'resize_structure', structure: targetStructure, replacement }
    }
  }

  const accessStructureCommand = parseAccessStructureCommand(normalizedText, matches)
  if (accessStructureCommand) {
    return accessStructureCommand
  }

  if (hasStructureMoveIntent(normalizedText)) {
    const direction = getStructureMoveDirection(normalizedText)
    if (direction) {
      const backyardReference = direction === 'behind' &&
        /\bbackyard\b/.test(normalizedText) &&
        targetStructure?.role === 'outdoor_amenity'
        ? getStructureById('mediumHouse')
        : null
      return {
        type: 'move_structure',
        structure: targetStructure,
        referenceStructure: matches[1]?.object || backyardReference,
        direction,
        distanceM: parseDistanceCommand(normalizedText),
        intentLabel: null,
        intentCopy: null,
      }
    }
  }

  if (hasStructureRotateIntent(normalizedText)) {
    return {
      type: 'rotate_structure',
      structure: targetStructure,
      degrees: parseRotationDegrees(normalizedText),
    }
  }

  return null
}

function parseSelectedGeneratedBuildingCommand(normalizedText) {
  const mentionsPlacedPlan = /\b(floor plan|floor-plan|uploaded plan|placed plan|source plan|selected plan|current plan|this plan|that plan|selected building|current building|this building|that building)\b/.test(normalizedText)
  const mentionsSelectedThing = /\b(selected|current|this|that|it)\b/.test(normalizedText)
  const wantsDeselect = /\b(deselect|unselect|clear selection|clear selected|cancel selection)\b/.test(normalizedText)
  const wantsSelect = /\b(select|focus|highlight|target|open|show me|show)\b/.test(normalizedText)

  if (wantsDeselect && (mentionsPlacedPlan || mentionsSelectedThing)) {
    return { type: 'deselect_selected_generated_building' }
  }

  if (wantsSelect && mentionsPlacedPlan) {
    return { type: 'select_generated_building' }
  }

  const mentionsBuildingActionTarget = mentionsPlacedPlan ||
    (mentionsSelectedThing && /\b(plan|building|editable|selection)\b/.test(normalizedText))

  if (!mentionsBuildingActionTarget) return null

  if (/\b(explode|make editable|editable|turn into walls|convert to walls|edit walls|edit the walls)\b/.test(normalizedText)) {
    return { type: 'explode_selected_generated_building' }
  }

  if (hasStructureRotateIntent(normalizedText)) {
    return { type: 'rotate_selected_generated_building', degrees: parseRotationDegrees(normalizedText) }
  }

  return null
}

function createComparisonAction(object, label = `Show ${object.name} in 3D`, options = {}) {
  return {
    type: 'activate_comparison',
    comparisonId: object.id,
    label,
    objectName: object.name,
    handoff: true,
    ...(options.placementMode ? { placementMode: options.placementMode } : {}),
    ...(options.targetBuildingId ? { targetBuildingId: options.targetBuildingId } : {}),
    ...(options.targetSource ? { targetSource: options.targetSource } : {}),
    ...(Number.isFinite(options.generatedBuildingCount) ? { generatedBuildingCount: options.generatedBuildingCount } : {}),
    toast: options.toast || `${object.displayName} added • drag or rotate it to compare scale`,
  }
}

function createFloorPlanPlacementAction(label = 'Place this in 3D') {
  return {
    type: 'handoff_to_scene',
    label,
    toast: 'Preview ready • click the land to place it • R to rotate',
  }
}

function createBoundaryReviewAction(label = 'Review boundary') {
  return {
    type: 'review_site_boundary',
    label,
    toast: 'Site plan prepared • review boundary in Land tools',
  }
}

function createDemoLandAction(label = 'Use demo land') {
  return {
    type: 'set_demo_land',
    label,
    length: 55,
    width: 50,
    toast: 'Demo land ready • 2750m²',
  }
}

function buildFitLine(object, landArea) {
  const fit = getObjectFit(object, landArea)
  if (fit.count === null) {
    return `- ${object.displayName}: land area needed`
  }
  if (fit.count <= 0) {
    return `- ${object.displayName}: not enough area before setbacks (${Math.round(fit.objectArea)}m² footprint)`
  }
  return `- ${object.displayName}: about ${fit.count} ${fit.count === 1 ? object.name : object.pluralName}`
}

function parseLandDimensionCommand(normalizedText) {
  const mentionsLand = /\b(land|plot|site|lot|parcel|property)\b/.test(normalizedText)
  const hasSetIntent = /\b(set|make|create|define|use|change|resize|start)\b/.test(normalizedText)
  if (!mentionsLand || !hasSetIntent) return null

  const match = normalizedText.match(/\b(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres|ft|feet|foot)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres|ft|feet|foot)?\b/)
  if (!match) return null

  const firstValue = Number.parseFloat(match[1])
  const secondValue = Number.parseFloat(match[3])
  const unit = match[2] || match[4] || 'm'
  if (!Number.isFinite(firstValue) || !Number.isFinite(secondValue)) return null

  const unitMultiplier = /^(ft|feet|foot)$/.test(unit) ? 1 / 3.28084 : 1
  const length = firstValue * unitMultiplier
  const width = secondValue * unitMultiplier
  if (length < 1 || width < 1 || length > 1000 || width > 1000) return null

  return { length, width }
}

function parseLandAreaCommand(normalizedText) {
  const mentionsLand = /\b(land|plot|site|lot|parcel|property)\b/.test(normalizedText)
  const hasSetIntent = /\b(set|make|create|define|use|change|resize|start)\b/.test(normalizedText)
  if (!mentionsLand || !hasSetIntent) return null

  const match = normalizedText.match(/\b(\d+(?:\.\d+)?)\s*(m2|m²|sqm|sq m|square meters?|square metres?|acres?|hectares?)\b/)
  if (!match) return null

  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value)) return null

  let area = value
  if (/^acres?$/.test(match[2])) area = value * 4046.86
  if (/^hectares?$/.test(match[2])) area = value * 10000
  if (area < 10 || area > 1000000) return null

  const side = Math.sqrt(area)
  return { area, length: side, width: side }
}

function buildTextSceneAction(text, { landArea, generatedBuildings = [], selectedGeneratedBuildingId = null }) {
  const normalizedText = normalizeCommand(text)
  const landDimensions = parseLandDimensionCommand(normalizedText)
  if (landDimensions) {
    return { type: 'set_land_dimensions', ...landDimensions }
  }

  const landAreaDimensions = parseLandAreaCommand(normalizedText)
  if (landAreaDimensions) {
    return { type: 'set_land_area', ...landAreaDimensions }
  }

  if (/\b(use|start with|set|make)\b.*\bdemo land\b/.test(normalizedText) || /\bdemo land\b.*\b(use|start|set|make)\b/.test(normalizedText)) {
    return createDemoLandAction()
  }

  if (isUndoAgentStructureRequest(normalizedText)) {
    return { type: 'undo_agent_structure_change' }
  }

  if (isRetryStructureLayoutRequest(normalizedText)) {
    return { type: 'retry_structure_layout' }
  }

  if (isClearStructuresRequest(normalizedText)) {
    return { type: 'clear_structures' }
  }

  const aroundPlanComparison = getComparisonFromCommand(normalizedText)
  if (
    aroundPlanComparison &&
    isAroundGeneratedBuildingPlacementRequest(normalizedText) &&
    (hasSceneAddIntent(normalizedText) || /\b(compare|comparison|scale|show|add|place)\b/.test(normalizedText))
  ) {
    const action = buildAroundGeneratedBuildingComparisonAction(aroundPlanComparison, {
      generatedBuildings,
      selectedGeneratedBuildingId,
    })
    if (action) return { ...action, object: aroundPlanComparison }
  }

  const selectedGeneratedBuildingAction = parseSelectedGeneratedBuildingCommand(normalizedText)
  if (selectedGeneratedBuildingAction) {
    return selectedGeneratedBuildingAction
  }

  const structureRefinement = parseStructureRefinementCommand(normalizedText)
  if (structureRefinement) {
    return structureRefinement
  }

  const structureLayout = getStructureLayoutFromCommand(normalizedText)
  if (structureLayout && (hasStructurePlaceIntent(normalizedText) || isStarterStructureLayoutRequest(normalizedText))) {
    return { type: 'offer_structure_layout_options', structures: structureLayout }
  }

  const layoutRecommendationFollowThrough = parseLayoutRecommendationFollowThrough(normalizedText)
  if (layoutRecommendationFollowThrough) {
    return layoutRecommendationFollowThrough
  }

  const layoutPreferenceSelection = parseLayoutPreferenceSelection(normalizedText)
  if (layoutPreferenceSelection) {
    return { type: 'apply_layout_preference', ...layoutPreferenceSelection }
  }

  const projectGoalRequest = parseProjectGoalRequest(normalizedText)
  if (projectGoalRequest) {
    return projectGoalRequest
  }

  const clarifyOrActRequest = parseClarifyOrActRequest(normalizedText)
  if (clarifyOrActRequest) {
    return clarifyOrActRequest
  }

  const decisionRequest = parseDecisionRequest(normalizedText)
  if (decisionRequest) {
    return decisionRequest
  }

  const siteBriefRequest = parseSiteBriefRequest(normalizedText)
  if (siteBriefRequest) {
    return siteBriefRequest
  }

  const sceneAwarenessRequest = parseSceneAwarenessRequest(normalizedText)
  if (sceneAwarenessRequest) {
    return sceneAwarenessRequest
  }

  const layoutAdvisorRequest = parseLayoutAdvisorRequest(normalizedText)
  if (layoutAdvisorRequest) {
    return layoutAdvisorRequest
  }

  const structure = getStructureFromCommand(normalizedText)
  if (structure && hasStructureRemoveIntent(normalizedText)) {
    return { type: 'remove_structure', structure }
  }

  if (structure && hasStructurePlaceIntent(normalizedText)) {
    return { type: 'place_structure', structure }
  }

  if (isClearComparisonsRequest(normalizedText)) {
    return { type: 'clear_comparisons' }
  }

  const replacement = parseReplaceCommand(normalizedText)
  if (replacement) {
    return { type: 'replace_comparison', ...replacement }
  }

  if (isResetAllComparisonsRequest(normalizedText)) {
    return { type: 'reset_all_comparison_transforms' }
  }

  const comparison = getComparisonFromCommand(normalizedText)
  if (comparison && hasResetIntent(normalizedText)) {
    return { type: 'reset_comparison_transform', object: comparison }
  }

  if (comparison && hasRemoveIntent(normalizedText)) {
    return { type: 'remove_comparison', object: comparison }
  }

  if (comparison && hasFitIntent(normalizedText) && !hasSceneAddIntent(normalizedText)) {
    const fit = getObjectFit(comparison, landArea)
    return {
      type: 'fit_check',
      object: comparison,
      content: `${fit.text}\n\nI can add one ${comparison.name} to the scene so you can compare the scale visually.`,
      suggestedActions: [createComparisonAction(comparison)],
      toolInput: {
        objectId: comparison.id,
        objectName: comparison.name,
        landArea: Math.round(landArea || 0),
        fitCount: fit.count,
      },
    }
  }

  if (comparison && hasSceneAddIntent(normalizedText)) {
    return { type: 'activate_comparison', object: comparison }
  }

  if (isFitAroundGeneratedBuildingRequest(normalizedText)) {
    const fitAroundPlan = buildFitAroundGeneratedBuildingAction({
      landArea,
      generatedBuildings,
      selectedGeneratedBuildingId,
    })
    if (fitAroundPlan) return fitAroundPlan
  }

  if (isGeneralFitRequest(normalizedText)) {
    return {
      type: 'general_fit_check',
      content: `Here is a quick area-only fit check for ${formatArea(landArea)}:\n\n${TEXT_ACTION_COMPARISONS.map(object => buildFitLine(object, landArea)).join('\n')}\n\nThis is a first-pass scale check. Setbacks, access, slope, and the house footprint can reduce what actually works.`,
      suggestedActions: TEXT_ACTION_COMPARISONS
        .filter(object => {
          const fit = getObjectFit(object, landArea)
          return fit.count === null || fit.count > 0
        })
        .slice(0, 2)
        .map(object => createComparisonAction(object)),
      toolInput: {
        landArea: Math.round(landArea || 0),
        objects: TEXT_ACTION_COMPARISONS.map(object => ({
          id: object.id,
          count: getObjectFit(object, landArea).count,
        })),
      },
    }
  }

  if (/\b(start|help|define|set)\b/.test(normalizedText) && /\bland size\b/.test(normalizedText)) {
    return {
      type: 'land_size_help',
      content: 'Tell me the land dimensions and I will set the scene for you. For example: "Set my land to 40m by 30m." You can also upload a site plan and I will prepare the boundary review.',
    }
  }

  return null
}

function shouldTreatUploadAsSitePlan(text, fileMeta, detection) {
  const uploadText = `${text || ''} ${fileMeta?.fileName || ''}`.toLowerCase()
  const asksForSite = /\b(site|land|plot|parcel|lot|boundary)\b/.test(uploadText)
  const asksForFloor = /\b(floor|room|wall|door|window|bedroom|bathroom)\b/.test(uploadText)
  return detection?.type === 'site-plan' || (asksForSite && !asksForFloor)
}

export function useAIChat({
  addWallFromPoints,
  addFurniture,
  deleteFurniture,
  clearAllWalls,
  setFurnitureItems,
  walls,
  rooms,
  furnitureItems,
  roomLabels,
  setRoomLabels,
  onFloorPlanGenerated,
  onSitePlanUploaded,
  activateComparison,
  onVisualHandoff,
  onSceneControl,
  onLandDimensionsUpdated,
  isPaidUser = false,
  markUploadUsed = async () => ({ ok: true }),
  hasLand = false,
  dimensions,
  landArea,
  shapeMode,
  confirmedPolygon,
  placedBuildings = [],
  generatedBuildings = [],
  selectedGeneratedBuildingId = null,
  activeComparisons = {},
  setbacksEnabled = false,
  setbackDistanceM = 0,
}) {
  const STORAGE_KEY = 'sitea-ai-chat'

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [activeProcess, setActiveProcess] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(false)
  const pendingLabelsRef = useRef([]) // [{centerX, centerZ, label}]
  const messagesRef = useRef(messages) // always-current messages for building API payloads
  const pendingStructureLayoutRef = useRef(null)

  // Keep ref in sync + persist to localStorage
  useEffect(() => {
    messagesRef.current = messages
    try {
      if (messages.length > 0) {
        // Keep last 50 messages to avoid bloating localStorage
        const toSave = messages.slice(-50)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch { /* storage full — ignore */ }
  }, [messages])

  const executeTool = useCallback((name, input) => {
    switch (name) {
      case 'create_room': {
        const { width, depth, centerX = 0, centerZ = 0, label } = input
        const hw = width / 2, hd = depth / 2
        const points = [
          { x: centerX - hw, z: centerZ - hd },
          { x: centerX + hw, z: centerZ - hd },
          { x: centerX + hw, z: centerZ + hd },
          { x: centerX - hw, z: centerZ + hd },
          { x: centerX - hw, z: centerZ - hd }, // close the rectangle
        ]
        addWallFromPoints(points)
        if (label) {
          pendingLabelsRef.current.push({ centerX, centerZ, label })
        }
        return { success: true, message: `Created ${width}x${depth}m ${label || 'room'} at (${centerX}, ${centerZ})` }
      }
      case 'add_furniture': {
        const { catalogId, x, z } = input
        addFurniture(catalogId, { x, z })
        return { success: true, message: `Added ${catalogId} at (${x}, ${z})` }
      }
      case 'delete_furniture': {
        const { id } = input
        deleteFurniture(id)
        return { success: true, message: `Deleted furniture ${id}` }
      }
      case 'clear_scene': {
        clearAllWalls()
        setFurnitureItems([])
        return { success: true, message: 'Cleared all walls and furniture' }
      }
      case 'get_scene_summary': {
        const wallCount = walls.length
        const roomCount = rooms.length
        const furnitureList = furnitureItems.map(f => `${f.catalogId} (id: ${f.id})`).join(', ')
        const roomList = rooms.map((r, i) => {
          const label = roomLabels[r.id] || `Room ${i + 1}`
          return label
        }).join(', ')
        return {
          success: true,
          summary: {
            walls: wallCount,
            rooms: roomCount,
            roomNames: roomList || 'none',
            furniture: furnitureList || 'none',
            furnitureCount: furnitureItems.length,
          },
        }
      }
      default:
        return { success: false, error: `Unknown tool: ${name}` }
    }
  }, [addWallFromPoints, addFurniture, deleteFurniture, clearAllWalls, setFurnitureItems, walls, rooms, furnitureItems, roomLabels])

  // Build API messages from UI messages
  const buildApiMessages = useCallback((allMessages) => {
    const apiMessages = []
    for (const msg of allMessages) {
      if (msg.role === 'user') {
        apiMessages.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant') {
        if (msg.apiContent) {
          apiMessages.push({ role: 'assistant', content: msg.apiContent })
          if (msg.toolResults) {
            apiMessages.push({ role: 'user', content: msg.toolResults })
          }
        } else if (msg.content) {
          apiMessages.push({ role: 'assistant', content: msg.content })
        }
      }
    }
    return apiMessages
  }, [])

  // Build scene context so the agent knows what's already placed
  const buildSceneContext = useCallback(() => {
    const parts = []
    if (hasLand) {
      const landShape = shapeMode === 'upload' ? 'uploaded/detected boundary' : shapeMode || 'rectangle'
      parts.push(`Land: ${landShape}, ${Math.round(landArea || 0)}m², approximately ${formatMeters(dimensions?.width)} wide by ${formatMeters(dimensions?.length)} long.`)
      if (confirmedPolygon?.length >= 3) {
        parts.push(`Land boundary has ${confirmedPolygon.length} points.`)
      }
      if (setbacksEnabled) {
        parts.push(`Setback rule: keep new structures ${formatMeters(setbackDistanceM)} from the land boundary.`)
      }
    } else {
      parts.push('Land is not confirmed yet. Help the user define land size, shape, or upload a plan before making detailed placement promises.')
    }
    if (placedBuildings.length > 0) {
      parts.push(`Placed structures (${placedBuildings.length}):`)
      placedBuildings.forEach((building, i) => {
        const name = building.type?.name || building.type?.id || `Structure ${i + 1}`
        const width = building.type?.width ? formatMeters(building.type.width) : 'unknown width'
        const length = building.type?.length ? formatMeters(building.type.length) : 'unknown length'
        const x = formatMeters(building.position?.x)
        const z = formatMeters(building.position?.z)
        parts.push(`  - ${name}: ${width} x ${length}, center=(${x}, ${z})`)
      })
    }
    if (generatedBuildings.length > 0) {
      parts.push(`AI-generated floor-plan buildings (${generatedBuildings.length}):`)
      generatedBuildings.forEach((building, i) => {
        const stats = building.stats
          ? `${building.stats.wallCount || 0} walls, ${building.stats.doorCount || 0} doors, ${building.stats.windowCount || 0} windows, ${building.stats.roomCount || 0} rooms`
          : 'no stats'
        const x = formatMeters(building.position?.x)
        const z = formatMeters(building.position?.z)
        parts.push(`  - Building ${i + 1}: ${stats}, center=(${x}, ${z})`)
      })
    }
    if (rooms.length > 0) {
      parts.push(`Rooms (${rooms.length}):`)
      rooms.forEach((r, i) => {
        const label = roomLabels[r.id] || `Room ${i + 1}`
        const xs = r.points.map(p => p.x)
        const zs = r.points.map(p => p.z)
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minZ = Math.min(...zs), maxZ = Math.max(...zs)
        parts.push(`  - ${label}: ${(maxX - minX).toFixed(1)}x${(maxZ - minZ).toFixed(1)}m, center=(${r.center.x.toFixed(1)}, ${r.center.z.toFixed(1)}), X=[${minX.toFixed(1)}, ${maxX.toFixed(1)}] Z=[${minZ.toFixed(1)}, ${maxZ.toFixed(1)}]`)
      })
    }
    if (furnitureItems.length > 0) {
      parts.push(`Furniture (${furnitureItems.length}):`)
      furnitureItems.forEach(f => {
        parts.push(`  - ${f.catalogId} at (${f.position.x.toFixed(1)}, ${f.position.z.toFixed(1)}) id=${f.id}`)
      })
    }
    return parts.join('\n')
  }, [
    hasLand,
    shapeMode,
    landArea,
    dimensions,
    confirmedPolygon,
    setbacksEnabled,
    setbackDistanceM,
    placedBuildings,
    generatedBuildings,
    rooms,
    furnitureItems,
    roomLabels,
  ])

  // Handle floor plan file upload via the dedicated analyzer endpoint
  const analyzeFloorPlan = useCallback(async (fileBase64, text, fileMeta = {}) => {
    setError(null)
    setIsLoading(true)
    setActiveProcess(FLOOR_PLAN_PROCESS)

    const displayText = getUploadUserDisplayText(text, fileMeta)
    const userMsg = { role: 'user', content: displayText, displayText, hasImage: true }
    setMessages(prev => [...prev, userMsg])

    try {
      if (!supabase) throw new Error('Please sign in to use the AI assistant')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Please sign in to use the AI assistant')

      const response = await fetch('/api/analyze-floor-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image: fileBase64 }),
      })

      const data = await readFloorPlanAnalysisResponse(response)
      if (!data.walls || data.walls.length === 0) {
        throw new Error('No walls detected. Please try a clearer image.')
      }

      const result = {
        ...convertFloorPlanToWorld(data),
        analysis: data,
        sourceImage: fileMeta?.imageData || null,
        sourceFileName: fileMeta?.fileName || null,
      }
      const { stats } = result
      const readout = buildFloorPlanReadout({
        stats,
        analysis: data,
        warnings: result.warnings,
        fileName: fileMeta?.fileName || 'your plan',
      })
      result.readout = readout
      const uploadDecision = buildFloorPlanUploadDecision(stats, fileMeta, readout)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: uploadDecision.content,
        decision: uploadDecision.decision,
        nextSteps: uploadDecision.nextSteps,
        toolActions: [{
          name: 'analyze_floor_plan',
          input: uploadDecision.toolInput,
          success: true,
        }],
        suggestedActions: uploadDecision.suggestedActions,
      }])

      if (onFloorPlanGenerated) {
        onFloorPlanGenerated(result)
      }
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, { role: 'assistant', content: '', error: err.message }])
    } finally {
      setActiveProcess(null)
      setIsLoading(false)
    }
  }, [onFloorPlanGenerated])

  const analyzeSitePlan = useCallback(async (text, fileMeta, detection = null) => {
    setError(null)
    setIsLoading(true)
    setActiveProcess(SITE_PLAN_PROCESS)

    const displayText = getUploadUserDisplayText(text, fileMeta)
    const userMsg = { role: 'user', content: displayText, displayText, hasImage: true }
    setMessages(prev => [...prev, userMsg])

    try {
      const quota = await markUploadUsed()
      if (!quota?.ok) {
        throw new Error(quota?.error || 'Upload limit reached')
      }

      if (fileMeta?.imageData && onSitePlanUploaded) {
        onSitePlanUploaded(fileMeta.imageData)
      }

      const fit = getTennisCourtFit(landArea)
      const uploadDecision = buildSitePlanUploadDecision({ fit, detection, landArea, fileMeta })

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: uploadDecision.content,
        decision: uploadDecision.decision,
        nextSteps: uploadDecision.nextSteps,
        toolActions: [{
          name: 'review_site_plan',
          input: uploadDecision.toolInput,
          success: true,
        }],
        suggestedActions: uploadDecision.suggestedActions,
      }])
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, { role: 'assistant', content: '', error: err.message }])
    } finally {
      setActiveProcess(null)
      setIsLoading(false)
    }
  }, [landArea, markUploadUsed, onSitePlanUploaded])

  const routePlanUpload = useCallback(async (fileBase64, text, fileMeta = {}) => {
    let detection = null
    if (fileMeta?.imageData) {
      try {
        detection = await analyzeImage(fileMeta.imageData, isPaidUser)
      } catch (err) {
        console.warn('Plan type detection failed, using floor-plan analyzer fallback:', err)
      }
    }

    if (shouldTreatUploadAsSitePlan(text, fileMeta, detection)) {
      return analyzeSitePlan(text, fileMeta, detection)
    }

    return analyzeFloorPlan(fileBase64, text, fileMeta)
  }, [analyzeFloorPlan, analyzeSitePlan, isPaidUser])

  const applyStructureLayoutOption = useCallback((optionId, userMsg, fallbackStructures = [], preference = {}) => {
    const restoredStructures = fallbackStructures?.length
      ? fallbackStructures
      : getOfferedLayoutStructuresFromMessages(messagesRef.current)
    const pendingLayout = pendingStructureLayoutRef.current?.structures?.length
      ? pendingStructureLayoutRef.current
      : { structures: restoredStructures }
    const option = getLayoutOptionById(optionId)

    if (!pendingLayout?.structures?.length) {
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: 'I do not have layout options waiting yet. Ask me for a layout first, then choose an option.',
        nextSteps: [
          { label: 'Option checked', state: 'done' },
          { label: 'No pending layout options', state: 'current' },
        ],
        toolActions: [{
          name: 'apply_structure_layout_option',
          input: { optionId: option.id, reason: 'no_pending_layout' },
          success: false,
        }],
      }])
      return true
    }

    const result = onSceneControl?.({
      type: 'place_structure_layout',
      structures: pendingLayout.structures.map(structure => ({ id: structure.id, role: structure.role })),
      layoutVariant: option.layoutVariant,
      replaceAgentStructures: true,
    })
    const placed = Array.isArray(result?.placed) ? result.placed : []
    const skipped = Array.isArray(result?.skipped) ? result.skipped : []
    const success = result?.ok === true && placed.length > 0
    const placedNames = formatStructureNameList(placed.map(item => item.name))
    const skippedNames = formatStructureNameList(skipped.map(item => item.name))
    const partialCopy = skipped.length > 0
      ? ` I could not safely fit ${skippedNames} without breaking the buildable area.`
      : ''
    const fallbackCount = placed.filter(item => item.placementMode === 'fallback').length
    const fallbackCopy = fallbackCount > 0
      ? ` I used a safe fallback spot for ${fallbackCount} item${fallbackCount === 1 ? '' : 's'} where needed.`
      : ''
    const preferenceOpening = getLayoutPreferenceOpening(option.id, preference.preferenceLabel)

    setMessages(prev => [...prev, userMsg, {
      role: 'assistant',
      content: success
        ? `${preferenceOpening || `Done. I used ${option.label}.`} ${option.reason} I placed ${placedNames}.${partialCopy}${fallbackCopy}`
        : `I checked ${option.label}, but I could not place that option safely on the current land. Try a smaller layout or clear space first.`,
      nextSteps: success ? [
        { label: preference.preferenceLabel ? `${preference.preferenceLabel} layout applied` : `${option.label} placed`, state: 'done' },
        { label: 'Safety rules checked', state: 'done' },
        { label: 'Say undo that or choose another option', state: 'current' },
      ] : [
        { label: `${option.label} checked`, state: 'done' },
        { label: 'No safe option found', state: 'current' },
      ],
      toolActions: [{
        name: 'apply_structure_layout_option',
        input: {
          optionId: option.id,
          optionLabel: option.label,
          preferenceLabel: preference.preferenceLabel,
          layoutVariant: option.layoutVariant,
          structureIds: pendingLayout.structures.map(structure => structure.id),
          placedCount: placed.length,
          skippedCount: skipped.length,
          skippedNames: skipped.map(item => item.name),
          fallbackCount,
          placements: placed.map(item => ({
            structureId: item.structureId,
            structureName: item.name,
            role: item.role,
            placementMode: item.placementMode,
            x: Number(item.position?.x?.toFixed?.(2) ?? item.position?.x ?? 0),
            z: Number(item.position?.z?.toFixed?.(2) ?? item.position?.z ?? 0),
          })),
          reason: result?.reason,
        },
        success,
      }],
    }])

    onVisualHandoff?.({ toast: success ? `${option.label.replace(/^Option \d+: /, '')} placed` : 'Layout option blocked' })
    return true
  }, [onSceneControl, onVisualHandoff])

  const handleTextSceneAction = useCallback((messageText) => {
    const action = buildTextSceneAction(messageText, {
      landArea,
      generatedBuildings,
      selectedGeneratedBuildingId,
    })
    if (!action) return false

    setError(null)
    const userMsg = { role: 'user', content: messageText, displayText: messageText, hasImage: false }

    if (action.type === 'set_land_dimensions' || action.type === 'set_land_area') {
      const sceneAction = { type: 'set_land_dimensions', length: action.length, width: action.width }
      if (action.type === 'set_land_area') sceneAction.area = action.area
      if (onSceneControl) {
        onSceneControl(sceneAction)
      } else {
        onLandDimensionsUpdated?.({ length: action.length, width: action.width })
      }
      const area = action.length * action.width
      const dimensionText = `${formatMeters(action.length)} x ${formatMeters(action.width)}`
      const content = action.type === 'set_land_area'
        ? `Done. I made the land a square ${formatArea(action.area)} plot (${dimensionText}) and opened the 3D scene so you can keep going visually.`
        : `Done. I set the land to ${dimensionText} (${formatArea(area)}) and opened the 3D scene so you can keep going visually.`
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content,
        nextSteps: [
          { label: action.type === 'set_land_area' ? 'Land area set' : 'Land dimensions set', state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Ask what fits next', state: 'current' },
        ],
        toolActions: [{
          name: action.type,
          input: {
            length: Number(action.length.toFixed(2)),
            width: Number(action.width.toFixed(2)),
            area: Math.round(action.area || area),
          },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: action.type === 'set_land_area' ? `Land set to ${formatArea(action.area)}` : `Land set to ${dimensionText}` })
      return true
    }

    if (action.type === 'set_demo_land') {
      const length = action.length || 55
      const width = action.width || 50
      const result = onSceneControl?.({ type: 'set_land_dimensions', length, width })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: `Done. I set up demo land at ${formatMeters(length)} x ${formatMeters(width)} (${formatArea(length * width)}) so we can start planning immediately.`,
        nextSteps: [
          { label: 'Demo land set', state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Tell me your goal or say make it better', state: 'current' },
        ],
        toolActions: [{
          name: 'set_demo_land',
          input: {
            source: 'text_command',
            length,
            width,
            area: Math.round(length * width),
            reason: result?.reason,
          },
          success: result !== false,
        }],
      }])
      onVisualHandoff?.({ toast: action.toast || 'Demo land ready' })
      return true
    }

    if (action.type === 'offer_structure_layout_options') {
      pendingStructureLayoutRef.current = {
        structures: action.structures.map(structure => ({ ...structure })),
      }
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: formatVisualPlanOffer(action.structures),
        nextSteps: [
          { label: 'Layout request understood', state: 'done' },
          { label: 'Visual plan options prepared', state: 'done' },
          { label: 'Choose an option or say do it', state: 'current' },
        ],
        toolActions: [{
          name: 'offer_structure_layout_options',
          input: buildVisualPlanOfferInput(action.structures),
          success: true,
        }],
        suggestedActions: getLayoutOptionActions(action.structures),
      }])
      return true
    }

    if (action.type === 'explain_last_layout_change') {
      const explanation = formatLastLayoutExplanation(messagesRef.current)
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: explanation.content,
        nextSteps: explanation.success ? [
          { label: 'Last layout reviewed', state: 'done' },
          { label: 'Tradeoff explained', state: 'done' },
          { label: 'Ask me to compare options if you want alternatives', state: 'current' },
        ] : [
          { label: 'Layout history checked', state: 'done' },
          { label: 'No layout change yet', state: 'current' },
        ],
        toolActions: [{
          name: 'explain_last_layout_change',
          input: explanation.input,
          success: explanation.success,
        }],
      }])
      return true
    }

    if (action.type === 'compare_layout_options') {
      const layoutStructures = pendingStructureLayoutRef.current?.structures?.length
        ? pendingStructureLayoutRef.current.structures
        : getAdvisorLayoutStructuresFromMessages(messagesRef.current)
      const recommendedAction = action.recommendationId && layoutStructures.length > 0
        ? [createLayoutOptionAction(action.recommendationId, layoutStructures)]
        : []

      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: formatLayoutComparison(action),
        nextSteps: [
          { label: 'Layout options compared', state: 'done' },
          { label: 'Tradeoffs explained', state: 'done' },
          { label: recommendedAction.length ? 'Apply the recommendation or ask another question' : 'Ask for a layout to apply this recommendation', state: 'current' },
        ],
        toolActions: [{
          name: 'compare_layout_options',
          input: {
            topic: action.topic,
            optionIds: action.optionIds,
            recommendationId: action.recommendationId,
            structureIds: layoutStructures.map(structure => structure.id),
            canApplyRecommendation: recommendedAction.length > 0,
          },
          success: true,
        }],
        suggestedActions: recommendedAction,
      }])
      return true
    }

    if (action.type === 'capture_project_goals') {
      const capturedGoals = getProjectGoalsByIds(action.goalIds)
      const previousGoals = getProjectGoalsFromMessages(messagesRef.current)
      const goalCapture = buildProjectGoalCapture({
        capturedGoals,
        previousGoals,
        placedBuildings,
        messages: messagesRef.current,
      })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: goalCapture.content,
        decision: goalCapture.decision,
        nextSteps: goalCapture.nextSteps,
        toolActions: [{
          name: 'capture_project_goals',
          input: goalCapture.toolInput,
          success: true,
        }],
        suggestedActions: goalCapture.suggestedActions,
      }])
      return true
    }

    if (action.type === 'clarify_or_act') {
      const response = buildClarifyOrAct({
        hasLand,
        dimensions,
        landArea,
        shapeMode,
        confirmedPolygon,
        placedBuildings,
        generatedBuildings,
        walls,
        rooms,
        activeComparisons,
        messages: messagesRef.current,
      })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: response.content,
        decision: response.decision,
        nextSteps: response.nextSteps,
        toolActions: [{
          name: 'clarify_or_act',
          input: {
            intent: action.intent,
            ...response.toolInput,
          },
          success: true,
        }],
        suggestedActions: response.suggestedActions,
      }])
      return true
    }

    if (action.type === 'recommend_next_step') {
      const decision = buildAgentDecision({
        hasLand,
        dimensions,
        landArea,
        shapeMode,
        confirmedPolygon,
        placedBuildings,
        generatedBuildings,
        walls,
        rooms,
        activeComparisons,
        messages: messagesRef.current,
      })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: decision.content,
        decision: decision.decision,
        nextSteps: decision.nextSteps,
        toolActions: [{
          name: 'recommend_next_step',
          input: {
            intent: action.intent,
            ...decision.toolInput,
          },
          success: true,
        }],
        suggestedActions: decision.suggestedActions,
      }])
      return true
    }

    if (action.type === 'summarize_scene') {
      const summary = buildSceneSummary({
        hasLand,
        dimensions,
        landArea,
        shapeMode,
        confirmedPolygon,
        setbacksEnabled,
        setbackDistanceM,
        placedBuildings,
        generatedBuildings,
        walls,
        rooms,
        furnitureItems,
        activeComparisons,
        messages: messagesRef.current,
      })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: summary.content,
        nextSteps: summary.nextSteps,
        toolActions: [{
          name: 'summarize_scene',
          input: {
            intent: action.intent,
            ...summary.toolInput,
          },
          success: true,
        }],
        suggestedActions: summary.suggestedActions,
      }])
      return true
    }

    if (action.type === 'site_brief') {
      const brief = buildSiteBrief({
        hasLand,
        dimensions,
        landArea,
        shapeMode,
        confirmedPolygon,
        setbacksEnabled,
        setbackDistanceM,
        placedBuildings,
        generatedBuildings,
        walls,
        rooms,
        furnitureItems,
        activeComparisons,
        messages: messagesRef.current,
      })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: brief.content,
        decision: brief.decision,
        nextSteps: brief.nextSteps,
        toolActions: [{
          name: 'site_brief',
          input: {
            intent: action.intent,
            ...brief.toolInput,
          },
          success: true,
        }],
        suggestedActions: brief.suggestedActions,
      }])
      return true
    }

    if (action.type === 'apply_latest_layout_recommendation') {
      const layoutRecommendation = getLatestLayoutRecommendationAction(messagesRef.current)
      if (layoutRecommendation) {
        return applyStructureLayoutOption(layoutRecommendation.optionId, userMsg, layoutRecommendation.structures, {
          preferenceLabel: null,
        })
      }

      const visualPlanOffer = getLatestVisualPlanOfferAction(messagesRef.current)
      if (visualPlanOffer) {
        return applyStructureLayoutOption(visualPlanOffer.optionId, userMsg, visualPlanOffer.structures, {
          preferenceLabel: null,
        })
      }

      const agentRecommendation = getLatestAgentDecisionAction(messagesRef.current)
      if (agentRecommendation?.type === 'apply_structure_layout_option') {
        return applyStructureLayoutOption(agentRecommendation.optionId, userMsg, agentRecommendation.structures, {
          preferenceLabel: null,
        })
      }

      if (agentRecommendation?.type === 'handoff_to_scene') {
        setMessages(prev => [...prev, userMsg, {
          role: 'assistant',
          content: 'Done. I opened the prepared scene so you can review it visually.',
          nextSteps: [
            { label: 'Upload recommendation accepted', state: 'done' },
            { label: 'Scene opened', state: 'done' },
            { label: 'Review the plan in 3D', state: 'current' },
          ],
          toolActions: [{
            name: 'handoff_to_scene',
            input: {
              source: 'upload_follow_through',
              label: agentRecommendation.label,
            },
            success: true,
          }],
        }])
        onVisualHandoff?.(agentRecommendation)
        return true
      }

      if (agentRecommendation?.type === 'review_site_boundary') {
        const result = onSceneControl?.({ type: 'review_site_boundary', toast: agentRecommendation.toast })
        const opened = result?.ok !== false
        setMessages(prev => [...prev, userMsg, {
          role: 'assistant',
          content: opened
            ? 'Done. I opened the land boundary tools so you can review the uploaded site plan outline.'
            : 'I could not open the boundary review tools yet. Use the Land panel to check the uploaded site plan.',
          nextSteps: opened ? [
            { label: 'Upload recommendation accepted', state: 'done' },
            { label: 'Boundary tools opened', state: 'done' },
            { label: 'Adjust the outline if needed', state: 'current' },
          ] : [
            { label: 'Boundary review checked', state: 'done' },
            { label: 'Open Land panel manually', state: 'current' },
          ],
          toolActions: [{
            name: 'review_site_boundary',
            input: {
              source: 'upload_follow_through',
              reason: result?.reason,
            },
            success: opened,
          }],
        }])
        return true
      }

      if (agentRecommendation?.type === 'activate_comparison' && agentRecommendation.comparisonId) {
        const comparison = getComparisonById(agentRecommendation.comparisonId)
        if (comparison) {
          if (onSceneControl) {
            onSceneControl({ type: 'activate_comparison', comparisonId: comparison.id, toast: agentRecommendation.toast })
          } else {
            activateComparison?.(comparison.id)
          }
          setMessages(prev => [...prev, userMsg, {
            role: 'assistant',
            content: `Done. I added a ${comparison.name} to the land so the scale is visible immediately. It measures ${formatMeters(comparison.width)} x ${formatMeters(comparison.length)}.`,
            nextSteps: [
              { label: `${comparison.displayName} added`, state: 'done' },
              { label: '3D scene opened', state: 'done' },
              { label: 'Drag or rotate to compare scale', state: 'current' },
            ],
            toolActions: [{
              name: 'activate_comparison',
              input: {
                objectId: comparison.id,
                objectName: comparison.name,
                width: comparison.width,
                length: comparison.length,
              },
              success: true,
            }],
          }])
          onVisualHandoff?.({ toast: agentRecommendation.toast || `${comparison.displayName} added • drag or rotate it to compare scale` })
          return true
        }
      }

      if (agentRecommendation?.type === 'set_demo_land') {
        const length = agentRecommendation.length || 55
        const width = agentRecommendation.width || 50
        const result = onSceneControl?.({ type: 'set_land_dimensions', length, width })
        setMessages(prev => [...prev, userMsg, {
          role: 'assistant',
          content: `Done. I set up demo land at ${formatMeters(length)} x ${formatMeters(width)} (${formatArea(length * width)}) so we can start planning immediately.`,
          nextSteps: [
            { label: 'Demo land set', state: 'done' },
            { label: '3D scene opened', state: 'done' },
            { label: 'Tell me your goal or say make it better', state: 'current' },
          ],
          toolActions: [{
            name: 'set_demo_land',
            input: {
              source: 'intake_follow_through',
              length,
              width,
              area: Math.round(length * width),
              reason: result?.reason,
            },
            success: result !== false,
          }],
        }])
        onVisualHandoff?.({ toast: agentRecommendation.toast || 'Demo land ready' })
        return true
      }

      if (agentRecommendation?.prompt) {
        const promptedAction = buildTextSceneAction(agentRecommendation.prompt, {
          landArea,
          generatedBuildings,
          selectedGeneratedBuildingId,
        })

        if (promptedAction?.type === 'offer_structure_layout_options') {
          pendingStructureLayoutRef.current = {
            structures: promptedAction.structures.map(structure => ({ ...structure })),
          }
          setMessages(prev => [...prev, userMsg, {
            role: 'assistant',
            content: formatVisualPlanOffer(promptedAction.structures, 'decision_follow_through'),
            nextSteps: [
              { label: 'Recommended move accepted', state: 'done' },
              { label: 'Visual plan options prepared', state: 'done' },
              { label: 'Choose an option or say do it', state: 'current' },
            ],
            toolActions: [{
              name: 'offer_structure_layout_options',
              input: buildVisualPlanOfferInput(promptedAction.structures, 'decision_follow_through'),
              success: true,
            }],
            suggestedActions: getLayoutOptionActions(promptedAction.structures),
          }])
          return true
        }

        if (promptedAction?.type === 'compare_layout_options') {
          const layoutStructures = pendingStructureLayoutRef.current?.structures?.length
            ? pendingStructureLayoutRef.current.structures
            : getAdvisorLayoutStructuresFromMessages(messagesRef.current)
          const recommendedAction = promptedAction.recommendationId && layoutStructures.length > 0
            ? [createLayoutOptionAction(promptedAction.recommendationId, layoutStructures)]
            : []

          setMessages(prev => [...prev, userMsg, {
            role: 'assistant',
            content: formatLayoutComparison(promptedAction),
            nextSteps: [
              { label: 'Recommended comparison opened', state: 'done' },
              { label: 'Tradeoffs explained', state: 'done' },
              { label: recommendedAction.length ? 'Apply the recommendation or ask another question' : 'Ask for a layout to apply this recommendation', state: 'current' },
            ],
            toolActions: [{
              name: 'compare_layout_options',
              input: {
                source: 'decision_follow_through',
                topic: promptedAction.topic,
                optionIds: promptedAction.optionIds,
                recommendationId: promptedAction.recommendationId,
                structureIds: layoutStructures.map(structure => structure.id),
                canApplyRecommendation: recommendedAction.length > 0,
              },
              success: true,
            }],
            suggestedActions: recommendedAction,
          }])
          return true
        }

        if (promptedAction?.type === 'apply_layout_preference') {
          return applyStructureLayoutOption(promptedAction.optionId, userMsg, [], {
            preferenceLabel: promptedAction.preferenceLabel,
          })
        }

        if (promptedAction?.type === 'explain_last_layout_change') {
          const explanation = formatLastLayoutExplanation(messagesRef.current)
          setMessages(prev => [...prev, userMsg, {
            role: 'assistant',
            content: explanation.content,
            nextSteps: explanation.success ? [
              { label: 'Recommended review opened', state: 'done' },
              { label: 'Tradeoff explained', state: 'done' },
              { label: 'Ask me to compare options if you want alternatives', state: 'current' },
            ] : [
              { label: 'Layout history checked', state: 'done' },
              { label: 'No layout change yet', state: 'current' },
            ],
            toolActions: [{
              name: 'explain_last_layout_change',
              input: {
                source: 'decision_follow_through',
                ...explanation.input,
              },
              success: explanation.success,
            }],
          }])
          return true
        }

        if (promptedAction?.type === 'general_fit_check' || promptedAction?.type === 'fit_around_generated_building') {
          setMessages(prev => [...prev, userMsg, {
            role: 'assistant',
            content: promptedAction.content,
            toolActions: [{
              name: promptedAction.type,
              input: {
                source: 'decision_follow_through',
                ...promptedAction.toolInput,
              },
              success: true,
            }],
            suggestedActions: promptedAction.suggestedActions,
          }])
          return true
        }
      }

      if (!agentRecommendation) {
        setMessages(prev => [...prev, userMsg, {
          role: 'assistant',
          content: 'I do not have a layout recommendation waiting yet. Ask me to compare layout options first, then you can say yes, do that, or apply it.',
          nextSteps: [
            { label: 'Recommendation checked', state: 'done' },
            { label: 'No pending recommendation', state: 'current' },
          ],
          toolActions: [{
            name: 'apply_latest_layout_recommendation',
            input: { reason: 'no_pending_recommendation' },
            success: false,
          }],
        }])
        return true
      }

      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: 'I found the recommendation, but it is not an action I can safely apply yet. Choose one of the visible options or ask me to compare layouts.',
        nextSteps: [
          { label: 'Recommendation checked', state: 'done' },
          { label: 'Manual choice needed', state: 'current' },
        ],
        toolActions: [{
          name: 'apply_latest_layout_recommendation',
          input: { reason: 'unsupported_agent_recommendation' },
          success: false,
        }],
      }])
      return true
    }

    if (action.type === 'apply_pending_layout_option') {
      return applyStructureLayoutOption(action.optionId, userMsg)
    }

    if (action.type === 'apply_layout_preference') {
      return applyStructureLayoutOption(action.optionId, userMsg, [], {
        preferenceLabel: action.preferenceLabel,
      })
    }

    if (action.type === 'activate_comparison') {
      const sceneAction = {
        type: 'activate_comparison',
        comparisonId: action.object.id,
        ...(action.placementMode ? { placementMode: action.placementMode } : {}),
        ...(action.targetBuildingId ? { targetBuildingId: action.targetBuildingId } : {}),
        ...(action.targetSource ? { targetSource: action.targetSource } : {}),
      }
      const sceneResult = onSceneControl ? onSceneControl(sceneAction) : null
      if (!onSceneControl) {
        activateComparison?.(action.object.id)
      }
      const placedAroundPlan = action.placementMode === 'around_generated_building'
      const placedNearPlan = placedAroundPlan && sceneResult?.placementStatus === 'placed'
      const placementCopy = placedAroundPlan
        ? placedNearPlan
          ? ` I placed it beside ${sceneResult.targetLabel || 'the uploaded plan'} so the comparison starts in context.`
          : ' I added it to the land; I could not find a clear beside-plan spot, so you can drag it into position.'
        : ''
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: `Done. I added a ${action.object.name} to the land so the scale is visible immediately. It measures ${formatMeters(action.object.width)} x ${formatMeters(action.object.length)}.${placementCopy}`,
        nextSteps: [
          { label: `${action.object.displayName} added`, state: 'done' },
          { label: placedNearPlan ? 'Placed beside uploaded plan' : '3D scene opened', state: 'done' },
          { label: 'Drag or rotate to compare scale', state: 'current' },
        ],
        toolActions: [{
          name: 'activate_comparison',
          input: {
            objectId: action.object.id,
            objectName: action.object.name,
            width: action.object.width,
            length: action.object.length,
            ...(action.placementMode ? { placementMode: action.placementMode } : {}),
            ...(sceneResult?.buildingId || action.targetBuildingId ? { buildingId: sceneResult?.buildingId || action.targetBuildingId } : {}),
            ...(sceneResult?.targetSource || action.targetSource ? { targetSource: sceneResult?.targetSource || action.targetSource } : {}),
            ...(sceneResult?.position ? { position: sceneResult.position } : {}),
            ...(sceneResult?.placementStatus ? { placementStatus: sceneResult.placementStatus } : {}),
          },
          success: sceneResult?.ok !== false,
        }],
      }])
      onVisualHandoff?.({ toast: action.toast || `${action.object.displayName} added • drag or rotate it to compare scale` })
      return true
    }

    if (action.type === 'undo_agent_structure_change') {
      const result = onSceneControl?.({ type: 'undo_agent_structure_change' })
      const undone = result?.ok === true
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: undone
          ? 'Done. I undid the last agent layout change. Uploaded floor-plan buildings, comparisons, walls, rooms, and land dimensions were left alone.'
          : `There is nothing to undo yet. ${result?.message || 'Ask me to place or adjust a layout first, then I can roll back that agent change.'}`,
        nextSteps: undone ? [
          { label: 'Last agent change undone', state: 'done' },
          { label: 'Other scene data preserved', state: 'done' },
          { label: 'Ask for another layout or adjustment', state: 'current' },
        ] : [
          { label: 'Undo checked', state: 'done' },
          { label: 'No agent history yet', state: 'current' },
        ],
        toolActions: [{
          name: 'undo_agent_structure_change',
          input: {
            restoredCount: result?.restoredCount || 0,
            reason: result?.reason,
          },
          success: undone,
        }],
      }])
      onVisualHandoff?.({ toast: undone ? 'Agent change undone' : 'Nothing to undo' })
      return true
    }

    if (action.type === 'retry_structure_layout') {
      const result = onSceneControl?.({ type: 'retry_structure_layout' })
      const placed = Array.isArray(result?.placed) ? result.placed : []
      const skipped = Array.isArray(result?.skipped) ? result.skipped : []
      const retried = result?.ok === true && placed.length > 0
      const placedNames = formatStructureNameList(placed.map(item => item.name))
      const skippedNames = formatStructureNameList(skipped.map(item => item.name))
      const partialCopy = skipped.length > 0
        ? ` I still could not safely fit ${skippedNames} without breaking the buildable area.`
        : ''
      const fallbackCount = placed.filter(item => item.placementMode === 'fallback').length
      const fallbackCopy = fallbackCount > 0
        ? ` I used a safe fallback spot for ${fallbackCount} item${fallbackCount === 1 ? '' : 's'} where needed.`
        : ''

      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: retried
          ? `Done. I tried another safe layout with ${placedNames}.${partialCopy}${fallbackCopy} The uploaded plans, comparisons, walls, rooms, and land dimensions were left alone.`
          : `I could not try another layout yet. ${result?.message || 'Ask me to create a starter layout first, then say "try again".'}`,
        nextSteps: retried ? [
          { label: 'Alternate layout placed', state: 'done' },
          { label: 'Safety rules checked', state: 'done' },
          { label: 'Say undo that if you prefer the previous layout', state: 'current' },
        ] : [
          { label: 'Retry checked', state: 'done' },
          { label: 'No alternate layout available', state: 'current' },
        ],
        toolActions: [{
          name: 'retry_structure_layout',
          input: {
            layoutVariant: result?.layoutVariant,
            placedCount: placed.length,
            skippedCount: skipped.length,
            skippedNames: skipped.map(item => item.name),
            fallbackCount,
            placements: placed.map(item => ({
              structureId: item.structureId,
              structureName: item.name,
              role: item.role,
              placementMode: item.placementMode,
              x: Number(item.position?.x?.toFixed?.(2) ?? item.position?.x ?? 0),
              z: Number(item.position?.z?.toFixed?.(2) ?? item.position?.z ?? 0),
            })),
            reason: result?.reason,
          },
          success: retried,
        }],
      }])
      onVisualHandoff?.({ toast: retried ? 'Tried another layout' : 'No alternate layout yet' })
      return true
    }

    if (action.type === 'move_structure') {
      const result = onSceneControl?.({
        type: 'move_structure',
        structureId: action.structure?.id || null,
        referenceStructureId: action.referenceStructure?.id || null,
        direction: action.direction,
        distanceM: action.distanceM,
      })
      const moved = result?.ok === true
      const structureName = result?.name || action.structure?.name || 'structure'
      const movementCopy = action.intentCopy || action.direction
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: moved
          ? `Done. I moved the ${structureName} ${movementCopy} and kept it inside the valid buildable area.`
          : `I could not move that structure safely. ${result?.message || 'I need a clear target structure and enough open space inside the boundary/setback rules.'}`,
        nextSteps: moved ? [
          { label: `${structureName} moved`, state: 'done' },
          { label: 'Placement rules checked', state: 'done' },
          { label: 'Ask for the next adjustment', state: 'current' },
        ] : [
          { label: 'Move checked', state: 'done' },
          { label: 'Adjustment blocked', state: 'current' },
        ],
        toolActions: [{
          name: 'move_structure',
          input: {
            structureId: action.structure?.id,
            structureName,
            direction: action.direction,
            distanceM: action.distanceM,
            intentLabel: action.intentLabel,
            intentCopy: action.intentCopy,
            x: Number(result?.position?.x?.toFixed?.(2) ?? result?.position?.x ?? 0),
            z: Number(result?.position?.z?.toFixed?.(2) ?? result?.position?.z ?? 0),
            reason: result?.reason,
          },
          success: moved,
        }],
      }])
      onVisualHandoff?.({ toast: moved ? `${structureName} moved` : 'Move blocked' })
      return true
    }

    if (action.type === 'rotate_structure') {
      const result = onSceneControl?.({
        type: 'rotate_structure',
        structureId: action.structure?.id || null,
        degrees: action.degrees,
      })
      const rotated = result?.ok === true
      const structureName = result?.name || action.structure?.name || 'structure'
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: rotated
          ? `Done. I rotated the ${structureName} ${Math.abs(action.degrees)} degrees and checked it still fits safely.`
          : `I could not rotate that structure safely. ${result?.message || 'It may overlap another structure or break the boundary/setback rules.'}`,
        nextSteps: rotated ? [
          { label: `${structureName} rotated`, state: 'done' },
          { label: 'Fit checked', state: 'done' },
          { label: 'Keep refining the layout', state: 'current' },
        ] : [
          { label: 'Rotation checked', state: 'done' },
          { label: 'Adjustment blocked', state: 'current' },
        ],
        toolActions: [{
          name: 'rotate_structure',
          input: {
            structureId: action.structure?.id,
            structureName,
            degrees: action.degrees,
            reason: result?.reason,
          },
          success: rotated,
        }],
      }])
      onVisualHandoff?.({ toast: rotated ? `${structureName} rotated` : 'Rotation blocked' })
      return true
    }

    if (
      action.type === 'select_generated_building' ||
      action.type === 'rotate_selected_generated_building' ||
      action.type === 'explode_selected_generated_building' ||
      action.type === 'deselect_selected_generated_building'
    ) {
      const labels = {
        select_generated_building: {
          action: 'selected',
          content: 'Done. I selected the uploaded floor-plan building.',
          toast: 'Floor-plan building selected',
        },
        rotate_selected_generated_building: {
          action: 'rotated',
          content: 'Done. I rotated the uploaded floor-plan building.',
          toast: 'Floor-plan building rotated',
        },
        explode_selected_generated_building: {
          action: 'made editable',
          content: 'Done. I turned the uploaded floor-plan building into editable walls.',
          toast: 'Building made editable',
        },
        deselect_selected_generated_building: {
          action: 'deselected',
          content: 'Done. I deselected the floor-plan building.',
          toast: 'Building deselected',
        },
      }
      const label = labels[action.type]
      const result = onSceneControl?.({ type: action.type, degrees: action.degrees })
      const success = result?.ok === true

      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: success
          ? (result?.message || label.content)
          : `${result?.message || 'Place or select an uploaded floor-plan building first.'} Then I can select it, rotate it, make it editable, or deselect it for you.`,
        nextSteps: success ? [
          { label: `Floor-plan building ${label.action}`, state: 'done' },
          { label: 'Scene updated', state: 'done' },
          { label: 'Ask for the next adjustment', state: 'current' },
        ] : [
          { label: 'Floor-plan building command understood', state: 'done' },
          { label: 'Place or select a floor-plan building first', state: 'current' },
        ],
        toolActions: [{
          name: action.type,
          input: {
            buildingId: result?.buildingId || null,
            targetSource: result?.targetSource || null,
            generatedBuildingCount: result?.generatedBuildingCount || generatedBuildings.length,
            degrees: action.degrees || null,
            reason: result?.reason,
          },
          success,
        }],
        suggestedActions: success ? getFloorPlanBuildingFollowUpActions() : undefined,
      }])

      if (success) {
        onVisualHandoff?.({ toast: result?.toast || label.toast })
      }
      return true
    }

    if (action.type === 'resize_structure' || action.type === 'replace_structure') {
      const result = onSceneControl?.({
        type: action.type,
        structureId: action.structure?.id || null,
        replacementStructureId: action.replacement.id,
      })
      const changed = result?.ok === true
      const oldName = result?.oldName || action.structure?.name || 'structure'
      const newName = result?.newName || action.replacement.name
      const verb = action.type === 'resize_structure' ? 'changed' : 'replaced'
      const successCopy = action.type === 'resize_structure'
        ? `I changed the ${oldName} to a ${newName}`
        : `I replaced the ${oldName} with a ${newName}`
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: changed
          ? `Done. ${successCopy} and checked the new footprint still fits safely.`
          : `I could not ${verb} that structure safely. ${result?.message || 'The new footprint may overlap another structure or break the boundary/setback rules.'}`,
        nextSteps: changed ? [
          { label: `${oldName} updated`, state: 'done' },
          { label: 'New footprint checked', state: 'done' },
          { label: 'Review it in 3D', state: 'current' },
        ] : [
          { label: 'New footprint checked', state: 'done' },
          { label: 'Adjustment blocked', state: 'current' },
        ],
        toolActions: [{
          name: action.type,
          input: {
            structureId: action.structure?.id,
            structureName: oldName,
            replacementStructureId: action.replacement.id,
            replacementStructureName: newName,
            reason: result?.reason,
          },
          success: changed,
        }],
      }])
      onVisualHandoff?.({ toast: changed ? `${oldName} updated` : 'Structure update blocked' })
      return true
    }

    if (action.type === 'place_structure_layout') {
      const result = onSceneControl?.({
        type: 'place_structure_layout',
        structures: action.structures.map(structure => ({ id: structure.id, role: structure.role })),
      })
      const placed = Array.isArray(result?.placed) ? result.placed : []
      const skipped = Array.isArray(result?.skipped) ? result.skipped : []
      const placedNames = formatStructureNameList(placed.map(item => item.name))
      const requestedNames = formatStructureNameList(action.structures.map(structure => structure.name))
      const skippedNames = formatStructureNameList(skipped.map(item => item.name))
      const success = placed.length > 0
      const partialCopy = skipped.length > 0
        ? ` I could not safely fit ${skippedNames} without overlapping another structure or breaking the boundary/setback rules.`
        : ''
      const fallbackCount = placed.filter(item => item.placementMode === 'fallback').length
      const fallbackCopy = fallbackCount > 0
        ? ` I used a safe fallback spot for ${fallbackCount} item${fallbackCount === 1 ? '' : 's'} where the natural role-aware position was blocked.`
        : ''

      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: success
          ? `Done. I placed a starter layout with ${placedNames}.${partialCopy}${fallbackCopy} The placed structures are real 3D buildings, so you can drag or adjust them in the scene.`
          : `I checked ${requestedNames}, but I could not place the starter layout safely on the current land without overlap or boundary/setback issues. Try clearing space or asking for a smaller layout.`,
        nextSteps: success ? [
          { label: `${placed.length} structure${placed.length === 1 ? '' : 's'} placed`, state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: skipped.length > 0 ? 'Adjust or ask for a smaller layout' : 'Drag or adjust if needed', state: 'current' },
        ] : [
          { label: 'Layout checked', state: 'done' },
          { label: 'No safe layout found', state: 'current' },
        ],
        toolActions: [{
          name: 'place_structure_layout',
          input: {
            structureIds: action.structures.map(structure => structure.id),
            structureNames: action.structures.map(structure => structure.name),
            placedCount: placed.length,
            skippedCount: skipped.length,
            skippedNames: skipped.map(item => item.name),
            fallbackCount,
            placements: placed.map(item => ({
              structureId: item.structureId,
              structureName: item.name,
              role: item.role,
              placementMode: item.placementMode,
              x: Number(item.position?.x?.toFixed?.(2) ?? item.position?.x ?? 0),
              z: Number(item.position?.z?.toFixed?.(2) ?? item.position?.z ?? 0),
            })),
          },
          success,
        }],
      }])
      onVisualHandoff?.({ toast: success ? 'Starter layout placed' : 'Starter layout could not be placed' })
      return true
    }

    if (action.type === 'place_structure') {
      const result = onSceneControl?.({ type: 'place_structure', structureId: action.structure.id })
      const placed = result?.ok !== false
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: placed
          ? `Done. I placed a ${action.structure.name} on the land at the first safe open spot. It measures ${formatMeters(action.structure.width)} x ${formatMeters(action.structure.length)} and is ready to drag or adjust in the scene.`
          : `I could not place the ${action.structure.name} safely on the current land without overlapping another structure or breaking the boundary/setback rules. Try a smaller structure or clear some space first.`,
        nextSteps: placed ? [
          { label: `${action.structure.displayName} placed`, state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Drag or adjust if needed', state: 'current' },
        ] : [
          { label: 'Safe placement checked', state: 'done' },
          { label: 'No open spot found', state: 'current' },
        ],
        toolActions: [{
          name: 'place_structure',
          input: {
            structureId: action.structure.id,
            structureName: action.structure.name,
            width: action.structure.width,
            length: action.structure.length,
            position: result?.position,
          },
          success: placed,
        }],
      }])
      onVisualHandoff?.({ toast: placed ? `${action.structure.displayName} placed` : `${action.structure.displayName} could not be placed` })
      return true
    }

    if (action.type === 'remove_comparison') {
      onSceneControl?.({ type: 'remove_comparison', comparisonId: action.object.id })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: `Done. I removed the ${action.object.name} from the scene.`,
        nextSteps: [
          { label: `${action.object.displayName} removed`, state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Ask for the next comparison', state: 'current' },
        ],
        toolActions: [{
          name: 'remove_comparison',
          input: { objectId: action.object.id, objectName: action.object.name },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: `${action.object.displayName} removed` })
      return true
    }

    if (action.type === 'remove_structure') {
      const result = onSceneControl?.({ type: 'remove_structure', structureId: action.structure.id })
      const removedCount = result?.removedCount || 0
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: removedCount > 0
          ? `Done. I removed ${removedCount === 1 ? `the ${action.structure.name}` : `${removedCount} ${action.structure.name} structures`} from the land.`
          : `I did not find a ${action.structure.name} structure on the land to remove.`,
        nextSteps: removedCount > 0 ? [
          { label: `${action.structure.displayName} removed`, state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Ask what to place next', state: 'current' },
        ] : undefined,
        toolActions: [{
          name: 'remove_structure',
          input: {
            structureId: action.structure.id,
            structureName: action.structure.name,
            removedCount,
          },
          success: removedCount > 0,
        }],
      }])
      onVisualHandoff?.({ toast: removedCount > 0 ? `${action.structure.displayName} removed` : `${action.structure.displayName} not found` })
      return true
    }

    if (action.type === 'replace_comparison') {
      onSceneControl?.({
        type: 'replace_comparison',
        fromComparisonId: action.fromObject.id,
        toComparisonId: action.toObject.id,
      })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: `Done. I replaced the ${action.fromObject.name} with a ${action.toObject.name}. The ${action.toObject.name} measures ${formatMeters(action.toObject.width)} x ${formatMeters(action.toObject.length)}.`,
        nextSteps: [
          { label: `${action.fromObject.displayName} removed`, state: 'done' },
          { label: `${action.toObject.displayName} added`, state: 'done' },
          { label: 'Review scale in 3D', state: 'current' },
        ],
        toolActions: [{
          name: 'replace_comparison',
          input: {
            fromObjectId: action.fromObject.id,
            fromObjectName: action.fromObject.name,
            toObjectId: action.toObject.id,
            toObjectName: action.toObject.name,
          },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: `${action.fromObject.displayName} replaced with ${action.toObject.displayName}` })
      return true
    }

    if (action.type === 'clear_comparisons') {
      onSceneControl?.({ type: 'clear_comparisons' })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: 'Done. I cleared the comparison objects from the land and opened the scene.',
        nextSteps: [
          { label: 'Comparison objects cleared', state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Ask what fits next', state: 'current' },
        ],
        toolActions: [{
          name: 'clear_comparisons',
          input: { scope: 'comparison_objects' },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: 'Comparison objects cleared' })
      return true
    }

    if (action.type === 'clear_structures') {
      const result = onSceneControl?.({ type: 'clear_structures' })
      const removedCount = result?.removedCount || 0
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: removedCount > 0
          ? `Done. I cleared ${removedCount} placed structure${removedCount === 1 ? '' : 's'} from the land. Uploaded floor-plan buildings and comparison objects were left alone.`
          : 'There were no manually placed structures to clear. Uploaded floor-plan buildings and comparison objects were left alone.',
        nextSteps: [
          { label: 'Placed structures checked', state: 'done' },
          { label: removedCount > 0 ? 'Structures cleared' : 'Nothing to clear', state: 'done' },
          { label: 'Ask what to place next', state: 'current' },
        ],
        toolActions: [{
          name: 'clear_structures',
          input: { scope: 'placed_structures', removedCount },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: removedCount > 0 ? 'Placed structures cleared' : 'No placed structures to clear' })
      return true
    }

    if (action.type === 'reset_comparison_transform') {
      onSceneControl?.({ type: 'reset_comparison_transform', comparisonId: action.object.id })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: `Done. I reset the ${action.object.name} position and rotation so it returns to the default comparison layout.`,
        toolActions: [{
          name: 'reset_comparison_transform',
          input: { objectId: action.object.id, objectName: action.object.name },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: `${action.object.displayName} reset` })
      return true
    }

    if (action.type === 'reset_all_comparison_transforms') {
      onSceneControl?.({ type: 'reset_all_comparison_transforms' })
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: 'Done. I reset all comparison object positions and rotations.',
        toolActions: [{
          name: 'reset_all_comparison_transforms',
          input: { scope: 'comparison_objects' },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: 'Comparison objects reset' })
      return true
    }

    setMessages(prev => [...prev, userMsg, {
      role: 'assistant',
      content: action.content,
      toolActions: action.toolInput ? [{
        name: action.type,
        input: action.toolInput,
        success: true,
      }] : undefined,
      suggestedActions: action.suggestedActions,
    }])
    return true
  }, [
    activateComparison,
    activeComparisons,
    applyStructureLayoutOption,
    confirmedPolygon,
    dimensions,
    furnitureItems,
    generatedBuildings,
    hasLand,
    landArea,
    onLandDimensionsUpdated,
    onSceneControl,
    onVisualHandoff,
    placedBuildings,
    rooms,
    setbackDistanceM,
    setbacksEnabled,
    selectedGeneratedBuildingId,
    shapeMode,
    walls,
  ])

  const sendMessage = useCallback(async (text, fileBase64 = null, fileMeta = {}) => {
    const messageText = text || ''
    if ((!messageText.trim() && !fileBase64) || isLoading) return

    // Route file uploads by plan type before using the paid floor-plan analyzer.
    if (fileBase64) {
      return routePlanUpload(fileBase64, messageText, fileMeta)
    }

    if (handleTextSceneAction(messageText)) {
      return
    }

    setError(null)
    setIsLoading(true)
    abortRef.current = false

    const apiContent = messageText

    // Add user message to UI
    const userMsg = { role: 'user', content: apiContent, displayText: messageText, hasImage: false }
    setMessages(prev => [...prev, userMsg])

    // Build API messages from ref (has all messages up to now) + the new user message
    const apiMessages = buildApiMessages([...messagesRef.current, userMsg])

    try {
      if (!supabase) throw new Error('Please sign in to use the AI assistant')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Please sign in to use the AI assistant')

      let currentMessages = apiMessages
      let iterations = 0

      while (iterations < MAX_TOOL_ITERATIONS) {
        if (abortRef.current) break
        iterations++

        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: currentMessages, sceneContext: buildSceneContext() }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || `API error ${response.status}`)
        }

        const data = await response.json()
        const { content, stop_reason } = data

        // Extract text and tool_use blocks
        const textBlocks = content.filter(b => b.type === 'text')
        const toolBlocks = content.filter(b => b.type === 'tool_use')

        if (stop_reason === 'end_turn' || toolBlocks.length === 0) {
          // Final text response — add to UI
          const assistantText = textBlocks.map(b => b.text).join('\n')
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: assistantText,
            apiContent: content,
          }])
          break
        }

        // Tool use — execute tools and continue the loop
        const toolActions = []
        const toolResults = []

        for (const tool of toolBlocks) {
          const result = executeTool(tool.name, tool.input)
          toolActions.push({
            name: tool.name,
            input: tool.input,
            success: result.success !== false,
          })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: JSON.stringify(result),
          })
        }

        // Add assistant message with tool actions to UI
        const assistantText = textBlocks.map(b => b.text).join('\n')
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: assistantText,
          toolActions,
          apiContent: content,
          toolResults,
        }])

        // Continue the conversation with tool results
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content },
          { role: 'user', content: toolResults },
        ]
      }
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, { role: 'assistant', content: '', error: err.message }])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, routePlanUpload, handleTextSceneAction, executeTool, buildApiMessages, buildSceneContext])

  const handleAction = useCallback((action) => {
    if (!action || isLoading) return

    if (action.type === 'activate_comparison' && action.comparisonId) {
      const sceneAction = {
        type: 'activate_comparison',
        comparisonId: action.comparisonId,
        toast: action.toast,
        ...(action.placementMode ? { placementMode: action.placementMode } : {}),
        ...(action.targetBuildingId ? { targetBuildingId: action.targetBuildingId } : {}),
        ...(action.targetSource ? { targetSource: action.targetSource } : {}),
      }
      const sceneResult = onSceneControl ? onSceneControl(sceneAction) : null
      if (!onSceneControl) {
        activateComparison?.(action.comparisonId)
      }
      const label = action.objectName || 'comparison object'
      const placedAroundPlan = action.placementMode === 'around_generated_building'
      const placedNearPlan = placedAroundPlan && sceneResult?.placementStatus === 'placed'
      const placementCopy = placedAroundPlan
        ? placedNearPlan
          ? ` I placed it beside ${sceneResult.targetLabel || 'the uploaded plan'} so you can compare scale in context.`
          : ' I added it to the land; I could not find a clear beside-plan spot, so you can drag it into position.'
        : ''
      setMessages(prev => [...prev, {
        role: 'user',
        content: action.label,
        displayText: action.label,
        hasImage: false,
      }, {
        role: 'assistant',
        content: `Done. I added the ${label} comparison to the land and opened the scene so you can inspect scale visually.${placementCopy}`,
        toolActions: [{
          name: 'activate_comparison',
          input: {
            objectId: action.comparisonId,
            objectName: label,
            ...(action.placementMode ? { placementMode: action.placementMode } : {}),
            ...(sceneResult?.buildingId || action.targetBuildingId ? { buildingId: sceneResult?.buildingId || action.targetBuildingId } : {}),
            ...(sceneResult?.targetSource || action.targetSource ? { targetSource: sceneResult?.targetSource || action.targetSource } : {}),
            ...(sceneResult?.position ? { position: sceneResult.position } : {}),
            ...(sceneResult?.placementStatus ? { placementStatus: sceneResult.placementStatus } : {}),
          },
          success: sceneResult?.ok !== false,
        }],
      }])
      if (action.handoff) {
        onVisualHandoff?.(action)
      }
      return
    }

    if (action.type === 'handoff_to_scene') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: action.label,
        displayText: action.label,
        hasImage: false,
      }, {
        role: 'assistant',
        content: 'Done. I opened the prepared scene so you can review it visually.',
      }])
      onVisualHandoff?.(action)
      return
    }

    if (action.type === 'review_site_boundary') {
      const result = onSceneControl?.({ type: 'review_site_boundary', toast: action.toast })
      const opened = result?.ok !== false
      setMessages(prev => [...prev, {
        role: 'user',
        content: action.label,
        displayText: action.label,
        hasImage: false,
      }, {
        role: 'assistant',
        content: opened
          ? 'Done. I opened the land boundary tools so you can review the uploaded site plan outline.'
          : 'I could not open the boundary review tools yet. Use the Land panel to check the uploaded site plan.',
      }])
      return
    }

    if (action.type === 'set_demo_land') {
      const length = action.length || 55
      const width = action.width || 50
      const result = onSceneControl?.({ type: 'set_land_dimensions', length, width })
      setMessages(prev => [...prev, {
        role: 'user',
        content: action.label,
        displayText: action.label,
        hasImage: false,
      }, {
        role: 'assistant',
        content: `Done. I set up demo land at ${formatMeters(length)} x ${formatMeters(width)} (${formatArea(length * width)}) so we can start planning immediately.`,
        nextSteps: [
          { label: 'Demo land set', state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Tell me your goal or say make it better', state: 'current' },
        ],
        toolActions: [{
          name: 'set_demo_land',
          input: {
            source: 'action_button',
            length,
            width,
            area: Math.round(length * width),
            reason: result?.reason,
          },
          success: result !== false,
        }],
      }])
      onVisualHandoff?.({ toast: action.toast || 'Demo land ready' })
      return
    }

    if (action.type === 'apply_structure_layout_option') {
      applyStructureLayoutOption(action.optionId, {
        role: 'user',
        content: action.label,
        displayText: action.label,
        hasImage: false,
      }, action.structures)
      return
    }

    if (action.prompt) {
      sendMessage(action.prompt)
    }
  }, [activateComparison, applyStructureLayoutOption, isLoading, onSceneControl, onVisualHandoff, sendMessage])

  const clearChat = useCallback(() => {
    setMessages([])
    setActiveProcess(null)
    setError(null)
  }, [])

  // Match pending labels to newly detected rooms
  useEffect(() => {
    if (pendingLabelsRef.current.length === 0 || rooms.length === 0) return
    const pending = [...pendingLabelsRef.current]
    pendingLabelsRef.current = []
    const newLabels = {}
    for (const { centerX, centerZ, label } of pending) {
      // Find the room whose center is closest to the expected center
      let bestRoom = null, bestDist = Infinity
      for (const room of rooms) {
        if (roomLabels[room.id]) continue // already labeled
        const dx = room.center.x - centerX
        const dz = room.center.z - centerZ
        const dist = dx * dx + dz * dz
        if (dist < bestDist) {
          bestDist = dist
          bestRoom = room
        }
      }
      if (bestRoom && bestDist < 4) { // within 2m tolerance
        newLabels[bestRoom.id] = label
      }
    }
    if (Object.keys(newLabels).length > 0) {
      setRoomLabels(prev => ({ ...prev, ...newLabels }))
    }
  }, [rooms, roomLabels, setRoomLabels])

  return { messages, isLoading, activeProcess, error, sendMessage, handleAction, clearChat }
}
