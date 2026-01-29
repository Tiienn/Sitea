import { useRef, useEffect, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

const FEET_PER_METER = 3.28084

export default function Minimap({
  landWidth,
  landLength,
  polygonPoints,
  placedBuildings,
  comparisonObjects,
  comparisonPositions = {},
  comparisonRotations = {},
  playerPosition,
  playerRotation,
  lengthUnit = 'm',
  walls = [],
  rooms = [],
  buildings = []
}) {
  const canvasRef = useRef(null)
  const [showDimensions, setShowDimensions] = useState(true)
  const isMobile = useIsMobile()
  const size = isMobile ? 100 : 160

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, size, size)

    // Calculate bounds for the view
    // Use polygon coordinates directly to match Edit panel orientation
    let minX, maxX, minY, maxY

    if (polygonPoints && polygonPoints.length >= 3) {
      minX = Math.min(...polygonPoints.map(p => p.x))
      maxX = Math.max(...polygonPoints.map(p => p.x))
      minY = Math.min(...polygonPoints.map(p => p.y))
      maxY = Math.max(...polygonPoints.map(p => p.y))
    } else {
      minX = -landWidth / 2
      maxX = landWidth / 2
      minY = -landLength / 2
      maxY = landLength / 2
    }

    // Add padding
    const padding = Math.max(maxX - minX, maxY - minY) * 0.2
    minX -= padding
    maxX += padding
    minY -= padding
    maxY += padding

    const rangeX = maxX - minX
    const rangeY = maxY - minY
    const scale = Math.min(size / rangeX, size / rangeY) * 0.9

    // Center offset
    const offsetX = size / 2
    const offsetY = size / 2

    // Transform polygon coords to canvas coords (flip Y to match Edit panel)
    const toCanvas = (x, y) => ({
      x: offsetX + (x - (minX + maxX) / 2) * scale,
      y: offsetY - (y - (minY + maxY) / 2) * scale  // Flip Y to match Edit panel
    })

    // Transform world coords to canvas for player position
    // World Z = -polygon.Y, and we want to match Edit panel orientation
    const worldToCanvas = (worldX, worldZ) => {
      // Convert world Z back to polygon Y coordinate
      const polygonY = -worldZ
      return toCanvas(worldX, polygonY)
    }

    // Draw land boundary
    ctx.strokeStyle = '#4ade80'
    ctx.fillStyle = 'rgba(74, 222, 128, 0.2)'
    ctx.lineWidth = 2
    ctx.beginPath()

    if (polygonPoints && polygonPoints.length >= 3) {
      // Use polygon coordinates directly to match Edit panel orientation
      const first = toCanvas(polygonPoints[0].x, polygonPoints[0].y)
      ctx.moveTo(first.x, first.y)
      for (let i = 1; i < polygonPoints.length; i++) {
        const p = toCanvas(polygonPoints[i].x, polygonPoints[i].y)
        ctx.lineTo(p.x, p.y)
      }
    } else {
      const corners = [
        toCanvas(-landWidth / 2, -landLength / 2),
        toCanvas(landWidth / 2, -landLength / 2),
        toCanvas(landWidth / 2, landLength / 2),
        toCanvas(-landWidth / 2, landLength / 2)
      ]
      ctx.moveTo(corners[0].x, corners[0].y)
      corners.forEach(c => ctx.lineTo(c.x, c.y))
    }

    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Draw dimension labels along edges
    if (showDimensions) {
      ctx.font = '9px sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Get edges based on shape type
      let edges = []
      if (polygonPoints && polygonPoints.length >= 3) {
        for (let i = 0; i < polygonPoints.length; i++) {
          const p1 = polygonPoints[i]
          const p2 = polygonPoints[(i + 1) % polygonPoints.length]
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const lengthMeters = Math.sqrt(dx * dx + dy * dy)
          // Use polygon coordinates directly to match Edit panel
          edges.push({
            start: toCanvas(p1.x, p1.y),
            end: toCanvas(p2.x, p2.y),
            length: lengthMeters
          })
        }
      } else {
        // Rectangle edges
        const corners = [
          { x: -landWidth / 2, y: -landLength / 2 },
          { x: landWidth / 2, y: -landLength / 2 },
          { x: landWidth / 2, y: landLength / 2 },
          { x: -landWidth / 2, y: landLength / 2 }
        ]
        const lengths = [landWidth, landLength, landWidth, landLength]
        for (let i = 0; i < 4; i++) {
          const p1 = corners[i]
          const p2 = corners[(i + 1) % 4]
          edges.push({
            start: toCanvas(p1.x, p1.y),
            end: toCanvas(p2.x, p2.y),
            length: lengths[i]
          })
        }
      }

      // Draw label for each edge
      edges.forEach(edge => {
        const midX = (edge.start.x + edge.end.x) / 2
        const midY = (edge.start.y + edge.end.y) / 2

        // Convert to display unit
        let displayLength = edge.length
        let unit = 'm'
        if (lengthUnit === 'ft') {
          displayLength = edge.length * FEET_PER_METER
          unit = 'ft'
        }

        // Always use toFixed(1) to match main view formatting
        const label = `${displayLength.toFixed(1)}${unit}`

        // Draw background for readability
        const textWidth = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(midX - textWidth / 2 - 2, midY - 6, textWidth + 4, 12)

        // Draw text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fillText(label, midX, midY)
      })
    }

    // Draw comparison objects using positions and rotations from state
    if (comparisonObjects && comparisonObjects.length > 0) {
      const totalObjects = comparisonObjects.length
      comparisonObjects.forEach((obj, index) => {
        // Use position from state or calculate default (staggered horizontally)
        const defaultX = (index - (totalObjects - 1) / 2) * 15
        const defaultZ = 0
        const pos = comparisonPositions[obj.id] || { x: defaultX, z: defaultZ }
        const rotation = comparisonRotations[obj.id] || 0
        const rotRad = (rotation * Math.PI) / 180

        const p = worldToCanvas(pos.x, pos.z)
        const w = obj.width * scale
        const h = obj.length * scale

        // Save context, translate and rotate
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(-rotRad)  // Negate since Y-axis is flipped

        // Draw rotated rectangle
        ctx.fillStyle = obj.color + '80'
        ctx.strokeStyle = obj.color
        ctx.lineWidth = 1
        ctx.fillRect(-w / 2, -h / 2, w, h)
        ctx.strokeRect(-w / 2, -h / 2, w, h)

        // Draw direction indicator (small triangle on "front" edge, pointing +Z in local space)
        const indicatorSize = Math.min(w, h) * 0.25
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(0, -h / 2 - 1) // Top center (front edge in Y-down canvas)
        ctx.lineTo(-indicatorSize / 2, -h / 2 + indicatorSize)
        ctx.lineTo(indicatorSize / 2, -h / 2 + indicatorSize)
        ctx.closePath()
        ctx.fill()

        ctx.restore()
      })
    }

    // Draw placed buildings
    if (placedBuildings && placedBuildings.length > 0) {
      placedBuildings.forEach(building => {
        const p = worldToCanvas(building.position.x, building.position.z)
        const w = building.type.width * scale
        const h = building.type.length * scale

        ctx.fillStyle = building.type.color
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h)
        ctx.strokeRect(p.x - w / 2, p.y - h / 2, w, h)
      })
    }

    // Draw rooms (filled polygons)
    if (rooms && rooms.length > 0) {
      rooms.forEach(room => {
        if (!room.points || room.points.length < 3) return

        ctx.fillStyle = 'rgba(20, 184, 166, 0.3)' // Teal with transparency
        ctx.beginPath()

        const firstPoint = worldToCanvas(room.points[0].x, room.points[0].z)
        ctx.moveTo(firstPoint.x, firstPoint.y)

        for (let i = 1; i < room.points.length; i++) {
          const p = worldToCanvas(room.points[i].x, room.points[i].z)
          ctx.lineTo(p.x, p.y)
        }

        ctx.closePath()
        ctx.fill()
      })
    }

    // Draw walls (with gaps for openings)
    if (walls && walls.length > 0) {
      ctx.strokeStyle = '#E5E5E5'
      ctx.lineWidth = 2
      walls.forEach(wall => {
        const dx = wall.end.x - wall.start.x
        const dz = wall.end.z - wall.start.z
        const wallLength = Math.sqrt(dx * dx + dz * dz)
        if (wallLength < 0.01) return

        const dirX = dx / wallLength
        const dirZ = dz / wallLength

        // Get wall position at distance along wall
        const getWallPos = (dist) => ({
          x: wall.start.x + dirX * dist,
          z: wall.start.z + dirZ * dist
        })

        // Generate segments (skip openings)
        const openings = wall.openings || []
        const sortedOpenings = [...openings].sort((a, b) => a.position - b.position)

        const segments = []
        let currentDist = 0

        for (const opening of sortedOpenings) {
          const openingStart = opening.position - opening.width / 2
          const openingEnd = opening.position + opening.width / 2

          if (openingStart > currentDist) {
            segments.push({ start: currentDist, end: openingStart })
          }
          currentDist = openingEnd
        }

        if (currentDist < wallLength) {
          segments.push({ start: currentDist, end: wallLength })
        }

        // Draw each segment
        segments.forEach(seg => {
          const segStart = worldToCanvas(getWallPos(seg.start).x, getWallPos(seg.start).z)
          const segEnd = worldToCanvas(getWallPos(seg.end).x, getWallPos(seg.end).z)
          ctx.beginPath()
          ctx.moveTo(segStart.x, segStart.y)
          ctx.lineTo(segEnd.x, segEnd.y)
          ctx.stroke()
        })

        // Draw door symbols (small arc)
        sortedOpenings.filter(o => o.type === 'door').forEach(opening => {
          const pos = getWallPos(opening.position)
          const p = worldToCanvas(pos.x, pos.z)
          ctx.strokeStyle = '#00ffff'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
          ctx.stroke()
          ctx.strokeStyle = '#E5E5E5'
          ctx.lineWidth = 2
        })

        // Draw window symbols (small x)
        sortedOpenings.filter(o => o.type === 'window').forEach(opening => {
          const pos = getWallPos(opening.position)
          const p = worldToCanvas(pos.x, pos.z)
          ctx.strokeStyle = '#87CEEB'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(p.x - 2, p.y - 2)
          ctx.lineTo(p.x + 2, p.y + 2)
          ctx.moveTo(p.x + 2, p.y - 2)
          ctx.lineTo(p.x - 2, p.y + 2)
          ctx.stroke()
          ctx.strokeStyle = '#E5E5E5'
          ctx.lineWidth = 2
        })
      })
    }

    // Draw floor plan buildings (AI-generated)
    if (buildings && buildings.length > 0) {
      buildings.forEach(building => {
        const buildingPos = building.position || { x: 0, z: 0 }
        const buildingRotation = building.rotation || 0

        // Draw each wall in the building
        if (building.walls && building.walls.length > 0) {
          ctx.strokeStyle = '#A0AEC0' // Gray for building walls
          ctx.lineWidth = 2

          building.walls.forEach(wall => {
            // Transform wall coordinates by building position and rotation
            const cos = Math.cos(buildingRotation)
            const sin = Math.sin(buildingRotation)

            // Rotate and translate start point
            const startX = wall.start.x * cos - wall.start.z * sin + buildingPos.x
            const startZ = wall.start.x * sin + wall.start.z * cos + buildingPos.z

            // Rotate and translate end point
            const endX = wall.end.x * cos - wall.end.z * sin + buildingPos.x
            const endZ = wall.end.x * sin + wall.end.z * cos + buildingPos.z

            const start = worldToCanvas(startX, startZ)
            const end = worldToCanvas(endX, endZ)

            ctx.beginPath()
            ctx.moveTo(start.x, start.y)
            ctx.lineTo(end.x, end.y)
            ctx.stroke()
          })
        }
      })
    }

    // Draw player position as arrow (use world coords)
    if (playerPosition) {
      const p = worldToCanvas(playerPosition.x, playerPosition.z)
      const angle = playerRotation || 0
      const arrowSize = 8

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(-angle)  // Negate angle since Y-axis is flipped

      // Draw arrow pointing in direction player is facing
      ctx.fillStyle = '#22d3ee'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, -arrowSize)          // Tip (forward, up on canvas = forward in world)
      ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.6)   // Back left
      ctx.lineTo(0, arrowSize * 0.2)     // Notch
      ctx.lineTo(arrowSize * 0.6, arrowSize * 0.6)    // Back right
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      ctx.restore()
    }

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, size, size)

  }, [landWidth, landLength, polygonPoints, placedBuildings, comparisonObjects, comparisonPositions, comparisonRotations, playerPosition, playerRotation, showDimensions, lengthUnit, walls, rooms, buildings])

  return (
    <div className={`fixed z-40 minimap-frame p-1 animate-fade-in ${isMobile ? 'bottom-[72px] right-2' : 'bottom-20 right-4'}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg"
        style={{
          background: 'var(--color-bg-primary)',
        }}
      />
      {/* Toggle dimensions button */}
      <button
        onClick={() => setShowDimensions(!showDimensions)}
        className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
          showDimensions
            ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
            : 'bg-white/10 text-[var(--color-text-secondary)] hover:bg-white/15 hover:text-white'
        }`}
        title={showDimensions ? 'Hide dimensions' : 'Show dimensions'}
      >
        Dims
      </button>
    </div>
  )
}
