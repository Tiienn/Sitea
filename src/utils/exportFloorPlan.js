/**
 * Floor Plan Export Utility
 * Exports 2D floor plan as PNG image using Canvas API
 */

// Calculate bounding box of land and walls
function calculateBounds(landPoints, walls) {
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  // Include land points
  for (const point of landPoints || []) {
    const z = point.z ?? point.y
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }

  // Include walls
  for (const wall of walls || []) {
    minX = Math.min(minX, wall.start.x, wall.end.x)
    maxX = Math.max(maxX, wall.start.x, wall.end.x)
    minZ = Math.min(minZ, wall.start.z, wall.end.z)
    maxZ = Math.max(maxZ, wall.start.z, wall.end.z)
  }

  // Handle empty case
  if (minX === Infinity) {
    return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }
  }

  return { minX, maxX, minZ, maxZ }
}

// Calculate scale to fit content in canvas
function calculateScale(bounds, availableWidth, availableHeight) {
  const worldWidth = bounds.maxX - bounds.minX
  const worldHeight = bounds.maxZ - bounds.minZ

  if (worldWidth <= 0 || worldHeight <= 0) return 50

  const scaleX = availableWidth / worldWidth
  const scaleY = availableHeight / worldHeight

  return Math.min(scaleX, scaleY)
}

// Get wall length
function getWallLength(wall) {
  const dx = wall.end.x - wall.start.x
  const dz = wall.end.z - wall.start.z
  return Math.sqrt(dx * dx + dz * dz)
}

// Draw land boundary
function drawLandBoundary(ctx, landPoints, toCanvas) {
  if (!landPoints || landPoints.length < 3) return

  ctx.beginPath()
  const first = toCanvas(landPoints[0].x, landPoints[0].z ?? landPoints[0].y)
  ctx.moveTo(first.x, first.y)

  for (let i = 1; i < landPoints.length; i++) {
    const p = toCanvas(landPoints[i].x, landPoints[i].z ?? landPoints[i].y)
    ctx.lineTo(p.x, p.y)
  }

  ctx.closePath()

  // Fill
  ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'
  ctx.fill()

  // Stroke
  ctx.strokeStyle = '#22C55E'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 5])
  ctx.stroke()
  ctx.setLineDash([])
}

// Draw rooms (floors)
function drawRooms(ctx, rooms, toCanvas, includeLabels) {
  for (const room of rooms || []) {
    if (!room.points || room.points.length < 3) continue

    // Draw room floor
    ctx.beginPath()
    const first = toCanvas(room.points[0].x, room.points[0].z)
    ctx.moveTo(first.x, first.y)

    for (let i = 1; i < room.points.length; i++) {
      const p = toCanvas(room.points[i].x, room.points[i].z)
      ctx.lineTo(p.x, p.y)
    }

    ctx.closePath()
    ctx.fillStyle = 'rgba(55, 65, 81, 0.5)'
    ctx.fill()

    // Room label
    if (includeLabels && room.area > 0 && room.center) {
      const center = toCanvas(room.center.x, room.center.z)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${room.area.toFixed(1)} m²`, center.x, center.y)
    }
  }
}

// Draw wall with openings
function drawWallWithOpenings(ctx, wall, toCanvas, scale) {
  const wallLength = getWallLength(wall)
  const openings = [...(wall.openings || [])].sort((a, b) => a.position - b.position)

  const start = toCanvas(wall.start.x, wall.start.z)
  const end = toCanvas(wall.end.x, wall.end.z)

  if (wallLength < 0.01) return

  const dirX = (end.x - start.x) / wallLength
  const dirY = (end.y - start.y) / wallLength

  let currentPos = 0

  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'

  for (const opening of openings) {
    const openingStart = opening.position - opening.width / 2
    const openingEnd = opening.position + opening.width / 2

    // Draw wall segment before opening
    if (openingStart > currentPos) {
      const segStartX = start.x + (currentPos / wallLength) * (end.x - start.x)
      const segStartY = start.y + (currentPos / wallLength) * (end.y - start.y)
      const segEndX = start.x + (openingStart / wallLength) * (end.x - start.x)
      const segEndY = start.y + (openingStart / wallLength) * (end.y - start.y)

      ctx.beginPath()
      ctx.moveTo(segStartX, segStartY)
      ctx.lineTo(segEndX, segEndY)
      ctx.stroke()
    }

    currentPos = openingEnd
  }

  // Draw final segment
  if (currentPos < wallLength) {
    const segStartX = start.x + (currentPos / wallLength) * (end.x - start.x)
    const segStartY = start.y + (currentPos / wallLength) * (end.y - start.y)

    ctx.beginPath()
    ctx.moveTo(segStartX, segStartY)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }
}

// Draw walls
function drawWalls(ctx, walls, toCanvas, scale, includeDimensions) {
  for (const wall of walls || []) {
    const start = toCanvas(wall.start.x, wall.start.z)
    const end = toCanvas(wall.end.x, wall.end.z)

    const openings = wall.openings || []

    if (openings.length === 0) {
      // Solid wall
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
    } else {
      // Wall with openings
      drawWallWithOpenings(ctx, wall, toCanvas, scale)
    }

    // Dimension label
    if (includeDimensions) {
      const length = getWallLength(wall)
      if (length > 0.5) {
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2

        // Offset label perpendicular to wall
        const angle = Math.atan2(end.y - start.y, end.x - start.x)
        const offsetX = Math.sin(angle) * 18
        const offsetY = -Math.cos(angle) * 18

        ctx.fillStyle = '#9CA3AF'
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${length.toFixed(1)}m`, midX + offsetX, midY + offsetY)
      }
    }
  }
}

