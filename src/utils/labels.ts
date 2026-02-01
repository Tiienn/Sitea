/**
 * Label Utilities for Land Edge Dimensions
 * Precomputes edge data to avoid per-frame recalculation
 */

import type { Point2D, LengthUnit } from '../types'

// ============================================
// Types
// ============================================

interface Vertex {
  x: number
  z: number
}

interface EdgeLabel {
  position: Vertex
  length: number
  key: string
}

// ============================================
// Constants
// ============================================

const FEET_PER_METER = 3.28084
const MIN_EDGE_LABEL_M = 5 // Minimum edge length to show label (meters)

// ============================================
// Functions
// ============================================

/**
 * Format length for display
 */
export function formatEdgeLength(meters: number, unit: LengthUnit): string {
  if (unit === 'ft') {
    const feet = meters * FEET_PER_METER
    return `${Math.round(feet)} ft`
  }
  return `${meters.toFixed(1)} m`
}

/**
 * Compute polygon centroid
 */
function computeCentroid(vertices: Vertex[]): Vertex {
  let cx = 0, cz = 0
  for (const v of vertices) {
    cx += v.x
    cz += v.z
  }
  return { x: cx / vertices.length, z: cz / vertices.length }
}

/**
 * Compute edge label data for a polygon
 * Uses centroid interpolation for inward offset (winding-independent)
 */
export function computeEdgeLabelData(
  polygon: Point2D[] | null,
  length: number,
  width: number
): EdgeLabel[] {
  // Get vertices in 3D world coordinates (polygon.y → -Z due to rotation)
  let vertices: Vertex[]
  if (polygon && polygon.length >= 3) {
    vertices = polygon.map(p => ({ x: p.x, z: -p.y }))
  } else {
    // Rectangle fallback (already in 3D world coordinates)
    const hw = width / 2, hl = length / 2
    vertices = [
      { x: -hw, z: -hl },
      { x: hw, z: -hl },
      { x: hw, z: hl },
      { x: -hw, z: hl }
    ]
  }

  const centroid = computeCentroid(vertices)
  const labels: EdgeLabel[] = []
  const isPolygon = polygon && polygon.length >= 3

  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i]
    const v2 = vertices[(i + 1) % vertices.length]

    // Edge length
    const dx = v2.x - v1.x
    const dz = v2.z - v1.z
    const edgeLength = Math.sqrt(dx * dx + dz * dz)

    // Skip short edges for polygons (clutter reduction)
    if (isPolygon && edgeLength < MIN_EDGE_LABEL_M) continue

    // Edge midpoint
    const midX = (v1.x + v2.x) / 2
    const midZ = (v1.z + v2.z) / 2

    // Offset toward centroid (winding-independent)
    const toCentroidX = centroid.x - midX
    const toCentroidZ = centroid.z - midZ
    const toCentroidLen = Math.sqrt(toCentroidX * toCentroidX + toCentroidZ * toCentroidZ)

    // Offset 0.8m toward centroid (or less if edge is very close to centroid)
    const offsetDist = Math.min(0.8, toCentroidLen * 0.3)
    const offsetX = toCentroidLen > 0 ? (toCentroidX / toCentroidLen) * offsetDist : 0
    const offsetZ = toCentroidLen > 0 ? (toCentroidZ / toCentroidLen) * offsetDist : 0

    labels.push({
      position: { x: midX + offsetX, z: midZ + offsetZ },
      length: edgeLength,
      key: `edge-${i}`
    })
  }

  return labels
}

/**
 * Compute compass rotation from camera state
 * Returns rotation in degrees where 0 = facing north (+Z in world)
 */
export function computeCompassRotation(cameraYaw: number): number {
  // In Three.js with YXZ euler order:
  // - yaw = 0 means camera looks toward -Z
  // - We define world north as +Z
  // - When camera looks north (+Z), yaw = PI, compass should show 0 (north at top)
  // - Compass rotation = -(yaw + PI) in degrees, normalized

  let degrees = -(cameraYaw + Math.PI) * (180 / Math.PI)
  // Normalize to 0-360
  degrees = ((degrees % 360) + 360) % 360
  return degrees
}
