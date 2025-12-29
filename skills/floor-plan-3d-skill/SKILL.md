---
name: floor-plan-3d
description: Convert floor plan images to 3D building geometry for Sitea. Use this skill when analyzing floor plan images to extract walls, doors, windows, and rooms for 3D visualization. Handles CAD drawings, simplified floor plans, and architectural layouts. Outputs structured JSON compatible with React Three Fiber wall rendering.
---

# Floor Plan to 3D Conversion

Convert 2D floor plan images into 3D-ready wall/door/window data for Sitea's LandScene renderer.

## Quick Reference

### Output Schema (simplified)

```javascript
{
  walls: [{ start: {x, y}, end: {x, y}, thickness: 20, isExterior: true }],
  doors: [{ wallIndex: 0, position: 0.5, width: 90 }],  // position = 0-1 along wall
  windows: [{ wallIndex: 1, position: 0.3, width: 120 }],
  rooms: [{ name: "Living Room", center: {x, y}, area: 21.4 }],
  scale: { pixelsPerMeter: 40, confidence: 0.9, source: "dimension_label" }
}
```

### Coordinate System

- **Image space**: Origin top-left, Y increases downward (pixels)
- **World space**: Origin center, Z increases toward camera (meters)
- **Conversion**: `worldX = (pixelX - centerX) * scale`, `worldZ = -(pixelY - centerY) * scale`

## Workflow

### 1. Analyze Image → Extract Data

Use the AI prompt in `references/ai-prompt.md` to analyze floor plan images. Key extraction targets:

| Element | Detection Cues |
|---------|---------------|
| **Walls** | Thick black/dark lines, parallel edges, consistent thickness |
| **Doors** | Arc swings (quarter circles), gaps in walls, door symbols |
| **Windows** | Short perpendicular lines crossing walls, parallel marks |
| **Rooms** | Enclosed spaces, text labels inside areas |
| **Dimensions** | Numbers with arrows/lines, unit labels (m, mm, ft) |

### 2. Calculate Scale

Priority order for scale detection:

1. **Labeled dimensions** - Read numbers like "5.37 m" or "3670" (mm)
2. **Total area** - If "71 m²" is shown, work backward from room geometry
3. **Standard elements** - Doors ≈ 0.9m, toilets ≈ 0.7m wide
4. **User calibration** - Fallback: ask user to set reference length

```javascript
// From labeled dimension
const pixelLength = distance(dimStart, dimEnd);  // pixels
const realLength = parseDimension("5.37 m");     // 5.37 meters
const pixelsPerMeter = pixelLength / realLength;
```

### 3. Convert to World Coordinates

See `references/coordinate-conversion.md` for full details.

```javascript
function convertToWorld(pixel, imageCenter, pixelsPerMeter) {
  return {
    x: (pixel.x - imageCenter.x) / pixelsPerMeter,
    z: -(pixel.y - imageCenter.y) / pixelsPerMeter  // Y flipped to Z
  };
}
```

### 4. Output for Sitea

Final wall format for `LandScene.jsx`:

```javascript
{
  id: 'wall-' + uuid(),
  start: { x: 0, z: 0 },      // World meters
  end: { x: 5.37, z: 0 },
  height: 2.7,
  thickness: 0.15,
  openings: [
    { id: 'door-1', type: 'door', position: 2.5, width: 0.9, height: 2.1, sillHeight: 0 },
    { id: 'window-1', type: 'window', position: 4.0, width: 1.2, height: 1.2, sillHeight: 0.9 }
  ]
}
```

## Common Issues & Fixes

| Problem | Cause | Solution |
|---------|-------|----------|
| Walls too small/large | Wrong scale | Verify dimension label parsing, check unit (m vs mm) |
| Missing walls | Low contrast lines | Lower detection threshold, check for colored walls |
| Doors on wrong wall | Incorrect wall index | Match door center to nearest wall segment |
| Overlapping walls | Duplicate detection | Merge walls within 0.3m of each other |
| Rooms not enclosed | Gap in wall loop | Check wall endpoints connect (within 0.5m) |

## References

- `references/ai-prompt.md` - Full AI prompt for floor plan analysis
- `references/output-schema.md` - Complete JSON schema with examples
- `references/coordinate-conversion.md` - Detailed coordinate math
