import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildFloorPlanReadout } from '../utils/floorPlanReadout'
import {
  applyManualOpeningPreset,
  buildCorrectedFloorPlan,
  countAddedDetections,
  countHiddenDetections,
  countOpeningEdits,
  countVisibleDetections,
  countWallEndpointEdits,
  createEmptyAddedDetections,
  createEmptyHiddenDetections,
  getManualOpeningPresetOptions,
  getReviewOpeningForDetection,
  getReviewWallForDetection,
  isDetectionHidden,
  moveReviewOpeningToPoint,
  moveReviewWallEndpoint,
  nudgeManualOpeningAlongWall,
  retargetManualOpeningToWall,
  snapOpeningToNearestReviewWall,
  snapReviewOpeningToNearestWall,
  toggleHiddenDetection,
  updateReviewOpening,
} from '../utils/floorPlanReviewCorrections'

const LEGEND = [
  { label: 'Walls', color: '#14b8a6' },
  { label: 'Doors', color: '#f59e0b' },
  { label: 'Windows', color: '#06b6d4' },
  { label: 'Rooms', color: '#a7f3d0' },
  { label: 'Stairs', color: '#facc15' },
  { label: 'Added walls', color: '#f472b6' },
  { label: 'Added doors', color: '#fb7185' },
  { label: 'Added windows', color: '#38bdf8' },
]

const READINESS_STYLES = {
  ready: {
    badge: 'border border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    panel: 'border-emerald-300/20 bg-emerald-950/15 text-emerald-50/90',
    title: 'text-emerald-100',
    footer: 'border-emerald-300/20 bg-emerald-950/15 text-emerald-100',
  },
  review: {
    badge: 'border border-amber-300/25 bg-amber-300/10 text-amber-100',
    panel: 'border-amber-300/20 bg-amber-950/15 text-amber-50/90',
    title: 'text-amber-100',
    footer: 'border-amber-300/20 bg-amber-950/15 text-amber-100',
  },
  needs_corrections: {
    badge: 'border border-rose-300/25 bg-rose-300/10 text-rose-100',
    panel: 'border-rose-300/20 bg-rose-950/15 text-rose-50/90',
    title: 'text-rose-100',
    footer: 'border-rose-300/20 bg-rose-950/15 text-rose-100',
  },
}

function getCount(value) {
  return Array.isArray(value) ? value.length : 0
}

function getDetectionKey(type, index) {
  return `${type}:${index}`
}

