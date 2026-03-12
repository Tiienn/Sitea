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

const SYSTEM_PROMPT = `You are a precise architectural floor plan parser. Your ONLY job is to extract STRUCTURAL ELEMENTS: walls, doors, windows, and stairs — with pixel-accurate coordinates.

CRITICAL RULES:
1. COMPLETELY IGNORE all furniture, fixtures, appliances, and room labels
2. COMPLETELY IGNORE dimension lines and measurement annotations (thin lines with numbers)
3. For EVERY wall you output, follow the actual drawn ink in the image — do not infer or estimate
4. Rate your confidence (0.0–1.0) for each wall: 1.0 = clearly a structural wall, 0.0 = uncertain

COORDINATE SYSTEM:
- Origin (0,0) = TOP-LEFT of image
- X increases RIGHT
- Y increases DOWN
- All values in PIXELS — measure from the actual image

OUTPUT: Pure JSON only. No markdown, no explanations, no code fences.`;

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

  const { image, knownWidthMeters } = req.body;

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
            text: `Extract all structural elements from this floor plan image with pixel-precise coordinates.
${cvHints}
═══════════════════════════════════════════════════════════════
WHAT TO IGNORE (NEVER detect these as walls):
═══════════════════════════════════════════════════════════════
❌ Thin lines with NUMBERS beside them → dimension annotations
❌ Lines with arrows/ticks at both ends → dimension lines
❌ Lines OUTSIDE the floor plan boundary → scale bars / annotations
❌ Any line thinner than the thinnest real wall → probably furniture edge or hatch
❌ Furniture outlines: beds, sofas, tables, bathtubs, toilets, kitchen counters

═══════════════════════════════════════════════════════════════
STEP 1 — IDENTIFY JUNCTION POINTS (do this FIRST, mentally)
═══════════════════════════════════════════════════════════════
Before tracing any wall, scan the entire image and locate every point where:
• Two walls meet at a corner (L-junction)
• One wall meets the side of another (T-junction)
• Two walls cross each other (X-junction)
• A wall ends freely (dead end)

These junction points are the START and END coordinates of every wall segment.
Mark them in your mind with precise pixel coordinates before proceeding.

═══════════════════════════════════════════════════════════════
STEP 2 — TRACE EACH WALL SEGMENT
═══════════════════════════════════════════════════════════════
A wall is a THICK BAND drawn as two parallel lines with solid fill between them.
Your job: place start/end at the CENTERLINE of that band (halfway between the two edges).

For each wall segment (junction-to-junction):
• start: pixel {x,y} of one junction
• end: pixel {x,y} of the next junction along the same wall
• thickness: pixel distance between the two parallel edges of the wall band
• isExterior: true if this wall forms the outer building perimeter
• confidence: 0.0–1.0 — how certain are you this is a structural wall?
  - 1.0 = thick, clearly drawn wall connecting two junctions
  - 0.7 = probably a wall but could be a partition
  - 0.3 = uncertain — might be furniture or annotation
  - Only include walls with confidence ≥ 0.4

CONNECTIVITY RULES (must be satisfied):
✓ Walls sharing a junction must have IDENTICAL pixel coordinates at that junction
✓ Exterior walls must form a CLOSED LOOP (last wall end = first wall start)
✓ Every interior wall must connect (at both ends) to another wall or exterior wall
✓ NO gaps between walls that visually touch in the image

EXTERIOR (isExterior: true): the outermost building perimeter including any bay windows, extensions, balconies
INTERIOR (isExterior: false): internal partition walls dividing rooms

═══════════════════════════════════════════════════════════════
STEP 3 — DOORS
═══════════════════════════════════════════════════════════════
• SINGLE door: quarter-circle arc + straight line from hinge. Arc radius = door width.
• DOUBLE door: two arcs facing each other (butterfly shape)
• SLIDING: two overlapping rectangles / parallel lines with arrow

For each door:
• center: pixel {x,y} at the midpoint of the opening (ON the wall centerline)
• width: arc radius in pixels (measure carefully — typically 60–120px in standard plans)
• wallIndex: 0-based index into the walls array
• rotation: 0 / 90 / 180 / 270 — which direction the arc swings
• doorType: "single" | "double" | "sliding"

═══════════════════════════════════════════════════════════════
STEP 4 — WINDOWS
═══════════════════════════════════════════════════════════════
Two or three short parallel lines crossing perpendicular through a wall.
• center: pixel {x,y} at the center of the window symbol
• width: window width in pixels (measure along the wall)
• wallIndex: 0-based index into the walls array

═══════════════════════════════════════════════════════════════
STEP 5 — SCALE CALIBRATION
═══════════════════════════════════════════════════════════════
${knownWidthMeters
  ? `✅ USER-PROVIDED SCALE: The user has measured this floor plan and confirmed the real-world width is ${knownWidthMeters} meters.
Use the imageSize.width from the image to calculate:
  pixelsPerMeter = imageSize.width / ${knownWidthMeters}
Report this exact value with confidence: 1.0 and source: "user_provided".`
  : `Estimate pixelsPerMeter using this priority order:
1. Dimension label in image (e.g. "5000" near a line = 5000mm): pixelsPerMeter = linePixels / realMeters
2. Standard door width (0.9m): pixelsPerMeter = doorArcRadius / 0.9
3. Standard interior wall thickness (0.1m): pixelsPerMeter = wallThicknessPixels / 0.1
4. If none available, estimate from overall building size (typical house = 8–15m wide)
Report your confidence (0.0–1.0) and source.`}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — return ONLY this JSON, nothing else:
═══════════════════════════════════════════════════════════════
{
  "success": true,
  "imageSize": { "width": NUMBER, "height": NUMBER },
  "walls": [
    {
      "start": { "x": NUMBER, "y": NUMBER },
      "end": { "x": NUMBER, "y": NUMBER },
      "thickness": NUMBER,
      "isExterior": BOOLEAN,
      "confidence": NUMBER
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
    "source": "user_provided" | "dimension_label" | "door_width" | "wall_thickness" | "estimated"
  },
  "overallShape": "rectangular" | "L-shaped" | "U-shaped" | "complex",
  "totalArea": { "value": NUMBER, "unit": "m²" } | null
}`
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

    // Post-process walls — filter out low-confidence detections
    result.walls = result.walls
      .filter(wall => (wall.confidence ?? 1.0) >= 0.4)
      .map((wall, i) => ({
        start: wall.start || { x: 0, y: 0 },
        end: wall.end || { x: 0, y: 0 },
        thickness: wall.thickness || 15,
        isExterior: wall.isExterior ?? (i < 6),
        confidence: wall.confidence ?? 1.0,
      }));

    // If knownWidthMeters was provided, override scale with exact calculation
    if (knownWidthMeters && result.imageSize?.width) {
      result.scale = {
        pixelsPerMeter: result.imageSize.width / knownWidthMeters,
        confidence: 1.0,
        source: 'user_provided',
      };
    }

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

    const avgConfidence = result.walls.length
      ? (result.walls.reduce((s, w) => s + (w.confidence ?? 1), 0) / result.walls.length).toFixed(2)
      : 'n/a';

    console.log('[FloorPlan API] Analysis:', {
      walls: result.walls.length,
      avgWallConfidence: avgConfidence,
      doors: result.doors.length,
      windows: result.windows.length,
      rooms: result.rooms.length,
      stairs: result.stairs?.length || 0,
      shape: result.overallShape,
      scaleSource: result.scale?.source,
      pixelsPerMeter: result.scale?.pixelsPerMeter?.toFixed(1),
      knownWidthUsed: !!knownWidthMeters,
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
