// src/utils/floorPlanConverter.js
// FINAL FIX: Negate X (not Z) to correct horizontal mirroring

/**
 * Validate AI results and log warnings
 */
export function validateAiResults(aiData) {
  const warnings = [];
  const walls = aiData.walls || [];
  const doors = aiData.doors || [];
  const rooms = aiData.rooms || [];
  const imageSize = aiData.imageSize || { width: 0, height: 0 };
  const scale = aiData.scale || {};

  if (walls.length === 0) {
    warnings.push('No walls detected - floor plan may not be recognized');
  } else if (walls.length < 4) {
    warnings.push(`Only ${walls.length} walls detected - may be missing walls`);
  } else if (walls.length > 50) {
    warnings.push(`${walls.length} walls detected - may include furniture or duplicates`);
  }

  if (walls.length >= 4 && rooms.length === 0) {
    warnings.push('No rooms detected - room labels may be missing from image');
  }

  if (walls.length >= 4 && doors.length === 0) {
    warnings.push('No doors detected - door symbols may not be recognized');
  }

  if (scale.confidence !== undefined && scale.confidence < 0.5) {
    warnings.push(`Low scale confidence (${(scale.confidence * 100).toFixed(0)}%) - dimensions may be inaccurate`);
  }

  if (scale.pixelsPerMeter) {
    if (scale.pixelsPerMeter < 10) {
      warnings.push(`Scale seems too small - building would be very large`);
    } else if (scale.pixelsPerMeter > 200) {
      warnings.push(`Scale seems too large - building would be very small`);
    }
  }

  if (imageSize.width < 200 || imageSize.height < 200) {
    warnings.push('Image resolution is low - detection accuracy may be reduced');
  }

  let outsideBounds = 0;
  for (const wall of walls) {
    if (wall.start.x < 0 || wall.start.y < 0 ||
        wall.end.x < 0 || wall.end.y < 0 ||
        wall.start.x > imageSize.width || wall.start.y > imageSize.height ||
        wall.end.x > imageSize.width || wall.end.y > imageSize.height) {
      outsideBounds++;
    }
  }
  if (outsideBounds > 0) {
    warnings.push(`${outsideBounds} walls have coordinates outside image bounds`);
  }

  if (warnings.length > 0) {
    console.warn('[FloorPlan] Validation warnings:');
    warnings.forEach(w => console.warn(`  ⚠️ ${w}`));
  }

  return warnings;
}

/**
 * Calculate distance between two points
 */
function distance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Remove duplicate or overlapping walls
 */
function deduplicateWalls(walls, threshold) {
  const dedupeThreshold = threshold * 2;
  const kept = [];

  for (const wall of walls) {
    let isDuplicate = false;

    for (const existing of kept) {
      const sameDirection =
        distance(wall.start, existing.start) < dedupeThreshold &&
        distance(wall.end, existing.end) < dedupeThreshold;
      const reverseDirection =
        distance(wall.start, existing.end) < dedupeThreshold &&
        distance(wall.end, existing.start) < dedupeThreshold;

      if (sameDirection || reverseDirection) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(wall);
    }
  }

  console.log(`[FloorPlan] Walls: ${walls.length} input → ${kept.length} after dedup`);
  return kept;
}

/**
 * Snap wall endpoints that are close together
 */
