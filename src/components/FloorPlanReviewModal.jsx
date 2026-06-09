import { useEffect, useMemo, useRef, useState } from 'react'

const LEGEND = [
  { label: 'Walls', color: '#14b8a6' },
  { label: 'Doors', color: '#f59e0b' },
  { label: 'Windows', color: '#06b6d4' },
  { label: 'Rooms', color: '#a7f3d0' },
]

function getCount(value) {
  return Array.isArray(value) ? value.length : 0
}

function drawPointLabel(ctx, item, label, scale, offsetX, offsetY) {
  if (!item?.center) return
  const x = offsetX + item.center.x * scale
  const y = offsetY + item.center.y * scale

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
}

function drawLinearElement(ctx, item, scale, offsetX, offsetY, color, fallbackLength = 28) {
  if (item?.start && item?.end) {
    ctx.beginPath()
    ctx.moveTo(offsetX + item.start.x * scale, offsetY + item.start.y * scale)
    ctx.lineTo(offsetX + item.end.x * scale, offsetY + item.end.y * scale)
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, (item.thickness || 5) * scale)
    ctx.lineCap = 'round'
    ctx.stroke()
    return
  }

  if (!item?.center) return
  const rotation = Number.isFinite(item.rotation) ? item.rotation : 0
  const length = (item.width || fallbackLength) * scale
  const half = length / 2
  const x = offsetX + item.center.x * scale
  const y = offsetY + item.center.y * scale
  const dx = Math.cos(rotation) * half
  const dy = Math.sin(rotation) * half

  ctx.beginPath()
  ctx.moveTo(x - dx, y - dy)
  ctx.lineTo(x + dx, y + dy)
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.stroke()
}

function FloorPlanReviewCanvas({ analysis, sourceImage }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
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
      ;(analysis?.walls || []).forEach(wall => {
        drawLinearElement(ctx, wall, scale, 0, 0, wall.isExterior ? 'rgba(20, 184, 166, 0.95)' : 'rgba(45, 212, 191, 0.85)')
      })
      ;(analysis?.doors || []).forEach(door => {
        drawLinearElement(ctx, door, scale, 0, 0, 'rgba(245, 158, 11, 0.95)', 34)
      })
      ;(analysis?.windows || []).forEach(windowItem => {
        drawLinearElement(ctx, windowItem, scale, 0, 0, 'rgba(6, 182, 212, 0.95)', 32)
      })
      ;(analysis?.rooms || []).forEach(room => {
        drawPointLabel(ctx, room, room.name || room.label, scale, 0, 0)
      })
      ;(analysis?.stairs || []).forEach(stair => {
        drawPointLabel(ctx, stair, 'Stairs', scale, 0, 0)
      })
      ctx.restore()
    }
    image.src = sourceImage

    return () => {
      cancelled = true
    }
  }, [analysis, frameWidth, sourceImage])

  return (
    <div ref={frameRef} className="w-full rounded-2xl border border-white/10 bg-slate-950/50 p-3 overflow-auto">
      <canvas ref={canvasRef} className="mx-auto block rounded-xl bg-slate-900 shadow-2xl" />
    </div>
  )
}

export default function FloorPlanReviewModal({ review, onClose, onPlace }) {
  const analysis = review?.analysis
  const stats = review?.floorPlan?.stats
  const counts = useMemo(() => ({
    walls: stats?.wallCount ?? getCount(analysis?.walls),
    doors: stats?.doorCount ?? getCount(analysis?.doors),
    windows: stats?.windowCount ?? getCount(analysis?.windows),
    rooms: stats?.roomCount ?? getCount(analysis?.rooms),
    stairs: stats?.stairCount ?? getCount(analysis?.stairs),
  }), [analysis, stats])

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

          <FloorPlanReviewCanvas analysis={analysis} sourceImage={review?.sourceImage} />

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
            onClick={onPlace}
            className="min-h-11 rounded-2xl bg-[#14b8a6] px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-950/30 transition-all hover:bg-[#2dd4bf]"
          >
            Place in 3D
          </button>
        </div>
      </div>
    </div>
  )
}
