import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertFloorPlanToWorld } from '../utils/floorPlanConverter'
import { analyzeImage } from '../services/imageAnalysis'

const MAX_TOOL_ITERATIONS = 5
const TENNIS_COURT = { id: 'tennisCourt', name: 'tennis court', width: 10.97, length: 23.77 }

const formatMeters = (value) => Number.isFinite(value) ? `${value.toFixed(1)}m` : 'unknown'
const formatArea = (value) => Number.isFinite(value) ? `${Math.round(value)}m²` : 'the current land'

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
  isPaidUser = false,
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

  // Build scene context so Claude knows what's already placed
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
      const summary = `I found ${stats.wallCount} walls, ${stats.doorCount} doors, ${stats.windowCount} windows, ${stats.roomCount} rooms${stairText}.\n\nI prepared a 3D building preview from your plan. Next, click on the land to place it. Press R first if you want to rotate it.`

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: summary,
        nextSteps: [
          { label: 'Plan geometry detected', state: 'done' },
          { label: '3D preview prepared', state: 'done' },
          { label: 'Click the land to place it', state: 'current' },
        ],
        toolActions: [{
          name: 'analyze_floor_plan',
          input: stats,
          success: true,
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
      if (fileMeta?.imageData && onSitePlanUploaded) {
        onSitePlanUploaded(fileMeta.imageData)
      }

      const fit = getTennisCourtFit(landArea)
      const confidenceText = detection?.confidence
        ? ` with ${Math.round(detection.confidence * 100)}% confidence`
        : ''
      const countLabel = fit.count === 1 ? 'Show 1 tennis court' : 'Show tennis court comparison'
      const summary = `I read this as a site plan${confidenceText}.\n\n${fit.text}\n\nI opened the Land panel with your uploaded plan, so you can trace or confirm the boundary next. You can also compare the land against a tennis court to make the scale easier to feel.`

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: summary,
        nextSteps: [
          { label: 'Site plan recognized', state: 'done' },
          { label: 'Land panel opened', state: 'done' },
          { label: 'Trace boundary or compare scale', state: 'current' },
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
        }],
      }])
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, { role: 'assistant', content: '', error: err.message }])
    } finally {
      setActiveProcess(null)
      setIsLoading(false)
    }
  }, [landArea, onSitePlanUploaded])

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

  const sendMessage = useCallback(async (text, fileBase64 = null, fileMeta = {}) => {
    const messageText = text || ''
    if ((!messageText.trim() && !fileBase64) || isLoading) return

    // Route file uploads by plan type before using the paid floor-plan analyzer.
    if (fileBase64) {
      return routePlanUpload(fileBase64, messageText, fileMeta)
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
  }, [isLoading, routePlanUpload, executeTool, buildApiMessages, buildSceneContext])

  const handleAction = useCallback((action) => {
    if (!action || isLoading) return

    if (action.type === 'activate_comparison' && action.comparisonId) {
      activateComparison?.(action.comparisonId)
      const label = action.objectName || 'comparison object'
      setMessages(prev => [...prev, {
        role: 'user',
        content: action.label,
        displayText: action.label,
        hasImage: false,
      }, {
        role: 'assistant',
        content: `Done. I added the ${label} comparison to the land. You can drag it around or rotate it in the scene.`,
      }])
      return
    }

    if (action.prompt) {
      sendMessage(action.prompt)
    }
  }, [activateComparison, isLoading, sendMessage])

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
