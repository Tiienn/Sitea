# AI Prompt for Floor Plan Analysis

Use this prompt when calling the Anthropic API to analyze floor plan images.

## System Prompt

```
You are a floor plan analyzer that extracts architectural elements from 2D floor plan images. Output structured JSON only - no explanations.

CRITICAL RULES:
1. All coordinates are in PIXELS from the image's top-left corner
2. Walls are defined by their CENTER LINE, not edges
3. Door/window positions are distance along wall from wall.start (in pixels)
4. Dimensions in the image may be in meters (m), millimeters (mm), or feet (ft)
5. If dimensions show numbers like 3670, 4580 without units, assume MILLIMETERS
6. If dimensions show numbers like 5.37, 3.68 with decimals, assume METERS
```

## User Prompt Template

```
Analyze this floor plan image and extract all architectural elements.

OUTPUT FORMAT (JSON only, no markdown):
{
  "success": true,
  "imageSize": { "width": <pixels>, "height": <pixels> },
  "walls": [
    {
      "start": { "x": <pixel>, "y": <pixel> },
      "end": { "x": <pixel>, "y": <pixel> },
      "thickness": <pixels>,
      "isExterior": <boolean>
    }
  ],
  "doors": [
    {
      "center": { "x": <pixel>, "y": <pixel> },
      "width": <pixels>,
      "swingDirection": "in|out|sliding",
      "wallIndex": <index of wall this door is on>
    }
  ],
  "windows": [
    {
      "center": { "x": <pixel>, "y": <pixel> },
      "width": <pixels>,
      "wallIndex": <index of wall this window is on>
    }
  ],
  "rooms": [
    {
      "name": "<room name from label or inferred>",
      "center": { "x": <pixel>, "y": <pixel> },
      "labeledArea": <number if shown in image, null otherwise>,
      "areaUnit": "m²|ft²|null"
    }
  ],
  "dimensions": [
    {
      "value": <number>,
      "unit": "m|mm|ft",
      "startPixel": { "x": <pixel>, "y": <pixel> },
      "endPixel": { "x": <pixel>, "y": <pixel> },
      "pixelLength": <distance in pixels between start and end>
    }
  ],
  "scale": {
    "pixelsPerMeter": <calculated or estimated>,
    "confidence": <0.0-1.0>,
    "source": "dimension_label|total_area|door_width|estimated"
  },
  "overallShape": "rectangular|L-shaped|U-shaped|complex",
  "totalArea": {
    "value": <number if shown>,
    "unit": "m²|ft²",
    "source": "label|calculated"
  }
}

DETECTION GUIDELINES:

WALLS:
- Look for thick black or dark-colored lines forming room boundaries
- Exterior walls are typically thicker (15-25 pixels) than interior walls (8-15 pixels)
- Trace wall CENTER lines, not edges
- Each wall segment should be a straight line from corner to corner
- DO NOT skip walls just because they're short - include ALL wall segments

DOORS:
- Quarter-circle arc = door swing (hinged door)
- Gap in wall with no arc = sliding door or open doorway
- Small rectangle crossing wall = door symbol
- Standard door width: ~80-100 pixels at typical scales

WINDOWS:
- Two short parallel lines perpendicular to wall
- Thin rectangles on walls
- Often have small tick marks at edges

ROOMS:
- Text labels inside enclosed spaces indicate room names
- Numbers with m² or ft² indicate room areas
- Common rooms: Living Room, Bedroom, Kitchen, Bathroom, Entry Hall, Balcony

DIMENSIONS:
- Numbers with arrows or extension lines
- Look for: 5.37 m, 3670 (mm), 10'-6" (feet-inches)
- The pixel distance between dimension endpoints helps calculate scale

SCALE CALCULATION:
1. Find a labeled dimension (e.g., "5.37 m" spanning some pixels)
2. Measure pixel distance between dimension endpoints
3. pixelsPerMeter = pixelDistance / meterValue
4. If dimensions are in mm: pixelsPerMeter = pixelDistance / (mmValue / 1000)
```

## Example API Call

```javascript
const response = await fetch('/api/analyze-floor-plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: base64ImageData,
    model: 'claude-sonnet-4-20250514',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT
  })
});

const data = await response.json();
```

## Handling Different Floor Plan Styles

### Style 1: Simple Labeled (like Image 1)
- Has room names and areas inside rooms
- Has overall dimensions on edges
- Clean black lines on white background
- **Best for**: Direct dimension reading

### Style 2: CAD/Professional (like Image 2)  
- Blue or colored walls
- Many dimension annotations (often in mm)
- Furniture and fixtures shown
- May have title block with scale info
- **Best for**: High accuracy from many dimensions

### Style 3: Minimal/Sketch (like Image 3)
- Thin lines, minimal annotations
- Few or no room labels
- May have red/cyan accent colors for doors
- **Best for**: User calibration fallback

## Post-Processing the AI Response

After receiving the AI response:

```javascript
function postProcess(aiData, imageWidth, imageHeight) {
  // 1. Validate scale
  if (!aiData.scale?.pixelsPerMeter || aiData.scale.confidence < 0.5) {
    // Fallback: estimate from standard door width (0.9m)
    const door = aiData.doors[0];
    if (door) {
      aiData.scale = {
        pixelsPerMeter: door.width / 0.9,
        confidence: 0.6,
        source: 'door_width'
      };
    }
  }

  // 2. Assign doors/windows to walls if wallIndex missing
  for (const door of aiData.doors) {
    if (door.wallIndex === undefined) {
      door.wallIndex = findNearestWall(door.center, aiData.walls);
    }
  }

  // 3. Merge duplicate walls (within 10px of each other)
  aiData.walls = mergeNearbyWalls(aiData.walls, 10);

  // 4. Connect wall endpoints (snap within 5px)
  aiData.walls = snapWallEndpoints(aiData.walls, 5);

  return aiData;
}
```

## Confidence Levels

| Confidence | Meaning | User Action |
|------------|---------|-------------|
| 0.9+ | High - dimensions clearly read | Auto-proceed |
| 0.7-0.9 | Medium - some inference used | Show preview |
| 0.5-0.7 | Low - estimated from elements | Request calibration |
| <0.5 | Very low - guessing | Manual calibration required |
