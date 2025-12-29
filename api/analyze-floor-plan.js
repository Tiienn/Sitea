// api/analyze-floor-plan.js (Vercel serverless function)
// Updated with floor-plan-3d skill for improved detection

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60, // Allow up to 60 seconds for AI analysis
};

// System prompt with critical rules from floor-plan-3d skill
const SYSTEM_PROMPT = `You are a floor plan analyzer that extracts architectural elements from 2D floor plan images. Output structured JSON only - no explanations.

CRITICAL RULES:
1. All coordinates are in PIXELS from the image's top-left corner
2. Walls are defined by their CENTER LINE, not edges
3. Door/window positions are their center point in pixels
4. Dimensions in the image may be in meters (m), millimeters (mm), or feet (ft)
5. If dimensions show numbers like 3670, 4580 without units, assume MILLIMETERS
6. If dimensions show numbers like 5.37, 3.68 with decimals, assume METERS
7. Calculate pixelsPerMeter from labeled dimensions: pixelsPerMeter = pixelDistance / meterValue`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: image,
            },
          },
          {
            type: 'text',
            text: `Analyze this floor plan image and extract all architectural elements.

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
      "wallIndex": <index of wall this door is on, or -1 if unknown>
    }
  ],
  "windows": [
    {
      "center": { "x": <pixel>, "y": <pixel> },
      "width": <pixels>,
      "wallIndex": <index of wall this window is on, or -1 if unknown>
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
    "pixelsPerMeter": <calculated from dimensions, or estimated>,
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

WALLS (CRITICAL - follow this process):
Step 1: Identify the EXTERIOR BOUNDARY first
- Start at the top-left corner of the floor plan
- Trace clockwise around the entire exterior perimeter
- Each corner creates a new wall segment
- For L-shaped plans: the exterior boundary will have 6+ corners (not 4!)
- For U-shaped plans: the exterior boundary will have 8+ corners

Step 2: Add INTERIOR walls
- These divide the interior into rooms
- Interior walls connect to exterior walls or other interior walls

WALL COORDINATE RULES:
- Coordinates are in PIXELS from image top-left (0,0)
- Wall "start" and "end" are the CENTER of wall thickness at each end
- Each wall is a straight segment from corner to corner
- Adjacent walls should share the same endpoint coordinates
- Example: If wall1 ends at (300, 100), wall2 should start at (300, 100)

WALL THICKNESS:
- Exterior walls: typically 15-25 pixels thick
- Interior walls: typically 8-15 pixels thick
- Measure the actual wall thickness in the image

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

SCALE CALCULATION (CRITICAL):
1. Find a labeled dimension (e.g., "5.37 m" spanning some pixels)
2. Measure pixel distance between dimension endpoints
3. pixelsPerMeter = pixelDistance / meterValue
4. If dimensions are in mm: pixelsPerMeter = pixelDistance / (mmValue / 1000)
5. If no dimensions found, estimate from door width (standard door = 0.9m)

VERIFICATION CHECKLIST (before responding):
- Does the exterior boundary form a closed shape?
- Do adjacent walls share endpoints?
- Are all corners of the floor plan represented?
- For L-shaped: exterior should have at least 6 wall segments
- Do wall coordinates look reasonable for the image size?

Return ONLY valid JSON. No markdown, no explanation outside JSON.`
          }
        ]
      }]
    });

    // Parse the response
    const content = response.content[0].text;

    let result;
    try {
      // Try direct parse first
      result = JSON.parse(content);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    }

    // Validate and provide defaults
    result.success = true;
    result.walls = result.walls || [];
    result.doors = result.doors || [];
    result.windows = result.windows || [];
    result.rooms = result.rooms || [];

    // Log for debugging
    console.log('AI Analysis Result:', {
      wallCount: result.walls.length,
      doorCount: result.doors.length,
      windowCount: result.windows.length,
      roomCount: result.rooms.length,
      shape: result.overallShape,
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('Floor plan analysis error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze floor plan',
      details: error.message,
      errorType: error.name,
      statusCode: error.status || error.statusCode
    });
  }
}
