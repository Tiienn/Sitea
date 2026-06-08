import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertFloorPlanToWorld } from '../utils/floorPlanConverter'
import { analyzeImage } from '../services/imageAnalysis'

const MAX_TOOL_ITERATIONS = 5
const TENNIS_COURT = { id: 'tennisCourt', name: 'tennis court', width: 10.97, length: 23.77 }
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

function formatLayoutOptions() {
  return STRUCTURE_LAYOUT_OPTIONS
    .map(option => `- ${option.label.replace(':', ' -')}: ${option.summary}`)
    .join('\n')
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
  const isExplicitSelection = /\b(option\s*[123]|use|choose|select)\b/.test(normalizedText)
  if (/\b(option\s*1|use\s*1|choose\s*1|select\s*1|balanced|balance|simple|default|straightforward)\b/.test(normalizedText)) {
    return { optionId: 'balanced', preferenceLabel: isExplicitSelection ? null : 'balanced' }
  }
  if (/\b(option\s*3|use\s*3|choose\s*3|select\s*3|privacy|private|more private|secluded|seclusion|less exposed)\b/.test(normalizedText)) {
    return { optionId: 'privacy', preferenceLabel: isExplicitSelection ? null : 'more private' }
  }
  if (/\b(option\s*2|use\s*2|choose\s*2|select\s*2|backyard|open space|more space|more yard|open backyard|backyard open|outdoor space|garden space)\b/.test(normalizedText)) {
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

function createComparisonAction(object, label = `Show ${object.name} in 3D`) {
  return {
    type: 'activate_comparison',
    comparisonId: object.id,
    label,
    objectName: object.name,
    handoff: true,
    toast: `${object.displayName} added • drag or rotate it to compare scale`,
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

function buildTextSceneAction(text, { landArea }) {
  const normalizedText = normalizeCommand(text)
  const landDimensions = parseLandDimensionCommand(normalizedText)
  if (landDimensions) {
    return { type: 'set_land_dimensions', ...landDimensions }
  }

  const landAreaDimensions = parseLandAreaCommand(normalizedText)
  if (landAreaDimensions) {
    return { type: 'set_land_area', ...landAreaDimensions }
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

  const structureRefinement = parseStructureRefinementCommand(normalizedText)
  if (structureRefinement) {
    return structureRefinement
  }

  const structureLayout = getStructureLayoutFromCommand(normalizedText)
  if (structureLayout && (hasStructurePlaceIntent(normalizedText) || isStarterStructureLayoutRequest(normalizedText))) {
    return { type: 'offer_structure_layout_options', structures: structureLayout }
  }

  const layoutAdvisorRequest = parseLayoutAdvisorRequest(normalizedText)
  if (layoutAdvisorRequest) {
    return layoutAdvisorRequest
  }

  const layoutPreferenceSelection = parseLayoutPreferenceSelection(normalizedText)
  if (layoutPreferenceSelection) {
    return { type: 'apply_layout_preference', ...layoutPreferenceSelection }
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
  const analyzeFloorPlan = useCallback(async (fileBase64, text) => {
    setError(null)
    setIsLoading(true)
    setActiveProcess(FLOOR_PLAN_PROCESS)

    const userMsg = { role: 'user', content: text || 'Analyze my floor plan', displayText: text || 'Analyze my floor plan', hasImage: true }
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

      const data = await response.json()
      if (!response.ok || data.error) {
        throw new Error(data.error || `Analysis failed: ${response.status}`)
      }
      if (!data.walls || data.walls.length === 0) {
        throw new Error('No walls detected. Please try a clearer image.')
      }

      const result = convertFloorPlanToWorld(data)
      const { stats } = result
      const stairText = stats.stairCount ? `, and ${stats.stairCount} stair${stats.stairCount === 1 ? '' : 's'}` : ''
      const summary = `I found ${stats.wallCount} walls, ${stats.doorCount} doors, ${stats.windowCount} windows, ${stats.roomCount} rooms${stairText}.\n\nI prepared a 3D building preview from your plan. It is ready to review on the land. You decide the final placement; I will open the scene at the right view.`

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: summary,
        nextSteps: [
          { label: 'Plan geometry detected', state: 'done' },
          { label: '3D preview prepared', state: 'done' },
          { label: 'Review placement in 3D', state: 'current' },
        ],
        toolActions: [{
          name: 'analyze_floor_plan',
          input: stats,
          success: true,
        }],
        suggestedActions: [{
          type: 'handoff_to_scene',
          label: 'Place this in 3D',
          toast: 'Preview ready • click the land to place it • R to rotate',
        }],
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

    const displayText = text || `Review ${fileMeta?.fileName || 'my site plan'}`
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
      const confidenceText = detection?.confidence
        ? ` with ${Math.round(detection.confidence * 100)}% confidence`
        : ''
      const countLabel = fit.count === 1 ? 'Show 1 tennis court in 3D' : 'Show tennis court in 3D'
      const summary = `I read this as a site plan${confidenceText}.\n\n${fit.text}\n\nI prepared the land workspace from your uploaded plan. You can review the boundary when needed; first, I can add a tennis court comparison so the scale is visible immediately.`

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: summary,
        nextSteps: [
          { label: 'Site plan recognized', state: 'done' },
          { label: 'Land workspace prepared', state: 'done' },
          { label: 'Review scale in 3D', state: 'current' },
        ],
        toolActions: [{
          name: 'review_site_plan',
          input: {
            landArea: Math.round(landArea || 0),
            tennisCourtFit: fit.count,
            detectionType: detection?.type || 'site-plan',
          },
          success: true,
        }],
        suggestedActions: [{
          type: 'activate_comparison',
          comparisonId: TENNIS_COURT.id,
          label: countLabel,
          objectName: 'tennis court',
          handoff: true,
          toast: 'Tennis court added • drag or rotate it to compare scale',
        }],
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

    return analyzeFloorPlan(fileBase64, text)
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
    const action = buildTextSceneAction(messageText, { landArea })
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

    if (action.type === 'offer_structure_layout_options') {
      pendingStructureLayoutRef.current = {
        structures: action.structures.map(structure => ({ ...structure })),
      }
      const requestedNames = formatStructureNameList(action.structures.map(structure => structure.name))
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: `I can lay out ${requestedNames} three ways. Pick the direction that matches what you care about most:\n\n${formatLayoutOptions()}`,
        nextSteps: [
          { label: 'Layout request understood', state: 'done' },
          { label: 'Options prepared', state: 'done' },
          { label: 'Choose an option to place it', state: 'current' },
        ],
        toolActions: [{
          name: 'offer_structure_layout_options',
          input: {
            structureIds: action.structures.map(structure => structure.id),
            structureNames: action.structures.map(structure => structure.name),
            optionIds: STRUCTURE_LAYOUT_OPTIONS.map(option => option.id),
          },
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

    if (action.type === 'apply_pending_layout_option') {
      return applyStructureLayoutOption(action.optionId, userMsg)
    }

    if (action.type === 'apply_layout_preference') {
      return applyStructureLayoutOption(action.optionId, userMsg, [], {
        preferenceLabel: action.preferenceLabel,
      })
    }

    if (action.type === 'activate_comparison') {
      if (onSceneControl) {
        onSceneControl({ type: 'activate_comparison', comparisonId: action.object.id })
      } else {
        activateComparison?.(action.object.id)
      }
      setMessages(prev => [...prev, userMsg, {
        role: 'assistant',
        content: `Done. I added a ${action.object.name} to the land so the scale is visible immediately. It measures ${formatMeters(action.object.width)} x ${formatMeters(action.object.length)}.`,
        nextSteps: [
          { label: `${action.object.displayName} added`, state: 'done' },
          { label: '3D scene opened', state: 'done' },
          { label: 'Drag or rotate to compare scale', state: 'current' },
        ],
        toolActions: [{
          name: 'activate_comparison',
          input: {
            objectId: action.object.id,
            objectName: action.object.name,
            width: action.object.width,
            length: action.object.length,
          },
          success: true,
        }],
      }])
      onVisualHandoff?.({ toast: `${action.object.displayName} added • drag or rotate it to compare scale` })
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
  }, [activateComparison, applyStructureLayoutOption, landArea, onLandDimensionsUpdated, onSceneControl, onVisualHandoff])

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
      if (onSceneControl) {
        onSceneControl({ type: 'activate_comparison', comparisonId: action.comparisonId, toast: action.toast })
      } else {
        activateComparison?.(action.comparisonId)
      }
      const label = action.objectName || 'comparison object'
      setMessages(prev => [...prev, {
        role: 'user',
        content: action.label,
        displayText: action.label,
        hasImage: false,
      }, {
        role: 'assistant',
        content: `Done. I added the ${label} comparison to the land and opened the scene so you can inspect scale visually.`,
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
