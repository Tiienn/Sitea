/**
 * Room Detection Algorithm
 * Detects enclosed areas (rooms) from a list of walls by finding cycles in the wall graph
 */

const SNAP_THRESHOLD = 0.15 // Merge points within 15cm

/**
 * Detect all enclosed rooms from a list of walls
 * @param {Array} walls - Array of wall objects with start/end points
 * @param {Object} options - Detection options
 * @param {number} options.minArea - Minimum room area in m² (default: 0.5)
 * @param {number} options.maxArea - Maximum room area in m² (default: 500)
 * @returns {Array} Array of room objects with points and area
 */
export function detectRooms(walls, options = {}) {
  const { minArea = 0.5, maxArea = 500 } = options

  if (!walls || walls.length < 3) return [] // Need at least 3 walls for a room

  // Filter to only actual user-drawn walls (not land boundary segments)
  const validWalls = walls.filter(wall => {
    // Must have wall ID format (user-drawn 'wall-' or preset 'fsm-')
    if (!wall.id || !(wall.id.startsWith('wall-') || wall.id.startsWith('fsm-'))) return false
    // Must have valid start/end points
    if (!wall.start || !wall.end) return false
    return true
  })

  if (validWalls.length < 3) return [] // Need at least 3 valid walls

  // Step 1: Build adjacency graph from wall endpoints
  const graph = buildWallGraph(validWalls)

  // Step 2: Find all cycles (enclosed areas)
  const cycles = findAllCycles(graph)

  // Step 3: Convert cycles to room objects
  const rooms = cycles.map((cycle, index) => {
    const points = cycle.map(nodeKey => ({
      x: graph.nodes[nodeKey].x,
      z: graph.nodes[nodeKey].z
    }))
    const area = calculatePolygonArea(points)

    return {
      id: `room-${Date.now()}-${index}`,
      points,
      area,
      center: calculateCentroid(points),
    }
  })

  // Filter out invalid rooms (too small or too large like land boundary)
  return rooms.filter(room => room.area >= minArea && room.area <= maxArea)
}

/**
 * Build a graph from wall endpoints
 * Nodes are positions (keyed by "x,z"), edges are walls
 */
function buildWallGraph(walls) {
  const nodes = {} // { "x,z": { x, z, connections: ["x,z", ...] } }

  // Helper to find or create node (with snapping to nearby nodes)
  const findOrCreateNode = (point) => {
    // Check if there's an existing node nearby
    for (const key of Object.keys(nodes)) {
      const existing = nodes[key]
      const dist = Math.sqrt(
        Math.pow(existing.x - point.x, 2) +
        Math.pow(existing.z - point.z, 2)
      )
      if (dist < SNAP_THRESHOLD) {
        return key // Use existing node
      }
    }

    // Create new node with rounded key
    const x = Math.round(point.x * 100) / 100
    const z = Math.round(point.z * 100) / 100
    const key = `${x},${z}`
    nodes[key] = { x: point.x, z: point.z, connections: [] }
    return key
  }

  // Process each wall
  for (const wall of walls) {
    const startKey = findOrCreateNode(wall.start)
    const endKey = findOrCreateNode(wall.end)

    if (startKey === endKey) continue // Degenerate wall

    // Add bidirectional connections
    if (!nodes[startKey].connections.includes(endKey)) {
      nodes[startKey].connections.push(endKey)
    }
    if (!nodes[endKey].connections.includes(startKey)) {
      nodes[endKey].connections.push(startKey)
    }
  }

  return { nodes }
}

/**
 * Find all simple cycles in the graph using wall-following algorithm
 */
function findAllCycles(graph) {
  const cycles = []
  const nodeKeys = Object.keys(graph.nodes)
  const processedEdges = new Set()

  // For each node with 2+ connections, try to find cycles
  for (const startKey of nodeKeys) {
    const startNode = graph.nodes[startKey]
    if (startNode.connections.length < 2) continue

    // Try each outgoing edge
    for (const firstStep of startNode.connections) {
      const edgeKey = `${startKey}->${firstStep}`
      if (processedEdges.has(edgeKey)) continue

      // Follow the wall to find a cycle
      const cycle = followWallCycle(graph, startKey, firstStep, processedEdges)

      if (cycle && cycle.length >= 3) {
        // Verify it's not a duplicate
        if (!isDuplicateCycle(cycles, cycle)) {
          cycles.push(cycle)
          // Mark all edges in this cycle as processed
          for (let i = 0; i < cycle.length; i++) {
            const from = cycle[i]
            const to = cycle[(i + 1) % cycle.length]
            processedEdges.add(`${from}->${to}`)
          }
        }
      }
    }
  }

  return cycles
}

