/**
 * Preset Placer - geometry helpers and placement logic for quick presets
 */

import { obbIntersectsObb2D } from './collision2d'
import { PRESETS } from '../data/presets'

// ============ GEOMETRY HELPERS ============

/**
 * Get centroid of polygon (in polygon coordinate space)
 */
export function getCentroid(polygon) {
  if (!polygon || polygon.length === 0) return { x: 0, z: 0 }
  let sumX = 0, sumZ = 0
  for (const p of polygon) {
    sumX += p.x
    sumZ += p.y ?? p.z
  }
  return { x: sumX / polygon.length, z: sumZ / polygon.length }
}

/**
 * Get bounding box of polygon
 */
function getBbox(polygon) {
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const p of polygon) {
    const z = p.y ?? p.z
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ }
}

/**
 * Get major axis direction from bounding box
 * Returns normalized {x, z} pointing along the longer axis
 */
function getBboxMajorAxis(polygon) {
  const bbox = getBbox(polygon)
  // If width > depth, major axis is along X
  if (bbox.width >= bbox.depth) {
    return { x: 1, z: 0 }
  }
  return { x: 0, z: 1 }
}

/**
 * Get direction vector of longest edge in polygon
 */
function getLongestEdgeDir(polygon) {
  if (!polygon || polygon.length < 2) return { x: 1, z: 0 }

  let maxLen = 0
  let bestDir = { x: 1, z: 0 }

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const az = a.y ?? a.z
    const bz = b.y ?? b.z
    const dx = b.x - a.x
    const dz = bz - az
    const len = Math.sqrt(dx * dx + dz * dz)

    if (len > maxLen) {
      maxLen = len
      bestDir = { x: dx / len, z: dz / len }
    }
  }

  return bestDir
}

/**
 * Check if direction is near-diagonal (25°-65° or 115°-155° etc)
 */
function isNearDiagonal(dir) {
  const angle = Math.abs(Math.atan2(dir.z, dir.x)) * 180 / Math.PI
  const normalized = angle % 90
  return normalized > 25 && normalized < 65
}

/**
 * Get forward direction for land, with diagonal guard
 */
export function getForwardDir(polygon) {
  const longestEdge = getLongestEdgeDir(polygon)

  // If longest edge is near-diagonal, use bbox major axis instead
  if (isNearDiagonal(longestEdge)) {
    return getBboxMajorAxis(polygon)
  }

  return longestEdge
}

/**
 * Get perpendicular (right) direction from forward
 */
function getRightDir(forward) {
  return { x: -forward.z, z: forward.x }
}

// ============ VALIDATION HELPERS ============

/**
 * Point-in-polygon test (ray casting)
 */
function pointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false
  const px = point.x, pz = point.z
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].y ?? polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].y ?? polygon[j].z
    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Distance from point to line segment
 */