function snapWallEndpoints(walls, imageSize = { width: 1000, height: 1000 }) {
  const baseDimension = Math.min(imageSize.width, imageSize.height);
  // Tighter snap: only merge endpoints that are very close (was 0.005 * dim, up to 15px)
  const SNAP_THRESHOLD = Math.max(2, Math.min(8, baseDimension * 0.003));

  const allEndpoints = [];
  walls.forEach((wall, wallIndex) => {
    allEndpoints.push({ point: wall.start, wallIndex, isStart: true });
    allEndpoints.push({ point: wall.end, wallIndex, isStart: false });
  });

  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < allEndpoints.length; i++) {
    if (assigned.has(i)) continue;

    const group = [i];
    assigned.add(i);

    for (let j = i + 1; j < allEndpoints.length; j++) {
      if (assigned.has(j)) continue;

      const dist = distance(allEndpoints[i].point, allEndpoints[j].point);
      if (dist < SNAP_THRESHOLD) {
        group.push(j);
        assigned.add(j);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  const snappedWalls = walls.map(w => ({
    ...w,
    start: { ...w.start },
    end: { ...w.end }
  }));

  for (const group of groups) {
    let sumX = 0, sumY = 0;
    for (const idx of group) {
      sumX += allEndpoints[idx].point.x;
      sumY += allEndpoints[idx].point.y;
    }
    const avgX = sumX / group.length;
    const avgY = sumY / group.length;

    for (const idx of group) {
      const ep = allEndpoints[idx];
      if (ep.isStart) {
        snappedWalls[ep.wallIndex].start = { x: avgX, y: avgY };
      } else {
        snappedWalls[ep.wallIndex].end = { x: avgX, y: avgY };
      }
    }
  }

  return snappedWalls;
}

/**
 * Convert floor plan pixel data to world coordinates for 3D rendering
 * 
 * COORDINATE MAPPING (FINAL - after testing):
 * - Image: Origin top-left, X+ right, Y+ down
 * - 3D World (top-down view): X+ right, Z+ toward camera
 * 
 * To match floor plan orientation in 3D preview:
 * - Image X → World -X (NEGATE to fix horizontal mirror)
 * - Image Y → World Z (no change - down stays down)
 */
export function convertFloorPlanToWorld(aiData, settings = {}) {
  if (!aiData) return { walls: [], rooms: [], warnings: ['No AI data provided'], stats: {} };

  // Extract scale
  let calculatedScale = 0.05;
  if (aiData.scale) {
    if (aiData.scale.pixelsPerMeter) {
      calculatedScale = 1 / aiData.scale.pixelsPerMeter;
    } else if (aiData.scale.estimatedMetersPerPixel) {
      calculatedScale = aiData.scale.estimatedMetersPerPixel;
    }
  }

  const {
    scale = calculatedScale,
    originX = 0,
    originZ = 0,
    rotation = 0,
    wallHeight = 2.7,
    wallThickness = 0.15,
    doorHeight = 2.1,
    windowHeight = 1.2,
    windowSillHeight = 0.9,
    idPrefix = `generated-${Date.now()}`,
  } = settings;

  // Get image center
  const imageCenter = {
    x: (aiData.imageSize?.width || 800) / 2,
    y: (aiData.imageSize?.height || 600) / 2
  };

  /**
   * Convert pixel coordinates to world coordinates
   *
   * Image: origin top-left, X+ right, Y+ down
   * Camera looking down with up=[0,0,-1]: screen right is +X, screen up is -Z
   * Direct mapping without negation gives correct orientation
   */
  const toWorld = (px, py) => {
    let x = (px - imageCenter.x) * scale;
    let z = (py - imageCenter.y) * scale;

    // Apply rotation
    if (rotation !== 0) {
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const newX = x * cos - z * sin;
      const newZ = x * sin + z * cos;
      x = newX;
      z = newZ;
    }

    // Apply offset
    x += originX;
    z += originZ;

    return { x, z };
  };

  // Process walls
  const imgSize = aiData.imageSize || { width: 1000, height: 1000 };
  const baseDimension = Math.min(imgSize.width, imgSize.height);
  const threshold = Math.max(3, Math.min(15, baseDimension * 0.005));

  const snappedWalls = snapWallEndpoints([...(aiData.walls || [])], aiData.imageSize);
  const cleanWalls = deduplicateWalls(snappedWalls, threshold);

  // Convert walls
  const rawWalls = cleanWalls.map((wall, index) => {
    const start = toWorld(wall.start.x, wall.start.y);
    const end = toWorld(wall.end.x, wall.end.y);

    return {
      id: `wall-${idPrefix}-${index}`,
      start,
      end,
      height: wallHeight,
      thickness: wall.isExterior ? wallThickness * 1.5 : wallThickness,
      isExterior: wall.isExterior || false,
      openings: [],
    };
  });

  const wallLength = (w) => {
    const dx = w.end.x - w.start.x;
    const dz = w.end.z - w.start.z;
    return Math.sqrt(dx * dx + dz * dz);
  };

  // Weld endpoints onto nearby wall bodies. Traced walls stop at the FACE of
  // the perpendicular wall band (half a wall thickness from its centerline),
  // which reads as a visible gap in 3D and breaks connectivity checks.
  // Two moves, tried in order:
  //  1. Extend the endpoint ALONG its own wall axis to a wall body ahead —
  //     directional, so it can reach further without grabbing parallel walls.
  //     Reach is hull-aware: in a real building interior walls terminate at
  //     exterior walls, so a wall ending short of the hull is a trace gap,
  //     not a passage — extensions toward hull walls may bridge further.
  const EXTEND_TOL_M = 1.0;
  const EXTEND_TO_HULL_M = 2.0;
  const EXTEND_HULL_TO_HULL_M = 3.0;
  const WELD_TOL_M = 0.35;
  const HULL_BAND_M = 0.35;
  const weldXs = rawWalls.flatMap(w => [w.start.x, w.end.x]);
  const weldZs = rawWalls.flatMap(w => [w.start.z, w.end.z]);
  const weldHull = {
    minX: Math.min(...weldXs), maxX: Math.max(...weldXs),
    minZ: Math.min(...weldZs), maxZ: Math.max(...weldZs),
  };
  const wallOnHull = (w) => {
    const horiz = Math.abs(w.end.x - w.start.x) >= Math.abs(w.end.z - w.start.z);
    const cross = horiz ? (w.start.z + w.end.z) / 2 : (w.start.x + w.end.x) / 2;
    return horiz
      ? (Math.abs(cross - weldHull.minZ) <= HULL_BAND_M || Math.abs(cross - weldHull.maxZ) <= HULL_BAND_M)
      : (Math.abs(cross - weldHull.minX) <= HULL_BAND_M || Math.abs(cross - weldHull.maxX) <= HULL_BAND_M);
  };
  let weldedCount = 0;
  for (const w of rawWalls) {
    const len = wallLength(w);
    if (len < 0.05) continue;
    for (const endKey of ['start', 'end']) {
      const p = w[endKey];
      const inner = endKey === 'start' ? w.end : w.start;
      // Outward unit direction at this endpoint
      const ux = (p.x - inner.x) / len;
      const uz = (p.z - inner.z) / len;

      let moved = false;
      // 1. Directional extension: march forward and find the nearest wall
      //    body crossing the ray, within a reach that depends on whether the
      //    target (and source) wall sits on the building hull.
      const sourceOnHull = wallOnHull(w);
      let bestT = Infinity;
      let bestHit = null;
      for (const other of rawWalls) {
        if (other === w) continue;
        const dx = other.end.x - other.start.x;
        const dz = other.end.z - other.start.z;
        const denom = ux * dz - uz * dx;
        if (Math.abs(denom) < 1e-9) continue; // parallel
        // Solve p + t*u = other.start + s*(d)
        const rx = other.start.x - p.x;
        const rz = other.start.z - p.z;
        const t = (rx * dz - rz * dx) / denom;
        const s = (rx * uz - rz * ux) / denom;
        const otherLen = Math.sqrt(dx * dx + dz * dz);
        const sTol = otherLen > 0 ? 0.35 / otherLen : 0;
        const reach = wallOnHull(other)
          ? (sourceOnHull ? EXTEND_HULL_TO_HULL_M : EXTEND_TO_HULL_M)
          : EXTEND_TOL_M;
        if (t > 1e-6 && t <= reach && t < bestT && s >= -sTol && s <= 1 + sTol) {
          bestT = t;
          bestHit = { x: p.x + ux * t, z: p.z + uz * t };
        }
      }
      if (bestHit) {
        w[endKey] = bestHit;
        weldedCount++;
        moved = true;
      }

      // 2. Lateral pull onto a very close wall body
      if (!moved) {
        let bestProj = null;
        let bestDist = WELD_TOL_M;
        for (const other of rawWalls) {
          if (other === w) continue;
          const dx = other.end.x - other.start.x;
          const dz = other.end.z - other.start.z;
          const lengthSq = dx * dx + dz * dz;
          if (lengthSq === 0) continue;
          const t = Math.max(0, Math.min(1, ((p.x - other.start.x) * dx + (p.z - other.start.z) * dz) / lengthSq));
          const projX = other.start.x + t * dx;
          const projZ = other.start.z + t * dz;
          const dist = Math.sqrt((p.x - projX) ** 2 + (p.z - projZ) ** 2);
          if (dist > 1e-6 && dist < bestDist) {
            bestDist = dist;
            bestProj = { x: projX, z: projZ };
          }
        }
        if (bestProj) {
          w[endKey] = bestProj;
          weldedCount++;
        }
      }
    }
  }
  if (weldedCount > 0) {
    console.log(`[FloorPlan] Walls: welded ${weldedCount} endpoints onto nearby wall bodies`);
  }

  // Merge collinear fragments separated by opening-sized gaps. A wall with
  // doors/windows along it traces as several short pieces; doors and windows
  // are attached as openings on walls afterwards, so they need the continuous
  // wall to exist. Gaps wider than a double door stay genuine passages —
  // unless a detected door/window sits inside the gap, which proves the wall
  // continues there (window hatching breaks the CV trace).
  const COLLINEAR_OFFSET_M = 0.2;
  const MAX_MERGE_GAP_M = 1.2;
  const MAX_OPENING_GAP_M = 2.8;
  const HULL_TOL_M = 0.35;
  const openingPoints = [...(aiData.doors || []), ...(aiData.windows || [])]
    .filter(o => o.center)
    .map(o => toWorld(o.center.x, o.center.y));
  // The exterior perimeter must be closed — fragments sitting on the
  // building's bounding hull may bridge wider gaps (closet symbols, hatching,
  // and faint sections break the trace along exterior walls).
  const hullXs = rawWalls.flatMap(w => [w.start.x, w.end.x]);
  const hullZs = rawWalls.flatMap(w => [w.start.z, w.end.z]);
  const hull = {
    minX: Math.min(...hullXs), maxX: Math.max(...hullXs),
    minZ: Math.min(...hullZs), maxZ: Math.max(...hullZs),
  };
  let mergedCount = 0;
  let mergeChanged = true;
  while (mergeChanged) {
    mergeChanged = false;
    outer:
    for (let i = 0; i < rawWalls.length; i++) {
      const a = rawWalls[i];
      const aHoriz = Math.abs(a.end.x - a.start.x) >= Math.abs(a.end.z - a.start.z);
      for (let j = i + 1; j < rawWalls.length; j++) {
        const b = rawWalls[j];
        const bHoriz = Math.abs(b.end.x - b.start.x) >= Math.abs(b.end.z - b.start.z);
        if (aHoriz !== bHoriz) continue;
        const [main, cross] = aHoriz ? ['x', 'z'] : ['z', 'x'];
        const aCross = (a.start[cross] + a.end[cross]) / 2;
        const bCross = (b.start[cross] + b.end[cross]) / 2;
        if (Math.abs(aCross - bCross) > COLLINEAR_OFFSET_M) continue;
        const aMin = Math.min(a.start[main], a.end[main]);
        const aMax = Math.max(a.start[main], a.end[main]);
        const bMin = Math.min(b.start[main], b.end[main]);
        const bMax = Math.max(b.start[main], b.end[main]);
        const gap = Math.max(aMin, bMin) - Math.min(aMax, bMax);
        if (gap > MAX_OPENING_GAP_M) continue;
        if (gap > MAX_MERGE_GAP_M) {
          // Bridge a wide gap only when a detected opening sits inside it,
          // or when both fragments lie on the building's outer hull
          const gapLo = Math.min(aMax, bMax);
          const gapHi = Math.max(aMin, bMin);
          const lineCross = (aCross + bCross) / 2;
          const hasOpening = openingPoints.some(p =>
            p[main] > gapLo && p[main] < gapHi && Math.abs(p[cross] - lineCross) <= 0.4);
          const onHull = aHoriz
            ? (Math.abs(lineCross - hull.minZ) <= HULL_TOL_M || Math.abs(lineCross - hull.maxZ) <= HULL_TOL_M)
            : (Math.abs(lineCross - hull.minX) <= HULL_TOL_M || Math.abs(lineCross - hull.maxX) <= HULL_TOL_M);
          if (!hasOpening && !onHull) continue;
        }
        // Merge b into a: union extent on the shared line
        const lo = Math.min(aMin, bMin);
        const hi = Math.max(aMax, bMax);
        const crossAvg = (aCross + bCross) / 2;
        a.start = { [main]: lo, [cross]: crossAvg };
        a.end = { [main]: hi, [cross]: crossAvg };
        a.isExterior = a.isExterior || b.isExterior;
        a.thickness = Math.max(a.thickness, b.thickness);
        rawWalls.splice(j, 1);
        mergedCount++;
        mergeChanged = true;
        break outer;
      }
    }
  }
  if (mergedCount > 0) {
    console.log(`[FloorPlan] Walls: merged ${mergedCount} collinear fragments across opening gaps (<= ${MAX_MERGE_GAP_M}m)`);
  }

  // Filter out segments too short to be real structural walls.
  // Rule: keep a wall if length >= 0.8m OR both endpoints touch another wall —
  // endpoint OR body (T-junction) — within tolerance. This preserves short
  // walls at junctions while discarding isolated noise like dimension ticks.
  const MIN_WALL_LENGTH_M = 0.8;
  const CONNECT_TOL_M = 0.15;

  const touchesWall = (p, other) =>
    pointToLineDistance(p, other.start, other.end) <= CONNECT_TOL_M;

  const walls = rawWalls.filter((w, i) => {
    if (wallLength(w) < 0.05) return false;
    if (wallLength(w) >= MIN_WALL_LENGTH_M) return true;

    // A detected door/window beside a short wall proves it's real — a door
    // has to swing from something (e.g. a bath-entry jamb wall).
    if (openingPoints.some(p => pointToLineDistance(p, w.start, w.end) <= 0.5)) {
      return true;
    }

    // Check if BOTH endpoints connect to at least one other wall
    let startConnected = false;
    let endConnected = false;
    for (let j = 0; j < rawWalls.length; j++) {
      if (j === i) continue;
      const other = rawWalls[j];
      if (!startConnected && touchesWall(w.start, other)) startConnected = true;
      if (!endConnected && touchesWall(w.end, other)) endConnected = true;
      if (startConnected && endConnected) return true;
    }
    return false;
  });

  if (walls.length !== rawWalls.length) {
    console.log(`[FloorPlan] Walls: filtered ${rawWalls.length - walls.length} short segments (< ${MIN_WALL_LENGTH_M}m, not connected at both ends)`);
  }

  // Helper: Find nearest wall
  const findNearestWall = (point) => {
    let nearestWall = null;
    let minDistance = Infinity;

    for (const wall of walls) {
      const dist = pointToLineDistance(point, wall.start, wall.end);
      if (dist < minDistance) {
        minDistance = dist;
        nearestWall = wall;
      }
    }

    return { wall: nearestWall, distance: minDistance };
  };

  // Helper: Position along wall
  const getPositionAlongWall = (wall, point) => {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const wallLength = Math.sqrt(dx * dx + dz * dz);

    if (wallLength === 0) return 0;

    const t = (
      (point.x - wall.start.x) * dx +
      (point.z - wall.start.z) * dz
    ) / (wallLength * wallLength);

    return Math.max(0, Math.min(wallLength, t * wallLength));
  };

  // Attach doors — project the door CENTER onto the nearest wall. The
  // analyzer's positionAlongWall is measured from its own trace fragment's
  // start; converter welding/merging moves wall starts, so that offset lands
  // openings on the wrong spot. The center is absolute and survives merges.
  (aiData.doors || []).forEach((door, index) => {
    if (!door.center) return;
    const doorCenter = toWorld(door.center.x, door.center.y);
    const { wall } = findNearestWall(doorCenter);

    if (wall) {
      const wallLen = getWallLength(wall);
      const position = getPositionAlongWall(wall, doorCenter);
      const width = (door.width || 90) * scale;

      wall.openings.push({
        id: `door-${idPrefix}-${index}`,
        type: 'door',
        doorType: door.doorType || 'single',
        position: Math.max(width / 2, Math.min(position, wallLen - width / 2)),
        width: Math.max(0.6, Math.min(width, door.doorType === 'double' ? 2.4 : 1.8)),
        height: doorHeight,
      });
    }
  });

  // Attach windows — same center projection as doors
  (aiData.windows || []).forEach((window, index) => {
    if (!window.center) return;
    const windowCenter = toWorld(window.center.x, window.center.y);
    const { wall } = findNearestWall(windowCenter);

    if (wall) {
      const wallLen = getWallLength(wall);
      const position = getPositionAlongWall(wall, windowCenter);
      const width = (window.width || 100) * scale;

      wall.openings.push({
        id: `window-${idPrefix}-${index}`,
        type: 'window',
        position: Math.max(width / 2, Math.min(position, wallLen - width / 2)),
        width: Math.max(0.4, Math.min(width, 3)),
        height: windowHeight,
        sillHeight: windowSillHeight,
      });
    }
  });

  // Sort openings
  walls.forEach(wall => {
    wall.openings.sort((a, b) => a.position - b.position);
  });

  // Convert rooms
  const rooms = (aiData.rooms || []).map((room, index) => {
    const center = toWorld(room.center.x, room.center.y);

    let areaInMeters;
    if (room.labeledArea) {
      areaInMeters = room.labeledArea;
    } else if (room.areaFromLabel) {
      areaInMeters = room.areaFromLabel;
    } else if (room.approximateArea) {
      areaInMeters = room.approximateArea * scale * scale;
    } else {
      areaInMeters = 0;
    }

    return {
      id: `room-${idPrefix}-${index}`,
      name: room.name || 'Room',
      center,
      area: areaInMeters,
    };
  });

  // Convert stairs
  const stairs = (aiData.stairs || []).map((stair, index) => {
    const center = toWorld(stair.center.x, stair.center.y);
    return {
      id: `stair-${idPrefix}-${index}`,
      center,
      direction: stair.direction || 'unknown',
    };
  });

  const warnings = validateAiResults(aiData);

  return {
    walls,
    rooms,
    stairs,
    warnings,
    stats: {
      wallCount: walls.length,
      doorCount: walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'door').length, 0),
      windowCount: walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'window').length, 0),
      roomCount: rooms.length,
      stairCount: stairs.length,
    }
  };
}