// Draw door symbol
function drawDoorSymbol(ctx, x, y, angle, width) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  // After rotation: +X is along wall direction, +Y is perpendicular (into canvas)
  // Door hinge at one edge of opening, leaf swings perpendicular to wall
  const doorWidth = width * 0.9

  // Door swing arc - from along wall (+X) to perpendicular (+Y)
  ctx.beginPath()
  ctx.arc(-width / 2, 0, doorWidth, 0, Math.PI / 2)
  ctx.strokeStyle = '#14B8A6'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.setLineDash([])

  // Door leaf in open position (perpendicular to wall)
  ctx.beginPath()
  ctx.moveTo(-width / 2, 0)
  ctx.lineTo(-width / 2, doorWidth)
  ctx.strokeStyle = '#14B8A6'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.restore()
}

// Draw window symbol
function drawWindowSymbol(ctx, x, y, angle, width) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  const halfWidth = width / 2
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 2

  ctx.beginPath()
  ctx.moveTo(-halfWidth, -4)
  ctx.lineTo(-halfWidth, 4)
  ctx.moveTo(halfWidth, -4)
  ctx.lineTo(halfWidth, 4)
  ctx.stroke()

  ctx.restore()
}

// Draw openings (doors and windows)
function drawOpenings(ctx, walls, toCanvas, scale) {
  for (const wall of walls || []) {
    const wallLength = getWallLength(wall)
    if (wallLength < 0.01) continue

    const start = toCanvas(wall.start.x, wall.start.z)
    const end = toCanvas(wall.end.x, wall.end.z)

    for (const opening of wall.openings || []) {
      const t = opening.position / wallLength
      const posX = start.x + t * (end.x - start.x)
      const posY = start.y + t * (end.y - start.y)

      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const pixelWidth = opening.width * scale

      if (opening.type === 'door') {
        drawDoorSymbol(ctx, posX, posY, angle, pixelWidth)
      } else if (opening.type === 'window') {
        drawWindowSymbol(ctx, posX, posY, angle, pixelWidth)
      }
    }
  }
}

// Draw grid
function drawGrid(ctx, bounds, scale, padding) {
  const gridSize = 1 // 1 meter grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1

  // Vertical lines
  for (let x = Math.floor(bounds.minX); x <= Math.ceil(bounds.maxX); x += gridSize) {
    const canvasX = padding + (x - bounds.minX) * scale
    ctx.beginPath()
    ctx.moveTo(canvasX, padding)
    ctx.lineTo(canvasX, padding + (bounds.maxZ - bounds.minZ) * scale)
    ctx.stroke()
  }

  // Horizontal lines
  for (let z = Math.floor(bounds.minZ); z <= Math.ceil(bounds.maxZ); z += gridSize) {
    const canvasY = padding + (z - bounds.minZ) * scale
    ctx.beginPath()
    ctx.moveTo(padding, canvasY)
    ctx.lineTo(padding + (bounds.maxX - bounds.minX) * scale, canvasY)
    ctx.stroke()
  }
}

