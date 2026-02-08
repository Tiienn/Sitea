import { useRef, useState, useEffect, useCallback } from 'react'
import { useUser } from '../hooks/useUser.jsx'
import { detectSitePlanBoundary } from '../services/imageAnalysis'

export default function ImageTracer({
  uploadedImage,
  setUploadedImage,
  onComplete,
  onClear,
  lengthUnit = 'm',
  isPaidUser = false,
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
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [autoDetectError, setAutoDetectError] = useState(null)

  // Drag editing state
  const [draggingIndex, setDraggingIndex] = useState(-1)
  const [pointsHistory, setPointsHistory] = useState([])
  const wasDragging = useRef(false)
  const dragStartRef = useRef(null)
  const [snapInfo, setSnapInfo] = useState(null) // { anchorX, anchorY, angle } for shift-drag visual

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
      setPointsHistory([])
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

  // Keyboard shortcuts: Ctrl+Z to undo, ESC to cancel
  useEffect(() => {
    if (!image) return
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      }
      if (e.key === 'Escape') {
        if (draggingIndex >= 0 && dragStartRef.current) {
          // Cancel drag — restore original position, remove history entry
          setPoints(prev => {
            const next = [...prev]
            next[draggingIndex] = dragStartRef.current
            return next
          })
          setPointsHistory(prev => prev.slice(0, -1))
          setDraggingIndex(-1)
          dragStartRef.current = null
          setSnapInfo(null)
        } else if (scaleMode) {
          setScaleMode(false)
          setScalePoints([])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [image, draggingIndex, scaleMode, pointsHistory.length])

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

        // Draw snap guide line when shift-dragging
        if (snapInfo && draggingIndex >= 0) {
          const anchor = toView({ x: snapInfo.anchorX, y: snapInfo.anchorY })
          const dragged = toView(points[draggingIndex])
          ctx.strokeStyle = '#14b8a6'
          ctx.lineWidth = 1 / zoom
          ctx.setLineDash([4 / zoom, 4 / zoom])
          ctx.beginPath()
          ctx.moveTo(anchor.x, anchor.y)
          ctx.lineTo(dragged.x, dragged.y)
          ctx.stroke()
          ctx.setLineDash([])

          // Angle label at midpoint
          const midX = (anchor.x + dragged.x) / 2
          const midY = (anchor.y + dragged.y) / 2
          const fontSize = Math.max(9, 11 / zoom)
          ctx.font = `bold ${fontSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const angleText = `${snapInfo.angle}°`
          const tw = ctx.measureText(angleText).width
          const pad = 3 / zoom
          ctx.fillStyle = 'rgba(20, 184, 166, 0.7)'
          ctx.fillRect(midX - tw / 2 - pad, midY - fontSize / 2 - pad - 12 / zoom, tw + pad * 2, fontSize + pad * 2)
          ctx.fillStyle = '#fff'
          ctx.fillText(angleText, midX, midY - 12 / zoom)
        }

        // Draw edge dimension labels
        if (scale && points.length >= 2) {
          const edgeCount = points.length >= 3 ? points.length : points.length - 1
          for (let i = 0; i < edgeCount; i++) {
            const j = (i + 1) % points.length
            const vp1 = toView(points[i])
            const vp2 = toView(points[j])
            const dx = points[j].x - points[i].x
            const dy = points[j].y - points[i].y
            const pixelDist = Math.sqrt(dx * dx + dy * dy)
            const meters = pixelDist / scale
            const label = meters < 1 ? `${(meters * 100).toFixed(0)}cm` : `${meters.toFixed(1)}m`

            const midX = (vp1.x + vp2.x) / 2
            const midY = (vp1.y + vp2.y) / 2

            // Offset label perpendicular to edge
            const edgeDx = vp2.x - vp1.x
            const edgeDy = vp2.y - vp1.y
            const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy)
            const nx = edgeLen > 0 ? -edgeDy / edgeLen : 0
            const ny = edgeLen > 0 ? edgeDx / edgeLen : 0
            const offsetDist = 10 / zoom
            const lx = midX + nx * offsetDist
            const ly = midY + ny * offsetDist

            const fontSize = Math.max(8, 10 / zoom)
            ctx.font = `${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(label).width
            const pad = 3 / zoom
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillRect(lx - textWidth / 2 - pad, ly - fontSize / 2 - pad, textWidth + pad * 2, fontSize + pad * 2)
            ctx.fillStyle = '#fff'
            ctx.fillText(label, lx, ly)
          }
        }
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
  }, [image, points, scaleMode, scalePoints, zoom, pan, scale, snapInfo, draggingIndex])

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

  // Convert image-space point to canvas-space (reverse of canvasToImageSpace)
  const imageToCanvasSpace = (imgX, imgY) => {
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
    const baseScale = baseWidth / imgDimensions.width
    const viewX = baseOffsetX + imgX * baseScale
    const viewY = baseOffsetY + imgY * baseScale
    // Apply zoom and pan
    const canvasX = (viewX - canvasSize / 2 + pan.x) * zoom + canvasSize / 2
    const canvasY = (viewY - canvasSize / 2 + pan.y) * zoom + canvasSize / 2
    return { x: canvasX, y: canvasY }
  }

  // Find point index within radius of canvas position, or -1
  const findNearPoint = (canvasX, canvasY, radius = 12) => {
    for (let i = 0; i < points.length; i++) {
      const cp = imageToCanvasSpace(points[i].x, points[i].y)
      const dx = cp.x - canvasX
      const dy = cp.y - canvasY
      if (dx * dx + dy * dy <= radius * radius) return i
    }
    return -1
  }

  // Distance from point (px,py) to line segment (x1,y1)-(x2,y2)
  const pointToSegmentDistance = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const projX = x1 + t * dx
    const projY = y1 + t * dy
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
  }

  // Find edge index within radius of canvas position, or -1
  const findNearEdge = (canvasX, canvasY, radius = 8) => {
    if (points.length < 3) return -1
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      const cp1 = imageToCanvasSpace(points[i].x, points[i].y)
      const cp2 = imageToCanvasSpace(points[j].x, points[j].y)
      const dist = pointToSegmentDistance(canvasX, canvasY, cp1.x, cp1.y, cp2.x, cp2.y)
      if (dist <= radius) return i
    }
    return -1
  }

  // Save current points to undo history (max 50)
  const pushPointsHistory = () => {
    setPointsHistory(prev => [...prev.slice(-49), points.map(p => ({ ...p }))])
  }

  // Snap a point to nearest angle increment from an anchor point (in image space)
  const snapPointToAngle = (anchorX, anchorY, targetX, targetY, snapDegrees = 15) => {
    const dx = targetX - anchorX
    const dy = targetY - anchorY
    const distance = Math.hypot(dx, dy)
    if (distance === 0) return { x: targetX, y: targetY, angle: 0 }
    const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI)
    const snappedAngle = Math.round(currentAngle / snapDegrees) * snapDegrees
    const snappedRadians = snappedAngle * (Math.PI / 180)
    return {
      x: anchorX + distance * Math.cos(snappedRadians),
      y: anchorY + distance * Math.sin(snappedRadians),
      angle: snappedAngle,
    }
  }

  // Snap dragged point to best angle relative to adjacent points
  const snapToAngle = (pointIndex, imgX, imgY) => {
    if (points.length < 2) return { x: imgX, y: imgY, angle: 0, anchorX: imgX, anchorY: imgY }
    const prevIndex = (pointIndex - 1 + points.length) % points.length
    const nextIndex = (pointIndex + 1) % points.length
    const prevPt = points[prevIndex]
    const nextPt = points[nextIndex]
    const snappedPrev = snapPointToAngle(prevPt.x, prevPt.y, imgX, imgY)
    const snappedNext = snapPointToAngle(nextPt.x, nextPt.y, imgX, imgY)
    const distPrev = Math.hypot(snappedPrev.x - imgX, snappedPrev.y - imgY)
    const distNext = Math.hypot(snappedNext.x - imgX, snappedNext.y - imgY)
    if (distPrev <= distNext) {
      return { ...snappedPrev, anchorX: prevPt.x, anchorY: prevPt.y }
    }
    return { ...snappedNext, anchorX: nextPt.x, anchorY: nextPt.y }
  }

  const handleCanvasClick = (e) => {
    if (isPanning) return
    // Skip adding a point if we just finished dragging
    if (wasDragging.current) {
      wasDragging.current = false
      return
    }

    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (canvasSize / rect.width)
    const canvasY = (e.clientY - rect.top) * (canvasSize / rect.height)

    const imagePoint = canvasToImageSpace(canvasX, canvasY)

    if (scaleMode) {
      setScalePoints(prev => {
        if (prev.length < 2) return [...prev, imagePoint]
        return prev
      })
    } else if (scale) {
      // Check if clicking near an edge to insert a point there
      if (points.length >= 3) {
        const edgeIdx = findNearEdge(canvasX, canvasY)
        if (edgeIdx >= 0) {
          pushPointsHistory()
          setPoints(prev => {
            const next = [...prev]
            next.splice(edgeIdx + 1, 0, imagePoint)
            return next
          })
          return
        }
      }
      // Otherwise append point
      pushPointsHistory()
      setPoints(prev => [...prev, imagePoint])
    }
  }

  const handleMouseDown = (e) => {
    // Middle mouse button (wheel click) to pan
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setLastPanPos({ x: e.clientX, y: e.clientY })
      return
    }
    // Left-click: check if near a point to start dragging
    if (e.button === 0 && scale && !scaleMode && points.length > 0) {
      const rect = canvasRef.current.getBoundingClientRect()
      const canvasX = (e.clientX - rect.left) * (canvasSize / rect.width)
      const canvasY = (e.clientY - rect.top) * (canvasSize / rect.height)
      const idx = findNearPoint(canvasX, canvasY)
      if (idx >= 0) {
        pushPointsHistory()
        dragStartRef.current = { ...points[idx] }
        setDraggingIndex(idx)
      }
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = (e.clientX - lastPanPos.x) / zoom
      const dy = (e.clientY - lastPanPos.y) / zoom
      setPan({ x: pan.x + dx, y: pan.y + dy })
      setLastPanPos({ x: e.clientX, y: e.clientY })
      return
    }
    // Drag a point
    if (draggingIndex >= 0) {
      const rect = canvasRef.current.getBoundingClientRect()
      const canvasX = (e.clientX - rect.left) * (canvasSize / rect.width)
      const canvasY = (e.clientY - rect.top) * (canvasSize / rect.height)
      let imgPt = canvasToImageSpace(canvasX, canvasY)

      // Shift+drag: snap to 15° angle increments
      if (e.shiftKey && points.length > 1) {
        const snapped = snapToAngle(draggingIndex, imgPt.x, imgPt.y)
        imgPt = { x: snapped.x, y: snapped.y }
        setSnapInfo({ anchorX: snapped.anchorX, anchorY: snapped.anchorY, angle: snapped.angle })
      } else {
        setSnapInfo(null)
      }

      setPoints(prev => {
        const next = [...prev]
        next[draggingIndex] = imgPt
        return next
      })
    }
  }

  const handleMouseUp = (e) => {
    if (e.button === 1) {
      setIsPanning(false)
    }
    if (draggingIndex >= 0) {
      wasDragging.current = true
      setDraggingIndex(-1)
      dragStartRef.current = null
      setSnapInfo(null)
    }
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    if (!scale || scaleMode || points.length === 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (canvasSize / rect.width)
    const canvasY = (e.clientY - rect.top) * (canvasSize / rect.height)
    const idx = findNearPoint(canvasX, canvasY, 15)
    if (idx >= 0) {
      pushPointsHistory()
      setPoints(prev => prev.filter((_, i) => i !== idx))
    }
  }

  // Double-click edge to straighten it to nearest H/V/45°
  const handleDoubleClick = (e) => {
    if (!scale || scaleMode || points.length < 3) return
    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (canvasSize / rect.width)
    const canvasY = (e.clientY - rect.top) * (canvasSize / rect.height)
    const edgeIdx = findNearEdge(canvasX, canvasY, 12)
    if (edgeIdx < 0) return

    pushPointsHistory()
    setPoints(prev => {
      const next = prev.map(p => ({ ...p }))
      const p1 = next[edgeIdx]
      const p2Idx = (edgeIdx + 1) % next.length
      const p2 = next[p2Idx]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      const length = Math.hypot(dx, dy)

      // Find closest target angle
      const targets = [0, 45, 90, 135, 180, -45, -90, -135, -180]
      let closestAngle = 0
      let minDiff = Infinity
      for (const t of targets) {
        const diff = Math.abs(angle - t)
        if (diff < minDiff) { minDiff = diff; closestAngle = t }
      }

      const rad = closestAngle * (Math.PI / 180)
      next[p2Idx] = { x: p1.x + length * Math.cos(rad), y: p1.y + length * Math.sin(rad) }
      return next
    })
  }

  // Straighten all edges that are close to H/V (within 10°)
  const handleStraightenAll = () => {
    if (points.length < 3 || !scale) return
    pushPointsHistory()
    setPoints(prev => {
      const next = prev.map(p => ({ ...p }))
      for (let i = 0; i < next.length; i++) {
        const j = (i + 1) % next.length
        const dx = next[j].x - next[i].x
        const dy = next[j].y - next[i].y
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)

        // Straighten if within 10° of horizontal
        if (Math.abs(angle) < 10 || Math.abs(angle - 180) < 10 || Math.abs(angle + 180) < 10) {
          next[j] = { ...next[j], y: next[i].y }
        }
        // Straighten if within 10° of vertical
        else if (Math.abs(angle - 90) < 10 || Math.abs(angle + 90) < 10) {
          next[j] = { ...next[j], x: next[i].x }
        }
      }
      return next
    })
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

  const handleAutoDetect = async () => {
    if (!image || autoDetecting) return
    setAutoDetecting(true)
    setAutoDetectError(null)

    try {
      const result = await detectSitePlanBoundary(image)

      // Boundary coordinates are already in original image space (resizing handled in service)
      setPoints(result.boundary)
      setPointsHistory([])

      // If scale was returned, set it (already scaled to original image coords)
      if (result.scale?.pixelsPerMeter) {
        setScale(result.scale.pixelsPerMeter)
        setScaleMode(false)
      }
    } catch (err) {
      setAutoDetectError(err.message || 'Detection failed. Try manual tracing.')
    } finally {
      setAutoDetecting(false)
    }
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
    setPointsHistory([])
    onClear?.()
  }

  const handleUndo = () => {
    if (scaleMode && scalePoints.length > 0) {
      setScalePoints(scalePoints.slice(0, -1))
    } else if (pointsHistory.length > 0) {
      setPointsHistory(prev => {
        const next = [...prev]
        const restored = next.pop()
        setPoints(restored)
        return next
      })
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
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsPanning(false); if (draggingIndex >= 0) { wasDragging.current = true; setDraggingIndex(-1); dragStartRef.current = null; setSnapInfo(null) } }}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        className="rounded border border-white/20 w-full"
        style={{ maxWidth: canvasSize, cursor: draggingIndex >= 0 ? 'grabbing' : 'crosshair' }}
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
            {scalePoints.length >= 2 ? (
              <div className="text-white/70">
                Reference: {scaleDistance} {lengthUnit} = {Math.round(Math.sqrt(
                  Math.pow(scalePoints[1].x - scalePoints[0].x, 2) +
                  Math.pow(scalePoints[1].y - scalePoints[0].y, 2)
                ))} pixels
              </div>
            ) : (
              <div className="text-white/70">Scale set via auto-detect</div>
            )}
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

              {/* Auto-detect boundary — paid users only */}
              {isPaidUser && (
                <>
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <button
                    onClick={handleAutoDetect}
                    disabled={autoDetecting}
                    className="w-full px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-wait rounded font-medium flex items-center justify-center gap-2"
                  >
                    {autoDetecting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Detecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Auto-detect Boundary
                        <span className="text-[9px] bg-cyan-400/20 text-cyan-200 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Pro</span>
                      </>
                    )}
                  </button>
                  {autoDetectError && (
                    <div className="text-xs text-red-400 mt-1">{autoDetectError}</div>
                  )}
                </>
              )}
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
              : 'Drag to adjust · Shift+drag to snap 45°/90° · Right-click to delete'
            }
          </div>
          {points.length >= 3 && (
            <div className="text-xs text-white/40 mt-0.5">
              Double-click edge to straighten · Ctrl+Z to undo
            </div>
          )}
        </div>
      )}

      {/* Action buttons - hide when showing summary */}
      {!showSummary && (
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={(scaleMode ? scalePoints.length : pointsHistory.length) === 0}
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
            <>
              <button
                onClick={handleStraightenAll}
                className="flex-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
                title="Straighten edges close to horizontal/vertical"
              >
                Straighten
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded font-medium"
              >
                Done
              </button>
            </>
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
