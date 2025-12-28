/**
 * Label Utilities for Land Edge Dimensions
 * Precomputes edge data to avoid per-frame recalculation
 */

const FEET_PER_METER = 3.28084
const MIN_EDGE_LABEL_M = 5 // Minimum edge length to show label (meters)

/**
 * Format length for display
 * @param {number} meters - Length in meters
 * @param {string} unit - 'm' or 'ft'
 * @returns {string} Formatted string like "12.5 m" or "41 ft"
 */
export function formatEdgeLength(meters, unit) {
  if (unit === 'ft') {
    const feet = meters * FEET_PER_METER
    return `${Math.round(feet)} ft`
  }
  return `${meters.toFixed(1)} m`
}

/**
 * Compute polygon centroid
 * @param {Array} vertices - [{x, y/z}, ...]
 * @returns {{x: number, z: number}}
 */
function computeCentroid(vertices) {
  let cx = 0, cz = 0
  for (const v of vertices) {
    cx += v.x
    cz += v.y ?? v.z
  }
  return { x: cx / vertices.length, z: cz / vertices.length }
}

/**
 * Compute edge label data for a polygon
 * Uses centroid interpolation for inward offset (winding-independent)
 *
 * @param {Array} polygon - Array of {x, y} or {x, z} vertices
 * @param {number} length - Rectangle length (used if no polygon)
 * @param {number} width - Rectangle width (used if no polygon)
 * @returns {Array} Array of { position: {x, z}, length: number, key: string }
 */
export function computeEdgeLabelData(polygon, length, width) {
  // Get vertices in 3D world coordinates (polygon.y → -Z due to rotation)
  let vertices
  if (polygon && polygon.length >= 3) {
    vertices = polygon.map(p => ({ x: p.x, z: -(p.y ?? p.z) }))
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
  const labels = []
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
 *
 * @param {number} cameraYaw - Camera yaw in radians (from Euler Y)
 * @returns {number} Compass rotation in degrees (0 = north at top)
 */
export function computeCompassRotation(cameraYaw) {
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
