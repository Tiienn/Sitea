import { useRef, useState, useEffect, useCallback } from 'react'
import { useUser } from '../hooks/useUser.jsx'

export default function ImageTracer({
  uploadedImage,
  setUploadedImage,
  onComplete,
  onClear,
  lengthUnit = 'm'
}) {
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [points, setPoints] = useState([]) // Boundary points in image space
  const [scale, setScale] = useState(null) // pixels per meter
  const [scaleMode, setScaleMode] = useState(false)
  const [scalePoints, setScalePoints] = useState([]) // Two points for scale reference
  const [scaleDistance, setScaleDistance] = useState('')
  const [scaleUnit, setScaleUnit] = useState(lengthUnit) // Unit for scale input (m, ft, mm)
  const [isDragging, setIsDragging] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  // Zoom and pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 })

  // Cache image dimensions
  const [imgDimensions, setImgDimensions] = useState({ width: 1, height: 1 })

  const canvasSize = 300
  const image = uploadedImage // Alias for compatibility

  // Upload tracking (for analytics, parent handles gating)
  const { markUploadUsed } = useUser()

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) return

    // Check file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PNG, JPG, or PDF file')
      return
    }

    // For PDF, we'd need a PDF renderer - for now just handle images
    if (file.type === 'application/pdf') {
      alert('PDF support coming soon. Please use PNG or JPG for now.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      // Mark upload as used (consumes free trial)
      markUploadUsed()

      setUploadedImage(e.target.result)
      // Reset state for new image
      setPoints([])
      setScale(null)
      setScalePoints([])
      setScaleDistance('')
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }, [setUploadedImage, markUploadUsed])

  // Handle file input change
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    handleFileSelect(file)
  }

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    handleFileSelect(file)
  }

  // Load image dimensions on mount
  useEffect(() => {
    if (!image) return
    const img = new Image()
    img.onload = () => {
      setImgDimensions({ width: img.width, height: img.height })
    }
    img.src = image
  }, [image])

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Draw image
    const img = new Image()
    img.onload = () => {
      // Calculate base fit
      const aspectRatio = img.width / img.height
      let baseWidth, baseHeight, baseOffsetX, baseOffsetY

      if (aspectRatio > 1) {
        baseWidth = canvasSize
        baseHeight = canvasSize / aspectRatio
        baseOffsetX = 0
        baseOffsetY = (canvasSize - baseHeight) / 2
      } else {
        baseHeight = canvasSize
        baseWidth = canvasSize * aspectRatio
        baseOffsetX = (canvasSize - baseWidth) / 2
        baseOffsetY = 0
      }

      // Apply zoom and pan
      ctx.save()
      ctx.translate(canvasSize / 2, canvasSize / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-canvasSize / 2 + pan.x, -canvasSize / 2 + pan.y)

      // Draw image
      ctx.drawImage(img, baseOffsetX, baseOffsetY, baseWidth, baseHeight)

      // Helper to convert image-space point to current view
      const baseScale = baseWidth / img.width
      const toView = (p) => ({
        x: baseOffsetX + p.x * baseScale,
        y: baseOffsetY + p.y * baseScale
      })

      // Draw scale reference line if setting scale
      if (scaleMode && scalePoints.length > 0) {
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2 / zoom
        ctx.setLineDash([5 / zoom, 5 / zoom])
        ctx.beginPath()
        const sp0 = toView(scalePoints[0])
        ctx.moveTo(sp0.x, sp0.y)
        if (scalePoints.length === 2) {
          const sp1 = toView(scalePoints[1])
          ctx.lineTo(sp1.x, sp1.y)
        }
        ctx.stroke()
        ctx.setLineDash([])

        // Draw scale points
        scalePoints.forEach((p) => {
          const vp = toView(p)
          ctx.beginPath()
          ctx.arc(vp.x, vp.y, 6 / zoom, 0, Math.PI * 2)
          ctx.fillStyle = '#f59e0b'
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2 / zoom
          ctx.stroke()
        })
      }

      // Draw boundary polygon
      if (points.length > 0) {
        ctx.beginPath()
        ctx.strokeStyle = '#4ade80'
        ctx.fillStyle = 'rgba(74, 222, 128, 0.2)'
        ctx.lineWidth = 2 / zoom

        const vp0 = toView(points[0])
        ctx.moveTo(vp0.x, vp0.y)
        for (let i = 1; i < points.length; i++) {
          const vp = toView(points[i])
          ctx.lineTo(vp.x, vp.y)
        }

        if (points.length >= 3) {
          ctx.closePath()
          ctx.fill()
        }
        ctx.stroke()

        // Draw points
        points.forEach((p, i) => {
          const vp = toView(p)
          ctx.beginPath()
          ctx.arc(vp.x, vp.y, 6 / zoom, 0, Math.PI * 2)
          ctx.fillStyle = i === 0 ? '#22d3ee' : '#4ade80'
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2 / zoom
          ctx.stroke()
        })
      }

      ctx.restore()

      // Draw zoom indicator
      if (zoom > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(canvasSize - 45, 5, 40, 20)
        ctx.fillStyle = '#fff'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${zoom}x`, canvasSize - 25, 19)
      }
    }
    img.src = image
  }, [image, points, scaleMode, scalePoints, zoom, pan])

  // Convert canvas click to image-space coordinates
  const canvasToImageSpace = (canvasX, canvasY) => {
    if (!image || imgDimensions.width === 0) return { x: 0, y: 0 }

    const aspectRatio = imgDimensions.width / imgDimensions.height

    let baseWidth, baseHeight, baseOffsetX, baseOffsetY
    if (aspectRatio > 1) {
      baseWidth = canvasSize
      baseHeight = canvasSize / aspectRatio
      baseOffsetX = 0
      baseOffsetY = (canvasSize - baseHeight) / 2
    } else {
      baseHeight = canvasSize
      baseWidth = canvasSize * aspectRatio
      baseOffsetX = (canvasSize - baseWidth) / 2
      baseOffsetY = 0
    }

    // Reverse the zoom/pan transform
    const viewX = (canvasX - canvasSize / 2) / zoom + canvasSize / 2 - pan.x
    const viewY = (canvasY - canvasSize / 2) / zoom + canvasSize / 2 - pan.y

    // Convert to image coordinates
    const baseScale = baseWidth / imgDimensions.width
    const imageX = (viewX - baseOffsetX) / baseScale
    const imageY = (viewY - baseOffsetY) / baseScale

    return { x: imageX, y: imageY }
  }

  const handleCanvasClick = (e) => {
    if (isPanning) return

    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (canvasSize / rect.width)
    const canvasY = (e.clientY - rect.top) * (canvasSize / rect.height)

    const imagePoint = canvasToImageSpace(canvasX, canvasY)

    console.log('Canvas click:', { scaleMode, imagePoint, currentScalePoints: scalePoints.length })

    if (scaleMode) {
      setScalePoints(prev => {
        console.log('Adding scale point, prev length:', prev.length)
        if (prev.length < 2) {
          const newPoints = [...prev, imagePoint]
          console.log('New scale points:', newPoints)
          return newPoints
        }
        return prev
      })
    } else if (scale) {
      // Only allow tracing after scale is set
      setPoints(prev => [...prev, imagePoint])
    }
  }

  const handleMouseDown = (e) => {
    // Middle mouse button (wheel click) to pan
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setLastPanPos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = (e.clientX - lastPanPos.x) / zoom
      const dy = (e.clientY - lastPanPos.y) / zoom
      setPan({ x: pan.x + dx, y: pan.y + dy })
      setLastPanPos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = (e) => {
    if (e.button === 1) {
      setIsPanning(false)
    }
  }

  const handleWheel = (e) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      // Scroll up = zoom in
      setZoom(Math.min(zoom + 0.5, 5))
    } else {
      // Scroll down = zoom out
      const newZoom = Math.max(zoom - 0.5, 1)
      setZoom(newZoom)
      if (newZoom === 1) {
        setPan({ x: 0, y: 0 })
      }
    }
  }

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.5, 5))
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.5, 1)
    setZoom(newZoom)
    if (newZoom === 1) {
      setPan({ x: 0, y: 0 })
    }
  }

  const handleSetScale = () => {
    console.log('handleSetScale called', { scalePoints, scaleDistance })

    if (scalePoints.length !== 2) {
      console.log('Not enough scale points:', scalePoints.length)
      return
    }
    if (!scaleDistance) {
      console.log('No scale distance entered')
      return
    }

    const dx = scalePoints[1].x - scalePoints[0].x
    const dy = scalePoints[1].y - scalePoints[0].y
    const pixelDistance = Math.sqrt(dx * dx + dy * dy)

    console.log('Pixel distance:', pixelDistance)

    let distanceMeters = parseFloat(scaleDistance)
    // Convert to meters based on selected scale unit
    if (scaleUnit === 'ft') {
      distanceMeters = distanceMeters / 3.28084
    } else if (scaleUnit === 'mm') {
      distanceMeters = distanceMeters / 1000
    }

    console.log('Distance in meters:', distanceMeters)

    const pixelsPerMeter = pixelDistance / distanceMeters
    console.log('Setting scale to:', pixelsPerMeter)

    setScale(pixelsPerMeter)
    setScaleMode(false)
  }

  const handleComplete = () => {
    if (points.length < 3 || !scale) return
    // Show summary instead of completing immediately
    setShowSummary(true)
  }

  // Confirm and complete
  const handleConfirm = () => {
    const worldPoints = getWorldPoints()
    onComplete(worldPoints)
    setShowSummary(false)
  }

  // Go back to editing from summary
  const handleBackToEdit = () => {
    setShowSummary(false)
  }

  const handleClear = () => {
    setPoints([])
    setScalePoints([])
    setScale(null)
    setScaleDistance('')
    setZoom(1)
    setPan({ x: 0, y: 0 })
    onClear?.()
  }

  const handleUndo = () => {
    if (scaleMode && scalePoints.length > 0) {
      setScalePoints(scalePoints.slice(0, -1))
    } else if (points.length > 0) {
      setPoints(points.slice(0, -1))
    }
  }

  // Calculate area in square meters
  const calculateArea = () => {
    if (points.length < 3 || !scale) return 0
    let area = 0
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      area += points[i].x * points[j].y
      area -= points[j].x * points[i].y
    }
    const pixelArea = Math.abs(area / 2)
    return pixelArea / (scale * scale)
  }

  // Calculate perimeter in meters
  const calculatePerimeter = () => {
    if (points.length < 2 || !scale) return 0
    let perimeter = 0
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i]
      const p2 = points[(i + 1) % points.length]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      perimeter += Math.sqrt(dx * dx + dy * dy)
    }
    return perimeter / scale
  }

  // Get world points for passing to parent
  const getWorldPoints = () => {
    if (points.length < 3 || !scale) return []
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length
    return points.map(p => ({
      x: (p.x - centerX) / scale,
      y: -(p.y - centerY) / scale
    }))
  }

  // Handle remove image
  const handleRemoveImage = () => {
    setUploadedImage(null)
    setPoints([])
    setScale(null)
    setScalePoints([])
    setScaleDistance('')
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  if (!image) {
    return (
      <div className="space-y-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,.pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Drag & drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-cyan-400 bg-cyan-400/10'
              : 'border-white/20 hover:border-white/40 hover:bg-white/5'
            }
          `}
        >
          {/* Upload icon */}
          <div className="flex justify-center mb-3">
            <svg className="w-12 h-12 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="text-sm text-white/70 mb-1">
            {isDragging ? 'Drop your image here' : 'Drop site plan here'}
          </div>
          <div className="text-xs text-white/40 mb-3">
            or click to browse
          </div>
          <div className="text-[10px] text-white/30">
            Supports PNG, JPG
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-white/70">How it works:</div>
          <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
            <li>Upload your site plan or survey image</li>
            <li>Set a scale reference (click 2 points with known distance)</li>
            <li>Trace your land boundary by clicking corners</li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Hidden file input for changing image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,.pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Image header with change button */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-white/50">
          Scroll to zoom
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
          >
            Change
          </button>
          <button
            onClick={handleRemoveImage}
            className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-red-400"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            className="w-7 h-7 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded flex items-center justify-center"
          >
            −
          </button>
          <span className="text-xs text-white/50 self-center w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="w-7 h-7 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="rounded border border-white/20 w-full cursor-crosshair"
        style={{ maxWidth: canvasSize }}
      />

      {/* Step indicator */}
      <div className="flex gap-2 text-xs mb-2">
        <div className={`flex items-center gap-1 ${scale ? 'text-green-400' : 'text-amber-400'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${scale ? 'bg-green-600' : 'bg-amber-600'}`}>
            {scale ? '✓' : '1'}
          </span>
          Scale
        </div>
        <div className={`flex items-center gap-1 ${points.length >= 3 ? 'text-green-400' : scale ? 'text-white' : 'text-white/30'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${points.length >= 3 ? 'bg-green-600' : scale ? 'bg-white/20' : 'bg-white/10'}`}>
            {points.length >= 3 ? '✓' : '2'}
          </span>
          Trace
        </div>
        <div className={`flex items-center gap-1 ${showSummary ? 'text-green-400' : points.length >= 3 && scale ? 'text-white' : 'text-white/30'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${showSummary ? 'bg-green-600' : points.length >= 3 && scale ? 'bg-white/20' : 'bg-white/10'}`}>
            {showSummary ? '✓' : '3'}
          </span>
          Done
        </div>
      </div>

      {/* Post-trace Summary */}
      {showSummary && (
        <div className="bg-green-900/40 border border-green-500/40 rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium text-green-200 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Trace Complete
          </div>

          {/* Traced Shape Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/50 text-xs">Area</div>
              <div className="text-white font-medium">
                {lengthUnit === 'ft'
                  ? `${(calculateArea() * 10.7639).toFixed(0)} ft²`
                  : `${calculateArea().toFixed(0)} m²`
                }
              </div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/50 text-xs">Perimeter</div>
              <div className="text-white font-medium">
                {lengthUnit === 'ft'
                  ? `${(calculatePerimeter() * 3.28084).toFixed(1)} ft`
                  : `${calculatePerimeter().toFixed(1)} m`
                }
              </div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/50 text-xs">Points</div>
              <div className="text-white font-medium">{points.length}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-white/50 text-xs">Edges</div>
              <div className="text-white font-medium">{points.length}</div>
            </div>
          </div>

          {/* Scale Calibration Info */}
          <div className="bg-white/5 rounded p-2 text-xs">
            <div className="text-white/50 mb-1">Scale Calibration</div>
            <div className="text-white/70">
              Reference: {scaleDistance} {lengthUnit} = {scale ? Math.round(Math.sqrt(
                Math.pow(scalePoints[1]?.x - scalePoints[0]?.x, 2) +
                Math.pow(scalePoints[1]?.y - scalePoints[0]?.y, 2)
              )) : 0} pixels
            </div>
            <div className="text-white/50">
              1 pixel = {scale ? (1/scale).toFixed(4) : 0} m
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleBackToEdit}
              className="flex-1 px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Shape
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 rounded font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Looks Good
            </button>
          </div>

          <div className="text-xs text-white/40 text-center">
            Click "Edit Shape" to refine in the shape editor
          </div>
        </div>
      )}

      {/* Scale calibration UI - hide when showing summary */}
      {!showSummary && !scale ? (
        <div className="bg-amber-900/30 border border-amber-500/30 rounded p-3">
          <div className="text-sm font-medium text-amber-200 mb-2">
            Step 1: Set Scale Reference
          </div>

          {!scaleMode ? (
            <>
              <div className="text-xs text-white/60 mb-2">
                Click two points on a known measurement in the image
              </div>
              <button
                onClick={() => {
                  setScaleMode(true)
                  setScalePoints([])
                }}
                className="w-full px-3 py-2 text-sm bg-amber-600 hover:bg-amber-700 rounded font-medium"
              >
                Start Scale Calibration
              </button>
            </>
          ) : scalePoints.length < 2 ? (
            <>
              <div className="text-xs text-amber-100 mb-2">
                Click point {scalePoints.length + 1} of 2 on a known distance
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 bg-white/10 rounded h-2">
                  <div
                    className="bg-amber-500 h-2 rounded transition-all"
                    style={{ width: `${scalePoints.length * 50}%` }}
                  />
                </div>
                <span className="text-xs text-white/60">{scalePoints.length}/2</span>
              </div>
              <button
                onClick={() => {
                  setScaleMode(false)
                  setScalePoints([])
                }}
                className="mt-2 w-full px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="text-xs text-amber-100 mb-2">
                Enter the real-world distance between the two points:
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={scaleDistance}
                  onChange={(e) => setScaleDistance(e.target.value)}
                  placeholder={`e.g. 10`}
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
                  autoFocus
                />
                <select
                  value={scaleUnit}
                  onChange={(e) => setScaleUnit(e.target.value)}
                  className="px-2 py-2 bg-[#1a1a2e] border border-white/20 rounded text-white text-sm"
                >
                  <option value="m" className="bg-[#1a1a2e] text-white">m</option>
                  <option value="ft" className="bg-[#1a1a2e] text-white">ft</option>
                  <option value="mm" className="bg-[#1a1a2e] text-white">mm</option>
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setScalePoints([])
                  }}
                  className="flex-1 px-2 py-2 text-xs bg-white/10 hover:bg-white/20 rounded"
                >
                  Re-pick Points
                </button>
                <button
                  onClick={handleSetScale}
                  disabled={!scaleDistance}
                  className="flex-1 px-2 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium"
                >
                  Confirm Scale
                </button>
              </div>
            </>
          )}
        </div>
      ) : !showSummary && (
        <div className="bg-green-900/30 border border-green-500/30 rounded p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-200">✓ Scale Set</div>
              <div className="text-xs text-green-300/70">1 pixel = {(1/scale).toFixed(3)}m</div>
            </div>
            <button
              onClick={() => {
                setScale(null)
                setScalePoints([])
                setScaleDistance('')
                setScaleMode(false)
              }}
              className="text-xs text-white/50 hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Trace boundary - hide when showing summary */}
      {scale && !showSummary && (
        <div className={`rounded p-3 ${points.length >= 3 ? 'bg-green-900/30 border border-green-500/30' : 'bg-blue-900/30 border border-blue-500/30'}`}>
          <div className="text-sm font-medium mb-1" style={{ color: points.length >= 3 ? '#86efac' : '#93c5fd' }}>
            Step 2: Trace Boundary ({points.length} points)
          </div>
          <div className="text-xs text-white/60">
            {points.length < 3
              ? 'Click corners of your land boundary (minimum 3 points)'
              : 'Continue adding points or click Done'
            }
          </div>
        </div>
      )}

      {/* Action buttons - hide when showing summary */}
      {!showSummary && (
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={(scaleMode ? scalePoints.length : points.length) === 0}
            className="flex-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded"
          >
            Undo
          </button>
          <button
            onClick={handleClear}
            className="flex-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
          >
            Clear
          </button>
          {points.length >= 3 && scale && (
            <button
              onClick={handleComplete}
              className="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded font-medium"
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Area display - hide when showing summary */}
      {!showSummary && points.length >= 3 && scale && (
        <div className="text-sm font-bold">
          {calculateArea().toFixed(0)} m²
        </div>
      )}
    </div>
  )
}
