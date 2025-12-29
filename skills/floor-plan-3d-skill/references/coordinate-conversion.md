# Coordinate Conversion: Pixels to World

Detailed math for converting floor plan pixel coordinates to Sitea's 3D world coordinates.

## Coordinate Systems

### Image Space (Pixels)
```
(0,0) ────────────────────► X+ (width)
  │
  │    Floor Plan Image
  │
  ▼
  Y+ (height)
```

### Sitea World Space (Meters)
```
        Z- (away from camera)
        │
        │
        │
X- ─────┼───── X+
        │
        │
        ▼
        Z+ (toward camera)
```

**Key difference**: Image Y increases downward, World Z increases toward camera (opposite direction).

## Conversion Formula

```javascript
/**
 * Convert pixel coordinates to world meters
 * @param {Object} pixel - { x: number, y: number } in pixels from top-left
 * @param {Object} imageCenter - { x: number, y: number } center point of image in pixels
 * @param {number} pixelsPerMeter - scale factor
 * @returns {Object} { x: number, z: number } in meters
 */
function pixelToWorld(pixel, imageCenter, pixelsPerMeter) {
  return {
    x: (pixel.x - imageCenter.x) / pixelsPerMeter,
    z: -(pixel.y - imageCenter.y) / pixelsPerMeter  // NEGATIVE: Y flipped
  };
}

/**
 * Convert world meters back to pixels (for preview overlay)
 */
function worldToPixel(world, imageCenter, pixelsPerMeter) {
  return {
    x: (world.x * pixelsPerMeter) + imageCenter.x,
    y: (-world.z * pixelsPerMeter) + imageCenter.y  // NEGATIVE: Z flipped back
  };
}
```

## Complete Conversion Pipeline

### Step 1: Calculate Image Center

```javascript
function getImageCenter(imageWidth, imageHeight) {
  return {
    x: imageWidth / 2,
    y: imageHeight / 2
  };
}
```

### Step 2: Calculate Scale from Labeled Dimension

```javascript
function calculateScale(dimension) {
  // dimension from AI: { value, unit, startPixel, endPixel, pixelLength }
  
  // Convert value to meters
  let meters;
  switch (dimension.unit) {
    case 'mm':
      meters = dimension.value / 1000;
      break;
    case 'ft':
      meters = dimension.value * 0.3048;
      break;
    case 'm':
    default:
      meters = dimension.value;
  }
  
  // Calculate pixels per meter
  const pixelsPerMeter = dimension.pixelLength / meters;
  
  return {
    pixelsPerMeter,
    confidence: 0.95,
    source: 'dimension_label'
  };
}
```

### Step 3: Convert All Walls

```javascript
function convertAllWalls(aiWalls, imageCenter, pixelsPerMeter) {
  return aiWalls.map((wall, index) => ({
    id: `wall-${index}-${Date.now()}`,
    start: pixelToWorld(wall.start, imageCenter, pixelsPerMeter),
    end: pixelToWorld(wall.end, imageCenter, pixelsPerMeter),
    height: 2.7,  // Default wall height
    thickness: Math.max(0.1, wall.thickness / pixelsPerMeter),
    openings: []
  }));
}
```

### Step 4: Convert Doors and Attach to Walls

```javascript
function convertDoorsToOpenings(aiDoors, walls, aiWalls, imageCenter, pixelsPerMeter) {
  for (const door of aiDoors) {
    const wallIndex = door.wallIndex;
    if (wallIndex < 0 || wallIndex >= walls.length) continue;
    
    const aiWall = aiWalls[wallIndex];
    const wall = walls[wallIndex];
    
    // Calculate distance along wall from start (in pixels)
    const wallDx = aiWall.end.x - aiWall.start.x;
    const wallDy = aiWall.end.y - aiWall.start.y;
    const wallLengthPx = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
    
    // Vector from wall start to door center
    const toDoorX = door.center.x - aiWall.start.x;
    const toDoorY = door.center.y - aiWall.start.y;
    
    // Project onto wall direction (dot product)
    const dotProduct = (toDoorX * wallDx + toDoorY * wallDy) / wallLengthPx;
    const positionAlongWallPx = dotProduct;
    
    // Convert to meters
    const positionMeters = positionAlongWallPx / pixelsPerMeter;
    const widthMeters = door.width / pixelsPerMeter;
    
    wall.openings.push({
      id: `door-${wallIndex}-${wall.openings.length}`,
      type: 'door',
      position: Math.max(0.3, positionMeters),  // Clamp to valid range
      width: Math.min(1.2, Math.max(0.7, widthMeters)),  // 0.7-1.2m
      height: 2.1,
      sillHeight: 0
    });
  }
}
```