/**
 * Follow walls using the "right-hand rule" to find a cycle
 */
function followWallCycle(graph, startKey, firstStep, processedEdges) {
  const cycle = [startKey]
  let prevKey = startKey
  let currentKey = firstStep
  const maxIterations = 100
  let iterations = 0

  while (iterations < maxIterations) {
    iterations++

    // Check if we've completed the cycle
    if (currentKey === startKey) {
      return cycle
    }

    // Check for invalid self-intersection
    if (cycle.includes(currentKey)) {
      return null
    }

    cycle.push(currentKey)

    const current = graph.nodes[currentKey]
    const connections = current.connections.filter(c => c !== prevKey)

    if (connections.length === 0) {
      return null // Dead end
    }

    // Pick the next node using right-hand rule (consistent winding)
    const nextKey = pickRightmostTurn(graph, prevKey, currentKey, connections)

    prevKey = currentKey
    currentKey = nextKey
  }

  return null // Didn't find a cycle
}

/**
 * Pick the next node by choosing the rightmost turn (for consistent winding)
 */
function pickRightmostTurn(graph, prevKey, currentKey, connections) {
  if (connections.length === 1) {
    return connections[0]
  }

  const prev = graph.nodes[prevKey]
  const current = graph.nodes[currentKey]

  // Incoming direction angle
  const inAngle = Math.atan2(current.z - prev.z, current.x - prev.x)

  let bestKey = connections[0]
  let bestAngle = -Infinity

  for (const nextKey of connections) {
    const next = graph.nodes[nextKey]

    // Outgoing direction angle
    const outAngle = Math.atan2(next.z - current.z, next.x - current.x)

    // Calculate turn angle (normalized)
    let turnAngle = outAngle - inAngle
    while (turnAngle > Math.PI) turnAngle -= 2 * Math.PI
    while (turnAngle < -Math.PI) turnAngle += 2 * Math.PI

    // Pick the most counter-clockwise turn (largest angle)
    if (turnAngle > bestAngle) {
      bestAngle = turnAngle
      bestKey = nextKey
    }
  }

  return bestKey
}

/**
 * Check if a cycle is a duplicate of an already found cycle
 */
function isDuplicateCycle(existingCycles, newCycle) {
  const newSet = new Set(newCycle)

  for (const existing of existingCycles) {
    if (existing.length !== newCycle.length) continue

    const existingSet = new Set(existing)
    let same = true
    for (const node of newSet) {
      if (!existingSet.has(node)) {
        same = false
        break
      }
    }

    if (same) return true
  }

  return false
}

/**
 * Calculate area of polygon using Shoelace formula
 */
export function calculatePolygonArea(points) {
  if (!points || points.length < 3) return 0

  let area = 0
  const n = points.length

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].z
    area -= points[j].x * points[i].z
  }

  return Math.abs(area) / 2
}

/**
 * Calculate centroid of polygon
 */
export function calculateCentroid(points) {
  if (!points || points.length === 0) return { x: 0, z: 0 }

  let sumX = 0
  let sumZ = 0

  for (const point of points) {
    sumX += point.x
    sumZ += point.z
  }

  return {
    x: sumX / points.length,
    z: sumZ / points.length,
  }
}

/**
 * Check if a point is inside a polygon using ray casting
 */
export function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false

  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].z

    const intersect = ((zi > point.z) !== (zj > point.z))
      && (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * BFS from a set of starting wall IDs to find all walls connected through shared endpoints
 * @param {Array} startingWallIds - Wall IDs to start from (e.g. one room's walls)
 * @param {Array} allWalls - All wall objects in the scene
 * @param {number} threshold - Distance threshold for endpoint matching (default 0.3m)
 * @returns {Array} Array of all connected wall IDs
 */
export function findConnectedWalls(startingWallIds, allWalls, threshold = 0.3) {
  // Filter to valid walls only
  const validWalls = allWalls.filter(w =>
    w.id && (w.id.startsWith('wall-') || w.id.startsWith('fsm-')) && w.start && w.end
  )

  const visited = new Set(startingWallIds)
  const queue = [...startingWallIds]

  while (queue.length > 0) {
    const wallId = queue.shift()
    const wall = validWalls.find(w => w.id === wallId)
    if (!wall) continue

    for (const other of validWalls) {
      if (visited.has(other.id)) continue

      // Check endpoint-to-endpoint OR endpoint-on-segment (T-junctions)
      const connected =
        dist2D(wall.start, other.start) < threshold ||
        dist2D(wall.start, other.end) < threshold ||
        dist2D(wall.end, other.start) < threshold ||
        dist2D(wall.end, other.end) < threshold ||
        pointOnSegment(other.start, wall.start, wall.end, threshold) ||
        pointOnSegment(other.end, wall.start, wall.end, threshold) ||
        pointOnSegment(wall.start, other.start, other.end, threshold) ||
        pointOnSegment(wall.end, other.start, other.end, threshold)

      if (connected) {
        visited.add(other.id)
        queue.push(other.id)
      }
    }
  }

  return [...visited]
}

function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2)
}

