// api/analyze-floor-plan.js (Vercel serverless function)
// v3: Strict furniture exclusion, focus on structural elements only

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `You are an architectural floor plan wall detector. Your ONLY job is to extract STRUCTURAL ELEMENTS: walls, doors, windows, and stairs.

CRITICAL RULES:
1. You must COMPLETELY IGNORE all furniture and fixtures
2. You must COMPLETELY IGNORE dimension lines and measurement annotations
3. If you detect furniture or dimension lines as walls, you have FAILED

COORDINATE SYSTEM:
- Origin (0,0) = TOP-LEFT of image
- X increases RIGHT
- Y increases DOWN
- All values in PIXELS

OUTPUT: Pure JSON only. No markdown, no explanations.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  // Detect image media type from base64 data
  const detectMediaType = (base64Data) => {
    if (base64Data.startsWith('/9j/')) return 'image/jpeg';
    if (base64Data.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64Data.startsWith('R0lGOD')) return 'image/gif';
    if (base64Data.startsWith('UklGR')) return 'image/webp';
    return 'image/png'; // default fallback
  };

  const mediaType = detectMediaType(image);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      temperature: 0,  // IMPORTANT: Set to 0 for consistent, deterministic results
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: image,
            },
          },
          {
            type: 'text',
            text: `Extract ONLY structural elements from this floor plan.

═══════════════════════════════════════════════════════════════
CRITICAL: DIMENSION LINES ARE NOT WALLS!
═══════════════════════════════════════════════════════════════

DIMENSION LINES look like this (IGNORE ALL OF THESE):
❌ Thin lines with NUMBERS next to them (e.g., "2900", "4580", "5.37m")
❌ Lines with small ARROWS or TICKS at both ends
❌ Lines that have measurement text like "2900", "4580mm", "5.37 m"
❌ Lines positioned OUTSIDE the floor plan pointing to edges
❌ Horizontal or vertical lines with numbers written along them
❌ Any line where you can see a measurement number nearby

WALLS look like this (DETECT THESE):
✓ Form CLOSED shapes (rectangles, L-shapes, etc.)
✓ Create the BOUNDARY of rooms - you cannot walk through them
✓ Connect to OTHER walls at corners (T-junctions, L-corners)
✓ Usually THICKER than dimension lines
✓ Do NOT have measurement numbers written on them
✓ Are part of the building structure, not annotations

═══════════════════════════════════════════════════════════════
TWO-PASS DETECTION PROCESS:
═══════════════════════════════════════════════════════════════

PASS 1: FIND THE OUTER BOUNDARY FIRST
- Look for the OUTERMOST closed shape that forms the building perimeter
- This should form a CLOSED polygon (rectangle, L-shape, etc.)
- Trace this boundary - these are your EXTERIOR walls (isExterior: true)
- The outer boundary should have 4+ walls that connect end-to-end

PASS 2: FIND INTERIOR WALLS
- Look INSIDE the outer boundary for lines that divide the space
- Interior walls CONNECT to the outer boundary or to each other
- They create separate rooms within the building
- Mark these as isExterior: false

═══════════════════════════════════════════════════════════════
WALL VALIDATION RULES:
═══════════════════════════════════════════════════════════════

A valid wall MUST:
✓ Connect to at least ONE other wall at an endpoint
✓ Be part of a room boundary (not floating in space)
✓ NOT have dimension numbers written along it

A line is NOT a wall if:
✗ It has numbers like "2900", "4580", "5470" next to it
✗ It has arrows or tick marks at its ends
✗ It floats outside the building boundary
✗ It doesn't connect to any other structural element
✗ It's a thin annotation line

═══════════════════════════════════════════════════════════════
WHAT TO DETECT:
═══════════════════════════════════════════════════════════════

1. WALLS - Lines that form room boundaries
   • Must form CLOSED shapes when connected
   • Must NOT have measurement numbers on them
   • Exterior walls: outer perimeter (isExterior: true)
   • Interior walls: room dividers (isExterior: false)