### Step 5: Convert Windows

```javascript
function convertWindowsToOpenings(aiWindows, walls, aiWalls, imageCenter, pixelsPerMeter) {
  for (const window of aiWindows) {
    const wallIndex = window.wallIndex;
    if (wallIndex < 0 || wallIndex >= walls.length) continue;
    
    const aiWall = aiWalls[wallIndex];
    const wall = walls[wallIndex];
    
    // Same projection math as doors
    const wallDx = aiWall.end.x - aiWall.start.x;
    const wallDy = aiWall.end.y - aiWall.start.y;
    const wallLengthPx = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
    
    const toWindowX = window.center.x - aiWall.start.x;
    const toWindowY = window.center.y - aiWall.start.y;
    const positionAlongWallPx = (toWindowX * wallDx + toWindowY * wallDy) / wallLengthPx;
    
    const positionMeters = positionAlongWallPx / pixelsPerMeter;
    const widthMeters = window.width / pixelsPerMeter;
    
    wall.openings.push({
      id: `window-${wallIndex}-${wall.openings.length}`,
      type: 'window',
      position: positionMeters,
      width: Math.min(2.0, Math.max(0.5, widthMeters)),  // 0.5-2.0m
      height: 1.2,
      sillHeight: 0.9
    });
  }
}
```

### Step 6: Convert Room Centers

```javascript
function convertRooms(aiRooms, imageCenter, pixelsPerMeter) {
  return aiRooms.map(room => ({
    id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: room.name,
    center: pixelToWorld(room.center, imageCenter, pixelsPerMeter),
    area: room.labeledArea || null
  }));
}
```

## Complete Conversion Function

```javascript
export function convertFloorPlanToWorld(aiData) {
  const { imageSize, walls: aiWalls, doors: aiDoors, windows: aiWindows, rooms: aiRooms, scale } = aiData;
  
  const imageCenter = {
    x: imageSize.width / 2,
    y: imageSize.height / 2
  };
  
  const pixelsPerMeter = scale.pixelsPerMeter;
  
  // Convert walls
  const walls = convertAllWalls(aiWalls, imageCenter, pixelsPerMeter);
  
  // Attach doors and windows
  convertDoorsToOpenings(aiDoors, walls, aiWalls, imageCenter, pixelsPerMeter);
  convertWindowsToOpenings(aiWindows, walls, aiWalls, imageCenter, pixelsPerMeter);
  
  // Convert rooms
  const rooms = convertRooms(aiRooms, imageCenter, pixelsPerMeter);
  
  return { walls, rooms, scale };
}
```

## Offset and Rotation Adjustments

If the user needs to reposition or rotate the floor plan:

```javascript
function applyTransform(walls, rooms, offsetX, offsetZ, rotationDeg) {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  
  function transformPoint(p) {
    // Rotate around origin, then offset
    return {
      x: (p.x * cos - p.z * sin) + offsetX,
      z: (p.x * sin + p.z * cos) + offsetZ
    };
  }
  
  // Transform walls
  walls.forEach(wall => {
    wall.start = transformPoint(wall.start);
    wall.end = transformPoint(wall.end);
  });
  
  // Transform room centers
  rooms.forEach(room => {
    room.center = transformPoint(room.center);
  });
}
```

## Debugging Tips

### Check Scale is Reasonable

```javascript
function validateScale(pixelsPerMeter, aiWalls) {
  // Sample a few walls and check their real-world length
  for (const wall of aiWalls.slice(0, 3)) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const pixelLength = Math.sqrt(dx * dx + dy * dy);
    const meterLength = pixelLength / pixelsPerMeter;
    
    console.log(`Wall: ${pixelLength.toFixed(0)}px = ${meterLength.toFixed(2)}m`);
    
    // Sanity check: residential walls typically 1-15m
    if (meterLength < 0.5 || meterLength > 30) {
      console.warn(`WARNING: Wall length ${meterLength}m seems unusual`);
    }
  }
}
```

### Verify Y-Flip is Correct

```javascript
// If rooms appear upside-down in 3D, the Y-flip may be wrong
// Check by comparing room labels to their positions
function debugRoomPositions(aiRooms, rooms) {
  console.log('Room positions (should match visual layout):');
  aiRooms.forEach((aiRoom, i) => {
    const worldRoom = rooms[i];
    console.log(`${aiRoom.name}: pixel(${aiRoom.center.x}, ${aiRoom.center.y}) → world(${worldRoom.center.x.toFixed(2)}, ${worldRoom.center.z.toFixed(2)})`);
  });
}
```
