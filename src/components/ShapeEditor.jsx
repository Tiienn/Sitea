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

// Check if two line segments intersect (excluding shared endpoints)
function segmentsIntersect(a1, a2, b1, b2) {
  if ((a1.x === b1.x && a1.y === b1.y) || (a1.x === b2.x && a1.y === b2.y) ||
      (a2.x === b1.x && a2.y === b1.y) || (a2.x === b2.x && a2.y === b2.y)) {
    return false
  }
  const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x)
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2)
}

// Check if polygon is self-intersecting
function isSelfIntersecting(points) {
  if (points.length < 4) return false
  for (let i = 0; i < points.length; i++) {
    const a1 = points[i]
    const a2 = points[(i + 1) % points.length]
    for (let j = i + 2; j < points.length; j++) {
      if (j === (i + points.length - 1) % points.length) continue
      const b1 = points[j]
      const b2 = points[(j + 1) % points.length]
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  return false
}

// Get direction label based on angle
function getDirectionLabel(angle) {
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

// Calculate edge info
function getEdgeInfo(p1, p2) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  return { length, direction: getDirectionLabel(angle), angle }
}

export default function ShapeEditor({
  points,
  onChange,
  onComplete,
  onReset,
  originalPoints,
  lengthUnit = 'm'
}) {
  const canvasRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }) // Pan offset in world units
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [draggingPoint, setDraggingPoint] = useState(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [isInvalid, setIsInvalid] = useState(false)
  const [edgeLengthsExpanded, setEdgeLengthsExpanded] = useState(true) // Always expanded in Edit
  const [matchAreaExpanded, setMatchAreaExpanded] = useState(false)
  const [targetArea, setTargetArea] = useState('')
  const [coordsExpanded, setCoordsExpanded] = useState(false)

  // Precision tools
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapSize, setSnapSize] = useState(1) // Grid snap size in meters
  const [shiftHeld, setShiftHeld] = useState(false) // For angle constraint

  // Undo/redo history
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoAction = useRef(false)

  const baseScale = 3
  const scale = baseScale * zoom
  const canvasSize = 220
  const gridSize = canvasSize / 2

  // Convert length for display
  const convertLength = (meters) => {
    if (lengthUnit === 'ft') return meters * 3.28084
    return meters
  }

  const convertToMeters = (value) => {
    if (lengthUnit === 'ft') return value / 3.28084
    return value
  }

  const formatLength = (meters) => {
    const value = convertLength(meters)
    return `${value.toFixed(1)}`
  }

  // Snap point to grid
  const snapToGrid = (point) => {
    if (!snapEnabled) return point
    return {
      x: Math.round(point.x / snapSize) * snapSize,
      y: Math.round(point.y / snapSize) * snapSize
    }
  }

  // Constrain angle to 0, 45, 90, etc. when shift is held
  const constrainAngle = (fromPoint, toPoint) => {
    if (!shiftHeld || !fromPoint) return toPoint
    const dx = toPoint.x - fromPoint.x
    const dy = toPoint.y - fromPoint.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) return toPoint
    // Snap to nearest 45 degrees
    let angle = Math.atan2(dy, dx)
    const snapAngle = Math.PI / 4
    angle = Math.round(angle / snapAngle) * snapAngle
    return {
      x: fromPoint.x + Math.round(dist * Math.cos(angle) * 2) / 2,
      y: fromPoint.y + Math.round(dist * Math.sin(angle) * 2) / 2
    }
  }

  // Initialize history on mount
  useEffect(() => {
    if (points && points.length >= 3 && history.length === 0) {
      setHistory([JSON.parse(JSON.stringify(points))])
      setHistoryIndex(0)
    }
  }, [])

  // Add to history when points change (but not from undo/redo)
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false
      return
    }
    if (points && points.length >= 3) {
      const currentState = JSON.stringify(points)
      const lastState = history[historyIndex] ? JSON.stringify(history[historyIndex]) : null
      if (currentState !== lastState) {
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(JSON.parse(currentState))
        // Limit history to 50 states
        if (newHistory.length > 50) newHistory.shift()
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
      }
    }
  }, [points])

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onChange(JSON.parse(JSON.stringify(history[newIndex])))
    }
  }, [historyIndex, history, onChange])

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onChange(JSON.parse(JSON.stringify(history[newIndex])))
    }
  }, [historyIndex, history, onChange])

  // Keyboard shortcuts and shift tracking
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Track shift key for angle constraint
      if (e.key === 'Shift') {
        setShiftHeld(true)
      }
      // Don't interfere if user is typing in an input
      if (e.target.tagName === 'INPUT') return
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
  }, [handleUndo, handleRedo])

  // Calculate bounding box
  const getBounds = useCallback(() => {
    if (!points || points.length === 0) return { minX: -25, maxX: 25, minY: -25, maxY: 25 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    points.forEach(p => {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    })
    const padX = (maxX - minX) * 0.2 || 10
    const padY = (maxY - minY) * 0.2 || 10
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY }
  }, [points])

  // Auto-fit zoom on mount
  useEffect(() => {
    if (points && points.length >= 3) {
      const bounds = getBounds()
      const rangeX = bounds.maxX - bounds.minX
      const rangeY = bounds.maxY - bounds.minY
      const maxRange = Math.max(rangeX, rangeY)
      const fitZoom = (canvasSize / maxRange) / baseScale
      setZoom(Math.max(0.25, Math.min(2, fitZoom * 0.8)))
      setPanOffset({ x: 0, y: 0 })
    }
  }, [])

  // Check for self-intersection
  useEffect(() => {
    setIsInvalid(isSelfIntersecting(points))
  }, [points])

  // Get center with pan offset
  const getCenter = useCallback(() => {
    const bounds = getBounds()
    return {
      x: (bounds.minX + bounds.maxX) / 2 + panOffset.x,
      y: (bounds.minY + bounds.maxY) / 2 + panOffset.y
    }
  }, [getBounds, panOffset])

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const center = getCenter()

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    const gridStep = scale * 5
    const offsetX = (gridSize - center.x * scale) % gridStep
    const offsetY = (gridSize + center.y * scale) % gridStep
    for (let i = offsetX; i <= canvasSize; i += gridStep) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvasSize)
      ctx.stroke()
    }
    for (let i = offsetY; i <= canvasSize; i += gridStep) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvasSize, i)
      ctx.stroke()
    }

    const toCanvas = (p) => ({
      x: gridSize + (p.x - center.x) * scale,
      y: gridSize - (p.y - center.y) * scale
    })

    if (!points || points.length < 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No shape to edit', canvasSize / 2, canvasSize / 2)
      return
    }

    // Polygon fill
    ctx.beginPath()
    ctx.fillStyle = isInvalid ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)'
    const first = toCanvas(points[0])
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < points.length; i++) {
      const p = toCanvas(points[i])
      ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.fill()

    // Edges
    ctx.strokeStyle = isInvalid ? '#ef4444' : '#4ade80'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < points.length; i++) {
      const p = toCanvas(points[i])
      ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.stroke()

    // Edge labels
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      const p1 = toCanvas(points[i])
      const p2 = toCanvas(points[j])
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      const len = distance(points[i], points[j])

      if (hoveredEdge === i) {
        ctx.strokeStyle = '#22d3ee'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        ctx.strokeStyle = isInvalid ? '#ef4444' : '#4ade80'
        ctx.lineWidth = 2
      }

      // Label background
      const text = formatLength(len)
      const textWidth = ctx.measureText(text).width

      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillRect(midX - textWidth/2 - 6, midY - 9, textWidth + 12, 18)
      ctx.fillStyle = '#22d3ee'
      ctx.fillText(text, midX, midY + 4)
    }

    // Points
    points.forEach((point, i) => {
      const p = toCanvas(point)
      const isHovered = hoveredPoint === i
      const isDragged = draggingPoint === i
      const radius = isHovered || isDragged ? 14 : 10

      ctx.beginPath()
      ctx.arc(p.x, p.y, radius + 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isDragged ? '#f59e0b' : (isHovered ? '#22d3ee' : '#4ade80')
      ctx.fill()

      ctx.strokeStyle = isDragged ? '#fbbf24' : (isHovered ? '#67e8f9' : 'rgba(255,255,255,0.8)')
      ctx.lineWidth = isDragged || isHovered ? 3 : 2
      ctx.stroke()

      ctx.fillStyle = '#000'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(i + 1), p.x, p.y + 4)

      if (isHovered && !isDragged) {
        const coordText = `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`
        const textWidth = ctx.measureText(coordText).width
        ctx.fillStyle = 'rgba(0,0,0,0.85)'
        ctx.fillRect(p.x - textWidth/2 - 6, p.y - 32, textWidth + 12, 18)
        ctx.fillStyle = '#fff'
        ctx.font = '11px sans-serif'
        ctx.fillText(coordText, p.x, p.y - 18)
      }
    })

  }, [points, lengthUnit, zoom, scale, hoveredPoint, hoveredEdge, draggingPoint, isInvalid, getCenter, panOffset])

  // Coordinate conversion
  const toWorld = useCallback((canvasX, canvasY) => {
    const center = getCenter()
    return {
      x: (canvasX - gridSize) / scale + center.x,
      y: (gridSize - canvasY) / scale + center.y
    }
  }, [scale, getCenter])

  const toCanvas = useCallback((p) => {
    const center = getCenter()
    return {
      x: gridSize + (p.x - center.x) * scale,
      y: gridSize - (p.y - center.y) * scale
    }
  }, [scale, getCenter])

  // Find nearby elements
  const findPointNear = useCallback((canvasX, canvasY, threshold = 20) => {
    for (let i = 0; i < points.length; i++) {
      const p = toCanvas(points[i])
      const dist = Math.sqrt((canvasX - p.x) ** 2 + (canvasY - p.y) ** 2)
      if (dist < threshold) return i
    }
    return -1
  }, [points, toCanvas])

  const findEdgeNear = useCallback((canvasX, canvasY, threshold = 15) => {
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
  }, [points, toCanvas])

  // Pointer handlers (work for both mouse and touch)
  const getPointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e) => {
    const { x, y } = getPointerPos(e)

    // Middle click = pan
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Left click or touch (bigger hit area for touch)
    if (e.button === 0 || e.pointerType === 'touch') {
      const hitThreshold = e.pointerType === 'touch' ? 35 : 20
      const pointIndex = findPointNear(x, y, hitThreshold)
      if (pointIndex !== -1) {
        setDraggingPoint(pointIndex)
        e.preventDefault()
        // Capture pointer so we get move/up events even outside canvas
        e.target.setPointerCapture(e.pointerId)
      }
    }
  }

  const handlePointerMove = (e) => {
    const { x, y } = getPointerPos(e)

    // Panning
    if (isPanning) {
      const dx = (e.clientX - panStart.x) / scale
      const dy = (e.clientY - panStart.y) / scale
      setPanOffset(prev => ({ x: prev.x - dx, y: prev.y + dy }))
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Dragging point
    if (draggingPoint !== null) {
      let worldPoint = toWorld(x, y)

      // Apply angle constraint if shift is held (relative to previous point)
      const prevPointIndex = (draggingPoint - 1 + points.length) % points.length
      worldPoint = constrainAngle(points[prevPointIndex], worldPoint)

      // Apply grid snap
      worldPoint = snapToGrid(worldPoint)

      const newPoints = [...points]
      newPoints[draggingPoint] = worldPoint
      onChange(newPoints)
      return
    }

    // Hover detection - points then edges (not needed on touch but harmless)
    const pointIndex = findPointNear(x, y)
    setHoveredPoint(pointIndex !== -1 ? pointIndex : null)

    if (pointIndex === -1) {
      const edgeIndex = findEdgeNear(x, y)
      setHoveredEdge(edgeIndex !== -1 ? edgeIndex : null)
    } else {
      setHoveredEdge(null)
    }
  }

  const handlePointerUp = (e) => {
    if (e.button === 1) {
      setIsPanning(false)
    }
    setDraggingPoint(null)
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
    setHoveredEdge(null)
  }

  // Window-level listeners for drag outside canvas
  useEffect(() => {
    if (draggingPoint === null && !isPanning) return

    const handleWindowMouseMove = (e) => {
      if (!canvasRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (isPanning) {
        const dx = (e.clientX - panStart.x) / scale
        const dy = (e.clientY - panStart.y) / scale
        setPanOffset(prev => ({ x: prev.x - dx, y: prev.y + dy }))
        setPanStart({ x: e.clientX, y: e.clientY })
        return
      }

      if (draggingPoint !== null) {
        let worldPoint = toWorld(x, y)
        const prevPointIndex = (draggingPoint - 1 + points.length) % points.length
        worldPoint = constrainAngle(points[prevPointIndex], worldPoint)
        worldPoint = snapToGrid(worldPoint)
        const newPoints = [...points]
        newPoints[draggingPoint] = worldPoint
        onChange(newPoints)
      }
    }

    const handleWindowMouseUp = () => {
      setDraggingPoint(null)
      setIsPanning(false)
    }

    // Use capture phase to intercept events before they reach other elements
    // Listen to both mouse and pointer events (OrbitControls uses pointer events)
    window.addEventListener('mousemove', handleWindowMouseMove, { capture: true })
    window.addEventListener('mouseup', handleWindowMouseUp, { capture: true })
    window.addEventListener('pointermove', handleWindowMouseMove, { capture: true })
    window.addEventListener('pointerup', handleWindowMouseUp, { capture: true })

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove, { capture: true })
      window.removeEventListener('mouseup', handleWindowMouseUp, { capture: true })
      window.removeEventListener('pointermove', handleWindowMouseMove, { capture: true })
      window.removeEventListener('pointerup', handleWindowMouseUp, { capture: true })
    }
  }, [draggingPoint, isPanning, panStart, scale, toWorld, constrainAngle, snapToGrid, points, onChange])

  // Prevent context menu on middle click
  const handleContextMenu = (e) => {
    if (e.button === 1) e.preventDefault()
  }

  // Double click to add/delete points
  const handleDoubleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pointIndex = findPointNear(x, y)
    if (pointIndex !== -1) {
      if (points.length > 3) {
        const newPoints = points.filter((_, i) => i !== pointIndex)
        onChange(newPoints)
      }
      return
    }

    const edgeIndex = findEdgeNear(x, y)
    if (edgeIndex !== -1) {
      const worldPoint = toWorld(x, y)
      const snappedPoint = {
        x: Math.round(worldPoint.x * 2) / 2,
        y: Math.round(worldPoint.y * 2) / 2
      }
      const newPoints = [...points]
      newPoints.splice(edgeIndex + 1, 0, snappedPoint)
      onChange(newPoints)
    }
  }

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)))
  }

  // Delete a point
  const handleDeletePoint = (pointIndex) => {
    if (points.length <= 3) return
    const newPoints = points.filter((_, i) => i !== pointIndex)
    onChange(newPoints)
  }

  // Add a point on an edge (at midpoint)
  const handleAddPointOnEdge = (edgeIndex) => {
    const p1 = points[edgeIndex]
    const p2 = points[(edgeIndex + 1) % points.length]
    const midPoint = {
      x: Math.round(((p1.x + p2.x) / 2) * 2) / 2,
      y: Math.round(((p1.y + p2.y) / 2) * 2) / 2
    }
    const newPoints = [...points]
    newPoints.splice(edgeIndex + 1, 0, midPoint)
    onChange(newPoints)
  }

  // Update a single point's coordinate
  const handleCoordChange = (pointIndex, axis, value) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return

    // Convert from display unit to meters
    const valueInMeters = lengthUnit === 'ft' ? numValue / 3.28084 : numValue

    const newPoints = [...points]
    newPoints[pointIndex] = {
      ...newPoints[pointIndex],
      [axis]: Math.round(valueInMeters * 2) / 2
    }
    onChange(newPoints)
  }

  // Scale shape to match target area
  const handleScaleToArea = () => {
    const target = parseFloat(targetArea)
    if (isNaN(target) || target <= 0) return

    const currentArea = calculatePolygonArea(points)
    if (currentArea <= 0) return

    // Convert target to square meters if needed
    const targetInSqMeters = lengthUnit === 'ft' ? target / 10.7639 : target

    // Calculate scale factor (area scales with square of linear scale)
    const scaleFactor = Math.sqrt(targetInSqMeters / currentArea)

    // Find centroid
    let cx = 0, cy = 0
    points.forEach(p => { cx += p.x; cy += p.y })
    cx /= points.length
    cy /= points.length

    // Scale all points from centroid
    const newPoints = points.map(p => ({
      x: Math.round((cx + (p.x - cx) * scaleFactor) * 2) / 2,
      y: Math.round((cy + (p.y - cy) * scaleFactor) * 2) / 2
    }))

    onChange(newPoints)
    setTargetArea('')
  }

  const perimeter = calculatePerimeter(points)
  const area = calculatePolygonArea(points)
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <div
      className="space-y-3"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Invalid warning */}
      {isInvalid && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-3 py-2 text-xs text-red-300 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Edges are crossing! Move points to fix.</span>
        </div>
      )}

      {/* Canvas */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            className={`rounded-lg border ${isInvalid ? 'border-red-500/50' : 'border-white/20'} ${
              isPanning ? 'cursor-grabbing' :
              draggingPoint !== null ? 'cursor-grabbing' :
              hoveredPoint !== null ? 'cursor-grab' :
              hoveredEdge !== null ? 'cursor-pointer' : 'cursor-default'
            }`}
            style={{ width: canvasSize, height: canvasSize, touchAction: 'none' }}
          />

        </div>

        {/* Zoom and precision controls */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
              className="w-6 h-6 text-sm bg-white/10 hover:bg-white/20 rounded flex items-center justify-center"
            >−</button>
            <span className="text-[10px] text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
              className="w-6 h-6 text-sm bg-white/10 hover:bg-white/20 rounded flex items-center justify-center"
            >+</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`px-2 py-1 text-[10px] rounded ${snapEnabled ? 'bg-cyan-600 text-white' : 'bg-white/10 text-white/50'}`}
              title="Toggle grid snap"
            >
              Snap {snapEnabled ? snapSize + (lengthUnit === 'ft' ? 'ft' : 'm') : 'Off'}
            </button>
            {snapEnabled && (
              <select
                value={snapSize}
                onChange={(e) => setSnapSize(parseFloat(e.target.value))}
                className="bg-[#1a1a2e] text-white text-[10px] rounded px-1 py-1 outline-none border border-white/20"
              >
                <option value="0.5" className="bg-[#1a1a2e] text-white">0.5</option>
                <option value="1" className="bg-[#1a1a2e] text-white">1</option>
                <option value="2" className="bg-[#1a1a2e] text-white">2</option>
                <option value="5" className="bg-[#1a1a2e] text-white">5</option>
              </select>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-[10px] text-white/40 mt-1 text-center">
          {shiftHeld ? (
            <span className="text-cyan-400">45° angle constraint active</span>
          ) : (
            'Drag points • Hold Shift for 45° • Middle-click pan'
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Edge Lengths - Collapsible */}
      {points && points.length >= 3 && (
        <div>
          <button
            onClick={() => setEdgeLengthsExpanded(!edgeLengthsExpanded)}
            className="w-full flex items-center justify-between text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2 hover:text-white/60 transition-colors"
          >
            <span>Edge Lengths</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${edgeLengthsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {edgeLengthsExpanded && (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {points.map((p, i) => {
              const j = (i + 1) % points.length
              const edgeInfo = getEdgeInfo(p, points[j])

              return (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-white/40 w-5">#{i + 1}</span>
                  <span className="text-[10px] text-white/50 w-5">{edgeInfo.direction}</span>
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
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur()
                    }}
                    className="flex-1 w-14 px-2 py-1 text-xs text-cyan-400 bg-white/5 hover:bg-white/10 focus:bg-cyan-500 focus:text-black rounded border border-white/10 focus:border-cyan-400 outline-none transition-colors"
                    step="0.1"
                  />
                  <span className="text-[10px] text-white/40 w-5">{lengthUnit}</span>
                  <button
                    onClick={() => handleAddPointOnEdge(i)}
                    className="w-5 h-5 text-xs bg-white/5 hover:bg-green-500/30 hover:text-green-400 rounded flex items-center justify-center text-white/40 transition-colors"
                    title="Add point on this edge"
                  >
                    +
                  </button>
                </div>
              )
            })}
          </div>
          )}
        </div>
      )}

      {/* Match to Known Value - Collapsible */}
      {points && points.length >= 3 && (
        <div>
          <button
            onClick={() => setMatchAreaExpanded(!matchAreaExpanded)}
            className="w-full flex items-center justify-between text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2 hover:text-white/60 transition-colors"
          >
            <span>Match to Known Value</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${matchAreaExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {matchAreaExpanded && (
            <div className="space-y-3">
              <p className="text-[10px] text-white/40">
                Enter your known total area to scale the shape proportionally.
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 mb-1 block">Target Area</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={targetArea}
                      onChange={(e) => setTargetArea(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleScaleToArea()
                      }}
                      placeholder={convertLength(area).toFixed(0)}
                      className="flex-1 px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded focus:border-cyan-400 focus:bg-white/10 outline-none transition-colors"
                      step="1"
                    />
                    <span className="text-[10px] text-white/40">{lengthUnit}²</span>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleScaleToArea}
                    disabled={!targetArea || parseFloat(targetArea) <= 0}
                    className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed rounded font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
              {targetArea && parseFloat(targetArea) > 0 && (
                <div className="text-[10px] text-white/50 bg-white/5 rounded p-2">
                  <div className="flex justify-between">
                    <span>Current area:</span>
                    <span className="text-cyan-400">{convertLength(area).toFixed(1)} {lengthUnit}²</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target area:</span>
                    <span className="text-green-400">{parseFloat(targetArea).toFixed(1)} {lengthUnit}²</span>
                  </div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-white/10">
                    <span>Scale factor:</span>
                    <span className="text-yellow-400">
                      {(Math.sqrt(parseFloat(targetArea) / convertLength(area)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Point Coordinates - Collapsible */}
      {points && points.length >= 3 && (
        <div>
          <button
            onClick={() => setCoordsExpanded(!coordsExpanded)}
            className="w-full flex items-center justify-between text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2 hover:text-white/60 transition-colors"
          >
            <span>Point Coordinates</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${coordsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {coordsExpanded && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/40">
                Edit coordinates directly for precise placement.
              </p>
              {/* Table Header */}
              <div className="flex items-center gap-1 text-[10px] text-white/50 border-b border-white/10 pb-1">
                <span className="w-6 text-center">Pt</span>
                <span className="flex-1 text-center">X ({lengthUnit})</span>
                <span className="flex-1 text-center">Y ({lengthUnit})</span>
                <span className="w-5"></span>
              </div>
              {/* Table Body */}
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {points.map((point, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-6 text-[10px] text-white/40 text-center">{i + 1}</span>
                    <input
                      type="number"
                      defaultValue={convertLength(point.x).toFixed(1)}
                      key={`x-${i}-${Math.round(point.x * 100)}`}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => handleCoordChange(i, 'x', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur()
                      }}
                      className="flex-1 px-1 py-1 text-xs text-center text-cyan-400 bg-white/5 hover:bg-white/10 focus:bg-cyan-500 focus:text-black rounded border border-white/10 focus:border-cyan-400 outline-none transition-colors"
                      step="0.1"
                    />
                    <input
                      type="number"
                      defaultValue={convertLength(point.y).toFixed(1)}
                      key={`y-${i}-${Math.round(point.y * 100)}`}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => handleCoordChange(i, 'y', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur()
                      }}
                      className="flex-1 px-1 py-1 text-xs text-center text-cyan-400 bg-white/5 hover:bg-white/10 focus:bg-cyan-500 focus:text-black rounded border border-white/10 focus:border-cyan-400 outline-none transition-colors"
                      step="0.1"
                    />
                    <button
                      onClick={() => handleDeletePoint(i)}
                      disabled={points.length <= 3}
                      className="w-5 h-5 text-xs bg-white/5 hover:bg-red-500/30 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed rounded flex items-center justify-center text-white/40 transition-colors"
                      title={points.length <= 3 ? "Minimum 3 points required" : "Delete this point"}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Status */}
      <div className="bg-white/5 rounded-lg" style={{ padding: '12px 16px' }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Perimeter</div>
            <div className="text-sm font-medium text-cyan-400">{formatLength(perimeter)} {lengthUnit}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Area</div>
            <div className="text-sm font-medium text-green-400">{formatLength(area)} {lengthUnit}²</div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Points</div>
          <div className="text-sm font-medium text-white">{points.length}</div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Undo/Redo */}
      <div className="flex gap-2" style={{ marginTop: 6 }}>
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="flex-1 px-3 py-2 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-1.5"
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className="flex-1 px-3 py-2 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-1.5"
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2" style={{ marginTop: 6 }}>
        {onReset && originalPoints && (
          <button
            onClick={onReset}
            className="flex-1 px-3 py-2.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
          >
            Reset
          </button>
        )}
        <button
          onClick={() => onComplete?.(points)}
          disabled={isInvalid || points.length < 3}
          className="flex-1 px-3 py-2.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Done Editing
        </button>
      </div>
    </div>
  )
}