2. DOORS - Openings in walls:
   • Quarter-circle arc = hinged door
   • Double arc = double doors
   • Gap in wall = doorway

3. WINDOWS - On exterior walls:
   • Parallel lines crossing the wall
   • Small rectangles on wall line

4. STAIRS - Parallel step lines with arrow

═══════════════════════════════════════════════════════════════
WHAT TO COMPLETELY IGNORE:
═══════════════════════════════════════════════════════════════

DIMENSION ANNOTATIONS (NEVER detect as walls):
❌ ANY line with numbers nearby (2900, 4580, 5.37m, etc.)
❌ Lines with arrows/ticks at ends
❌ Measurement indicators outside the floor plan
❌ Scale bars or rulers

FURNITURE:
❌ Sofas, beds, tables, chairs (inside rooms)
❌ Kitchen counters, appliances
❌ Bathroom fixtures (toilet, tub, sink)

OTHER:
❌ Room labels and text
❌ North arrows, scale indicators
❌ Hatching or fill patterns

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════

{
  "success": true,
  "imageSize": { "width": NUMBER, "height": NUMBER },
  "walls": [
    {
      "start": { "x": NUMBER, "y": NUMBER },
      "end": { "x": NUMBER, "y": NUMBER },
      "thickness": NUMBER,
      "isExterior": BOOLEAN
    }
  ],
  "doors": [
    {
      "center": { "x": NUMBER, "y": NUMBER },
      "width": NUMBER,
      "doorType": "single" | "double" | "sliding"
    }
  ],
  "windows": [
    {
      "center": { "x": NUMBER, "y": NUMBER },
      "width": NUMBER
    }
  ],
  "rooms": [
    {
      "name": STRING,
      "center": { "x": NUMBER, "y": NUMBER },
      "labeledArea": NUMBER | null
    }
  ],
  "stairs": [
    {
      "center": { "x": NUMBER, "y": NUMBER },
      "direction": "up" | "down" | "unknown"
    }
  ],
  "scale": {
    "pixelsPerMeter": NUMBER,
    "confidence": NUMBER,
    "source": "dimension_label" | "door_width" | "estimated"
  },
  "overallShape": "rectangular" | "L-shaped" | "U-shaped" | "complex",
  "totalArea": { "value": NUMBER, "unit": "m²" } | null
}

═══════════════════════════════════════════════════════════════
FINAL CHECKLIST (verify before responding):
═══════════════════════════════════════════════════════════════

□ Did I ignore ALL lines with numbers (dimension lines)?
□ Do my exterior walls form a CLOSED boundary?
□ Does each wall connect to at least one other wall?
□ Did I only detect structural walls, not annotations?
□ Are there no floating/disconnected wall segments?

Return ONLY the JSON object, nothing else.`
          }
        ]
      }]
    });

    const content = response.content[0].text;

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    }

    // Ensure required fields
    result.success = true;
    result.walls = result.walls || [];
    result.doors = result.doors || [];
    result.windows = result.windows || [];
    result.rooms = result.rooms || [];
    result.stairs = result.stairs || [];
    result.scale = result.scale || { pixelsPerMeter: 50, confidence: 0.5, source: 'estimated' };

    // Post-process walls
    result.walls = result.walls.map((wall, i) => ({
      start: wall.start || { x: 0, y: 0 },
      end: wall.end || { x: 0, y: 0 },
      thickness: wall.thickness || 15,
      isExterior: wall.isExterior ?? (i < 6)
    }));

    // Add stairs to rooms if detected
    if (result.stairs && result.stairs.length > 0) {
      result.stairs.forEach((stair, i) => {
        result.rooms.push({
          name: 'Stairs',
          center: stair.center,
          labeledArea: null
        });
      });
    }

    console.log('[FloorPlan API] Analysis:', {
      walls: result.walls.length,
      doors: result.doors.length,
      windows: result.windows.length,
      rooms: result.rooms.length,
      stairs: result.stairs?.length || 0,
      shape: result.overallShape
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('[FloorPlan API] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze floor plan',
      details: error.message
    });
  }
}
