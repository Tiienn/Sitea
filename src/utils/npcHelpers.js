// Calculate positions for NPCs outside land boundary
export function calculateNPCPositions(polygonPoints, length, width) {
  const NPC_OFFSET = 4.0 // meters outside boundary

  // Get vertices (polygon or rectangle)
  // Note: polygon.y maps to NEGATIVE z in 3D space
  let vertices
  if (polygonPoints && polygonPoints.length >= 3) {
    vertices = polygonPoints.map(p => ({ x: p.x, z: -(p.y ?? p.z) }))
  } else {
    const hw = width / 2, hl = length / 2
    vertices = [
      { x: -hw, z: -hl },
      { x: hw, z: -hl },
      { x: hw, z: hl },
      { x: -hw, z: hl }
    ]
  }

  // Find centroid for facing direction
  const centroid = {
    x: vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length,
    z: vertices.reduce((sum, v) => sum + v.z, 0) / vertices.length
  }

  // Find longest edge for guide1, and opposite/perpendicular edge for guide2
  let longestEdgeIdx = 0
  let longestLen = 0

  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i]
    const v2 = vertices[(i + 1) % vertices.length]
    const dx = v2.x - v1.x
    const dz = v2.z - v1.z
    const edgeLen = Math.sqrt(dx * dx + dz * dz)
    if (edgeLen > longestLen) {
      longestLen = edgeLen
      longestEdgeIdx = i
    }
  }

  // Guide1: midpoint of longest edge, offset outward
  const e1v1 = vertices[longestEdgeIdx]
  const e1v2 = vertices[(longestEdgeIdx + 1) % vertices.length]
  const mid1 = { x: (e1v1.x + e1v2.x) / 2, z: (e1v1.z + e1v2.z) / 2 }

  // Calculate outward normal for edge 1
  const e1dx = e1v2.x - e1v1.x
  const e1dz = e1v2.z - e1v1.z
  const e1len = Math.sqrt(e1dx * e1dx + e1dz * e1dz)
  // Perpendicular (rotate 90 degrees)
  let n1x = -e1dz / e1len
  let n1z = e1dx / e1len
  // Ensure it points outward (away from centroid)
  const toCenter1x = centroid.x - mid1.x
  const toCenter1z = centroid.z - mid1.z
  if (n1x * toCenter1x + n1z * toCenter1z > 0) {
    n1x = -n1x
    n1z = -n1z
  }

  const guide1Pos = {
    x: mid1.x + n1x * NPC_OFFSET,
    z: mid1.z + n1z * NPC_OFFSET
  }
  // Rotation to face toward land (toward centroid)
  const guide1Rot = Math.atan2(centroid.x - guide1Pos.x, centroid.z - guide1Pos.z)

  // Guide2: opposite edge (half the vertices around)
  const oppositeEdgeIdx = (longestEdgeIdx + Math.floor(vertices.length / 2)) % vertices.length
  const e2v1 = vertices[oppositeEdgeIdx]
  const e2v2 = vertices[(oppositeEdgeIdx + 1) % vertices.length]
  const mid2 = { x: (e2v1.x + e2v2.x) / 2, z: (e2v1.z + e2v2.z) / 2 }

  // Calculate outward normal for edge 2
  const e2dx = e2v2.x - e2v1.x
  const e2dz = e2v2.z - e2v1.z
  const e2len = Math.sqrt(e2dx * e2dx + e2dz * e2dz) || 1
  let n2x = -e2dz / e2len
  let n2z = e2dx / e2len
  const toCenter2x = centroid.x - mid2.x
  const toCenter2z = centroid.z - mid2.z
  if (n2x * toCenter2x + n2z * toCenter2z > 0) {
    n2x = -n2x
    n2z = -n2z
  }

  const guide2Pos = {
    x: mid2.x + n2x * NPC_OFFSET,
    z: mid2.z + n2z * NPC_OFFSET
  }
  const guide2Rot = Math.atan2(centroid.x - guide2Pos.x, centroid.z - guide2Pos.z)

  return {
    guide1: { position: guide1Pos, rotation: guide1Rot },
    guide2: { position: guide2Pos, rotation: guide2Rot }
  }
}
