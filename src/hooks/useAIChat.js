import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertFloorPlanToWorld } from '../utils/floorPlanConverter'

const MAX_TOOL_ITERATIONS = 5

export function useAIChat({ addWallFromPoints, addFurniture, deleteFurniture, clearAllWalls, setFurnitureItems, walls, rooms, furnitureItems, roomLabels, setRoomLabels, onFloorPlanGenerated }) {
  const STORAGE_KEY = 'sitea-ai-chat'

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [isLoading, setIsLoading] = useState(false)
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
    if (parts.length === 0) parts.push('Scene is empty.')
    return parts.join('\n')
  }, [rooms, furnitureItems, roomLabels])

  // Handle floor plan file upload via the dedicated analyzer endpoint
  const analyzeFloorPlan = useCallback(async (fileBase64, text) => {
    setError(null)
    setIsLoading(true)

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
      const summary = `Detected ${stats.wallCount} walls, ${stats.doorCount} doors, ${stats.windowCount} windows, and ${stats.roomCount} rooms. Placing building now — click on your land to position it.`

      setMessages(prev => [...prev, { role: 'assistant', content: summary }])

      if (onFloorPlanGenerated) {
        onFloorPlanGenerated(result)
      }
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, { role: 'assistant', content: '', error: err.message }])
    } finally {
      setIsLoading(false)
    }
  }, [onFloorPlanGenerated])

  const sendMessage = useCallback(async (text, fileBase64 = null) => {
    if ((!text.trim() && !fileBase64) || isLoading) return

    // Route file uploads through the dedicated floor plan analyzer
    if (fileBase64) {
      return analyzeFloorPlan(fileBase64, text)
    }

    setError(null)
    setIsLoading(true)
    abortRef.current = false

    const apiContent = text

    // Add user message to UI
    const userMsg = { role: 'user', content: apiContent, displayText: text, hasImage: false }
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
  }, [isLoading, analyzeFloorPlan, executeTool, buildApiMessages, buildSceneContext])

  const clearChat = useCallback(() => {
    setMessages([])
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

  return { messages, isLoading, error, sendMessage, clearChat }
}
