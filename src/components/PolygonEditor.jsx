import { useRef, useState, useEffect, useCallback } from 'react'

// Calculate polygon area using shoelace formula
export function calculatePolygonArea(points) {
  if (points.length < 3) return 0
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area / 2)
}

// Calculate distance between two points
function distance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
}

// Calculate perimeter
export function calculatePerimeter(points) {
  if (points.length < 2) return 0
  let perimeter = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    perimeter += distance(points[i], points[j])
  }
  return perimeter
}

export default function PolygonEditor({ points, onChange, onComplete, onClear, onFullscreenDone, lengthUnit = 'm', fullscreen: fullscreenProp = false }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [history, setHistory] = useState([[]]) // History stack for undo/redo
  const [historyIndex, setHistoryIndex] = useState(0)
  const [mousePos, setMousePos] = useState(null) // For preview line
  const [shiftHeld, setShiftHeld] = useState(false) // For angle constraint
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapSize, setSnapSize] = useState(1) // Grid snap size in meters
  const [inputLength, setInputLength] = useState('') // For dimension input
  const [inputAngle, setInputAngle] = useState(0) // Angle in degrees (0 = East, 90 = North)
  const [draggingPoint, setDraggingPoint] = useState(null) // Index of point being dragged
  const [hoveredPoint, setHoveredPoint] = useState(null) // Index of hovered point
  const [zoom, setZoom] = useState(1) // Zoom level (0.5 to 4)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }) // Pan offset in world units
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isShapeComplete, setIsShapeComplete] = useState(false) // When shape is finished
  const [edgeLengthsExpanded, setEdgeLengthsExpanded] = useState(false) // Collapsed by default
  const [activeTab, setActiveTab] = useState('draw') // 'draw' | 'precision' | 'details'
  const [previewPaused, setPreviewPaused] = useState(false) // Pause preview line on right-click/Esc
  const [precisionMode, setPrecisionMode] = useState('table') // 'table' | 'quick'
  const [segments, setSegments] = useState([{ length: '', bearing: 90 }]) // For precision input
  const [quickText, setQuickText] = useState('') // For quick paste mode
  const [drawDimension, setDrawDimension] = useState('') // For type-and-click drawing
  const [nearFirstPoint, setNearFirstPoint] = useState(false) // Close shape indicator
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 200, height: 200 })
  const [isFullscreen, setIsFullscreen] = useState(false) // Internal fullscreen toggle

  // Use either prop or internal state for fullscreen
  const fullscreen = fullscreenProp || isFullscreen

  // Update canvas dimensions on resize for fullscreen mode
  useEffect(() => {
    if (!fullscreen) return
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCanvasDimensions({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [fullscreen])

  const baseScale = fullscreen ? 6 : 4 // Base scale: 4px = 1m (larger for fullscreen)
  const scale = baseScale * zoom // Actual scale with zoom applied
  const canvasSize = fullscreen ? Math.min(canvasDimensions.width, canvasDimensions.height) : 200
  const canvasWidth = fullscreen ? canvasDimensions.width : 200
  const canvasHeight = fullscreen ? canvasDimensions.height : 200
  const gridSize = Math.min(canvasWidth, canvasHeight) / 2 // Center at 0,0

  // Snap point to grid
  const snapToGrid = (point) => {
    if (!snapEnabled) return point
    return {
      x: Math.round(point.x / snapSize) * snapSize,
      y: Math.round(point.y / snapSize) * snapSize
    }
  }

  // Constrain angle to 0, 45, 90, etc.
  const constrainAngle = (fromPoint, toPoint) => {
    if (!shiftHeld || !fromPoint) return toPoint

    const dx = toPoint.x - fromPoint.x
    const dy = toPoint.y - fromPoint.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist === 0) return toPoint

    // Calculate angle and snap to nearest 45 degrees
    let angle = Math.atan2(dy, dx)
    const snapAngle = Math.PI / 4 // 45 degrees
    angle = Math.round(angle / snapAngle) * snapAngle

    return {
      x: fromPoint.x + Math.round(dist * Math.cos(angle)),
      y: fromPoint.y + Math.round(dist * Math.sin(angle))
    }
  }

  // Sync history when points change externally
  useEffect(() => {
    if (points.length === 0 && history[historyIndex]?.length > 0) {
      // Points were cleared externally
      setHistory([[]])
      setHistoryIndex(0)
    }
  }, [points])

  // Convert length for display
  const convertLength = (meters) => {
    if (lengthUnit === 'ft') return meters * 3.28084
    return meters
  }

  const formatLength = (meters) => {
    const value = convertLength(meters)
    return `${value.toFixed(1)}`
  }

  const convertToMeters = (value) => {
    if (lengthUnit === 'ft') return value / 3.28084
    return value
  }

  // Get direction label based on angle
  const getDirectionLabel = (angle) => {
    const normalized = ((angle % 360) + 360) % 360
    if (normalized >= 337.5 || normalized < 22.5) return 'E'
    if (normalized >= 22.5 && normalized < 67.5) return 'NE'
    if (normalized >= 67.5 && normalized < 112.5) return 'N'
    if (normalized >= 112.5 && normalized < 157.5) return 'NW'
    if (normalized >= 157.5 && normalized < 202.5) return 'W'
    if (normalized >= 202.5 && normalized < 247.5) return 'SW'
    if (normalized >= 247.5 && normalized < 292.5) return 'S'
    return 'SE'
  }

  // Calculate edge info (length and direction)
  const getEdgeInfo = (p1, p2) => {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    return { length, direction: getDirectionLabel(angle) }
  }

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    const gridStep = scale * 5
    for (let i = 0; i <= canvasWidth; i += gridStep) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvasHeight)
      ctx.stroke()
    }
    for (let j = 0; j <= canvasHeight; j += gridStep) {
      ctx.beginPath()
      ctx.moveTo(0, j)
      ctx.lineTo(canvasWidth, j)
      ctx.stroke()
    }

    // Draw axes
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, canvasHeight)
    ctx.moveTo(0, centerY)
    ctx.lineTo(canvasWidth, centerY)
    ctx.stroke()

    // Draw instruction text when empty
    if (points.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = fullscreen ? '16px sans-serif' : '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Click to add points', canvasWidth / 2, canvasHeight / 2)
    }

    // Helper to convert world coords to canvas coords (with pan offset)
    const toCanvasLocal = (p) => ({
      x: centerX + (p.x - panOffset.x) * scale,
      y: centerY - (p.y - panOffset.y) * scale // Flip Y
    })

    // Draw polygon
    if (points.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = '#4ade80'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.2)'
      ctx.lineWidth = 2

      const first = toCanvasLocal(points[0])
      ctx.moveTo(first.x, first.y)

      for (let i = 1; i < points.length; i++) {
        const p = toCanvasLocal(points[i])
        ctx.lineTo(p.x, p.y)
      }

      if (points.length >= 3) {
        ctx.closePath()
        ctx.fill()
      }
      ctx.stroke()

      // Draw segment lengths
      if (points.length >= 2) {
        ctx.font = '10px sans-serif'
        ctx.fillStyle = '#22d3ee'
        ctx.textAlign = 'center'
        for (let i = 0; i < points.length; i++) {
          const j = (i + 1) % points.length
          // Skip closing segment if not enough points
          if (points.length < 3 && j === 0) continue

          const p1 = toCanvasLocal(points[i])
          const p2 = toCanvasLocal(points[j])
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2
          const len = distance(points[i], points[j])

          // Draw background for text
          const text = formatLength(len)
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.fillRect(midX - 15, midY - 7, 30, 14)
          ctx.fillStyle = '#22d3ee'
          ctx.fillText(text, midX, midY + 3)
        }
      }

      // Draw points (larger for easier clicking)
      points.forEach((point, i) => {
        const p = toCanvasLocal(point)
        const isHovered = hoveredPoint === i
        const isDragged = draggingPoint === i
        const isFirstAndNear = i === 0 && nearFirstPoint && points.length >= 3

        // Pulsing ring for close indicator on first point
        if (isFirstAndNear) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 12, 0, Math.PI * 2)
          ctx.strokeStyle = '#14b8a6'
          ctx.lineWidth = 2
          ctx.setLineDash([3, 3])
          ctx.stroke()
          ctx.setLineDash([])
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, isHovered || isDragged ? 9 : 7, 0, Math.PI * 2)
        ctx.fillStyle = isDragged ? '#f59e0b' : (isFirstAndNear ? '#14b8a6' : (i === 0 ? '#22d3ee' : '#4ade80'))
        ctx.fill()
        ctx.strokeStyle = isHovered || isFirstAndNear ? '#fff' : 'rgba(255,255,255,0.7)'
        ctx.lineWidth = isHovered || isDragged ? 3 : 2
        ctx.stroke()

        // Show "Click to close" hint on first point
        if (isFirstAndNear) {
          ctx.font = '9px sans-serif'
          ctx.fillStyle = 'rgba(0,0,0,0.8)'
          ctx.fillRect(p.x - 28, p.y - 24, 56, 14)
          ctx.fillStyle = '#14b8a6'
          ctx.textAlign = 'center'
          ctx.fillText('Click to close', p.x, p.y - 14)
        }
        // Show coordinates on hover
        else if (isHovered && !isDragged) {
          const coordText = `(${point.x}, ${point.y})`
          ctx.font = '10px sans-serif'
          const textWidth = ctx.measureText(coordText).width
          ctx.fillStyle = 'rgba(0,0,0,0.8)'
          ctx.fillRect(p.x - textWidth/2 - 4, p.y - 22, textWidth + 8, 14)
          ctx.fillStyle = '#fff'
          ctx.textAlign = 'center'
          ctx.fillText(coordText, p.x, p.y - 12)
        }
      })

      // Draw corner angles when shape is closed (3+ points)
      if (points.length >= 3) {
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        points.forEach((point, i) => {
          const prev = points[(i - 1 + points.length) % points.length]
          const next = points[(i + 1) % points.length]

          // Calculate vectors
          const v1 = { x: prev.x - point.x, y: prev.y - point.y }
          const v2 = { x: next.x - point.x, y: next.y - point.y }

          // Calculate angle using dot product
          const dot = v1.x * v2.x + v1.y * v2.y
          const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
          const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
          const cosAngle = dot / (mag1 * mag2)
          const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)))
          const angleDeg = Math.round(angleRad * 180 / Math.PI)

          // Position angle text slightly inside the corner
          const p = toCanvasLocal(point)
          const centerX = (prev.x + point.x + next.x) / 3
          const centerY = (prev.y + point.y + next.y) / 3
          const offsetX = (centerX - point.x) * 0.4
          const offsetY = (centerY - point.y) * 0.4

          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillRect(p.x + offsetX * scale - 12, p.y - offsetY * scale - 6, 24, 12)
          ctx.fillStyle = '#fbbf24'
          ctx.fillText(`${angleDeg}°`, p.x + offsetX * scale, p.y - offsetY * scale + 3)
        })
      }
    }

    // Draw preview line (not when shape complete or preview paused)
    if (mousePos && points.length > 0 && draggingPoint === null && !isShapeComplete && !previewPaused) {
      const lastPoint = toCanvasLocal(points[points.length - 1])
      const previewPoint = toCanvasLocal(mousePos)

      // Dashed preview line
      ctx.beginPath()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = shiftHeld ? '#f59e0b' : '#22d3ee'
      ctx.lineWidth = 2
      ctx.moveTo(lastPoint.x, lastPoint.y)
      ctx.lineTo(previewPoint.x, previewPoint.y)
      ctx.stroke()
      ctx.setLineDash([])

      // Preview point
      ctx.beginPath()
      ctx.arc(previewPoint.x, previewPoint.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = shiftHeld ? '#f59e0b' : '#22d3ee'
      ctx.globalAlpha = 0.6
      ctx.fill()
      ctx.globalAlpha = 1

      // Preview distance - show typed dimension if entered, otherwise actual distance
      const previewDist = distance(points[points.length - 1], mousePos)
      const dim = parseFloat(drawDimension)
      const displayDist = dim > 0 ? (lengthUnit === 'ft' ? dim / 3.28084 : dim) : previewDist
      if (displayDist > 1) {
        const midX = (lastPoint.x + previewPoint.x) / 2
        const midY = (lastPoint.y + previewPoint.y) / 2
        const displayText = dim > 0 ? `${drawDimension}` : formatLength(previewDist)
        const textWidth = dim > 0 ? 36 : 30
        ctx.font = dim > 0 ? 'bold 11px sans-serif' : '10px sans-serif'
        ctx.fillStyle = dim > 0 ? 'rgba(20,184,166,0.9)' : 'rgba(0,0,0,0.7)'
        ctx.fillRect(midX - textWidth/2, midY - 8, textWidth, 16)
        ctx.fillStyle = dim > 0 ? '#fff' : (shiftHeld ? '#f59e0b' : '#22d3ee')
        ctx.textAlign = 'center'
        ctx.fillText(displayText, midX, midY + 4)

        // Show angle if shift held
        if (shiftHeld) {
          const dx = mousePos.x - points[points.length - 1].x
          const dy = mousePos.y - points[points.length - 1].y
          const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.fillRect(previewPoint.x + 10, previewPoint.y - 7, 30, 14)
          ctx.fillStyle = '#f59e0b'
          ctx.fillText(`${angle}°`, previewPoint.x + 25, previewPoint.y + 3)
        }
      }
    }
  }, [points, lengthUnit, mousePos, shiftHeld, hoveredPoint, draggingPoint, zoom, scale, panOffset, nearFirstPoint, drawDimension, isShapeComplete, previewPaused, canvasWidth, canvasHeight, fullscreen])

  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  const toWorld = (canvasX, canvasY) => ({
    x: Math.round((canvasX - centerX) / scale + panOffset.x),
    y: Math.round((centerY - canvasY) / scale + panOffset.y) // Flip Y
  })

  const toCanvas = (p) => ({
    x: centerX + (p.x - panOffset.x) * scale,
    y: centerY - (p.y - panOffset.y) * scale
  })

  // Find point near canvas coordinates (returns index or -1)
  const findPointNear = (canvasX, canvasY, threshold = 10) => {
    for (let i = 0; i < points.length; i++) {
      const p = toCanvas(points[i])
      const dist = Math.sqrt((canvasX - p.x) ** 2 + (canvasY - p.y) ** 2)
      if (dist < threshold) return i
    }
    return -1
  }

  // Find edge near canvas coordinates (returns edge index or -1)
  const findEdgeNear = (canvasX, canvasY, threshold = 12) => {
    if (points.length < 2) return -1
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      const p1 = toCanvas(points[i])
      const p2 = toCanvas(points[j])

      const A = canvasX - p1.x
      const B = canvasY - p1.y
      const C = p2.x - p1.x
      const D = p2.y - p1.y

      const dot = A * C + B * D
      const lenSq = C * C + D * D
      let t = lenSq !== 0 ? dot / lenSq : -1

      let xx, yy
      if (t < 0) { xx = p1.x; yy = p1.y }
      else if (t > 1) { xx = p2.x; yy = p2.y }
      else { xx = p1.x + t * C; yy = p1.y + t * D }

      const dist = Math.sqrt((canvasX - xx) ** 2 + (canvasY - yy) ** 2)
      if (dist < threshold && t >= 0 && t <= 1) return i
    }
    return -1
  }

  // Add point with history tracking
  const addPoint = useCallback((newPoint) => {
    const newPoints = [...points, newPoint]
    onChange(newPoints)
    // Add to history, truncate any redo states
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newPoints)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [points, onChange, history, historyIndex])

  // Mouse down - start dragging if on a point, or start panning with middle click
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Middle click = pan
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    const pointIndex = findPointNear(x, y)
    if (pointIndex !== -1) {
      setDraggingPoint(pointIndex)
      e.preventDefault() // Prevent text selection while dragging
    }
  }

  // Mouse up - stop dragging/panning, or add point if not dragging
  const handleMouseUp = (e) => {
    // Stop panning on middle click release
    if (e.button === 1) {
      setIsPanning(false)
      return
    }

    // Only process left-click for adding points
    if (e.button !== 0) return

    if (draggingPoint !== null) {
      // Save to history after drag
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push([...points])
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
      setDraggingPoint(null)
      return
    }

    // If panning or shape is complete, don't add points
    if (isPanning || isShapeComplete) return

    // Resume preview on click (in case it was paused)
    setPreviewPaused(false)

    // If not dragging, add a new point (click behavior)
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Don't add if clicking on existing point (except first point to close, or when dimension is set)
    const clickedPointIndex = findPointNear(x, y)
    const dim = parseFloat(drawDimension)

    // Check if clicking first point to close shape
    if (clickedPointIndex === 0 && points.length >= 3) {
      setIsShapeComplete(true)
      setMousePos(null)
      setNearFirstPoint(false)
      setPreviewPaused(true)
      setDrawDimension('')
      onComplete(points)
      return
    }

    // Skip point check if dimension is entered (we want to draw in a direction)
    if (clickedPointIndex !== -1 && !(dim > 0)) return

    let worldPoint = toWorld(x, y)

    // Apply angle constraint if shift is held
    if (points.length > 0) {
      worldPoint = constrainAngle(points[points.length - 1], worldPoint)
    }
    // Apply grid snap
    worldPoint = snapToGrid(worldPoint)

    // If dimension is entered, calculate point at exact dimension in click direction
    if (dim > 0 && points.length > 0) {
      const lastPoint = points[points.length - 1]
      const dx = worldPoint.x - lastPoint.x
      const dy = worldPoint.y - lastPoint.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0.1) {
        const dimInMeters = lengthUnit === 'ft' ? dim / 3.28084 : dim
        worldPoint = {
          x: lastPoint.x + (dx / dist) * dimInMeters,
          y: lastPoint.y + (dy / dist) * dimInMeters
        }
      }
    }

    // Check if this closes the shape (near first point)
    if (points.length >= 3 && nearFirstPoint) {
      setIsShapeComplete(true)
      setMousePos(null)
      setNearFirstPoint(false)
      setPreviewPaused(true)
      setDrawDimension('')
      onComplete(points)
      return
    }

    addPoint(worldPoint)

    // Clear dimension after adding point so user can type new number
    if (dim > 0) {
      setDrawDimension('')
    }
  }

  // Double click - delete point, add point on edge, or complete/reactivate shape
  const handleDoubleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if clicking on a point - delete it (don't reactivate preview)
    const pointIndex = findPointNear(x, y)
    if (pointIndex !== -1) {
      const newPoints = points.filter((_, i) => i !== pointIndex)
      onChange(newPoints)
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(newPoints)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
      return
    }

    // Check if clicking on an edge - add point there (don't reactivate preview)
    const edgeIndex = findEdgeNear(x, y)
    if (edgeIndex !== -1 && points.length >= 2) {
      const p1 = points[edgeIndex]
      const p2 = points[(edgeIndex + 1) % points.length]
      const midPoint = {
        x: Math.round((p1.x + p2.x) / 2),
        y: Math.round((p1.y + p2.y) / 2)
      }
      const newPoints = [...points]
      newPoints.splice(edgeIndex + 1, 0, midPoint)
      onChange(newPoints)
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(newPoints)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
      return
    }

    // If shape is already complete, reactivate drawing mode
    if (isShapeComplete) {
      setIsShapeComplete(false)
      return
    }

    // Otherwise complete shape
    if (points.length >= 3) {
      setIsShapeComplete(true)
      setMousePos(null)
      onComplete(points)
    }
  }

  const handleClear = () => {
    onChange([])
    setHistory([[]])
    setHistoryIndex(0)
    setIsShapeComplete(false)
    setNearFirstPoint(false)
    setDrawDimension('')
    onClear?.()
  }

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
    } else if (points.length > 0) {
      // Fallback: just remove last point
      onChange(points.slice(0, -1))
    }
  }, [historyIndex, history, onChange, points])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
    }
  }, [historyIndex, history, onChange])

  // Escape handler in capture phase — always fires before bubble-phase handlers (App.jsx, Onboarding)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (isFullscreen) {
        setIsFullscreen(false)
        e.stopImmediatePropagation()
        return
      }
      // Only consume the event if there's active drawing state to cancel
      if (drawDimension || !previewPaused) {
        setDrawDimension('')
        setPreviewPaused(true)
        setMousePos(null)
        e.stopImmediatePropagation()
      }
    }
    document.addEventListener('keydown', handleEscape, true) // capture phase
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [isFullscreen, drawDimension, previewPaused])

  // Keyboard shortcuts and shift tracking
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Track shift key
      if (e.key === 'Shift') {
        setShiftHeld(true)
      }

      // Only handle shortcuts if no input is focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

      // Number keys update dimension directly (works on all tabs)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        setDrawDimension(prev => prev + e.key)
        return
      }

      // Period for decimal
      if (e.key === '.' && !drawDimension.includes('.')) {
        e.preventDefault()
        setDrawDimension(prev => prev + '.')
        return
      }

      // Backspace removes last character from dimension
      if (e.key === 'Backspace' && drawDimension) {
        e.preventDefault()
        setDrawDimension(prev => prev.slice(0, -1))
        return
      }

      // Spacebar confirms point when dimension is typed
      if (e.key === ' ' && drawDimension && mousePos && points.length > 0) {
        e.preventDefault()
        const dim = parseFloat(drawDimension)
        if (dim > 0) {
          const lastPoint = points[points.length - 1]
          const dx = mousePos.x - lastPoint.x
          const dy = mousePos.y - lastPoint.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 0.1) {
            const dimInMeters = lengthUnit === 'ft' ? dim / 3.28084 : dim
            const newPoint = {
              x: lastPoint.x + (dx / dist) * dimInMeters,
              y: lastPoint.y + (dy / dist) * dimInMeters
            }
            addPoint(newPoint)
            setDrawDimension('')
          }
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          handleRedo()
        } else {
          e.preventDefault()
          handleUndo()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setShiftHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleUndo, handleRedo, drawDimension, mousePos, points, lengthUnit, addPoint, isFullscreen])

  // Mouse move handler for preview line, dragging, panning, and hover
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Handle panning
    if (isPanning) {
      const dx = (e.clientX - panStart.x) / scale
      const dy = (e.clientY - panStart.y) / scale
      setPanOffset(prev => ({ x: prev.x - dx, y: prev.y + dy }))
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Handle dragging
    if (draggingPoint !== null) {
      let worldPoint = toWorld(x, y)
      worldPoint = snapToGrid(worldPoint)

      const newPoints = [...points]
      newPoints[draggingPoint] = worldPoint
      onChange(newPoints)
      return
    }

    // Check for hover
    const hoverIndex = findPointNear(x, y)
    setHoveredPoint(hoverIndex !== -1 ? hoverIndex : null)

    // Preview line - only show if shape is not complete and preview not paused
    if (!isShapeComplete && !previewPaused) {
      let worldPoint = toWorld(x, y)
      if (points.length > 0) {
        worldPoint = constrainAngle(points[points.length - 1], worldPoint)
      }
      worldPoint = snapToGrid(worldPoint)

      // If dimension is entered, calculate point at exact dimension in click direction
      const dim = parseFloat(drawDimension)
      if (dim > 0 && points.length > 0) {
        const lastPoint = points[points.length - 1]
        const dx = worldPoint.x - lastPoint.x
        const dy = worldPoint.y - lastPoint.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0.1) {
          const dimInMeters = lengthUnit === 'ft' ? dim / 3.28084 : dim
          worldPoint = {
            x: lastPoint.x + (dx / dist) * dimInMeters,
            y: lastPoint.y + (dy / dist) * dimInMeters
          }
        }
      }

      setMousePos(worldPoint)

      // Check proximity to first point for close indicator
      if (points.length >= 3) {
        const firstPoint = points[0]
        const distToFirst = Math.sqrt(
          Math.pow(worldPoint.x - firstPoint.x, 2) +
          Math.pow(worldPoint.y - firstPoint.y, 2)
        )
        setNearFirstPoint(distToFirst < 3) // Within 3 meters
      } else {
        setNearFirstPoint(false)
      }
    }
  }

  const handleMouseLeave = () => {
    setMousePos(null)
    setHoveredPoint(null)
    setIsPanning(false)
    if (draggingPoint !== null) {
      setDraggingPoint(null)
    }
  }

  // Wheel handler for zoom
  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)))
  }

  // Add point at exact distance and angle
  const handleAddPointByInput = () => {
    const len = parseFloat(inputLength)
    if (isNaN(len) || len <= 0) return

    // Convert input length to meters if needed
    const lengthInMeters = lengthUnit === 'ft' ? len / 3.28084 : len

    // Calculate new point position
    const angleRad = (inputAngle * Math.PI) / 180
    let newPoint

    if (points.length === 0) {
      // First point at origin + offset
      newPoint = {
        x: Math.round(lengthInMeters * Math.cos(angleRad)),
        y: Math.round(lengthInMeters * Math.sin(angleRad))
      }
    } else {
      const lastPoint = points[points.length - 1]
      newPoint = {
        x: Math.round(lastPoint.x + lengthInMeters * Math.cos(angleRad)),
        y: Math.round(lastPoint.y + lengthInMeters * Math.sin(angleRad))
      }
    }

    addPoint(newPoint)
    setInputLength('') // Clear input after adding
  }

  // Direction presets (degrees)
  const setDirection = (dir) => {
    const angles = { N: 90, E: 0, S: 270, W: 180, NE: 45, SE: 315, SW: 225, NW: 135 }
    setInputAngle(angles[dir] || 0)
  }

  // Precision input helpers
  const directionToBearing = (dir) => {
    const bearings = { N: 90, NE: 45, E: 0, SE: 315, S: 270, SW: 225, W: 180, NW: 135 }
    return bearings[dir.toUpperCase()] ?? 0
  }

  const bearingToDirection = (bearing) => {
    const normalized = ((bearing % 360) + 360) % 360
    if (normalized >= 337.5 || normalized < 22.5) return 'E'
    if (normalized >= 22.5 && normalized < 67.5) return 'NE'
    if (normalized >= 67.5 && normalized < 112.5) return 'N'
    if (normalized >= 112.5 && normalized < 157.5) return 'NW'
    if (normalized >= 157.5 && normalized < 202.5) return 'W'
    if (normalized >= 202.5 && normalized < 247.5) return 'SW'
    if (normalized >= 247.5 && normalized < 292.5) return 'S'
    return 'SE'
  }

  const addSegment = () => {
    setSegments([...segments, { length: '', bearing: 90 }])
  }

  const updateSegment = (index, field, value) => {
    const updated = [...segments]
    updated[index] = { ...updated[index], [field]: value }
    setSegments(updated)
  }

  const removeSegment = (index) => {
    if (segments.length > 1) {
      setSegments(segments.filter((_, i) => i !== index))
    }
  }

  const getSegmentsPerimeter = () => {
    return segments.reduce((sum, seg) => sum + (parseFloat(seg.length) || 0), 0)
  }

  const parseQuickText = () => {
    const parsed = []
    const lines = quickText.split(/[,\n]+/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      let match
      // Pattern: "15m N" or "15 N" or "15m NE"
      match = trimmed.match(/^([\d.]+)\s*m?\s*(N|NE|E|SE|S|SW|W|NW)$/i)
      if (match) {
        parsed.push({ length: match[1], bearing: directionToBearing(match[2]) })
        continue
      }
      // Pattern: "N 15m" or "N 15"
      match = trimmed.match(/^(N|NE|E|SE|S|SW|W|NW)\s*([\d.]+)\s*m?$/i)
      if (match) {
        parsed.push({ length: match[2], bearing: directionToBearing(match[1]) })
        continue
      }
      // Pattern: "15m 90°" or "15 90"
      match = trimmed.match(/^([\d.]+)\s*m?\s*([\d.]+)°?$/)
      if (match) {
        parsed.push({ length: match[1], bearing: parseFloat(match[2]) })
        continue
      }
    }

    if (parsed.length > 0) {
      setSegments([...segments.filter(s => s.length), ...parsed])
      setQuickText('')
      setPrecisionMode('table')
    }
  }

  const convertSegmentsToPoints = () => {
    const validSegments = segments.filter(s => parseFloat(s.length) > 0)
    if (validSegments.length < 2) return

    const newPoints = []
    let x = 0, y = 0
    newPoints.push({ x: 0, y: 0 })

    for (const seg of validSegments) {
      const len = lengthUnit === 'ft' ? parseFloat(seg.length) / 3.28084 : parseFloat(seg.length)
      const angleRad = (seg.bearing * Math.PI) / 180
      x += Math.round(len * Math.cos(angleRad))
      y += Math.round(len * Math.sin(angleRad))
      newPoints.push({ x, y })
    }

    // Remove last point if it's close to first (auto-close)
    if (newPoints.length > 3) {
      const last = newPoints[newPoints.length - 1]
      const first = newPoints[0]
      if (Math.abs(last.x - first.x) < 2 && Math.abs(last.y - first.y) < 2) {
        newPoints.pop()
      }
    }

    onChange(newPoints)
    setHistory([[]])
    setHistory(prev => [...prev, newPoints])
    setHistoryIndex(1)
    setIsShapeComplete(true)
    onComplete(newPoints)
  }

  // Preset shapes
  const applyPresetShape = (shapeType) => {
    let newPoints = []
    const size = snapSize * 4 // Use snap size to determine shape size

    switch (shapeType) {
      case 'rectangle':
        newPoints = [
          { x: -size, y: -size/2 },
          { x: size, y: -size/2 },
          { x: size, y: size/2 },
          { x: -size, y: size/2 }
        ]
        break
      case 'square':
        newPoints = [
          { x: -size, y: -size },
          { x: size, y: -size },
          { x: size, y: size },
          { x: -size, y: size }
        ]
        break
      case 'l-shape':
        newPoints = [
          { x: -size, y: -size },
          { x: 0, y: -size },
          { x: 0, y: 0 },
          { x: size, y: 0 },
          { x: size, y: size },
          { x: -size, y: size }
        ]
        break
      case 't-shape':
        newPoints = [
          { x: -size, y: size/2 },
          { x: -size/3, y: size/2 },
          { x: -size/3, y: -size/2 },
          { x: size/3, y: -size/2 },
          { x: size/3, y: size/2 },
          { x: size, y: size/2 },
          { x: size, y: size },
          { x: -size, y: size }
        ].map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))
        break
      default:
        return
    }

    onChange(newPoints)
    // Add to history
    const newHistory = [[]]
    newHistory.push(newPoints)
    setHistory(newHistory)
    setHistoryIndex(1)
  }

  const canUndo = historyIndex > 0 || points.length > 0
  const canRedo = historyIndex < history.length - 1

  // Calculate measurements
  const perimeter = calculatePerimeter(points)
  const area = calculatePolygonArea(points)

  // Section header component
  const SectionHeader = ({ children }) => (
    <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
      {children}
    </div>
  )

  // Divider component
  const Divider = () => (
    <div className="border-t border-white/10 my-3" />
  )

  // Fullscreen mode - fixed overlay with canvas
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-gray-900">
        <div ref={containerRef} className="w-full h-full relative">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onContextMenu={(e) => { e.preventDefault(); setPreviewPaused(true); setMousePos(null) }}
            className={`${
              isPanning ? 'cursor-grabbing' :
              draggingPoint !== null ? 'cursor-grabbing' :
              hoveredPoint !== null ? 'cursor-grab' : 'cursor-crosshair'
            }`}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Exit Fullscreen Button (top right) */}
          {!fullscreenProp && (
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-gray-800/80 backdrop-blur rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title="Exit Fullscreen (Esc)"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 14h6v6m10-10h-6V4m0 6l7-7M3 21l7-7" />
              </svg>
            </button>
          )}

          {/* Floating Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => setZoom(z => Math.min(z + 0.25, 4))}
              className="w-10 h-10 bg-gray-800/80 backdrop-blur rounded-lg flex items-center justify-center text-white hover:bg-gray-700 transition-colors"
            >
              +
            </button>
            <span className="text-center text-sm text-gray-400 bg-gray-800/80 backdrop-blur rounded-lg px-2 py-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
              className="w-10 h-10 bg-gray-800/80 backdrop-blur rounded-lg flex items-center justify-center text-white hover:bg-gray-700 transition-colors"
            >
              −
            </button>
          </div>

          {/* Floating Undo/Redo */}
          <div className="absolute top-4 left-4 flex gap-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="w-10 h-10 bg-gray-800/80 backdrop-blur rounded-lg flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="w-10 h-10 bg-gray-800/80 backdrop-blur rounded-lg flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
          </div>

          {/* Bottom toolbar with Done button */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            {/* Dimension input hint */}
            {drawDimension && (
              <div className="bg-gray-800/90 backdrop-blur px-4 py-2 rounded-lg text-sm text-gray-300">
                Length: <span className="text-teal-400 font-medium">{drawDimension}</span> {lengthUnit} → click direction
              </div>
            )}
            {/* Done button */}
            <button
              onClick={() => {
                if (onFullscreenDone) {
                  onFullscreenDone(points)
                } else {
                  onComplete(points)
                }
                setIsFullscreen(false)
              }}
              disabled={points.length < 3}
              className="px-20 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium transition-colors border border-teal-400/50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Canvas with overlay toolbar */}
      <div className="flex justify-center mb-3">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onContextMenu={(e) => { e.preventDefault(); setPreviewPaused(true); setMousePos(null) }}
            className={`rounded-lg border border-white/20 ${
              isPanning ? 'cursor-grabbing' :
              draggingPoint !== null ? 'cursor-grabbing' :
              hoveredPoint !== null ? 'cursor-grab' : 'cursor-crosshair'
            }`}
            style={{ width: canvasWidth, height: canvasHeight }}
          />

          {/* Undo/Redo - top right of canvas */}
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="w-7 h-7 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed rounded-md backdrop-blur-sm flex items-center justify-center transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="w-7 h-7 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed rounded-md backdrop-blur-sm flex items-center justify-center transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
            <div className="w-px h-4 bg-white/20 mx-0.5" />
            <button
              onClick={() => setIsFullscreen(true)}
              className="w-7 h-7 bg-black/50 hover:bg-black/70 rounded-md backdrop-blur-sm flex items-center justify-center transition-colors"
              title="Fullscreen"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>

          {/* Zoom/Snap toolbar - bottom of canvas */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
            <button
              onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
              className="w-5 h-5 text-xs hover:bg-white/20 rounded flex items-center justify-center"
            >−</button>
            <span className="text-[9px] text-white/70 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
              className="w-5 h-5 text-xs hover:bg-white/20 rounded flex items-center justify-center"
            >+</button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`px-1.5 py-0.5 text-[9px] rounded ${snapEnabled ? 'bg-teal-500/80 text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              {snapEnabled ? `${snapSize}${lengthUnit}` : 'Snap'}
            </button>
            {snapEnabled && (
              <select
                value={snapSize}
                onChange={(e) => setSnapSize(Number(e.target.value))}
                className="bg-transparent text-white text-[9px] outline-none cursor-pointer"
              >
                <option value="1" className="bg-[#1a1a2e]">1</option>
                <option value="5" className="bg-[#1a1a2e]">5</option>
                <option value="10" className="bg-[#1a1a2e]">10</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Compact Status Bar */}
      <div className="flex items-center justify-center gap-4 text-[11px] mb-3 px-2">
        <span className="text-white/50">
          <span className="text-white font-medium">{points.length}</span> pts
        </span>
        {points.length >= 2 && (
          <span className="text-white/50">
            <span className="text-teal-400 font-medium">{formatLength(perimeter)}</span> {lengthUnit}
          </span>
        )}
        {points.length >= 3 && (
          <span className="text-white/50">
            <span className="text-green-400 font-medium">{formatLength(area)}</span> {lengthUnit}²
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-white/5 rounded-lg p-1 mb-3 gap-1">
        {[
          { id: 'draw', label: 'Draw', icon: '✏️' },
          { id: 'precision', label: 'Precision', icon: '📐' },
          { id: 'details', label: 'Details', icon: '📋' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? 'bg-teal-500 text-white shadow-md'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Draw Tab */}
        {activeTab === 'draw' && (
          <div className="space-y-3">
            {/* Dimension Input - Type and Click */}
            <div className="bg-white/5 rounded-lg" style={{ padding: '12px 14px' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40">Length:</span>
                <input
                  type="number"
                  value={drawDimension}
                  onChange={(e) => setDrawDimension(e.target.value)}
                  placeholder="—"
                  className="w-16 px-2 py-1.5 text-sm text-center bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-teal-400 focus:bg-white/15 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur()
                    if (e.key === 'Escape') { setDrawDimension(''); e.target.blur() }
                  }}
                />
                <span className="text-[10px] text-white/40">{lengthUnit}</span>
                <span className="text-[10px] text-white/30 ml-auto">→ click direction</span>
              </div>
              {drawDimension && (
                <div className="text-[9px] text-teal-400 mt-1.5 text-center">
                  Click canvas in any direction to draw {drawDimension}{lengthUnit} line
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="text-[10px] text-white/40 text-center">
              {nearFirstPoint ? (
                <span className="text-teal-400">Click first point to close shape</span>
              ) : shiftHeld ? (
                <span className="text-teal-400">45° constraint active</span>
              ) : drawDimension ? (
                'Type dimension • Click direction • Click start to close'
              ) : (
                'Enter length above, then click direction'
              )}
            </div>

            {/* Quick Shapes */}
            <div style={{ marginTop: 8 }}>
              <SectionHeader>Quick Shapes</SectionHeader>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'rectangle', icon: '▭', label: 'Rect' },
                  { id: 'square', icon: '□', label: 'Square' },
                  { id: 'l-shape', icon: '⌐', label: 'L' },
                  { id: 't-shape', icon: '⊤', label: 'T' }
                ].map(shape => (
                  <button
                    key={shape.id}
                    onClick={() => applyPresetShape(shape.id)}
                    className="flex flex-col items-center gap-0.5 py-2 px-1 bg-white/5 hover:bg-teal-500/20 rounded-lg border border-white/10 hover:border-teal-500/50 transition-colors"
                    title={shape.label}
                  >
                    <span className="text-lg leading-none">{shape.icon}</span>
                    <span className="text-[9px] text-white/50">{shape.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Precision Tab */}
        {activeTab === 'precision' && (
          <div className="space-y-3">
            {/* Mode Toggle */}
            <div className="flex bg-white/5 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setPrecisionMode('table')}
                className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all ${
                  precisionMode === 'table'
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Table Entry
              </button>
              <button
                onClick={() => setPrecisionMode('quick')}
                className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all ${
                  precisionMode === 'quick'
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Quick Paste
              </button>
            </div>

            {precisionMode === 'table' ? (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-1 text-[9px] text-white/40 px-1">
                  <span className="col-span-1">#</span>
                  <span className="col-span-3">Length</span>
                  <span className="col-span-7">Bearing</span>
                  <span className="col-span-1"></span>
                </div>

                {/* Segment Rows */}
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {segments.map((segment, index) => (
                    <div key={index} className="grid grid-cols-12 gap-1 items-center">
                      {/* Row number */}
                      <span className="col-span-1 text-[10px] text-white/40">{index + 1}</span>

                      {/* Length input */}
                      <input
                        type="number"
                        value={segment.length}
                        onChange={(e) => updateSegment(index, 'length', e.target.value)}
                        placeholder="0"
                        className="col-span-3 px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded focus:outline-none focus:border-teal-400 focus:bg-white/10"
                        autoFocus={index === segments.length - 1}
                      />

                      {/* Bearing input + direction buttons */}
                      <div className="col-span-7 flex gap-1 items-center">
                        <input
                          type="number"
                          value={segment.bearing}
                          onChange={(e) => updateSegment(index, 'bearing', parseFloat(e.target.value) || 0)}
                          min="0"
                          max="359"
                          className="w-12 px-1.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded focus:outline-none focus:border-teal-400"
                        />
                        <span className="text-[10px] text-white/30">°</span>

                        {/* Compass preview mini */}
                        <div className="relative w-6 h-6 flex-shrink-0">
                          <div className="absolute inset-0 border border-white/20 rounded-full" />
                          <div
                            className="absolute top-1/2 left-1/2 w-0.5 h-2.5 bg-teal-400 origin-bottom rounded-full"
                            style={{ transform: `translate(-50%, -100%) rotate(${90 - segment.bearing}deg)` }}
                          />
                          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-teal-400 rounded-full -translate-x-1/2 -translate-y-1/2" />
                        </div>

                        {/* Quick direction buttons */}
                        <div className="flex gap-0.5 ml-auto">
                          {['N', 'E', 'S', 'W'].map(dir => (
                            <button
                              key={dir}
                              onClick={() => updateSegment(index, 'bearing', directionToBearing(dir))}
                              className={`w-5 h-5 text-[9px] font-medium rounded transition-colors ${
                                segment.bearing === directionToBearing(dir)
                                  ? 'bg-teal-500 text-white'
                                  : 'bg-white/5 text-white/50 hover:bg-white/10'
                              }`}
                            >
                              {dir}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeSegment(index)}
                        disabled={segments.length <= 1}
                        className="col-span-1 p-1 text-white/30 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Segment Button */}
                <button
                  onClick={addSegment}
                  className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/40 hover:border-teal-500/50 hover:text-teal-400 transition-colors text-xs"
                >
                  + Add Segment
                </button>

                {/* 8-Direction Quick Add */}
                <div>
                  <div className="text-[9px] text-white/40 mb-1.5">Quick add direction:</div>
                  <div className="grid grid-cols-8 gap-1">
                    {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map(dir => (
                      <button
                        key={dir}
                        onClick={() => setSegments([...segments, { length: '', bearing: directionToBearing(dir) }])}
                        className="py-1.5 text-[9px] font-medium bg-white/5 hover:bg-teal-500/20 rounded border border-white/10 hover:border-teal-500/50 transition-colors"
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="text-[10px] text-white/40 pt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
                  <span>{segments.filter(s => s.length).length} segments</span>
                  <span>•</span>
                  <span>Perimeter: <span className="text-teal-400">{formatLength(getSegmentsPerimeter())} {lengthUnit}</span></span>
                </div>

                {/* Apply Button */}
                <button
                  onClick={convertSegmentsToPoints}
                  disabled={segments.filter(s => parseFloat(s.length) > 0).length < 3}
                  className="w-full px-3 py-2.5 text-sm bg-teal-500 hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  Apply to Canvas
                </button>
              </>
            ) : (
              /* Quick Paste Mode */
              <>
                <p className="text-[10px] text-white/40">
                  Paste dimensions from survey (e.g., "15m N, 20m E")
                </p>

                <textarea
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder={"15m N\n20m E\n15m S\n20m W"}
                  className="w-full h-28 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs resize-none focus:outline-none focus:border-teal-400 focus:bg-white/10"
                />

                <button
                  onClick={parseQuickText}
                  disabled={!quickText.trim()}
                  className="w-full py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  Parse & Add
                </button>

                <p className="text-[9px] text-white/30">
                  Formats: "15m N", "N 15", "15 90°", "NE 20m"
                </p>
              </>
            )}
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-3">
            {/* Full Status */}
            <div className="bg-white/5 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Points</div>
                  <div className="text-sm font-medium text-white">{points.length}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Perimeter</div>
                  <div className="text-sm font-medium text-teal-400">
                    {points.length >= 2 ? `${formatLength(perimeter)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Area</div>
                  <div className="text-sm font-medium text-green-400">
                    {points.length >= 3 ? `${formatLength(area)}` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Edge Lengths */}
            {points.length >= 2 && (
              <div>
                <SectionHeader>Edge Lengths</SectionHeader>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {points.map((p, i) => {
                    if (points.length < 3 && i === points.length - 1) return null
                    const j = (i + 1) % points.length
                    const edgeInfo = getEdgeInfo(p, points[j])

                    return (
                      <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-md px-2 py-1.5">
                        <span className="text-[10px] text-white/40 w-5">#{i + 1}</span>
                        <span className="text-[10px] text-teal-400 w-6">{edgeInfo.direction}</span>
                        <input
                          type="number"
                          defaultValue={convertLength(edgeInfo.length).toFixed(1)}
                          key={`edge-${i}-${Math.round(edgeInfo.length * 100)}`}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => {
                            const newLength = parseFloat(e.target.value)
                            if (!isNaN(newLength) && newLength > 0) {
                              const lengthInMeters = convertToMeters(newLength)
                              const currentLength = edgeInfo.length
                              if (Math.abs(lengthInMeters - currentLength) > 0.01) {
                                const ratio = lengthInMeters / currentLength
                                const p1 = points[i]
                                const p2 = points[j]
                                const dx = p2.x - p1.x
                                const dy = p2.y - p1.y
                                const newP2 = {
                                  x: Math.round((p1.x + dx * ratio) * 2) / 2,
                                  y: Math.round((p1.y + dy * ratio) * 2) / 2
                                }
                                const newPoints = [...points]
                                newPoints[j] = newP2
                                onChange(newPoints)
                                const newHistory = history.slice(0, historyIndex + 1)
                                newHistory.push(newPoints)
                                setHistory(newHistory)
                                setHistoryIndex(newHistory.length - 1)
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur()
                          }}
                          className="flex-1 px-2 py-1 text-xs text-teal-400 bg-white/5 hover:bg-white/10 focus:bg-teal-500 focus:text-white rounded border border-white/10 focus:border-teal-400 outline-none transition-colors"
                          step="0.1"
                        />
                        <span className="text-[10px] text-white/40">{lengthUnit}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Action Buttons */}
      <div className="flex gap-2 mt-auto border-t border-white/10" style={{ paddingTop: 10 }}>
        <button
          onClick={handleClear}
          disabled={points.length === 0}
          className="flex-1 px-3 py-2.5 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-white/10 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => { setIsShapeComplete(true); setMousePos(null); onComplete(points) }}
          disabled={points.length < 3}
          className="flex-1 px-3 py-2.5 text-sm bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
