import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildCorrectedFloorPlan,
  countHiddenDetections,
  countVisibleDetections,
  createEmptyHiddenDetections,
  isDetectionHidden,
  toggleHiddenDetection,
} from '../utils/floorPlanReviewCorrections'

const LEGEND = [
  { label: 'Walls', color: '#14b8a6' },
  { label: 'Doors', color: '#f59e0b' },
  { label: 'Windows', color: '#06b6d4' },
  { label: 'Rooms', color: '#a7f3d0' },
  { label: 'Stairs', color: '#facc15' },
]

function getCount(value) {
  return Array.isArray(value) ? value.length : 0
}

function getDetectionKey(type, index) {
  return `${type}:${index}`
}

function getDetectionLabel(type, index, item) {
  if (type === 'rooms') return item?.name || item?.label || `Room ${index + 1}`
  if (type === 'stairs') return `Stair ${index + 1}`
  const singular = type.slice(0, -1)
  return `${singular.charAt(0).toUpperCase()}${singular.slice(1)} ${index + 1}`
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

function drawLinearElement(ctx, item, scale, offsetX, offsetY, color, fallbackLength = 28, selected = false) {
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

  return { kind: 'line', ...geometry }
}

function FloorPlanReviewCanvas({ analysis, sourceImage, hiddenDetections, selectedDetection, onSelectDetection }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const interactiveItemsRef = useRef([])
  const [frameWidth, setFrameWidth] = useState(720)

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
      const addInteractiveItem = (type, index, item, geometry, hitPadding = 12) => {
        if (!geometry) return
        const key = getDetectionKey(type, index)
        interactiveItems.push({
          ...geometry,
          key,
          type,
          index,
          label: getDetectionLabel(type, index, item),
          hitPadding,
        })
      }

      ;(analysis?.walls || []).forEach((wall, index) => {
        if (isDetectionHidden(hiddenDetections, 'walls', index)) return
        const key = getDetectionKey('walls', index)
        const selected = selectedDetection?.key === key
        const geometry = drawLinearElement(ctx, wall, scale, 0, 0, wall.isExterior ? 'rgba(20, 184, 166, 0.95)' : 'rgba(45, 212, 191, 0.85)', 28, selected)
        addInteractiveItem('walls', index, wall, geometry, 12)
      })
      ;(analysis?.doors || []).forEach((door, index) => {
        if (isDetectionHidden(hiddenDetections, 'doors', index)) return
        const key = getDetectionKey('doors', index)
        const selected = selectedDetection?.key === key
        const geometry = drawLinearElement(ctx, door, scale, 0, 0, 'rgba(245, 158, 11, 0.95)', 34, selected)
        addInteractiveItem('doors', index, door, geometry, 14)
      })
      ;(analysis?.windows || []).forEach((windowItem, index) => {
        if (isDetectionHidden(hiddenDetections, 'windows', index)) return
        const key = getDetectionKey('windows', index)
        const selected = selectedDetection?.key === key
        const geometry = drawLinearElement(ctx, windowItem, scale, 0, 0, 'rgba(6, 182, 212, 0.95)', 32, selected)
        addInteractiveItem('windows', index, windowItem, geometry, 14)
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
      interactiveItemsRef.current = interactiveItems
      ctx.restore()
    }
    image.src = sourceImage

    return () => {
      cancelled = true
    }
  }, [analysis, frameWidth, hiddenDetections, selectedDetection, sourceImage])

  const handleCanvasClick = useCallback((event) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    let bestMatch = null
    let bestDistance = Infinity
    interactiveItemsRef.current.forEach(item => {
      const distance = getHitDistance(x, y, item)
      if (distance <= item.hitPadding && distance < bestDistance) {
        bestDistance = distance
        bestMatch = item
      }
    })

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
  }, [onSelectDetection])

  return (
    <div ref={frameRef} className="w-full rounded-2xl border border-white/10 bg-slate-950/50 p-3 overflow-auto">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="mx-auto block cursor-crosshair rounded-xl bg-slate-900 shadow-2xl"
      />
    </div>
  )
}

export default function FloorPlanReviewModal({ review, onClose, onPlace }) {
  const analysis = review?.analysis
  const [hiddenDetections, setHiddenDetections] = useState(() => createEmptyHiddenDetections())
  const [selectedDetection, setSelectedDetection] = useState(null)
  const hiddenCount = useMemo(() => countHiddenDetections(hiddenDetections), [hiddenDetections])
  const visibleCounts = useMemo(() => countVisibleDetections(analysis, hiddenDetections), [analysis, hiddenDetections])
  const correctedFloorPlan = useMemo(() => buildCorrectedFloorPlan(review, hiddenDetections), [review, hiddenDetections])
  const counts = useMemo(() => ({
    walls: correctedFloorPlan?.stats?.wallCount ?? visibleCounts.walls ?? getCount(analysis?.walls),
    doors: correctedFloorPlan?.stats?.doorCount ?? visibleCounts.doors ?? getCount(analysis?.doors),
    windows: correctedFloorPlan?.stats?.windowCount ?? visibleCounts.windows ?? getCount(analysis?.windows),
    rooms: correctedFloorPlan?.stats?.roomCount ?? visibleCounts.rooms ?? getCount(analysis?.rooms),
    stairs: correctedFloorPlan?.stats?.stairCount ?? visibleCounts.stairs ?? getCount(analysis?.stairs),
  }), [analysis, correctedFloorPlan, visibleCounts])

  const hideSelected = useCallback(() => {
    if (!selectedDetection) return
    setHiddenDetections(prev => toggleHiddenDetection(prev, selectedDetection))
    setSelectedDetection(null)
  }, [selectedDetection])

  const restoreHidden = useCallback(() => {
    setHiddenDetections(createEmptyHiddenDetections())
    setSelectedDetection(null)
  }, [])

  const placeCorrectedPlan = useCallback(() => {
    onPlace(correctedFloorPlan)
  }, [correctedFloorPlan, onPlace])

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
            selectedDetection={selectedDetection}
            onSelectDetection={setSelectedDetection}
          />

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Correction</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {selectedDetection ? `Selected: ${selectedDetection.label}` : 'Tap a detected item on the overlay to inspect it.'}
                  {hiddenCount > 0 ? ` Hidden detections: ${hiddenCount}.` : ''}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={hideSelected}
                  disabled={!selectedDetection}
                  className="min-h-11 rounded-2xl border border-amber-300/30 px-4 py-2.5 text-sm font-semibold text-amber-100 transition-all hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Hide selected
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

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
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
            disabled={!correctedFloorPlan?.walls?.length}
            className="min-h-11 rounded-2xl bg-[#14b8a6] px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-950/30 transition-all hover:bg-[#2dd4bf] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Place in 3D
          </button>
        </div>
      </div>
    </div>
  )
}
