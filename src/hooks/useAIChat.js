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

const formatMeters = (value) => Number.isFinite(value) ? `${value.toFixed(1)}m` : 'unknown'
const formatArea = (value) => Number.isFinite(value) ? `${Math.round(value)}m²` : 'the current land'
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

function getComparisonMatches(normalizedText) {
  const matches = []
  for (const object of TEXT_ACTION_COMPARISONS) {
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

function getComparisonFromCommand(normalizedText) {
  return getComparisonMatches(normalizedText)[0]?.object
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
  }, [activateComparison, landArea, onLandDimensionsUpdated, onSceneControl, onVisualHandoff])

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

    if (action.prompt) {
      sendMessage(action.prompt)
    }
  }, [activateComparison, isLoading, onSceneControl, onVisualHandoff, sendMessage])

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