function distancePointToSegment(point, a, b) {
  const ax = a.x, az = a.y ?? a.z
  const bx = b.x, bz = b.y ?? b.z
  const px = point.x, pz = point.z

  const abx = bx - ax, abz = bz - az
  const apx = px - ax, apz = pz - az
  const ab2 = abx * abx + abz * abz
  if (ab2 === 0) return Math.sqrt(apx * apx + apz * apz)

  let t = (apx * abx + apz * abz) / ab2
  t = Math.max(0, Math.min(1, t))

  const closestX = ax + t * abx
  const closestZ = az + t * abz
  const dx = px - closestX, dz = pz - closestZ
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Minimum distance from point to any polygon edge
 */
function minDistanceToEdges(point, polygon) {
  let minDist = Infinity
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const dist = distancePointToSegment(point, a, b)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

/**
 * Get 8 test points for building footprint (4 corners + 4 midpoints)
 */
function getFootprintTestPoints(position, width, length, rotationDeg = 0) {
  const hw = width / 2
  const hl = length / 2
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)

  const localCorners = [
    { x: -hw, z: -hl },
    { x: hw, z: -hl },
    { x: hw, z: hl },
    { x: -hw, z: hl }
  ]

  const transform = (p) => ({
    x: position.x + p.x * cos - p.z * sin,
    z: position.z + p.x * sin + p.z * cos
  })

  const corners = localCorners.map(transform)
  const midpoints = corners.map((c, i) => {
    const next = corners[(i + 1) % 4]
    return { x: (c.x + next.x) / 2, z: (c.z + next.z) / 2 }
  })

  return [...corners, ...midpoints]
}

/**
 * Check if a single building placement is valid
 */
function isPlacementValid(position, width, length, rotation, polygon, setbackM) {
  if (!polygon || polygon.length < 3) return true

  const testPoints = getFootprintTestPoints(position, width, length, rotation)

  for (const p of testPoints) {
    if (!pointInPolygon(p, polygon)) return false
    if (setbackM > 0 && minDistanceToEdges(p, polygon) < setbackM) return false
  }

  return true
}

/**
 * Check if two buildings overlap
 */
function buildingsOverlap(a, b) {
  return obbIntersectsObb2D(
    { position: a.position, width: a.width, length: a.length, rotationY: a.rotation },
    { position: b.position, width: b.width, length: b.length, rotationY: b.rotation }
  )
}

// ============ PLACEMENT LOGIC ============

/**
 * Compute building positions for a preset at given anchor
 */
function computePositions(preset, anchor, forwardDir, rightDir, buildingTypes, rotation) {
  const placements = []

  for (const item of preset.buildings) {
    const buildingType = buildingTypes.find(t => t.id === item.typeId)
    if (!buildingType) continue

    const position = {
      x: anchor.x + item.offsetForward * forwardDir.x + item.offsetRight * rightDir.x,
      z: anchor.z + item.offsetForward * forwardDir.z + item.offsetRight * rightDir.z
    }

    placements.push({
      typeId: item.typeId,
      type: buildingType,
      position,
      width: buildingType.width,
      length: buildingType.length,
      rotation
    })
  }

  return placements
}

/**
 * Validate all placements (all must pass for atomic commit)
 */
function validatePlacements(placements, polygon, setbackM) {
  // Check each building is valid (inside polygon + setback)
  for (const p of placements) {
    if (!isPlacementValid(p.position, p.width, p.length, p.rotation, polygon, setbackM)) {
      return false
    }
  }

  // Check no overlaps between preset buildings
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      if (buildingsOverlap(placements[i], placements[j])) {
        return false
      }
    }
  }

  return true
}

/**
 * Main function: attempt to place preset with retry logic
 * Returns { success: true, buildings: [...] } or { success: false }
 */
export function placePreset(presetId, polygon, setbackM, buildingTypes) {
  const preset = PRESETS.find(p => p.id === presetId)
  if (!preset) return { success: false }

  const centroid = getCentroid(polygon)
  const forwardDir = getForwardDir(polygon)
  const rightDir = getRightDir(forwardDir)

  // Compute rotation to align with forward direction (degrees)
  const rotation = Math.atan2(forwardDir.z, forwardDir.x) * 180 / Math.PI

  // Inward offset: move toward center, away from edges
  const inwardOffset = 3 + (setbackM > 0 ? setbackM + 1 : 0)

  // Try 3 positions: center, shift right, shift left
  const attempts = [
    { x: centroid.x - forwardDir.x * inwardOffset, z: centroid.z - forwardDir.z * inwardOffset },
    { x: centroid.x - forwardDir.x * inwardOffset + rightDir.x * 4, z: centroid.z - forwardDir.z * inwardOffset + rightDir.z * 4 },
    { x: centroid.x - forwardDir.x * inwardOffset - rightDir.x * 4, z: centroid.z - forwardDir.z * inwardOffset - rightDir.z * 4 }
  ]

  for (const anchor of attempts) {
    const placements = computePositions(preset, anchor, forwardDir, rightDir, buildingTypes, rotation)

    if (validatePlacements(placements, polygon, setbackM)) {
      // Convert to building format expected by App
      // Negate z to match 3D world coordinates (polygon.y → -Z in 3D)
      const buildings = placements.map(p => ({
        id: Date.now() + Math.random(), // unique ID
        type: p.type,
        position: { x: p.position.x, z: -p.position.z },
        rotationY: p.rotation
      }))

      return { success: true, buildings }
    }
  }

  return { success: false }
}
