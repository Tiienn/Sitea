# Floor Plan Output Schema

Complete JSON schema and examples for floor plan analysis output.

## Full Schema

```typescript
interface FloorPlanAnalysis {
  success: boolean;
  error?: string;
  
  imageSize: {
    width: number;   // pixels
    height: number;  // pixels
  };
  
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  rooms: Room[];
  dimensions: Dimension[];
  
  scale: {
    pixelsPerMeter: number;
    confidence: number;      // 0.0 - 1.0
    source: 'dimension_label' | 'total_area' | 'door_width' | 'estimated';
  };
  
  overallShape: 'rectangular' | 'L-shaped' | 'U-shaped' | 'complex';
  
  totalArea?: {
    value: number;
    unit: 'm²' | 'ft²';
    source: 'label' | 'calculated';
  };
}

interface Wall {
  start: { x: number; y: number };  // pixels from top-left
  end: { x: number; y: number };
  thickness: number;                 // pixels
  isExterior: boolean;
}

interface Door {
  center: { x: number; y: number };  // pixels
  width: number;                      // pixels
  swingDirection: 'in' | 'out' | 'sliding';
  wallIndex: number;                  // index into walls array
}

interface Window {
  center: { x: number; y: number };  // pixels
  width: number;                      // pixels
  wallIndex: number;
}

interface Room {
  name: string;
  center: { x: number; y: number };  // pixels
  labeledArea: number | null;         // from image label
  areaUnit: 'm²' | 'ft²' | null;
}

interface Dimension {
  value: number;
  unit: 'm' | 'mm' | 'ft';
  startPixel: { x: number; y: number };
  endPixel: { x: number; y: number };
  pixelLength: number;
}
```

## Example 1: Simple Labeled Floor Plan

For Image 1 (71 m² apartment with room labels):

```json
{
  "success": true,
  "imageSize": { "width": 800, "height": 533 },
  "walls": [
    { "start": { "x": 50, "y": 180 }, "end": { "x": 450, "y": 180 }, "thickness": 15, "isExterior": true },
    { "start": { "x": 450, "y": 180 }, "end": { "x": 450, "y": 50 }, "thickness": 15, "isExterior": true },
    { "start": { "x": 450, "y": 50 }, "end": { "x": 750, "y": 50 }, "thickness": 15, "isExterior": true },
    { "start": { "x": 750, "y": 50 }, "end": { "x": 750, "y": 480 }, "thickness": 15, "isExterior": true },
    { "start": { "x": 750, "y": 480 }, "end": { "x": 50, "y": 480 }, "thickness": 15, "isExterior": true },
    { "start": { "x": 50, "y": 480 }, "end": { "x": 50, "y": 180 }, "thickness": 15, "isExterior": true },
    { "start": { "x": 450, "y": 180 }, "end": { "x": 450, "y": 320 }, "thickness": 10, "isExterior": false },
    { "start": { "x": 450, "y": 320 }, "end": { "x": 550, "y": 320 }, "thickness": 10, "isExterior": false },
    { "start": { "x": 550, "y": 50 }, "end": { "x": 550, "y": 180 }, "thickness": 10, "isExterior": false },
    { "start": { "x": 550, "y": 320 }, "end": { "x": 550, "y": 480 }, "thickness": 10, "isExterior": false }
  ],
  "doors": [
    { "center": { "x": 730, "y": 265 }, "width": 70, "swingDirection": "in", "wallIndex": 3 },
    { "center": { "x": 500, "y": 320 }, "width": 70, "swingDirection": "in", "wallIndex": 7 },
    { "center": { "x": 550, "y": 130 }, "width": 70, "swingDirection": "in", "wallIndex": 8 },
    { "center": { "x": 550, "y": 400 }, "width": 70, "swingDirection": "in", "wallIndex": 9 }
  ],
  "windows": [
    { "center": { "x": 250, "y": 180 }, "width": 100, "wallIndex": 0 },
    { "center": { "x": 50, "y": 330 }, "width": 120, "wallIndex": 5 }
  ],
  "rooms": [
    { "name": "Kitchen & Dining Area", "center": { "x": 300, "y": 115 }, "labeledArea": 14.8, "areaUnit": "m²" },
    { "name": "Living Area", "center": { "x": 300, "y": 400 }, "labeledArea": 21.4, "areaUnit": "m²" },
    { "name": "Bathroom", "center": { "x": 650, "y": 115 }, "labeledArea": 4.5, "areaUnit": "m²" },
    { "name": "Entry Hall", "center": { "x": 650, "y": 250 }, "labeledArea": 6.2, "areaUnit": "m²" },
    { "name": "Bedroom", "center": { "x": 650, "y": 400 }, "labeledArea": 9.6, "areaUnit": "m²" },
    { "name": "Balcony", "center": { "x": 50, "y": 280 }, "labeledArea": 9.8, "areaUnit": "m²" }
  ],
  "dimensions": [
    { "value": 5.37, "unit": "m", "startPixel": { "x": 50, "y": 510 }, "endPixel": { "x": 450, "y": 510 }, "pixelLength": 400 },
    { "value": 3.68, "unit": "m", "startPixel": { "x": 450, "y": 510 }, "endPixel": { "x": 750, "y": 510 }, "pixelLength": 300 },
    { "value": 2.78, "unit": "m", "startPixel": { "x": 780, "y": 320 }, "endPixel": { "x": 780, "y": 480 }, "pixelLength": 160 },
    { "value": 2.49, "unit": "m", "startPixel": { "x": 780, "y": 180 }, "endPixel": { "x": 780, "y": 320 }, "pixelLength": 140 },
    { "value": 1.63, "unit": "m", "startPixel": { "x": 780, "y": 50 }, "endPixel": { "x": 780, "y": 180 }, "pixelLength": 130 }
  ],
  "scale": {
    "pixelsPerMeter": 74.5,
    "confidence": 0.95,
    "source": "dimension_label"
  },
  "overallShape": "L-shaped",
  "totalArea": {
    "value": 71,
    "unit": "m²",
    "source": "label"
  }
}
```

