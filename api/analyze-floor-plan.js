// api/analyze-floor-plan.js (Vercel serverless function)
// v3: Strict furniture exclusion, focus on structural elements only

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

// --- Roboflow CV detection (CubiCasa5K model) ---

async function callRoboflow(base64Image) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    console.log('[FloorPlan] No ROBOFLOW_API_KEY set, skipping CV detection');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://detect.roboflow.com/cubicasa5k-2-qpmsa/4?api_key=${apiKey}&confidence=40`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64Image,
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[FloorPlan] Roboflow returned ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn('[FloorPlan] Roboflow call failed:', err.message);
    return null;
  }
}

function formatRoboflowHints(roboflowData) {
  if (!roboflowData || !roboflowData.predictions || roboflowData.predictions.length === 0) {
    return '';
  }

  const predictions = roboflowData.predictions;
  const imgW = roboflowData.image?.width || 0;
  const imgH = roboflowData.image?.height || 0;

  const walls = predictions.filter(p => p.class === 'wall');
  const doors = predictions.filter(p => p.class === 'door');
  const windows = predictions.filter(p => p.class === 'window');

  if (walls.length === 0 && doors.length === 0 && windows.length === 0) {
    return '';
  }

  let hints = `\n═══════════════════════════════════════════════════════════════
CV DETECTION HINTS (from a computer-vision model — use as approximate guides)
Image size: ${imgW} x ${imgH} pixels
═══════════════════════════════════════════════════════════════\n`;

  if (walls.length > 0) {
    hints += `\nDetected ${walls.length} wall regions (approximate centerlines):\n`;
    walls.forEach((w, i) => {
      const halfW = w.width / 2;
      const halfH = w.height / 2;
      if (w.width > w.height) {
        // horizontal wall
        hints += `  Wall ${i}: horizontal (${Math.round(w.x - halfW)}, ${Math.round(w.y)}) → (${Math.round(w.x + halfW)}, ${Math.round(w.y)}), thickness≈${Math.round(w.height)}, conf=${Math.round(w.confidence * 100)}%\n`;
      } else {
        // vertical wall
        hints += `  Wall ${i}: vertical (${Math.round(w.x)}, ${Math.round(w.y - halfH)}) → (${Math.round(w.x)}, ${Math.round(w.y + halfH)}), thickness≈${Math.round(w.width)}, conf=${Math.round(w.confidence * 100)}%\n`;
      }
    });
  }

  if (doors.length > 0) {
    hints += `\nDetected ${doors.length} doors:\n`;
    doors.forEach((d, i) => {
      hints += `  Door ${i}: center=(${Math.round(d.x)}, ${Math.round(d.y)}), bbox=${Math.round(d.width)}x${Math.round(d.height)}, conf=${Math.round(d.confidence * 100)}%\n`;
    });
  }

  if (windows.length > 0) {
    hints += `\nDetected ${windows.length} windows:\n`;
    windows.forEach((w, i) => {
      hints += `  Window ${i}: center=(${Math.round(w.x)}, ${Math.round(w.y)}), bbox=${Math.round(w.width)}x${Math.round(w.height)}, conf=${Math.round(w.confidence * 100)}%\n`;
    });
  }

  hints += `\nNote: These are bounding-box detections. Use them to GUIDE your wall/door/window placement — they show WHERE elements are but not exact start/end coordinates. Trust your own analysis for exact geometry, connectivity, and room labels.\n`;

  return hints;
}

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

  // --- Auth: verify JWT and check subscription ---
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('email', user.email.toLowerCase())
    .eq('status', 'active')
    .maybeSingle();

  if (!subscription) {
    return res.status(403).json({ error: 'Active subscription required' });
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

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    // Call Roboflow CV model for spatial hints (graceful fallback if unavailable)
    const roboflowData = await callRoboflow(image);
    const cvHints = formatRoboflowHints(roboflowData);

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
            text: `Extract structural elements from this floor plan.
${cvHints}
═══════════════════════════════════════════════════════════════
CRITICAL: DIMENSION LINES ARE NOT WALLS!
═══════════════════════════════════════════════════════════════

DIMENSION LINES (IGNORE — never detect as walls):
❌ Thin lines with NUMBERS next to them (e.g., "2900", "4580", "5.37m")
❌ Lines with small ARROWS or TICKS at both ends
❌ Lines positioned OUTSIDE the floor plan pointing to edges
❌ Any line where you can see a measurement number nearby

═══════════════════════════════════════════════════════════════
1. WALLS — Trace the CENTERLINE of each wall band
═══════════════════════════════════════════════════════════════

Walls are THICK bands (drawn as two parallel lines with fill between them).
Your job: place start/end at the CENTER of each wall band (midway between the two edges).

HOW TO TRACE:
• Each wall is a STRAIGHT segment from one corner/junction to the next
• At CORNERS (L-shape): two walls meet — both must share the EXACT same {x,y} endpoint
• At T-JUNCTIONS: the joining wall's endpoint must exactly match a point on the through-wall
• At CROSS-JUNCTIONS: walls share the same intersection point
• NEVER leave gaps between walls that should connect — if two walls meet, their endpoints must be IDENTICAL pixel coordinates

EXTERIOR vs INTERIOR:
• EXTERIOR walls (isExterior: true): ALL walls that form the OUTERMOST perimeter of the building. This includes walls around balconies, extensions, bay windows, and any protruding sections — if it has walls and is part of the building, include it. Trace the FULL perimeter as a CLOSED loop (last wall's end = first wall's start). The building shape may be L-shaped, U-shaped, or complex — trace the entire outline.
• INTERIOR walls (isExterior: false): walls INSIDE the building that divide it into rooms. Each must connect to at least one exterior wall or another interior wall.

THICKNESS:
• Measure the pixel distance between the two parallel edges of the wall band
• Exterior walls are typically thicker than interior walls

WALL VALIDATION:
✓ Every wall connects to at least ONE other wall
✓ Exterior walls form a closed loop
✓ No floating/disconnected segments
✗ Lines with numbers nearby are NOT walls — they are dimension annotations

═══════════════════════════════════════════════════════════════
2. DOORS — Openings in walls with swing arcs
═══════════════════════════════════════════════════════════════

VISUAL IDENTIFICATION:
• SINGLE door: quarter-circle ARC touching a wall, with a straight line from the hinge point. The ARC RADIUS equals the door width.
• DOUBLE door: TWO quarter-circle arcs facing each other, forming a butterfly/M shape
• SLIDING door: two overlapping rectangles or parallel lines with an arrow, OR a gap in the wall with parallel guide lines

FOR EACH DOOR, REPORT:
• center: the pixel {x,y} at the MIDPOINT of the door opening along the wall. This should be ON the wall line, centered in the gap where the door is.
• width: the RADIUS of the door swing arc in PIXELS. This is how wide the door opening is. Measure the arc radius or the gap in the wall. A standard door arc is typically 50-100 pixels in a typical floor plan image. Do NOT return small values like 10-30 — measure carefully.
• wallIndex: the 0-based INDEX into the walls array for the wall this door is in
• rotation: the angle in DEGREES (0, 90, 180, or 270) that the door arc faces:
  - 0° = arc swings to the RIGHT and DOWN from hinge
  - 90° = arc swings DOWN and to the LEFT
  - 180° = arc swings to the LEFT and UP
  - 270° = arc swings UP and to the RIGHT
  Look at which direction the arc curves in the image to determine rotation.
• doorType: "single", "double", or "sliding"

═══════════════════════════════════════════════════════════════
3. WINDOWS — Parallel lines crossing through walls
═══════════════════════════════════════════════════════════════

VISUAL IDENTIFICATION:
• Two or three SHORT parallel lines that cross PERPENDICULAR to a wall
• Sometimes shown as a thin rectangle or double-line symbol ON a wall
• Often on exterior walls but can also appear on interior walls

FOR EACH WINDOW, REPORT:
• center: the CENTER of the window along the wall (in pixels)
• width: the width of the window in PIXELS (measure along the wall direction)
• wallIndex: the 0-based INDEX into the walls array for the wall this window is on

═══════════════════════════════════════════════════════════════
4. OTHER ELEMENTS
═══════════════════════════════════════════════════════════════

ROOMS: Identify each labeled room. Report its name (from the label text), center point, and labeled area if shown (e.g. "12.5 m²").

STAIRS: Parallel step lines with direction arrow. Report center and direction.

IGNORE: furniture, fixtures, bathroom fittings, kitchen appliances, text labels (except room names), north arrows, hatching.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
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
      "wallIndex": NUMBER,
      "rotation": NUMBER,
      "doorType": "single" | "double" | "sliding"
    }
  ],
  "windows": [
    {
      "center": { "x": NUMBER, "y": NUMBER },
      "width": NUMBER,
      "wallIndex": NUMBER
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
FINAL CHECKLIST:
═══════════════════════════════════════════════════════════════

□ Did I trace wall CENTERLINES (not edges)?
□ Do walls that meet share the EXACT same endpoint coordinates?
□ Do exterior walls form a CLOSED loop?
□ Did I set wallIndex on every door and window?
□ Did I set rotation (0/90/180/270) on every door based on the arc direction?
□ Did I ignore dimension lines (lines with numbers)?

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
      shape: result.overallShape,
      cvHintsUsed: cvHints.length > 0,
      roboflowDetections: roboflowData ? roboflowData.predictions?.length || 0 : 'skipped',
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('[FloorPlan API] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze floor plan'
    });
  }
}
