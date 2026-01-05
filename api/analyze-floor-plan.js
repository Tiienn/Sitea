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

CRITICAL: You must COMPLETELY IGNORE all furniture and fixtures. If you detect furniture as a wall, you have FAILED.

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
              media_type: 'image/png',
              data: image,
            },
          },
          {
            type: 'text',
            text: `Extract ONLY structural elements from this floor plan.

═══════════════════════════════════════════════════════════════
WHAT TO DETECT (structural elements):
═══════════════════════════════════════════════════════════════

1. WALLS - The thick lines that form room boundaries
   • Exterior walls: The outer boundary of the building (thicker, ~15-25px)
   • Interior walls: Divide the space into rooms (thinner, ~8-15px)
   • Walls are CONTINUOUS lines that connect at corners
   • Trace the CENTER LINE of each wall segment

2. DOORS - Openings in walls with these symbols:
   • Quarter-circle arc = hinged door swing
   • Double arc (butterfly pattern) = double doors
   • Gap with parallel lines = sliding door
   • Just a gap = open doorway

3. WINDOWS - Markings ON walls (not gaps):
   • Two parallel lines perpendicular to wall
   • Small rectangle on the wall line
   • Usually on exterior walls

4. STAIRS - Parallel lines with direction:
   • Multiple parallel lines (steps)
   • Arrow showing up/down direction
   • Report as a room with name "Stairs"

═══════════════════════════════════════════════════════════════
WHAT TO COMPLETELY IGNORE (NOT structural):
═══════════════════════════════════════════════════════════════

FURNITURE (DO NOT TRACE THESE AS WALLS):
❌ Sofas, couches, sectionals (L-shaped or rectangular outlines in living areas)
❌ Beds (rectangles in bedrooms, often with pillows drawn)
❌ Tables (dining tables, coffee tables, desks)
❌ Chairs (small rectangles or circles)
❌ Rugs (rectangular outlines on floor)

KITCHEN FIXTURES:
❌ Countertops (L-shaped or U-shaped lines along walls)
❌ Kitchen islands
❌ Stove/range (rectangle with circles for burners)
❌ Refrigerator (rectangle, often labeled R/F)
❌ Sink (small rectangle or oval)

BATHROOM FIXTURES:
❌ Toilet (small oval/rectangle)
❌ Bathtub (large rectangle)
❌ Shower (square with diagonal lines or X)
❌ Vanity/sink (rectangle against wall)
❌ Washer/dryer (squares, often labeled W/D)

OTHER NON-STRUCTURAL:
❌ Dimension lines (thin lines with arrows and numbers)
❌ Room labels (text like "Living Area 21.4 m²")
❌ Appliances
❌ Plants
❌ Closet organizers/shelving

═══════════════════════════════════════════════════════════════
HOW TO IDENTIFY WALLS vs FURNITURE:
═══════════════════════════════════════════════════════════════

WALLS have these characteristics:
✓ Form the BOUNDARY between rooms
✓ Connect to other walls at corners
✓ Continuous from corner to corner
✓ Same thickness throughout their length
✓ Have doors or windows cutting through them

FURNITURE has these characteristics:
✗ Sits INSIDE a room (not on boundaries)
✗ Does not connect to walls at both ends
✗ Floating in the middle of a space
✗ Has decorative details (cushions, legs, drawers)
✗ Smaller than room boundaries

TEST: If you can walk around it, it's furniture. If it blocks your path between rooms, it's a wall.

═══════════════════════════════════════════════════════════════
DETECTION PROCESS:
═══════════════════════════════════════════════════════════════

STEP 1: Find the EXTERIOR BOUNDARY
- Start at top-left corner of the building
- Trace clockwise around the entire perimeter
- This forms the outer walls (mark isExterior: true)

STEP 2: Find INTERIOR WALLS
- Look for lines that DIVIDE the interior into rooms
- These connect exterior walls to each other
- Or connect to other interior walls
- Mark isExterior: false

STEP 3: For each wall segment, record:
- start: {x, y} pixel coordinates of one end
- end: {x, y} pixel coordinates of other end
- thickness: pixel width of the wall
- isExterior: true/false

STEP 4: Find DOORS
- Look for arcs or gaps in walls
- Record center point and width

STEP 5: Find WINDOWS
- Look for parallel line symbols on exterior walls
- Record center point and width

STEP 6: Identify ROOMS from labels
- Read text labels inside spaces
- Record name and center point
- Include area if labeled (e.g., "21.4 m²")

STEP 7: Calculate SCALE
- Find dimension labels (e.g., "5.37 m")
- Measure pixel distance of that dimension
- pixelsPerMeter = pixelDistance / meterValue

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
FINAL VERIFICATION (check before responding):
═══════════════════════════════════════════════════════════════

□ Did I trace ONLY walls, not furniture?
□ Do exterior walls form a CLOSED boundary?
□ Do adjacent walls SHARE endpoints?
□ Did I ignore sofas, beds, tables, countertops?
□ Are wall coordinates within image bounds?
□ Did I find doors where there are arc symbols?
□ Did I find windows on exterior walls?

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