/** Check if point p is on segment from a to b (within threshold) */
function pointOnSegment(p, a, b, threshold) {
  const lenSq = (b.x - a.x) ** 2 + (b.z - a.z) ** 2
  if (lenSq === 0) return dist2D(p, a) < threshold
  // Project p onto line ab, clamped to [0,1]
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / lenSq))
  const proj = { x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) }
  return dist2D(p, proj) < threshold
}

/**
 * Find wall IDs that form a room's boundary
 * Matches walls whose endpoints align with consecutive room vertices
 * @param {Object} room - Room object with points array
 * @param {Array} walls - Array of wall objects
 * @returns {Array} Array of wall IDs that form the room boundary
 */
export function findWallsForRoom(room, walls) {
  if (!room?.points || !walls) return []

  const MATCH_THRESHOLD = 0.5 // 50cm tolerance for matching endpoints (increased for room dragging)
  const wallIds = []

  // Check each edge of the room polygon
  for (let i = 0; i < room.points.length; i++) {
    const p1 = room.points[i]
    const p2 = room.points[(i + 1) % room.points.length]

    // Find wall that matches this edge
    for (const wall of walls) {
      if (!wall.id?.startsWith('wall-') && !wall.id?.startsWith('fsm-')) continue
      if (wallIds.includes(wall.id)) continue

      // Check if wall matches edge in either direction (exact endpoint match)
      const matchForward = (
        Math.abs(wall.start.x - p1.x) < MATCH_THRESHOLD &&
        Math.abs(wall.start.z - p1.z) < MATCH_THRESHOLD &&
        Math.abs(wall.end.x - p2.x) < MATCH_THRESHOLD &&
        Math.abs(wall.end.z - p2.z) < MATCH_THRESHOLD
      )
      const matchBackward = (
        Math.abs(wall.start.x - p2.x) < MATCH_THRESHOLD &&
        Math.abs(wall.start.z - p2.z) < MATCH_THRESHOLD &&
        Math.abs(wall.end.x - p1.x) < MATCH_THRESHOLD &&
        Math.abs(wall.end.z - p1.z) < MATCH_THRESHOLD
      )

      if (matchForward || matchBackward) {
        wallIds.push(wall.id)
        continue
      }

      // Check if the room edge is a sub-segment of this wall (for walls spanning multiple rooms)
      // Both the edge and wall must be collinear, and the edge must lie within the wall
      const wallDx = wall.end.x - wall.start.x
      const wallDz = wall.end.z - wall.start.z
      const edgeDx = p2.x - p1.x
      const edgeDz = p2.z - p1.z

      // Check collinearity: wall and edge must be parallel
      const cross = wallDx * edgeDz - wallDz * edgeDx
      if (Math.abs(cross) > MATCH_THRESHOLD) continue

      // Check that edge endpoints lie on the wall line (perpendicular distance ≈ 0)
      const wallLen = Math.sqrt(wallDx * wallDx + wallDz * wallDz)
      if (wallLen < 0.01) continue
      const nx = -wallDz / wallLen
      const nz = wallDx / wallLen
      const dist1 = Math.abs(nx * (p1.x - wall.start.x) + nz * (p1.z - wall.start.z))
      const dist2 = Math.abs(nx * (p2.x - wall.start.x) + nz * (p2.z - wall.start.z))
      if (dist1 > MATCH_THRESHOLD || dist2 > MATCH_THRESHOLD) continue

      // Check that at least one edge endpoint is within the wall segment (not just on the line)
      const t1 = wallLen > 0.01 ? ((p1.x - wall.start.x) * wallDx + (p1.z - wall.start.z) * wallDz) / (wallLen * wallLen) : 0
      const t2 = wallLen > 0.01 ? ((p2.x - wall.start.x) * wallDx + (p2.z - wall.start.z) * wallDz) / (wallLen * wallLen) : 0
      const margin = MATCH_THRESHOLD / wallLen
      if (t1 >= -margin && t1 <= 1 + margin && t2 >= -margin && t2 <= 1 + margin) {
        wallIds.push(wall.id)
      }
    }
  }

  return wallIds
}