## Example 2: CAD Drawing with mm Dimensions

For Image 2 (Pallazina apartment):

```json
{
  "success": true,
  "imageSize": { "width": 1200, "height": 1000 },
  "walls": [
    { "start": { "x": 100, "y": 150 }, "end": { "x": 500, "y": 150 }, "thickness": 20, "isExterior": true },
    { "start": { "x": 500, "y": 150 }, "end": { "x": 500, "y": 400 }, "thickness": 20, "isExterior": true }
  ],
  "dimensions": [
    { "value": 7649, "unit": "mm", "startPixel": { "x": 100, "y": 130 }, "endPixel": { "x": 500, "y": 130 }, "pixelLength": 400 },
    { "value": 3670, "unit": "mm", "startPixel": { "x": 520, "y": 200 }, "endPixel": { "x": 520, "y": 350 }, "pixelLength": 150 }
  ],
  "scale": {
    "pixelsPerMeter": 52.3,
    "confidence": 0.9,
    "source": "dimension_label"
  }
}
```

**Note**: For mm dimensions, convert: `pixelsPerMeter = pixelLength / (mmValue / 1000)`

Example: 400 pixels / (7649mm / 1000) = 400 / 7.649 = 52.3 px/m

## Converted to World Coordinates (Sitea Format)

After coordinate conversion for Sitea's LandScene:

```javascript
// Input: AI pixel data + calculated scale
const pixelsPerMeter = 74.5;
const imageCenter = { x: 400, y: 265 };  // Center of image

// Convert wall from pixels to world meters
function convertWall(pixelWall) {
  return {
    id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    start: {
      x: (pixelWall.start.x - imageCenter.x) / pixelsPerMeter,
      z: -(pixelWall.start.y - imageCenter.y) / pixelsPerMeter
    },
    end: {
      x: (pixelWall.end.x - imageCenter.x) / pixelsPerMeter,
      z: -(pixelWall.end.y - imageCenter.y) / pixelsPerMeter
    },
    height: 2.7,
    thickness: pixelWall.thickness / pixelsPerMeter,
    openings: []  // Populated from doors/windows
  };
}

// Example output wall:
{
  id: "wall-1703847592-a8f3k2",
  start: { x: -4.70, z: 1.14 },  // meters from center
  end: { x: 0.67, z: 1.14 },
  height: 2.7,
  thickness: 0.20,
  openings: []
}
```

## Attaching Doors/Windows to Walls

```javascript
function attachOpenings(walls, doors, windows, pixelsPerMeter) {
  for (const door of doors) {
    const wall = walls[door.wallIndex];
    if (!wall) continue;
    
    // Calculate position along wall (in meters from wall.start)
    const wallStartPx = { 
      x: (wall.start.x * pixelsPerMeter) + imageCenter.x,
      y: -(wall.start.z * pixelsPerMeter) + imageCenter.y
    };
    
    const dx = door.center.x - wallStartPx.x;
    const dy = door.center.y - wallStartPx.y;
    const distanceAlongWall = Math.sqrt(dx*dx + dy*dy) / pixelsPerMeter;
    
    wall.openings.push({
      id: `door-${Date.now()}`,
      type: 'door',
      position: distanceAlongWall,  // meters from wall start
      width: door.width / pixelsPerMeter,
      height: 2.1,
      sillHeight: 0
    });
  }
  
  // Similar for windows, but with sillHeight: 0.9
}
```

## Validation Checklist

Before using the converted data:

- [ ] All walls have valid start/end coordinates
- [ ] Wall thickness is reasonable (0.1 - 0.3m for residential)
- [ ] Doors are 0.7 - 1.2m wide
- [ ] Windows are 0.6 - 2.0m wide
- [ ] Room centers are inside the floor plan bounds
- [ ] Total area matches sum of room areas (within 10%)
- [ ] Scale produces sensible dimensions (rooms 3-30m per side)