function getDetectionLabel(type, index, item) {
  if (type === 'addedWalls') return `Added wall ${index + 1}`
  if (type === 'addedDoors') return `Added door ${index + 1}`
  if (type === 'addedWindows') return `Added window ${index + 1}`
  if (type === 'rooms') return item?.name || item?.label || `Room ${index + 1}`
  if (type === 'stairs') return `Stair ${index + 1}`
  const singular = type.slice(0, -1)
  return `${singular.charAt(0).toUpperCase()}${singular.slice(1)} ${index + 1}`
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getPointDistance(a, b) {
  if (!a || !b) return Infinity
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function getLinearGeometry(item, scale, offsetX, offsetY, fallbackLength = 28) {
  if (item?.start && item?.end) {
    return {
      x1: offsetX + item.start.x * scale,
      y1: offsetY + item.start.y * scale,
      x2: offsetX + item.end.x * scale,
      y2: offsetY + item.end.y * scale,
      lineWidth: Math.max(2, (item.thickness || 5) * scale),
    }
  }

  if (!item?.center) return null
  const rotation = Number.isFinite(item.rotation) ? item.rotation : 0
  const length = (item.width || fallbackLength) * scale
  const half = length / 2
  const x = offsetX + item.center.x * scale
  const y = offsetY + item.center.y * scale
  const dx = Math.cos(rotation) * half
  const dy = Math.sin(rotation) * half

  return {
    x1: x - dx,
    y1: y - dy,
    x2: x + dx,
    y2: y + dy,
    lineWidth: 4,
  }
}

function distanceToSegment(px, py, item) {
  const dx = item.x2 - item.x1
  const dy = item.y2 - item.y1
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return Math.hypot(px - item.x1, py - item.y1)
  }

  const t = Math.max(0, Math.min(1, ((px - item.x1) * dx + (py - item.y1) * dy) / lengthSquared))
  const x = item.x1 + t * dx
  const y = item.y1 + t * dy
  return Math.hypot(px - x, py - y)
}

function getHitDistance(px, py, item) {
  if (item.kind === 'point') return Math.hypot(px - item.x, py - item.y)
  return distanceToSegment(px, py, item)
}

function drawPointLabel(ctx, item, label, scale, offsetX, offsetY, selected = false) {
  if (!item?.center) return null
  const x = offsetX + item.center.x * scale
  const y = offsetY + item.center.y * scale

  if (selected) {
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(250, 204, 21, 0.26)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(167, 243, 208, 0.85)'
  ctx.fill()

  if (!label) return
  ctx.font = '600 11px "DM Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)'
  ctx.strokeText(label, x, y - 7)
  ctx.fillStyle = '#ecfeff'
  ctx.fillText(label, x, y - 7)

  return { kind: 'point', x, y }
}

function drawWallEndpointHandles(ctx, geometry, activeEndpoint = null) {
  const handles = [
    { id: 'start', label: 'S', x: geometry.x1, y: geometry.y1 },
    { id: 'end', label: 'E', x: geometry.x2, y: geometry.y2 },
  ]

  handles.forEach(handle => {
    const active = activeEndpoint === handle.id
    ctx.beginPath()
    ctx.arc(handle.x, handle.y, active ? 8 : 7, 0, Math.PI * 2)
    ctx.fillStyle = active ? 'rgba(250, 204, 21, 0.96)' : 'rgba(15, 23, 42, 0.92)'
    ctx.fill()
    ctx.strokeStyle = active ? 'rgba(254, 240, 138, 0.98)' : 'rgba(226, 232, 240, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = '700 9px "DM Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = active ? '#0f172a' : '#f8fafc'
    ctx.fillText(handle.label, handle.x, handle.y + 0.5)
  })
}

function drawOpeningDragHandle(ctx, geometry) {
  const x = (geometry.x1 + geometry.x2) / 2
  const y = (geometry.y1 + geometry.y2) / 2

  ctx.beginPath()
  ctx.arc(x, y, 8, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.96)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(250, 204, 21, 0.96)'
  ctx.fill()
}

function drawLinearElement(ctx, item, scale, offsetX, offsetY, color, fallbackLength = 28, selected = false, showEndpointHandles = false, activeEndpoint = null) {
  const geometry = getLinearGeometry(item, scale, offsetX, offsetY, fallbackLength)
  if (!geometry) return null

  if (selected) {
    ctx.beginPath()
    ctx.moveTo(geometry.x1, geometry.y1)
    ctx.lineTo(geometry.x2, geometry.y2)
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)'
    ctx.lineWidth = geometry.lineWidth + 10
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(geometry.x1, geometry.y1)
  ctx.lineTo(geometry.x2, geometry.y2)
  ctx.strokeStyle = color
  ctx.lineWidth = geometry.lineWidth
  ctx.lineCap = 'round'
  ctx.stroke()

  if (showEndpointHandles) {
    drawWallEndpointHandles(ctx, geometry, activeEndpoint)
  } else if (selected) {
    drawOpeningDragHandle(ctx, geometry)
  }

  return { kind: 'line', ...geometry }
}

function FloorPlanReviewCanvas({
  analysis,
  sourceImage,
  hiddenDetections,
  addedDetections,
  selectedDetection,
  addWallMode,
  addOpeningMode,
  retargetWallMode,
  moveWallEndpointMode,
  pendingWallPoint,
  onAddWallPoint,
  onAddOpeningPoint,
  onRetargetWall,
  onMoveWallEndpointPoint,
  onDragWallEndpoint,
  onDragOpening,
  onSelectDetection,
}) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const interactiveItemsRef = useRef([])
  const renderInfoRef = useRef(null)
  const dragStateRef = useRef(null)
  const suppressClickRef = useRef(false)
  const [frameWidth, setFrameWidth] = useState(720)
  const [dragKind, setDragKind] = useState(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined

    const updateWidth = () => {
      const nextWidth = Math.max(280, Math.floor(frame.clientWidth || 720))
      setFrameWidth(nextWidth)
    }

    updateWidth()
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(frame)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !sourceImage) return undefined

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return

      const maxHeight = Math.min(560, Math.max(320, window.innerHeight * 0.58))
      const naturalWidth = analysis?.imageSize?.width || image.naturalWidth || 1
      const naturalHeight = analysis?.imageSize?.height || image.naturalHeight || 1
      const scale = Math.min(frameWidth / naturalWidth, maxHeight / naturalHeight)
      const drawWidth = Math.max(1, Math.round(naturalWidth * scale))
      const drawHeight = Math.max(1, Math.round(naturalHeight * scale))
      const dpr = window.devicePixelRatio || 1
      renderInfoRef.current = { scale, naturalWidth, naturalHeight }

      canvas.width = Math.round(drawWidth * dpr)
      canvas.height = Math.round(drawHeight * dpr)
      canvas.style.width = `${drawWidth}px`
      canvas.style.height = `${drawHeight}px`

      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, drawWidth, drawHeight)
      ctx.drawImage(image, 0, 0, drawWidth, drawHeight)

      ctx.save()
      ctx.globalCompositeOperation = 'source-over'

      const interactiveItems = []
      const addInteractiveItem = (type, index, item, geometry, hitPadding = 12, extra = {}) => {
        if (!geometry) return
        const key = getDetectionKey(type, index)
        interactiveItems.push({
          ...geometry,
          key,
          type,
          index,
          label: getDetectionLabel(type, index, item),
          hitPadding,
          ...extra,
        })
      }
      const addEndpointItems = (type, index, item, geometry) => {
        if (!geometry) return
        const key = getDetectionKey(type, index)
        const label = getDetectionLabel(type, index, item)
        ;[
          { endpoint: 'start', x: geometry.x1, y: geometry.y1 },
          { endpoint: 'end', x: geometry.x2, y: geometry.y2 },
        ].forEach(endpointItem => {
          interactiveItems.push({
            kind: 'point',
            key,
            type,
            index,
            label,
            hitPadding: 20,
            dragType: 'wallEndpoint',
            ...endpointItem,
          })
        })
      }

      ;(analysis?.walls || []).forEach((wall, index) => {
        if (isDetectionHidden(hiddenDetections, 'walls', index)) return
        const key = getDetectionKey('walls', index)
        const selected = selectedDetection?.key === key
        const editedWall = getReviewWallForDetection(analysis, addedDetections, { type: 'walls', index }) || wall
        const geometry = drawLinearElement(
          ctx,
          editedWall,
          scale,
          0,
          0,
          editedWall.isExterior ? 'rgba(20, 184, 166, 0.95)' : 'rgba(45, 212, 191, 0.85)',
          28,
          selected,
          selected,
          selected ? moveWallEndpointMode : null,
        )
        addInteractiveItem('walls', index, editedWall, geometry, 12)
        if (selected) addEndpointItems('walls', index, editedWall, geometry)
      })
      ;(analysis?.doors || []).forEach((door, index) => {
        if (isDetectionHidden(hiddenDetections, 'doors', index)) return
        const key = getDetectionKey('doors', index)
        const selected = selectedDetection?.key === key
        const editedDoor = getReviewOpeningForDetection(analysis, addedDetections, { type: 'doors', index }) || door
        const geometry = drawLinearElement(ctx, editedDoor, scale, 0, 0, 'rgba(245, 158, 11, 0.95)', 34, selected)
        addInteractiveItem('doors', index, editedDoor, geometry, selected ? 20 : 14, selected ? { dragType: 'opening' } : {})
      })
      ;(analysis?.windows || []).forEach((windowItem, index) => {
        if (isDetectionHidden(hiddenDetections, 'windows', index)) return
        const key = getDetectionKey('windows', index)
        const selected = selectedDetection?.key === key
        const editedWindow = getReviewOpeningForDetection(analysis, addedDetections, { type: 'windows', index }) || windowItem
        const geometry = drawLinearElement(ctx, editedWindow, scale, 0, 0, 'rgba(6, 182, 212, 0.95)', 32, selected)
        addInteractiveItem('windows', index, editedWindow, geometry, selected ? 20 : 14, selected ? { dragType: 'opening' } : {})
      })
      ;(analysis?.rooms || []).forEach((room, index) => {
        if (isDetectionHidden(hiddenDetections, 'rooms', index)) return
        const key = getDetectionKey('rooms', index)
        const selected = selectedDetection?.key === key
        const geometry = drawPointLabel(ctx, room, room.name || room.label, scale, 0, 0, selected)
        addInteractiveItem('rooms', index, room, geometry, 18)
      })
      ;(analysis?.stairs || []).forEach((stair, index) => {
        if (isDetectionHidden(hiddenDetections, 'stairs', index)) return
        const key = getDetectionKey('stairs', index)
        const selected = selectedDetection?.key === key
        const geometry = drawPointLabel(ctx, stair, 'Stairs', scale, 0, 0, selected)
        addInteractiveItem('stairs', index, stair, geometry, 18)
      })
      ;(addedDetections?.walls || []).forEach((wall, index) => {
        const key = getDetectionKey('addedWalls', index)
        const selected = selectedDetection?.key === key
        const geometry = drawLinearElement(ctx, wall, scale, 0, 0, 'rgba(244, 114, 182, 0.98)', 28, selected, selected, selected ? moveWallEndpointMode : null)
        addInteractiveItem('addedWalls', index, wall, geometry, 14)
        if (selected) addEndpointItems('addedWalls', index, wall, geometry)
      })
      ;(addedDetections?.doors || []).forEach((door, index) => {
        const key = getDetectionKey('addedDoors', index)
        const selected = selectedDetection?.key === key
        const geometry = drawLinearElement(ctx, door, scale, 0, 0, 'rgba(251, 113, 133, 0.98)', 34, selected)
        addInteractiveItem('addedDoors', index, door, geometry, selected ? 20 : 16, selected ? { dragType: 'opening' } : {})
      })
      ;(addedDetections?.windows || []).forEach((windowItem, index) => {
        const key = getDetectionKey('addedWindows', index)
        const selected = selectedDetection?.key === key
        const geometry = drawLinearElement(ctx, windowItem, scale, 0, 0, 'rgba(56, 189, 248, 0.98)', 38, selected)
        addInteractiveItem('addedWindows', index, windowItem, geometry, selected ? 20 : 16, selected ? { dragType: 'opening' } : {})
      })
      if (pendingWallPoint) {
        const x = pendingWallPoint.x * scale
        const y = pendingWallPoint.y * scale
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(244, 114, 182, 0.26)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.98)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      interactiveItemsRef.current = interactiveItems
      ctx.restore()
    }
    image.src = sourceImage

    return () => {
      cancelled = true
    }
  }, [addedDetections, analysis, frameWidth, hiddenDetections, moveWallEndpointMode, pendingWallPoint, selectedDetection, sourceImage])

  const getCanvasPoint = useCallback((event) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }, [])

  const getSourcePoint = useCallback((event) => {
    const canvasPoint = getCanvasPoint(event)
    const renderInfo = renderInfoRef.current
    if (!canvasPoint || !renderInfo) return null

    return {
      x: clamp(canvasPoint.x / renderInfo.scale, 0, renderInfo.naturalWidth),
      y: clamp(canvasPoint.y / renderInfo.scale, 0, renderInfo.naturalHeight),
    }
  }, [getCanvasPoint])

  const findBestInteractiveItem = useCallback((x, y, predicate = () => true) => {
    let bestMatch = null
    let bestDistance = Infinity

    interactiveItemsRef.current.forEach(item => {
      if (!predicate(item)) return
      const distance = getHitDistance(x, y, item)
      if (distance <= item.hitPadding && distance < bestDistance) {
        bestDistance = distance
        bestMatch = item
      }
    })

    return bestMatch
  }, [])

  const getDetectionFromItem = useCallback((item) => {
    if (!item) return null
    return {
      type: item.type,
      index: item.index,
      key: item.key,
      label: item.label,
    }
  }, [])

  const handleCanvasPointerDown = useCallback((event) => {
    if (event.button !== 0 || addWallMode || addOpeningMode || retargetWallMode || moveWallEndpointMode) return
    const canvasPoint = getCanvasPoint(event)
    if (!canvasPoint) return
    const dragTarget = findBestInteractiveItem(canvasPoint.x, canvasPoint.y, item => (
      item.key === selectedDetection?.key && (item.dragType === 'wallEndpoint' || item.dragType === 'opening')
    ))
    if (!dragTarget) return

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: canvasPoint.x,
      startY: canvasPoint.y,
      moved: false,
      item: dragTarget,
    }
    setDragKind(dragTarget.dragType)
  }, [addOpeningMode, addWallMode, findBestInteractiveItem, getCanvasPoint, moveWallEndpointMode, retargetWallMode, selectedDetection?.key])

  const handleCanvasPointerMove = useCallback((event) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const canvasPoint = getCanvasPoint(event)
    const sourcePoint = getSourcePoint(event)
    if (!canvasPoint || !sourcePoint) return

    const movedDistance = Math.hypot(canvasPoint.x - dragState.startX, canvasPoint.y - dragState.startY)
    if (!dragState.moved && movedDistance < 3) return

    dragState.moved = true
    suppressClickRef.current = true
    const detection = getDetectionFromItem(dragState.item)

    if (dragState.item.dragType === 'wallEndpoint') {
      onDragWallEndpoint(detection, dragState.item.endpoint, sourcePoint)
    } else if (dragState.item.dragType === 'opening') {
      onDragOpening(detection, sourcePoint)
    }
    event.preventDefault()
  }, [getCanvasPoint, getDetectionFromItem, getSourcePoint, onDragOpening, onDragWallEndpoint])

  const finishCanvasPointerDrag = useCallback((event) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    if (dragState.moved) {
      suppressClickRef.current = true
      event.preventDefault()
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragStateRef.current = null
    setDragKind(null)
  }, [])

  const handleCanvasClick = useCallback((event) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    const canvasPoint = getCanvasPoint(event)
    if (!canvasPoint) return
    const { x, y } = canvasPoint

    if (addWallMode) {
      const sourcePoint = getSourcePoint(event)
      if (sourcePoint) onAddWallPoint(sourcePoint)
      return
    }

    if (addOpeningMode) {
      const sourcePoint = getSourcePoint(event)
      if (sourcePoint) onAddOpeningPoint(sourcePoint)
      return
    }

    if (moveWallEndpointMode) {
      const sourcePoint = getSourcePoint(event)
      if (sourcePoint) onMoveWallEndpointPoint(sourcePoint)
      return
    }

    if (retargetWallMode) {
      const bestWall = findBestInteractiveItem(x, y, item => item.type === 'walls' || item.type === 'addedWalls')
      if (bestWall) onRetargetWall(bestWall)
      return
    }

    const bestMatch = findBestInteractiveItem(x, y)

    if (!bestMatch) {
      onSelectDetection(null)
      return
    }

    onSelectDetection({
      type: bestMatch.type,
      index: bestMatch.index,
      key: bestMatch.key,
      label: bestMatch.label,
    })
  }, [addOpeningMode, addWallMode, findBestInteractiveItem, getCanvasPoint, getSourcePoint, moveWallEndpointMode, onAddOpeningPoint, onAddWallPoint, onMoveWallEndpointPoint, onRetargetWall, onSelectDetection, retargetWallMode])

  const canvasCursor = addWallMode || addOpeningMode || retargetWallMode || moveWallEndpointMode
    ? 'cursor-crosshair'
    : dragKind
      ? 'cursor-grabbing'
      : selectedDetection?.type === 'walls' || selectedDetection?.type === 'addedWalls' || selectedDetection?.type === 'doors' || selectedDetection?.type === 'windows' || selectedDetection?.type === 'addedDoors' || selectedDetection?.type === 'addedWindows'
        ? 'cursor-grab'
        : 'cursor-pointer'

  return (
    <div ref={frameRef} className="w-full rounded-2xl border border-white/10 bg-slate-950/50 p-3 overflow-auto">
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={finishCanvasPointerDrag}
        onPointerCancel={finishCanvasPointerDrag}
        onClick={handleCanvasClick}
        className={`mx-auto block rounded-xl bg-slate-900 shadow-2xl ${canvasCursor}`}
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}