// Draw legend
function drawLegend(ctx, canvasWidth, canvasHeight) {
  const legendX = canvasWidth - 180
  const legendY = canvasHeight - 120

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(legendX - 10, legendY - 10, 170, 110)

  ctx.font = 'bold 14px Arial'
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.fillText('Legend', legendX, legendY + 5)

  ctx.font = '12px Arial'

  // Wall
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(legendX, legendY + 25)
  ctx.lineTo(legendX + 30, legendY + 25)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('Wall', legendX + 40, legendY + 29)

  // Door
  ctx.strokeStyle = '#14B8A6'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(legendX + 15, legendY + 50, 12, -Math.PI / 2, 0)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('Door', legendX + 40, legendY + 54)

  // Window
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(legendX + 5, legendY + 70)
  ctx.lineTo(legendX + 5, legendY + 80)
  ctx.moveTo(legendX + 25, legendY + 70)
  ctx.lineTo(legendX + 25, legendY + 80)
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('Window', legendX + 40, legendY + 79)
}

// Draw title
function drawTitle(ctx, canvasWidth) {
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 24px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Floor Plan', canvasWidth / 2, 40)

  ctx.font = '14px Arial'
  ctx.fillStyle = '#9CA3AF'
  ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, canvasWidth / 2, 60)
}

// Draw scale bar
function drawScaleBar(ctx, scale, canvasWidth, canvasHeight) {
  const barLength = 5 // 5 meters
  const barPixels = barLength * scale

  const x = 50
  const y = canvasHeight - 30

  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2

  // Main bar
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + barPixels, y)
  ctx.stroke()

  // End caps
  ctx.beginPath()
  ctx.moveTo(x, y - 5)
  ctx.lineTo(x, y + 5)
  ctx.moveTo(x + barPixels, y - 5)
  ctx.lineTo(x + barPixels, y + 5)
  ctx.stroke()

  // Label
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`${barLength}m`, x + barPixels / 2, y - 10)
}

/**
 * Export floor plan as PNG image
 * @param {Object} options - Export options
 * @param {Array} options.landPoints - Land boundary polygon points
 * @param {Array} options.walls - Walls array with openings
 * @param {Array} options.rooms - Detected rooms with areas
 * @param {boolean} options.includeDimensions - Show wall dimensions
 * @param {boolean} options.includeRoomLabels - Show room areas
 * @param {boolean} options.includeLegend - Show legend
 * @param {boolean} options.includeGrid - Show grid
 * @param {number} options.canvasWidth - Canvas width in pixels
 * @param {number} options.canvasHeight - Canvas height in pixels
 * @param {number} options.padding - Padding around content
 */
export async function exportFloorPlanAsPNG(options) {
  const {
    landPoints = [],
    walls = [],
    rooms = [],
    includeDimensions = true,
    includeRoomLabels = true,
    includeLegend = true,
    includeGrid = false,
    canvasWidth = 2000,
    canvasHeight = 2000,
    padding = 100,
  } = options

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')

  // Calculate bounds
  const bounds = calculateBounds(landPoints, walls)
  const scale = calculateScale(bounds, canvasWidth - padding * 2, canvasHeight - padding * 2)

  // Transform function: world coords to canvas coords
  const toCanvas = (x, z) => ({
    x: padding + (x - bounds.minX) * scale,
    y: padding + (z - bounds.minZ) * scale,
  })

  // Background
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Grid (optional)
  if (includeGrid) {
    drawGrid(ctx, bounds, scale, padding)
  }

  // Land boundary
  drawLandBoundary(ctx, landPoints, toCanvas)

  // Rooms (floors)
  drawRooms(ctx, rooms, toCanvas, includeRoomLabels)

  // Walls
  drawWalls(ctx, walls, toCanvas, scale, includeDimensions)

  // Doors and Windows
  drawOpenings(ctx, walls, toCanvas, scale)

  // Legend
  if (includeLegend) {
    drawLegend(ctx, canvasWidth, canvasHeight)
  }

  // Title and scale bar
  drawTitle(ctx, canvasWidth)
  drawScaleBar(ctx, scale, canvasWidth, canvasHeight)

  // Convert to blob and download
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `floor-plan-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}
