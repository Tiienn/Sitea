import jsPDF from 'jspdf'

// Calculate bounding box of land and walls
function calculateBounds(landPoints, walls) {
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const point of landPoints || []) {
    const z = point.z ?? point.y
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }

  for (const wall of walls || []) {
    minX = Math.min(minX, wall.start.x, wall.end.x)
    maxX = Math.max(maxX, wall.start.x, wall.end.x)
    minZ = Math.min(minZ, wall.start.z, wall.end.z)
    maxZ = Math.max(maxZ, wall.start.z, wall.end.z)
  }

  if (minX === Infinity) {
    return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }
  }

  return { minX, maxX, minZ, maxZ }
}

// Calculate scale to fit content
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

/**
 * Generate floor plan canvas for PDF
 */
function generateFloorPlanCanvas(options = {}) {
  const {
    landPoints = [],
    walls = [],
    rooms = [],
    includeDimensions = true,
    includeRoomLabels = true,
    canvasWidth = 1200,
    canvasHeight = 1200,
    padding = 60,
  } = options

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')

  const bounds = calculateBounds(landPoints, walls)
  const scale = calculateScale(bounds, canvasWidth - padding * 2, canvasHeight - padding * 2)

  const toCanvas = (x, z) => ({
    x: padding + (x - bounds.minX) * scale,
    y: padding + (z - bounds.minZ) * scale,
  })

  // Background
  ctx.fillStyle = '#f9fafb'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Land boundary
  if (landPoints.length >= 3) {
    ctx.beginPath()
    const first = toCanvas(landPoints[0].x, landPoints[0].z ?? landPoints[0].y)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < landPoints.length; i++) {
      const p = toCanvas(landPoints[i].x, landPoints[i].z ?? landPoints[i].y)
      ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'
    ctx.fill()
    ctx.strokeStyle = '#22C55E'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Rooms
  for (const room of rooms || []) {
    if (!room.points || room.points.length < 3) continue

    ctx.beginPath()
    const first = toCanvas(room.points[0].x, room.points[0].z)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < room.points.length; i++) {
      const p = toCanvas(room.points[i].x, room.points[i].z)
      ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(229, 231, 235, 0.7)'
    ctx.fill()

    if (includeRoomLabels && room.area > 0 && room.center) {
      const center = toCanvas(room.center.x, room.center.z)
      ctx.fillStyle = '#374151'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${room.area.toFixed(1)} m²`, center.x, center.y)
    }
  }

  // Walls
  for (const wall of walls || []) {
    const start = toCanvas(wall.start.x, wall.start.z)
    const end = toCanvas(wall.end.x, wall.end.z)

    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()

    // Dimension labels
    if (includeDimensions) {
      const length = getWallLength(wall)
      if (length > 0.5) {
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2
        const angle = Math.atan2(end.y - start.y, end.x - start.x)
        const offsetX = Math.sin(angle) * 15
        const offsetY = -Math.cos(angle) * 15

        ctx.fillStyle = '#6b7280'
        ctx.font = '11px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${length.toFixed(1)}m`, midX + offsetX, midY + offsetY)
      }
    }
  }

  // Door/window symbols
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
        ctx.save()
        ctx.translate(posX, posY)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.arc(-pixelWidth / 2, 0, pixelWidth * 0.9, 0, Math.PI / 2)
        ctx.strokeStyle = '#14B8A6'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 2])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(-pixelWidth / 2, 0)
        ctx.lineTo(-pixelWidth / 2, pixelWidth * 0.9)
        ctx.strokeStyle = '#14B8A6'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      } else if (opening.type === 'window') {
        ctx.save()
        ctx.translate(posX, posY)
        ctx.rotate(angle)
        ctx.strokeStyle = '#3B82F6'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-pixelWidth / 2, -3)
        ctx.lineTo(-pixelWidth / 2, 3)
        ctx.moveTo(pixelWidth / 2, -3)
        ctx.lineTo(pixelWidth / 2, 3)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  return canvas
}

/**
 * Export floor plan as a PDF document
 * @param {Object} options - Export options
 */