export default function FloorPlanReviewModal({ review, onClose, onPlace }) {
  const analysis = review?.analysis
  const [hiddenDetections, setHiddenDetections] = useState(() => createEmptyHiddenDetections())
  const [addedDetections, setAddedDetections] = useState(() => createEmptyAddedDetections())
  const [selectedDetection, setSelectedDetection] = useState(null)
  const [addWallMode, setAddWallMode] = useState(false)
  const [addOpeningMode, setAddOpeningMode] = useState(null)
  const [retargetWallMode, setRetargetWallMode] = useState(false)
  const [moveWallEndpointMode, setMoveWallEndpointMode] = useState(null)
  const [pendingWallPoint, setPendingWallPoint] = useState(null)
  const hiddenCount = useMemo(() => countHiddenDetections(hiddenDetections), [hiddenDetections])
  const addedCount = useMemo(() => countAddedDetections(addedDetections), [addedDetections])
  const wallEditCount = useMemo(() => countWallEndpointEdits(addedDetections), [addedDetections])
  const openingEditCount = useMemo(() => countOpeningEdits(addedDetections), [addedDetections])
  const visibleCounts = useMemo(() => countVisibleDetections(analysis, hiddenDetections, addedDetections), [addedDetections, analysis, hiddenDetections])
  const correctedFloorPlan = useMemo(() => buildCorrectedFloorPlan(review, hiddenDetections, addedDetections), [addedDetections, review, hiddenDetections])
  const baselineReadout = useMemo(() => (
    review?.readout?.readiness ? review.readout : buildFloorPlanReadout({
      stats: review?.floorPlan?.stats,
      analysis,
      warnings: review?.floorPlan?.warnings,
      fileName: review?.sourceFileName || 'your plan',
    })
  ), [analysis, review])
  const readout = useMemo(() => (
    correctedFloorPlan?.stats ? buildFloorPlanReadout({
      stats: correctedFloorPlan.stats,
      analysis: correctedFloorPlan.analysis || analysis,
      warnings: correctedFloorPlan.warnings,
      fileName: review?.sourceFileName || 'your plan',
    }) : baselineReadout
  ), [analysis, baselineReadout, correctedFloorPlan, review?.sourceFileName])
  const correctedFloorPlanWithReadout = useMemo(() => (
    correctedFloorPlan ? { ...correctedFloorPlan, readout } : correctedFloorPlan
  ), [correctedFloorPlan, readout])
  const readiness = readout.readiness
  const baselineReadiness = baselineReadout.readiness
  const readinessStyle = READINESS_STYLES[readiness.state] || READINESS_STYLES.review
  const readinessUpdateCopy = baselineReadiness?.state && baselineReadiness.state !== readiness.state
    ? `Updated from ${baselineReadiness.label.toLowerCase()} after overlay corrections.`
    : `Updates live as you correct the overlay. Original upload: ${baselineReadiness?.label || readiness.label}.`
  const selectedWall = useMemo(() => (
    selectedDetection?.type === 'walls' || selectedDetection?.type === 'addedWalls'
      ? getReviewWallForDetection(analysis, addedDetections, selectedDetection)
      : null
  ), [addedDetections, analysis, selectedDetection])
  const selectedOpening = useMemo(() => {
    if (selectedDetection?.type === 'doors') {
      return {
        kind: 'door',
        collection: 'doors',
        isDetected: true,
        opening: getReviewOpeningForDetection(analysis, addedDetections, selectedDetection),
      }
    }
    if (selectedDetection?.type === 'windows') {
      return {
        kind: 'window',
        collection: 'windows',
        isDetected: true,
        opening: getReviewOpeningForDetection(analysis, addedDetections, selectedDetection),
      }
    }
    if (selectedDetection?.type === 'addedDoors') {
      return {
        kind: 'door',
        collection: 'doors',
        isDetected: false,
        opening: getReviewOpeningForDetection(analysis, addedDetections, selectedDetection),
      }
    }
    if (selectedDetection?.type === 'addedWindows') {
      return {
        kind: 'window',
        collection: 'windows',
        isDetected: false,
        opening: getReviewOpeningForDetection(analysis, addedDetections, selectedDetection),
      }
    }
    return null
  }, [addedDetections, analysis, selectedDetection])
  const selectedOpeningPresets = useMemo(() => (
    selectedOpening ? getManualOpeningPresetOptions(selectedOpening.kind, analysis) : []
  ), [analysis, selectedOpening])
  const counts = useMemo(() => ({
    walls: correctedFloorPlan?.stats?.wallCount ?? visibleCounts.walls ?? getCount(analysis?.walls),
    doors: correctedFloorPlan?.stats?.doorCount ?? visibleCounts.doors ?? getCount(analysis?.doors),
    windows: correctedFloorPlan?.stats?.windowCount ?? visibleCounts.windows ?? getCount(analysis?.windows),
    rooms: correctedFloorPlan?.stats?.roomCount ?? visibleCounts.rooms ?? getCount(analysis?.rooms),
    stairs: correctedFloorPlan?.stats?.stairCount ?? visibleCounts.stairs ?? getCount(analysis?.stairs),
  }), [analysis, correctedFloorPlan, visibleCounts])

  const handleSelectDetection = useCallback((detection) => {
    setSelectedDetection(detection)
    if (detection?.type !== 'doors' && detection?.type !== 'windows' && detection?.type !== 'addedDoors' && detection?.type !== 'addedWindows') {
      setRetargetWallMode(false)
    }
    if (detection?.type !== 'walls' && detection?.type !== 'addedWalls') {
      setMoveWallEndpointMode(null)
    }
  }, [])

  const hideSelected = useCallback(() => {
    if (!selectedDetection) return
    setHiddenDetections(prev => toggleHiddenDetection(prev, selectedDetection))
    setSelectedDetection(null)
    setRetargetWallMode(false)
    setMoveWallEndpointMode(null)
  }, [selectedDetection])

  const removeSelectedAddedDetection = useCallback(() => {
    setAddedDetections(prev => ({
      ...prev,
      walls: selectedDetection?.type === 'addedWalls'
        ? (prev.walls || []).filter((_, index) => index !== selectedDetection.index)
        : prev.walls || [],
      doors: selectedDetection?.type === 'addedDoors'
        ? (prev.doors || []).filter((_, index) => index !== selectedDetection.index)
        : prev.doors || [],
      windows: selectedDetection?.type === 'addedWindows'
        ? (prev.windows || []).filter((_, index) => index !== selectedDetection.index)
        : prev.windows || [],
    }))
    setSelectedDetection(null)
    setRetargetWallMode(false)
    setMoveWallEndpointMode(null)
  }, [selectedDetection])

  const hideOrRemoveSelected = useCallback(() => {
    if (selectedDetection?.type === 'addedWalls' || selectedDetection?.type === 'addedDoors' || selectedDetection?.type === 'addedWindows') {
      removeSelectedAddedDetection()
      return
    }
    hideSelected()
  }, [hideSelected, removeSelectedAddedDetection, selectedDetection])

  const restoreHidden = useCallback(() => {
    setHiddenDetections(createEmptyHiddenDetections())
    setSelectedDetection(null)
    setRetargetWallMode(false)
    setMoveWallEndpointMode(null)
  }, [])

  const toggleAddWallMode = useCallback(() => {
    setAddWallMode(prev => {
      const next = !prev
      setPendingWallPoint(null)
      setSelectedDetection(null)
      setAddOpeningMode(null)
      setRetargetWallMode(false)
      setMoveWallEndpointMode(null)
      return next
    })
  }, [])

  const toggleAddOpeningMode = useCallback((type) => {
    setAddOpeningMode(prev => {
      const next = prev === type ? null : type
      setAddWallMode(false)
      setPendingWallPoint(null)
      setSelectedDetection(null)
      setRetargetWallMode(false)
      setMoveWallEndpointMode(null)
      return next
    })
  }, [])

  const handleAddWallPoint = useCallback((point) => {
    setSelectedDetection(null)

    if (!pendingWallPoint) {
      setPendingWallPoint(point)
      return
    }

    if (getPointDistance(pendingWallPoint, point) < 6) return

    setAddedDetections(prev => ({
      ...prev,
      walls: [
        ...(prev.walls || []),
        {
          start: {
            x: Number(pendingWallPoint.x.toFixed(2)),
            y: Number(pendingWallPoint.y.toFixed(2)),
          },
          end: {
            x: Number(point.x.toFixed(2)),
            y: Number(point.y.toFixed(2)),
          },
          thickness: 12,
          isExterior: false,
          confidence: 1,
          source: 'manual_review',
        },
      ],
    }))
    setPendingWallPoint(null)
    setAddWallMode(false)
  }, [pendingWallPoint])

  const handleAddOpeningPoint = useCallback((point) => {
    if (!addOpeningMode) return
    const type = addOpeningMode === 'door' ? 'doors' : 'windows'
    const defaultPreset = addOpeningMode === 'door' ? 'single' : 'standard'
    const snappedOpening = snapOpeningToNearestReviewWall(point, analysis, hiddenDetections, addedDetections)
    const nextOpening = applyManualOpeningPreset({
      center: snappedOpening.center,
      rotation: snappedOpening.rotation,
      positionAlongWall: snappedOpening.positionAlongWall,
      snap: snappedOpening.snap,
      confidence: 1,
      source: 'manual_review',
    }, addOpeningMode, defaultPreset, analysis)

    setSelectedDetection(null)
    setAddedDetections(prev => ({
      ...prev,
      [type]: [
        ...(prev[type] || []),
        nextOpening,
      ],
    }))
    setAddOpeningMode(null)
  }, [addOpeningMode, addedDetections, analysis, hiddenDetections])

  const applySelectedOpeningPreset = useCallback((presetId) => {
    if (!selectedOpening?.opening || !selectedDetection) return
    setAddedDetections(prev => {
      const currentOpening = getReviewOpeningForDetection(analysis, prev, selectedDetection) || selectedOpening.opening
      return updateReviewOpening(
        prev,
        selectedDetection,
        applyManualOpeningPreset(currentOpening, selectedOpening.kind, presetId, analysis),
      )
    })
  }, [analysis, selectedDetection, selectedOpening])

  const toggleRetargetWallMode = useCallback(() => {
    if (!selectedOpening) return
    setAddWallMode(false)
    setAddOpeningMode(null)
    setPendingWallPoint(null)
    setMoveWallEndpointMode(null)
    setRetargetWallMode(prev => !prev)
  }, [selectedOpening])

  const toggleMoveWallEndpointMode = useCallback((endpoint) => {
    if (!selectedWall) return
    setAddWallMode(false)
    setAddOpeningMode(null)
    setRetargetWallMode(false)
    setPendingWallPoint(null)
    setMoveWallEndpointMode(prev => (prev === endpoint ? null : endpoint))
  }, [selectedWall])

  const moveSelectedWallEndpoint = useCallback((point) => {
    if (!selectedWall || !selectedDetection || !moveWallEndpointMode) return
    setAddedDetections(prev => moveReviewWallEndpoint(prev, selectedDetection, moveWallEndpointMode, point, analysis))
    setMoveWallEndpointMode(null)
  }, [analysis, moveWallEndpointMode, selectedDetection, selectedWall])

  const dragWallEndpoint = useCallback((detection, endpoint, point) => {
    if (!detection || !endpoint || !point) return
    setSelectedDetection(detection)
    setAddedDetections(prev => moveReviewWallEndpoint(prev, detection, endpoint, point, analysis))
  }, [analysis])

  const retargetSelectedOpening = useCallback((wallItem) => {
    if (!selectedOpening?.opening || !selectedDetection || !wallItem?.key) return
    setAddedDetections(prev => {
      const currentOpening = getReviewOpeningForDetection(analysis, prev, selectedDetection) || selectedOpening.opening
      return updateReviewOpening(
        prev,
        selectedDetection,
        retargetManualOpeningToWall(currentOpening, wallItem.key, analysis, hiddenDetections, prev),
      )
    })
    setRetargetWallMode(false)
  }, [analysis, hiddenDetections, selectedDetection, selectedOpening])

  const nudgeSelectedOpening = useCallback((direction) => {
    if (!selectedOpening?.opening || !selectedDetection) return
    setAddedDetections(prev => {
      const currentOpening = getReviewOpeningForDetection(analysis, prev, selectedDetection) || selectedOpening.opening
      const snappedOpening = snapReviewOpeningToNearestWall(currentOpening, analysis, hiddenDetections, prev)
      return updateReviewOpening(
        prev,
        selectedDetection,
        nudgeManualOpeningAlongWall(snappedOpening, direction, analysis, hiddenDetections, prev),
      )
    })
  }, [analysis, hiddenDetections, selectedDetection, selectedOpening])

  const dragOpening = useCallback((detection, point) => {
    if (!detection || !point) return
    setSelectedDetection(detection)
    setAddedDetections(prev => moveReviewOpeningToPoint(prev, detection, point, analysis, hiddenDetections))
  }, [analysis, hiddenDetections])

  const placeCorrectedPlan = useCallback(() => {
    if (!correctedFloorPlanWithReadout?.walls?.length) return
    onPlace(correctedFloorPlanWithReadout)
  }, [correctedFloorPlanWithReadout, onPlace])

  const selectedIsAdded = selectedDetection?.type === 'addedWalls' || selectedDetection?.type === 'addedDoors' || selectedDetection?.type === 'addedWindows'
  const correctionText = addWallMode
    ? pendingWallPoint
      ? 'Tap the wall end point on the plan.'
      : 'Tap the missing wall start point on the plan.'
    : moveWallEndpointMode
      ? `Tap the correct wall ${moveWallEndpointMode} point on the plan.`
    : retargetWallMode
      ? 'Tap the wall this opening belongs to.'
    : addOpeningMode === 'door'
      ? 'Tap the wall where the missing door belongs. Sitea will snap it to the nearest visible wall.'
    : addOpeningMode === 'window'
      ? 'Tap the wall where the missing window belongs. Sitea will snap it to the nearest visible wall.'
    : selectedDetection
      ? `Selected: ${selectedDetection.label}. Drag the highlighted handle or use the controls below.`
      : 'Tap a detected item to inspect it, or add missing walls, doors, or windows.'

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[88vh] w-full max-w-[920px] overflow-hidden rounded-3xl border border-white/10 bg-[#101a2a] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Review detected plan</h2>
            <p className="mt-1 text-sm text-slate-400">
              {review?.sourceFileName || 'Uploaded floor plan'} - check the overlay before placing it in 3D.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl p-3 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
            aria-label="Close review"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(88vh-156px)] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-4 rounded-2xl border border-teal-300/15 bg-teal-950/25 px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-100">
                    Sitea readout
                  </span>
                  <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${readinessStyle.badge}`}>
                    {readiness.label}
                  </span>
                  <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                    readout.scaleState === 'good'
                      ? 'border border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                      : 'border border-amber-300/25 bg-amber-300/10 text-amber-100'
                  }`}
                  >
                    {readout.scaleState === 'good' ? 'Scale usable' : 'Check scale'}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-6 text-white">{readout.summary}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{readout.caveat}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{readiness.detail}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{readinessUpdateCopy}</p>
              </div>
              <div className="grid min-w-[220px] grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {[
                  ['Walls', readout.counts.wallCount],
                  ['Doors', readout.counts.doorCount],
                  ['Windows', readout.counts.windowCount],
                  ['Rooms', readout.counts.roomCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-0.5 text-lg font-bold text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">What Sitea found</p>
                <div className="space-y-2">
                  {readout.findings.slice(0, 3).map((item, index) => (
                    <p key={`${item}-${index}`} className="text-sm leading-6 text-slate-200">{item}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-950/15 px-4 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-100">Check before 3D</p>
                <div className="space-y-2">
                  {readout.reviewNotes.slice(0, 3).map((item, index) => (
                    <p key={`${item}-${index}`} className="text-sm leading-6 text-amber-50/90">{item}</p>
                  ))}
                </div>
              </div>
              <div className={`rounded-2xl border px-4 py-3 md:col-span-2 ${readinessStyle.panel}`}>
                <p className={`mb-2 text-xs font-bold uppercase tracking-wide ${readinessStyle.title}`}>Readiness checklist</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {readiness.checklist.map((item, index) => (
                    <p key={`${item}-${index}`} className="text-sm leading-6">{item}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(counts).map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                <div className="mt-1 text-2xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          <FloorPlanReviewCanvas
            analysis={analysis}
            sourceImage={review?.sourceImage}
            hiddenDetections={hiddenDetections}
            addedDetections={addedDetections}
            selectedDetection={selectedDetection}
            addWallMode={addWallMode}
            addOpeningMode={addOpeningMode}
            retargetWallMode={retargetWallMode}
            moveWallEndpointMode={moveWallEndpointMode}
            pendingWallPoint={pendingWallPoint}
            onAddWallPoint={handleAddWallPoint}
            onAddOpeningPoint={handleAddOpeningPoint}
            onRetargetWall={retargetSelectedOpening}
            onMoveWallEndpointPoint={moveSelectedWallEndpoint}
            onDragWallEndpoint={dragWallEndpoint}
            onDragOpening={dragOpening}
            onSelectDetection={handleSelectDetection}
          />

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Correction</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {correctionText}
                  {hiddenCount > 0 ? ` Hidden detections: ${hiddenCount}.` : ''}
                  {addedCount > 0 ? ` Manual additions: ${addedCount}.` : ''}
                  {wallEditCount > 0 ? ` Wall edits: ${wallEditCount}.` : ''}
                  {openingEditCount > 0 ? ` Opening edits: ${openingEditCount}.` : ''}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={toggleAddWallMode}
                  className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    addWallMode
                      ? 'border border-pink-300/40 bg-pink-400/15 text-pink-100 hover:bg-pink-400/20'
                      : 'border border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {addWallMode ? 'Cancel wall' : 'Add wall'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleAddOpeningMode('door')}
                  className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    addOpeningMode === 'door'
                      ? 'border border-rose-300/40 bg-rose-400/15 text-rose-100 hover:bg-rose-400/20'
                      : 'border border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {addOpeningMode === 'door' ? 'Cancel door' : 'Add door'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleAddOpeningMode('window')}
                  className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    addOpeningMode === 'window'
                      ? 'border border-sky-300/40 bg-sky-400/15 text-sky-100 hover:bg-sky-400/20'
                      : 'border border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {addOpeningMode === 'window' ? 'Cancel window' : 'Add window'}
                </button>
                <button
                  type="button"
                  onClick={hideOrRemoveSelected}
                  disabled={!selectedDetection}
                  className="min-h-11 rounded-2xl border border-amber-300/30 px-4 py-2.5 text-sm font-semibold text-amber-100 transition-all hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {selectedIsAdded ? 'Remove added' : 'Hide selected'}
                </button>
                <button
                  type="button"
                  onClick={restoreHidden}
                  disabled={hiddenCount === 0}
                  className="min-h-11 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Restore hidden
                </button>
              </div>
            </div>
            {selectedWall ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Wall endpoints</p>
                    <p className="text-xs leading-5 text-slate-400">
                      Drag the S/E handles on the plan, or tap a button and then tap the correct point.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {['start', 'end'].map(endpoint => {
                    const active = moveWallEndpointMode === endpoint
                    return (
                      <button
                        key={endpoint}
                        type="button"
                        onClick={() => toggleMoveWallEndpointMode(endpoint)}
                        className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold capitalize transition-all ${
                          active
                            ? 'border border-amber-300/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/20'
                            : 'border border-white/10 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {active ? `Cancel ${endpoint}` : `Move ${endpoint}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
            {selectedOpening ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedOpening.kind === 'door' ? 'Door size' : 'Window size'}
                    </p>
                    <p className="text-xs leading-5 text-slate-400">
                      Adjust this {selectedOpening.isDetected ? 'detected' : 'manual'} opening before placing in 3D.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {selectedOpeningPresets.map(preset => {
                    const active = selectedOpening.opening?.presetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applySelectedOpeningPreset(preset.id)}
                        className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                          active
                            ? 'border border-teal-300/40 bg-teal-400/15 text-teal-100 hover:bg-teal-400/20'
                            : 'border border-white/10 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {preset.label} · {preset.meters}m
                      </button>
                    )
                  })}
                </div>
                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="mb-2 text-sm font-semibold text-white">Position</p>
                  <p className="mb-3 text-xs leading-5 text-slate-400">
                    Drag the highlighted opening on the plan, nudge it, or attach it to another wall.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => nudgeSelectedOpening(-1)}
                      disabled={!selectedOpening.opening?.center}
                      className="min-h-11 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeSelectedOpening(1)}
                      disabled={!selectedOpening.opening?.center}
                      className="min-h-11 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Forward
                    </button>
                    <button
                      type="button"
                      onClick={toggleRetargetWallMode}
                      className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                        retargetWallMode
                          ? 'border border-teal-300/40 bg-teal-400/15 text-teal-100 hover:bg-teal-400/20'
                          : 'border border-white/10 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {retargetWallMode ? 'Cancel pick' : 'Pick wall'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-teal-300/15 bg-teal-950/25 px-4 py-3">
            {LEGEND.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-slate-200">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-950/20 px-4 py-3 text-sm leading-6 text-amber-100">
            Compare the overlay with the original plan. If major walls, doors, or windows are missing, Sitea should improve detection before trusting the 3D result.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${readinessStyle.footer}`}>
            {readiness.action}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10"
            >
              Back to agent
            </button>
            <button
              type="button"
              onClick={placeCorrectedPlan}
              disabled={!correctedFloorPlanWithReadout?.walls?.length}
              className="min-h-11 rounded-2xl bg-[#14b8a6] px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-950/30 transition-all hover:bg-[#2dd4bf] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Place in 3D
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