/**
 * Get wall length
 */
function getWallLength(wall) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Distance from point to line segment
 */
function pointToLineDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  const lengthSq = dx * dx + dz * dz;

  if (lengthSq === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 +
      (point.z - lineStart.z) ** 2
    );
  }

  const t = Math.max(0, Math.min(1, (
    (point.x - lineStart.x) * dx +
    (point.z - lineStart.z) * dz
  ) / lengthSq));

  const projX = lineStart.x + t * dx;
  const projZ = lineStart.z + t * dz;

  return Math.sqrt((point.x - projX) ** 2 + (point.z - projZ) ** 2);
}

/**
 * Calculate scale from known wall length
 */
export function calculateScaleFromReference(aiData, knownLengthMeters, wallIndex = -1) {
  if (!aiData.walls || aiData.walls.length === 0) {
    return 0.05;
  }

  let targetWall;
  if (wallIndex >= 0 && wallIndex < aiData.walls.length) {
    targetWall = aiData.walls[wallIndex];
  } else {
    let maxLength = 0;
    for (const wall of aiData.walls) {
      const length = Math.sqrt(
        (wall.end.x - wall.start.x) ** 2 +
        (wall.end.y - wall.start.y) ** 2
      );
      if (length > maxLength) {
        maxLength = length;
        targetWall = wall;
      }
    }
  }

  if (!targetWall) return 0.05;

  const pixelLength = Math.sqrt(
    (targetWall.end.x - targetWall.start.x) ** 2 +
    (targetWall.end.y - targetWall.start.y) ** 2
  );

  if (pixelLength === 0) return 0.05;

  return knownLengthMeters / pixelLength;
}