export async function exportToPDF(options = {}) {
  const {
    title = 'Floor Plan',
    wallCount = 0,
    roomCount = 0,
    landArea = 0,
    buildingArea = 0,
    filename = 'floor-plan',
    landPoints = [],
    walls = [],
    rooms = [],
    includeDimensions = true,
    includeRoomLabels = true,
  } = options

  // Create PDF in A4 portrait
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  // Colors
  const accentColor = [16, 185, 129]
  const darkGray = [31, 41, 55]
  const mediumGray = [107, 114, 128]
  const lightGray = [229, 231, 235]

  // Header bar
  pdf.setFillColor(...accentColor)
  pdf.rect(0, 0, pageWidth, 25, 'F')

  // Title
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text(title, margin, 16)

  // Date
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(date, pageWidth - margin, 16, { align: 'right' })

  let currentY = 35

  // Generate floor plan canvas
  const hasContent = landPoints.length >= 3 || walls.length > 0
  if (hasContent) {
    try {
      const floorPlanCanvas = generateFloorPlanCanvas({
        landPoints,
        walls,
        rooms,
        includeDimensions,
        includeRoomLabels,
        canvasWidth: 1200,
        canvasHeight: 1200,
      })

      const imgData = floorPlanCanvas.toDataURL('image/png')

      // Calculate dimensions to fit
      let imgWidth = contentWidth
      let imgHeight = imgWidth // Square aspect ratio

      const maxImageHeight = pageHeight - currentY - 70
      if (imgHeight > maxImageHeight) {
        imgHeight = maxImageHeight
        imgWidth = imgHeight
      }

      const imgX = margin + (contentWidth - imgWidth) / 2

      // Border
      pdf.setDrawColor(...lightGray)
      pdf.setLineWidth(0.5)
      pdf.rect(imgX - 2, currentY - 2, imgWidth + 4, imgHeight + 4)

      // Image
      pdf.addImage(imgData, 'PNG', imgX, currentY, imgWidth, imgHeight)

      currentY += imgHeight + 12
    } catch (error) {
      console.error('Error generating floor plan for PDF:', error)
      pdf.setFillColor(...lightGray)
      pdf.rect(margin, currentY, contentWidth, 80, 'F')
      pdf.setTextColor(...mediumGray)
      pdf.setFontSize(12)
      pdf.text('Floor plan image unavailable', pageWidth / 2, currentY + 40, { align: 'center' })
      currentY += 92
    }
  } else {
    pdf.setFillColor(249, 250, 251)
    pdf.rect(margin, currentY, contentWidth, 80, 'F')
    pdf.setDrawColor(...lightGray)
    pdf.rect(margin, currentY, contentWidth, 80)
    pdf.setTextColor(...mediumGray)
    pdf.setFontSize(12)
    pdf.text('No floor plan data', pageWidth / 2, currentY + 40, { align: 'center' })
    currentY += 92
  }

  // Statistics section
  pdf.setFillColor(249, 250, 251)
  pdf.rect(margin, currentY, contentWidth, 35, 'F')
  pdf.setDrawColor(...lightGray)
  pdf.rect(margin, currentY, contentWidth, 35)

  // Stats header
  pdf.setTextColor(...darkGray)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PROJECT STATISTICS', margin + 5, currentY + 8)

  // Stats grid
  const statsY = currentY + 15
  const colWidth = contentWidth / 4

  const stats = [
    { label: 'Walls', value: wallCount.toString() },
    { label: 'Rooms', value: roomCount.toString() },
    { label: 'Land Area', value: landArea > 0 ? `${landArea.toFixed(1)} m²` : '—' },
    { label: 'Building Area', value: buildingArea > 0 ? `${buildingArea.toFixed(1)} m²` : '—' },
  ]

  stats.forEach((stat, i) => {
    const x = margin + colWidth * i + colWidth / 2

    pdf.setTextColor(...accentColor)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text(stat.value, x, statsY + 5, { align: 'center' })

    pdf.setTextColor(...mediumGray)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(stat.label, x, statsY + 12, { align: 'center' })
  })

  // Footer
  pdf.setTextColor(...mediumGray)
  pdf.setFontSize(8)
  pdf.text(
    `Generated on ${new Date().toLocaleString()}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  // Save
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const finalFilename = `${filename}-${timestamp}.pdf`
  pdf.save(finalFilename)

  return { filename: finalFilename }
}
