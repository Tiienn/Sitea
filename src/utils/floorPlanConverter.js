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
  const SNAP_THRESHOLD = Math.max(3, Math.min(15, baseDimension * 0.005));

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
  const walls = cleanWalls.map((wall, index) => {
    const start = toWorld(wall.start.x, wall.start.y);
    const end = toWorld(wall.end.x, wall.end.y);

    return {
      id: `wall-generated-${Date.now()}-${index}`,
      start,
      end,
      height: wallHeight,
      thickness: wall.isExterior ? wallThickness * 1.5 : wallThickness,
      isExterior: wall.isExterior || false,
      openings: [],
    };
  });

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

  // Attach doors
  (aiData.doors || []).forEach((door, index) => {
    const doorCenter = toWorld(door.center.x, door.center.y);
    const { wall } = findNearestWall(doorCenter);

    if (wall) {
      const position = getPositionAlongWall(wall, doorCenter);
      const width = (door.width || 90) * scale;
      const wallLen = getWallLength(wall);

      wall.openings.push({
        id: `door-generated-${Date.now()}-${index}`,
        type: 'door',
        doorType: door.doorType || 'single',
        position: Math.max(width / 2, Math.min(position, wallLen - width / 2)),
        width: Math.max(0.6, Math.min(width, door.doorType === 'double' ? 2.4 : 1.8)),
        height: doorHeight,
      });
    }
  });

  // Attach windows
  (aiData.windows || []).forEach((window, index) => {
    const windowCenter = toWorld(window.center.x, window.center.y);
    const { wall } = findNearestWall(windowCenter);

    if (wall) {
      const position = getPositionAlongWall(wall, windowCenter);
      const width = (window.width || 100) * scale;
      const wallLen = getWallLength(wall);

      wall.openings.push({
        id: `window-generated-${Date.now()}-${index}`,
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
      id: `room-generated-${Date.now()}-${index}`,
      name: room.name || 'Room',
      center,
      area: areaInMeters,
    };
  });

  const warnings = validateAiResults(aiData);

  return {
    walls,
    rooms,
    warnings,
    stats: {
      wallCount: walls.length,
      doorCount: walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'door').length, 0),
      windowCount: walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'window').length, 0),
      roomCount: rooms.length,
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
