/**
 * 2D Collision Detection Utilities (SAT for Oriented Bounding Boxes)
 * All operations on XZ plane (y is up in 3D space)
 */

/**
 * Get 4 corners of an oriented bounding box in XZ plane
 * @param {Object} center - {x, z} center position
 * @param {number} width - width of box (x-axis before rotation)
 * @param {number} depth - depth of box (z-axis before rotation)
 * @param {number} rotationY - rotation in degrees around Y axis
 * @returns {Array} 4 corner points [{x, z}, ...]
 */
export function getOBBCornersXZ(center, width, depth, rotationY = 0) {
  const hw = width / 2
  const hd = depth / 2
  const rad = (rotationY * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // Local corners (before rotation)
  const local = [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd }
  ]

  // Transform to world coordinates
  return local.map(p => ({
    x: center.x + p.x * cos - p.z * sin,
    z: center.z + p.x * sin + p.z * cos
  }))
}

/**
 * Project polygon points onto an axis and return min/max
 * @param {Object} axis - {x, z} normalized axis vector
 * @param {Array} points - [{x, z}, ...] polygon vertices
 * @returns {Object} {min, max} projection interval
 */
export function projectPolygon(axis, points) {
  let min = Infinity
  let max = -Infinity

  for (const p of points) {
    const dot = p.x * axis.x + p.z * axis.z
    if (dot < min) min = dot
    if (dot > max) max = dot
  }

  return { min, max }
}

/**
 * Check if two intervals overlap
 * @param {Object} a - {min, max}
 * @param {Object} b - {min, max}
 * @returns {boolean} true if intervals overlap
 */
export function intervalsOverlap(a, b) {
  return a.min <= b.max && b.min <= a.max
}

/**
 * Get the 2 edge normals (axes) for an OBB
 * @param {Array} corners - 4 corner points from getOBBCornersXZ
 * @returns {Array} 2 normalized axis vectors [{x, z}, {x, z}]
 */
function getOBBAxes(corners) {
  // Edge 0->1 and Edge 1->2 give us the two unique directions
  const axes = []

  for (let i = 0; i < 2; i++) {
    const p1 = corners[i]
    const p2 = corners[i + 1]
    const dx = p2.x - p1.x
    const dz = p2.z - p1.z
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len === 0) continue

    // Perpendicular (normal) to edge
    axes.push({ x: -dz / len, z: dx / len })
  }

  return axes
}

/**
 * Check if two OBBs intersect using SAT (Separating Axis Theorem)
 * @param {Object} a - Building A: {position: {x, z}, width, length, rotationY}
 * @param {Object} b - Building B: {position: {x, z}, width, length, rotationY}
 * @returns {boolean} true if buildings overlap
 */
export function obbIntersectsObb2D(a, b) {
  // Get corners for both OBBs
  const cornersA = getOBBCornersXZ(a.position, a.width, a.length, a.rotationY || 0)
  const cornersB = getOBBCornersXZ(b.position, b.width, b.length, b.rotationY || 0)

  // Get axes from both OBBs (2 from each = 4 total)
  const axesA = getOBBAxes(cornersA)
  const axesB = getOBBAxes(cornersB)
  const allAxes = [...axesA, ...axesB]

  // SAT: if we find any separating axis, no collision
  for (const axis of allAxes) {
    const projA = projectPolygon(axis, cornersA)
    const projB = projectPolygon(axis, cornersB)

    if (!intervalsOverlap(projA, projB)) {
      return false // Found separating axis, no collision
    }
  }

  return true // All axes overlap, collision detected
}

/**
 * Check if a building overlaps any other building in the list
 * @param {Object} building - The building to check
 * @param {Array} otherBuildings - Array of other buildings to check against
 * @returns {boolean} true if building overlaps any other
 */
export function checkBuildingOverlap(building, otherBuildings) {
  const a = {
    position: building.position,
    width: building.type.width,
    length: building.type.length,
    rotationY: building.rotationY || 0
  }

  for (const other of otherBuildings) {
    if (other.id === building.id) continue

    const b = {
      position: other.position,
      width: other.type.width,
      length: other.type.length,
      rotationY: other.rotationY || 0
    }

    if (obbIntersectsObb2D(a, b)) {
      return true
    }
  }

  return false
}

/**
 * Compute all overlapping building IDs from a list of buildings
 * @param {Array} buildings - Array of building objects
 * @returns {Set<string|number>} Set of building IDs that are overlapping
 */
export function computeOverlappingIds(buildings) {
  const overlapping = new Set()

  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = {
        position: buildings[i].position,
        width: buildings[i].type.width,
        length: buildings[i].type.length,
        rotationY: buildings[i].rotationY || 0
      }
      const b = {
        position: buildings[j].position,
        width: buildings[j].type.width,
        length: buildings[j].type.length,
        rotationY: buildings[j].rotationY || 0
      }

      if (obbIntersectsObb2D(a, b)) {
        overlapping.add(buildings[i].id)
        overlapping.add(buildings[j].id)
      }
    }
  }

  return overlapping
}

/**
 * Check if a preview building (being dragged) overlaps any placed building
 * @param {Object} previewPos - {x, z} position of preview
 * @param {Object} buildingType - {width, length} of building type
 * @param {number} rotationY - rotation in degrees
 * @param {Array} placedBuildings - Array of placed buildings
 * @returns {boolean} true if preview overlaps any placed building
 */
export function checkPreviewOverlap(previewPos, buildingType, rotationY, placedBuildings) {
  if (!previewPos || !buildingType || !placedBuildings.length) return false

  const preview = {
    position: previewPos,
    width: buildingType.width,
    length: buildingType.length,
    rotationY: rotationY || 0
  }

  for (const placed of placedBuildings) {
    const b = {
      position: placed.position,
      width: placed.type.width,
      length: placed.type.length,
      rotationY: placed.rotationY || 0
    }

    if (obbIntersectsObb2D(preview, b)) {
      return true
    }
  }

  return false
}
