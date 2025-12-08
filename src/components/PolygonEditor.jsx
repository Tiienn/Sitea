import { useRef, useState, useEffect } from 'react'

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

export default function PolygonEditor({ points, onChange, onComplete, onClear }) {
  const canvasRef = useRef(null)
  const [isDragging, setIsDragging] = useState(null)
  const scale = 4 // 1 pixel = 0.25 meters, so 4px = 1m
  const canvasSize = 200
  const gridSize = canvasSize / 2 // Center at 0,0

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i <= canvasSize; i += scale * 5) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvasSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvasSize, i)
      ctx.stroke()
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.moveTo(gridSize, 0)
    ctx.lineTo(gridSize, canvasSize)
    ctx.moveTo(0, gridSize)
    ctx.lineTo(canvasSize, gridSize)
    ctx.stroke()

    // Draw instruction text when empty
    if (points.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Click to add points', canvasSize / 2, canvasSize / 2)
    }

    // Draw polygon
    if (points.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = '#4ade80'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.2)'
      ctx.lineWidth = 2

      const toCanvas = (p) => ({
        x: gridSize + p.x * scale,
        y: gridSize - p.y * scale // Flip Y
      })

      const first = toCanvas(points[0])
      ctx.moveTo(first.x, first.y)

      for (let i = 1; i < points.length; i++) {
        const p = toCanvas(points[i])
        ctx.lineTo(p.x, p.y)
      }

      if (points.length >= 3) {
        ctx.closePath()
        ctx.fill()
      }
      ctx.stroke()

      // Draw points (larger for easier clicking)
      points.forEach((point, i) => {
        const p = toCanvas(point)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#22d3ee' : '#4ade80'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }
  }, [points])

  const toWorld = (canvasX, canvasY) => ({
    x: Math.round((canvasX - gridSize) / scale),
    y: Math.round((gridSize - canvasY) / scale) // Flip Y
  })

  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const worldPoint = toWorld(x, y)

    // Check if clicking near existing point
    const nearPoint = points.findIndex(p =>
      Math.abs(p.x - worldPoint.x) < 2 && Math.abs(p.y - worldPoint.y) < 2
    )

    if (nearPoint === -1) {
      onChange([...points, worldPoint])
    }
  }

  const handleDoubleClick = () => {
    if (points.length >= 3) {
      onComplete()
    }
  }

  const handleClear = () => {
    onChange([])
    onClear?.()
  }

  const handleUndo = () => {
    if (points.length > 0) {
      onChange(points.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className="rounded cursor-crosshair border border-white/20"
        style={{ width: canvasSize, height: canvasSize }}
      />
      <div className="text-xs text-white/50">
        Click to add points • Double-click to finish
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleUndo}
          disabled={points.length === 0}
          className="flex-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={points.length === 0}
          className="flex-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded"
        >
          Clear
        </button>
        {points.length >= 3 && (
          <button
            onClick={onComplete}
            className="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded font-medium"
          >
            Done
          </button>
        )}
      </div>
      {points.length >= 3 && (
        <div className="text-sm font-bold">
          {calculatePolygonArea(points).toFixed(0)} m²
        </div>
      )}
    </div>
  )
}
