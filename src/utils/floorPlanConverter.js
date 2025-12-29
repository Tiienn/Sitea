// src/utils/floorPlanConverter.js
// Updated with floor-plan-3d skill for improved coordinate conversion

/**
 * Snap wall endpoints that are close together
 * This ensures walls connect properly at corners
 */
function snapWallEndpoints(walls, threshold = 5) {
  const points = [];

  // Collect all endpoints
  walls.forEach(wall => {
    points.push({ wall, type: 'start', x: wall.start.x, y: wall.start.y });
    points.push({ wall, type: 'end', x: wall.end.x, y: wall.end.y });
  });

  // Snap close points together
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.sqrt(
        (points[i].x - points[j].x) ** 2 +
        (points[i].y - points[j].y) ** 2
      );

      if (dist < threshold && dist > 0) {
        // Snap to average position
        const avgX = (points[i].x + points[j].x) / 2;
        const avgY = (points[i].y + points[j].y) / 2;

        if (points[i].type === 'start') {
          points[i].wall.start.x = avgX;
          points[i].wall.start.y = avgY;
        } else {
          points[i].wall.end.x = avgX;
          points[i].wall.end.y = avgY;
        }

        if (points[j].type === 'start') {
          points[j].wall.start.x = avgX;
          points[j].wall.start.y = avgY;
        } else {
          points[j].wall.end.x = avgX;
          points[j].wall.end.y = avgY;
        }
      }
    }
  }

  return walls;
}

/**
 * Calculate scale from AI data using the skill's priority order:
 * 1. pixelsPerMeter from AI (new schema)
 * 2. estimatedMetersPerPixel from AI (old schema, convert)
 * 3. Calculate from dimensions array
 * 4. Estimate from door width (fallback)
 */
function calculatePixelsPerMeter(aiData) {
  // Priority 1: New schema pixelsPerMeter
  if (aiData.scale?.pixelsPerMeter && aiData.scale.pixelsPerMeter > 0) {
    return aiData.scale.pixelsPerMeter;
  }

  // Priority 2: Old schema (convert from meters per pixel)
  if (aiData.scale?.estimatedMetersPerPixel && aiData.scale.estimatedMetersPerPixel > 0) {
    return 1 / aiData.scale.estimatedMetersPerPixel;
  }

  // Priority 3: Calculate from dimensions array
  if (aiData.dimensions && aiData.dimensions.length > 0) {
    for (const dim of aiData.dimensions) {
      if (dim.pixelLength && dim.pixelLength > 0 && dim.value > 0) {
        let meters = dim.value;
        // Convert to meters based on unit
        if (dim.unit === 'mm') {
          meters = dim.value / 1000;
        } else if (dim.unit === 'ft') {
          meters = dim.value * 0.3048;
        }
        if (meters > 0) {
          return dim.pixelLength / meters;
        }
      }
    }
  }

  // Priority 4: Estimate from door width (standard door = 0.9m)
  if (aiData.doors && aiData.doors.length > 0) {
    const door = aiData.doors[0];
    if (door.width && door.width > 0) {
      return door.width / 0.9;
    }
  }

  // Default fallback: assume 50 pixels per meter
  return 50;
}

/**
 * Convert AI-extracted floor plan data to 3D world coordinates
 * Uses center-based conversion from floor-plan-3d skill
 * @param {Object} aiData - Data from AI analysis
 * @param {Object} settings - Conversion settings
 * @returns {Object} - Walls and rooms in 3D world coordinates
 */
export function convertFloorPlanToWorld(aiData, settings = {}) {
  // Calculate pixelsPerMeter using skill's priority order
  const pixelsPerMeter = calculatePixelsPerMeter(aiData);

  // Convert to metersPerPixel for backwards compatibility with settings.scale
  let calculatedScale = 1 / pixelsPerMeter;
  if (settings.scale) {
    calculatedScale = settings.scale;
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

  // Get image center for centered conversion (from skill's coordinate-conversion.md)
  const imageCenter = {
    x: (aiData.imageSize?.width || 800) / 2,
    y: (aiData.imageSize?.height || 600) / 2
  };

  // Helper: Convert pixel coords to world coords (centered)
  const toWorld = (px, py) => {
    // Convert from image center
    // Image Y down → World Z (no flip needed for top-down view)
    let x = (px - imageCenter.x) * scale;
    let z = (py - imageCenter.y) * scale;

    // Apply rotation around origin
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

  // Snap wall endpoints before converting
  const snappedWalls = snapWallEndpoints([...(aiData.walls || [])]);

  // Convert walls
  const walls = snappedWalls.map((wall, index) => {
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

  // Helper: Find nearest wall to a point
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

  // Helper: Calculate position along wall
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

  // Attach doors to walls
  (aiData.doors || []).forEach((door, index) => {
    const doorCenter = toWorld(door.center.x, door.center.y);
    const { wall } = findNearestWall(doorCenter);

    if (wall) {
      const position = getPositionAlongWall(wall, doorCenter);
      const width = (door.width || 90) * scale; // Default 90px ~ 0.9m
      const wallLen = getWallLength(wall);

      wall.openings.push({
        id: `door-generated-${Date.now()}-${index}`,
        type: 'door',
        position: Math.max(width / 2, Math.min(position, wallLen - width / 2)),
        width: Math.max(0.6, Math.min(width, 1.8)), // Clamp to reasonable door width
        height: doorHeight,
      });
    }
  });

  // Attach windows to walls
  (aiData.windows || []).forEach((window, index) => {
    const windowCenter = toWorld(window.center.x, window.center.y);
    const { wall } = findNearestWall(windowCenter);

    if (wall) {
      const position = getPositionAlongWall(wall, windowCenter);
      const width = (window.width || 100) * scale; // Default 100px ~ 1m
      const wallLen = getWallLength(wall);

      wall.openings.push({
        id: `window-generated-${Date.now()}-${index}`,
        type: 'window',
        position: Math.max(width / 2, Math.min(position, wallLen - width / 2)),
        width: Math.max(0.4, Math.min(width, 3)), // Clamp to reasonable window width
        height: windowHeight,
        sillHeight: windowSillHeight,
      });
    }
  });

  // Sort openings by position along wall
  walls.forEach(wall => {
    wall.openings.sort((a, b) => a.position - b.position);
  });

  // Convert rooms - handle labeledArea (new), areaFromLabel (old), and approximateArea
  const rooms = (aiData.rooms || []).map((room, index) => {
    const center = toWorld(room.center.x, room.center.y);

    // Use labeled area if available (handles both new and old schema)
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

  return {
    walls,
    rooms,
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
    return 0.05; // Default
  }

  // Find the specified wall or the longest wall
  let targetWall;
  if (wallIndex >= 0 && wallIndex < aiData.walls.length) {
    targetWall = aiData.walls[wallIndex];
  } else {
    // Find longest wall
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
