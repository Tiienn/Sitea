// api/analyze-floor-plan.js (Vercel serverless function)
// v3: Strict furniture exclusion, focus on structural elements only

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const config = {
  maxDuration: 120,
};

// --- Image preprocessing for better AI detection ---

async function preprocessImage(base64Image) {
  try {
    const inputBuffer = Buffer.from(base64Image, 'base64');

    const processed = await sharp(inputBuffer)
      // Convert to grayscale — removes color noise from photos/scans
      .grayscale()
      // Sharpen edges — makes wall lines crisper for detection
      .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 })
      // Binarize — pure black/white, removes gradients and shadows
      .threshold(140)
      // NOTE: .trim() removed — it changes image dimensions, causing coordinate
      // mismatch between original and preprocessed images in the dual-image pipeline
      .png()
      .toBuffer();

    console.log(`[FloorPlan] Preprocessed image: ${inputBuffer.length} → ${processed.length} bytes`);
    return processed.toString('base64');
  } catch (err) {
    console.warn('[FloorPlan] Preprocessing failed, using original image:', err.message);
    return base64Image;
  }
}

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

// --- OCR: Extract dimension labels from floor plan using Claude Haiku ---

async function extractDimensionLabels(base64Image, mediaType, anthropic) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          {
            type: 'text',
            text: `Look at this floor plan image. Find ALL dimension/measurement labels printed on it.
These are numbers with units like "3500", "3500mm", "12ft", "4.2m", "2100", etc.
They usually appear next to lines with arrows or tick marks at both ends.

Return ONLY a JSON array of objects. No markdown, no explanation.
Each object: { "value": number, "unit": "mm"|"m"|"cm"|"ft"|"in"|"unknown", "pixelLength": number|null }
- value: the numeric value shown
- unit: the unit (if no unit shown, guess from context — values >100 are likely mm, <20 are likely meters)
- pixelLength: approximate pixel length of the dimension line if visible, otherwise null

If no dimension labels found, return an empty array: []`,
          },
        ],
      }],
    });

    const text = response.content[0]?.text || '[]';
    let dimensions;
    try {
      dimensions = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      dimensions = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(dimensions)) dimensions = [];

    // Normalize all values to meters
    const normalized = dimensions.map(d => {
      let meters;
      switch (d.unit) {
        case 'mm': meters = d.value / 1000; break;
        case 'cm': meters = d.value / 100; break;
        case 'ft': meters = d.value * 0.3048; break;
        case 'in': meters = d.value * 0.0254; break;
        case 'm': meters = d.value; break;
        default:
          // Values > 100 are almost certainly mm
          meters = d.value > 100 ? d.value / 1000 : d.value;
          break;
      }
      return { ...d, meters, pixelLength: d.pixelLength || null };
    }).filter(d => d.meters > 0.3 && d.meters < 50); // Sane range: 0.3m to 50m

    console.log(`[FloorPlan] OCR found ${normalized.length} dimension labels:`, normalized.map(d => `${d.value}${d.unit}=${d.meters.toFixed(2)}m`));
    return normalized;
  } catch (err) {
    console.warn('[FloorPlan] OCR dimension extraction failed:', err.message);
    return [];
  }
}

function formatDimensionHints(dimensions) {
  if (!dimensions || dimensions.length === 0) return '';

  let hints = `\n═══════════════════════════════════════════════════════════════
OCR-DETECTED DIMENSION LABELS (extracted from the image — use for SCALE CALIBRATION)
═══════════════════════════════════════════════════════════════
The following measurement labels were detected printed on the floor plan:\n`;

  dimensions.forEach((d, i) => {
    hints += `  Dimension ${i + 1}: ${d.value} ${d.unit} (= ${d.meters.toFixed(2)} meters)`;
    if (d.pixelLength) hints += ` — line is ~${d.pixelLength}px long`;
    hints += '\n';
  });

  hints += `\nUse these to calculate pixelsPerMeter MORE ACCURATELY:
If a dimension line of N pixels represents M meters → pixelsPerMeter = N / M
These labels are MORE RELIABLE than estimating from door widths or wall thickness.
Report source: "dimension_label" and confidence: 0.9+ when using these.\n`;

  return hints;
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
  if (walls.length === 0 && doors.length === 0) {
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

  hints += `\nNote: These are bounding-box detections. Use them to GUIDE your wall/door placement — they show WHERE elements are but not exact start/end coordinates. Trust your own analysis for exact geometry, connectivity, and room labels.\n`;

  return hints;
}

function formatRoomHints(roomHints) {
  if (!roomHints || roomHints.length === 0) return '';

  let hints = `\n═══════════════════════════════════════════════════════════════
USER-PROVIDED ROOM LOCATIONS (high confidence — use these to guide wall placement)
═══════════════════════════════════════════════════════════════
The user has manually marked the following rooms on the floor plan.
Positions are given as percentages of image width/height (0% = left/top, 100% = right/bottom).
Convert to pixels using the image dimensions you detect.
Use these as STRONG hints:
- There MUST be walls separating adjacent rooms
- Each room MUST be enclosed by walls on all sides
- If two marked rooms are next to each other, there MUST be a wall between them
- EXCEPTION: Outdoor spaces (Terrace, Balcony) do NOT need walls drawn around them. They are open-air areas outside the building. Do NOT create walls to enclose terraces or balconies — only detect the building walls that border them.
- STAIRS: If a room is marked as "Stairs", output it in the "stairs" array (not "rooms"). Stairs appear as parallel diagonal lines in floor plans. Never classify stairs as a room.\n\n`;

  roomHints.forEach((room, i) => {
    hints += `  Room ${i + 1}: "${room.name}" at (${(room.x * 100).toFixed(1)}%, ${(room.y * 100).toFixed(1)}%)\n`;
  });

  hints += `\nTotal rooms marked: ${roomHints.length}. You should find AT LEAST ${roomHints.length - 1} interior walls to separate these rooms.\n`;

  return hints;
}

const SYSTEM_PROMPT = `You are a precise architectural floor plan parser. Your ONLY job is to extract STRUCTURAL ELEMENTS: walls, doors, and stairs — with pixel-accurate coordinates.

You are given TWO versions of the same floor plan:
- Image 1 (ORIGINAL): Full detail — use this to see fine lines, door arcs, room labels, thin partition walls, and dimension text. Measure all pixel coordinates from this image.
- Image 2 (PREPROCESSED): Black/white enhanced — use this to confirm wall locations and see structure more clearly when the original is noisy or low-contrast.
Always cross-reference BOTH images. If you see a wall in the preprocessed image, verify it in the original. If you see a thin wall or door arc in the original that was lost in preprocessing, INCLUDE it.

CRITICAL RULES:
1. COMPLETELY IGNORE all furniture, fixtures, appliances, and room labels
2. COMPLETELY IGNORE dimension lines and measurement annotations (thin lines with numbers)
3. For EVERY wall you output, follow the actual drawn ink in the image — do not infer or estimate
4. Rate your confidence (0.0–1.0) for each wall: 1.0 = clearly a structural wall, 0.0 = uncertain
5. FIND ALL WALLS — typical houses have 15–40 wall segments. If you found fewer than 12, you are likely missing interior partition walls. Go back and look harder.
6. Every labeled room (bedroom, kitchen, bathroom, etc.) MUST be enclosed by walls on all sides. If a room has no wall separating it from an adjacent room, you missed a wall.
7. STAIRS are NOT rooms. Stairs appear as parallel diagonal lines (tread pattern). Output them ONLY in the "stairs" array, NEVER in the "rooms" array.
8. OUTDOOR SPACES (terraces, balconies, covered terraces, patios, decks) are NOT enclosed by walls. Do NOT draw walls around outdoor areas. Dashed lines, thin lines, or boundary markings around outdoor spaces are NOT structural walls. Only detect the BUILDING WALL that separates the interior from the outdoor space.
9. ROOM-COUNT CROSS-CHECK: Before outputting, count every distinct room you can identify in the original image. For N rooms, you need AT LEAST N-1 interior walls. If you have fewer, you are missing partition walls — look again at the original image for thin lines between rooms.
10. WALL CONNECTIVITY: Every interior wall must connect to another wall or exterior wall at BOTH endpoints. If a wall endpoint is floating in space, extend it to the nearest wall it should connect to. Walls at T-junctions and L-junctions must share EXACT coordinates at the junction point.

COORDINATE SYSTEM:
- Origin (0,0) = TOP-LEFT of image
- X increases RIGHT
- Y increases DOWN
- All values in PIXELS — measure from the ORIGINAL image (Image 1)

OUTPUT: Pure JSON only. No markdown, no explanations, no code fences.`;

// --- Two-pass Claude analysis for better completeness ---

async function twoPassAnalysis(anthropic, processedImage, originalImage, originalMediaType, mediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, actualWidth, actualHeight) {
  // PASS 1: Extract exterior shell only — send both images
  const pass1Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    thinking: { type: 'enabled', budget_tokens: 10000 },
    system: `You are a precise architectural floor plan parser. Extract ONLY the EXTERIOR PERIMETER walls — the outermost building boundary.
IGNORE all interior partition walls, furniture, fixtures, and annotations.
You are given TWO versions of the same floor plan:
- Image 1 (ORIGINAL): Full detail — use this to see fine lines, door arcs, room labels, and thin walls
- Image 2 (PREPROCESSED): Black/white enhanced — use this to see wall structure more clearly
Use BOTH images together for the most accurate detection. Measure pixel coordinates from what you see in the image.
COORDINATE SYSTEM: Origin (0,0) = TOP-LEFT. X increases RIGHT, Y increases DOWN. All values in PIXELS.
OUTPUT: Pure JSON only. No markdown, no explanations, no code fences.`,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Image 1 — ORIGINAL (use for detail and pixel measurements):',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: originalMediaType, data: originalImage },
        },
        {
          type: 'text',
          text: 'Image 2 — PREPROCESSED (use for wall structure clarity):',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: processedImage },
        },
        {
          type: 'text',
          text: `Extract ONLY the EXTERIOR PERIMETER walls from this floor plan.
${cvHints}
Trace the outermost building boundary as wall segments (junction-to-junction).
Each wall: centerline start/end coordinates, thickness, confidence.
The exterior walls must form a CLOSED LOOP.

Return JSON:
{
  "imageSize": { "width": NUMBER, "height": NUMBER },
  "walls": [
    { "start": { "x": NUMBER, "y": NUMBER }, "end": { "x": NUMBER, "y": NUMBER }, "thickness": NUMBER, "confidence": NUMBER }
  ],
  "overallShape": "rectangular" | "L-shaped" | "U-shaped" | "complex"
}`
        }
      ]
    }]
  });

  const pass1Text = (pass1Response.content.find(b => b.type === 'text') || pass1Response.content[0]).text;
  let pass1Result;
  try {
    pass1Result = JSON.parse(pass1Text);
  } catch {
    const match = pass1Text.match(/\{[\s\S]*\}/);
    pass1Result = match ? JSON.parse(match[0]) : null;
  }

  if (!pass1Result || !pass1Result.walls || pass1Result.walls.length < 3) {
    console.warn('[FloorPlan] Pass 1 failed or found too few walls, falling back to single-pass');
    return null; // Caller will fall back to single-pass
  }

  console.log(`[FloorPlan] Pass 1: ${pass1Result.walls.length} exterior walls detected`);

  // Format exterior walls for Pass 2
  const exteriorWallsDesc = pass1Result.walls.map((w, i) =>
    `  Wall ${i}: (${Math.round(w.start.x)},${Math.round(w.start.y)}) → (${Math.round(w.end.x)},${Math.round(w.end.y)}), thickness=${Math.round(w.thickness)}`
  ).join('\n');

  // PASS 2: Find interior partitions, doors, rooms, stairs using exterior as context
  const scaleSection = knownWidthMeters
    ? `✅ USER-PROVIDED SCALE: Real-world width = ${knownWidthMeters} meters. pixelsPerMeter = imageWidth / ${knownWidthMeters}. Report confidence: 1.0, source: "user_provided".`
    : `Estimate pixelsPerMeter from: 1) Dimension labels in image, 2) Standard door width (0.9m), 3) Wall thickness (0.1m), 4) Overall building size.`;

  const pass2Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 16000 },
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Image 1 — ORIGINAL (use for fine details: door arcs, thin partition walls, room labels, dimension text):',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: originalMediaType, data: originalImage },
        },
        {
          type: 'text',
          text: 'Image 2 — PREPROCESSED (use for wall structure clarity):',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: processedImage },
        },
        {
          type: 'text',
          text: `The EXTERIOR PERIMETER walls have already been detected:
${exteriorWallsDesc}

Now find ALL INTERIOR elements:
1. ALL interior partition walls (walls INSIDE the building that divide rooms)
2. ALL doors (single, double, sliding)
3. ALL rooms (name + center)
4. ALL stairs
5. Scale calibration
${dimensionHints}${formatRoomHints(roomHints)}
IMPORTANT: Do NOT re-detect exterior walls — they are provided above. Focus ONLY on interior walls, doors, rooms, stairs, and scale.
Every room must be bounded by walls. If two rooms are adjacent, there MUST be a wall between them.

Return the COMPLETE floor plan JSON (including the exterior walls from above as-is with isExterior: true):
{
  "success": true,
  "imageSize": { "width": NUMBER, "height": NUMBER },
  "walls": [ ... all walls (exterior from above + your new interior walls) ... ],
  "doors": [ { "center": {"x":N,"y":N}, "width": N, "wallIndex": N, "rotation": N, "doorType": "single"|"double"|"sliding" } ],
  "rooms": [ { "name": STRING, "center": {"x":N,"y":N}, "labeledArea": NUMBER|null } ],
  "stairs": [ { "center": {"x":N,"y":N}, "direction": "up"|"down"|"unknown" } ],
  "scale": { "pixelsPerMeter": NUMBER, "confidence": NUMBER, "source": STRING },
  "overallShape": "${pass1Result.overallShape || 'rectangular'}",
  "totalArea": { "value": NUMBER, "unit": "m²" } | null
}`
        }
      ]
    }]
  });

  const pass2Text = (pass2Response.content.find(b => b.type === 'text') || pass2Response.content[0]).text;
  let pass2Result;
  try {
    pass2Result = JSON.parse(pass2Text);
  } catch {
    const match = pass2Text.match(/\{[\s\S]*\}/);
    pass2Result = match ? JSON.parse(match[0]) : null;
  }

  if (!pass2Result) {
    console.warn('[FloorPlan] Pass 2 failed to parse, falling back to single-pass');
    return null;
  }

  console.log(`[FloorPlan] Pass 2: ${pass2Result.walls?.length || 0} total walls, ${pass2Result.doors?.length || 0} doors, ${pass2Result.rooms?.length || 0} rooms`);
  return pass2Result;
}

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

  const { image, knownWidthMeters, roomHints } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  // Detect original image media type (needed for OCR on original)
  const detectMediaType = (base64Data) => {
    if (base64Data.startsWith('/9j/')) return 'image/jpeg';
    if (base64Data.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64Data.startsWith('R0lGOD')) return 'image/gif';
    if (base64Data.startsWith('UklGR')) return 'image/webp';
    return 'image/png';
  };
  const originalMediaType = detectMediaType(image);

  // Get actual image dimensions before any processing
  const inputBuffer = Buffer.from(image, 'base64');
  const imageMeta = await sharp(inputBuffer).metadata();
  const actualWidth = imageMeta.width;
  const actualHeight = imageMeta.height;
  console.log(`[FloorPlan] Actual image dimensions: ${actualWidth}x${actualHeight}`);

  // Preprocess image for better detection (grayscale, sharpen, binarize)
  const processedImage = await preprocessImage(image);

  // After preprocessing, image is always PNG
  const mediaType = 'image/png';

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    // Run OCR (on original image — text is readable before binarization),
    // Roboflow (on preprocessed image) in parallel
    const [ocrDimensions, roboflowData] = await Promise.all([
      knownWidthMeters ? [] : extractDimensionLabels(image, originalMediaType, anthropic),
      callRoboflow(processedImage),
    ]);
    const cvHints = formatRoboflowHints(roboflowData);
    const dimensionHints = knownWidthMeters ? '' : formatDimensionHints(ocrDimensions);

    // Try two-pass analysis first (exterior shell → interior partitions)
    // Falls back to single-pass if two-pass fails
    let result = await twoPassAnalysis(anthropic, processedImage, image, originalMediaType, mediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, actualWidth, actualHeight);

    if (!result) {
      // Single-pass fallback
      console.log('[FloorPlan] Using single-pass analysis');
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        thinking: { type: 'enabled', budget_tokens: 16000 },
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Image 1 — ORIGINAL (use for fine details: door arcs, thin partition walls, room labels):',
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: originalMediaType, data: image },
            },
            {
              type: 'text',
              text: 'Image 2 — PREPROCESSED (use for wall structure clarity):',
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: processedImage },
            },
            {
              type: 'text',
              text: `Extract all structural elements from this floor plan image with pixel-precise coordinates.
Use Image 1 (original) for fine details and pixel measurements. Use Image 2 (preprocessed) to confirm wall structure.
${cvHints}${dimensionHints}${formatRoomHints(roomHints)}
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
STEP 4 — SCALE CALIBRATION
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
STEP 5 — COMPLETENESS CHECK (do this BEFORE outputting JSON)
═══════════════════════════════════════════════════════════════
Before finalizing, verify:
1. Count the rooms visible in the floor plan. Each room must be bounded by walls on ALL sides.
2. If Room A and Room B are visibly separate spaces, there MUST be a wall between them.
3. Typical floor plans have: 4 exterior walls (minimum) + 1-2 interior walls PER room.
   A 3-bedroom house typically has 20-35 wall segments. If you have fewer than 15, re-examine.
4. Look for interior walls you may have missed — especially:
   • Walls between bedrooms
   • Walls separating bathrooms from hallways
   • Kitchen partition walls
   • Short wall stubs at doorway openings
5. Check that exterior walls form a CLOSED perimeter with no gaps.

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

      const textBlock = response.content.find(block => block.type === 'text');
      const content = textBlock?.text || response.content[0].text;

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
    }

    // Ensure required fields
    result.success = true;
    result.walls = result.walls || [];
    result.doors = result.doors || [];
    result.windows = []; // Windows removed from detection
    result.rooms = result.rooms || [];
    result.stairs = result.stairs || [];
    result.scale = result.scale || { pixelsPerMeter: 50, confidence: 0.5, source: 'estimated' };

    // Rescale coordinates if Claude reported a different image size than the actual
    // Claude's vision model internally downscales images, so its coordinates may be
    // in a smaller space (e.g., 768px) than the actual image (e.g., 2000px)
    const reportedW = result.imageSize?.width || actualWidth;
    const reportedH = result.imageSize?.height || actualHeight;
    const scaleX = actualWidth / reportedW;
    const scaleY = actualHeight / reportedH;
    const needsRescale = Math.abs(scaleX - 1) > 0.05 || Math.abs(scaleY - 1) > 0.05;

    if (needsRescale) {
      console.log(`[FloorPlan] Rescaling coordinates: Claude reported ${reportedW}x${reportedH}, actual ${actualWidth}x${actualHeight} (scale ${scaleX.toFixed(2)}x${scaleY.toFixed(2)})`);

      // Scale walls
      (result.walls || []).forEach(wall => {
        if (wall.start) { wall.start.x *= scaleX; wall.start.y *= scaleY; }
        if (wall.end) { wall.end.x *= scaleX; wall.end.y *= scaleY; }
        if (wall.thickness) wall.thickness *= Math.max(scaleX, scaleY);
      });

      // Scale doors
      (result.doors || []).forEach(door => {
        if (door.center) { door.center.x *= scaleX; door.center.y *= scaleY; }
        if (door.width) door.width *= Math.max(scaleX, scaleY);
      });

      // Scale rooms
      (result.rooms || []).forEach(room => {
        if (room.center) { room.center.x *= scaleX; room.center.y *= scaleY; }
      });

      // Scale stairs
      (result.stairs || []).forEach(stair => {
        if (stair.center) { stair.center.x *= scaleX; stair.center.y *= scaleY; }
      });

      // Scale pixelsPerMeter
      if (result.scale?.pixelsPerMeter) {
        result.scale.pixelsPerMeter *= Math.max(scaleX, scaleY);
      }

      // Update imageSize to actual
      result.imageSize = { width: actualWidth, height: actualHeight };
    }

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

    // Snap nearby wall endpoints together (within 12px) for better connectivity
    const SNAP_THRESHOLD = 12;
    const allEndpoints = [];
    result.walls.forEach((wall, i) => {
      allEndpoints.push({ wallIdx: i, key: 'start', pt: wall.start });
      allEndpoints.push({ wallIdx: i, key: 'end', pt: wall.end });
    });
    for (let i = 0; i < allEndpoints.length; i++) {
      for (let j = i + 1; j < allEndpoints.length; j++) {
        const a = allEndpoints[i].pt;
        const b = allEndpoints[j].pt;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist > 0 && dist <= SNAP_THRESHOLD) {
          // Snap both to their midpoint
          const mx = Math.round((a.x + b.x) / 2);
          const my = Math.round((a.y + b.y) / 2);
          result.walls[allEndpoints[i].wallIdx][allEndpoints[i].key] = { x: mx, y: my };
          result.walls[allEndpoints[j].wallIdx][allEndpoints[j].key] = { x: mx, y: my };
        }
      }
    }

    // Wall connectivity validation: extend disconnected endpoints to nearest wall line
    const CONNECT_THRESHOLD = 15; // px — max distance to extend an endpoint to connect
    const wallCount = result.walls.length;
    for (let i = 0; i < wallCount; i++) {
      const wall = result.walls[i];
      for (const endKey of ['start', 'end']) {
        const pt = wall[endKey];
        // Check if this endpoint is already connected to another wall's endpoint
        let connected = false;
        for (let j = 0; j < wallCount; j++) {
          if (j === i) continue;
          const other = result.walls[j];
          if (Math.hypot(pt.x - other.start.x, pt.y - other.start.y) < 1 ||
              Math.hypot(pt.x - other.end.x, pt.y - other.end.y) < 1) {
            connected = true;
            break;
          }
        }
        if (connected) continue;

        // Not connected — find nearest wall LINE (not endpoint) to snap to
        let bestDist = CONNECT_THRESHOLD;
        let bestProj = null;
        for (let j = 0; j < wallCount; j++) {
          if (j === i) continue;
          const other = result.walls[j];
          const dx = other.end.x - other.start.x;
          const dy = other.end.y - other.start.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          const t = Math.max(0, Math.min(1,
            ((pt.x - other.start.x) * dx + (pt.y - other.start.y) * dy) / lenSq
          ));
          const projX = other.start.x + t * dx;
          const projY = other.start.y + t * dy;
          const dist = Math.hypot(pt.x - projX, pt.y - projY);
          // Only snap to middle of wall (not near endpoints, which are handled by endpoint snap)
          if (dist < bestDist && t > 0.05 && t < 0.95) {
            bestDist = dist;
            bestProj = { x: Math.round(projX), y: Math.round(projY) };
          }
        }
        if (bestProj) {
          result.walls[i][endKey] = bestProj;
          console.log(`[FloorPlan] Connected wall ${i} ${endKey} to nearest wall line (${bestDist.toFixed(1)}px)`);
        }
      }
    }

    // Close exterior wall loop if small gap exists
    const exteriorWalls = result.walls.filter(w => w.isExterior);
    if (exteriorWalls.length >= 3) {
      // Find the two exterior endpoints that are farthest from any other exterior endpoint
      // (these are the gap endpoints if the loop isn't closed)
      const extEndpoints = [];
      exteriorWalls.forEach((w, i) => {
        extEndpoints.push({ pt: w.start, wallIdx: result.walls.indexOf(w), key: 'start' });
        extEndpoints.push({ pt: w.end, wallIdx: result.walls.indexOf(w), key: 'end' });
      });
      // Find endpoints that appear only once (not shared with another wall)
      const unmatched = extEndpoints.filter(ep => {
        const matches = extEndpoints.filter(other =>
          other !== ep && Math.hypot(ep.pt.x - other.pt.x, ep.pt.y - other.pt.y) < 2
        );
        return matches.length === 0;
      });
      // If exactly 2 unmatched endpoints and they're close, snap them together
      if (unmatched.length === 2) {
        const gap = Math.hypot(
          unmatched[0].pt.x - unmatched[1].pt.x,
          unmatched[0].pt.y - unmatched[1].pt.y
        );
        if (gap > 0 && gap < 20) {
          const mx = Math.round((unmatched[0].pt.x + unmatched[1].pt.x) / 2);
          const my = Math.round((unmatched[0].pt.y + unmatched[1].pt.y) / 2);
          result.walls[unmatched[0].wallIdx][unmatched[0].key] = { x: mx, y: my };
          result.walls[unmatched[1].wallIdx][unmatched[1].key] = { x: mx, y: my };
          console.log(`[FloorPlan] Closed exterior wall loop gap (${gap.toFixed(1)}px)`);
        }
      }
    }

    // Post-process: Remove walls in terrace/balcony zones
    // Walls closer to an outdoor marker than any interior marker are boundary lines, not real walls
    if (roomHints && roomHints.length > 0 && result.imageSize) {
      const outdoorTypes = ['terrace', 'balcony', 'covered terrace', 'patio', 'deck'];
      const outdoorHints = roomHints.filter(r =>
        outdoorTypes.some(t => r.name.toLowerCase().includes(t))
      );
      const interiorHints = roomHints.filter(r =>
        !outdoorTypes.some(t => r.name.toLowerCase().includes(t)) &&
        r.name.toLowerCase() !== 'stairs'
      );

      if (outdoorHints.length > 0 && interiorHints.length > 0) {
        const imgW = result.imageSize.width;
        const imgH = result.imageSize.height;
        const outdoorPixels = outdoorHints.map(h => ({ x: h.x * imgW, y: h.y * imgH }));
        const interiorPixels = interiorHints.map(h => ({ x: h.x * imgW, y: h.y * imgH }));
        const maxRadius = Math.hypot(imgW, imgH) * 0.2; // Only check walls within 20% of diagonal

        const wallsToRemove = new Set();
        result.walls.forEach((wall, idx) => {
          const midX = (wall.start.x + wall.end.x) / 2;
          const midY = (wall.start.y + wall.end.y) / 2;

          // Find nearest outdoor marker distance
          let nearestOutdoorDist = Infinity;
          outdoorPixels.forEach(op => {
            const dist = Math.hypot(midX - op.x, midY - op.y);
            if (dist < nearestOutdoorDist) nearestOutdoorDist = dist;
          });

          // Skip if wall is too far from any outdoor marker
          if (nearestOutdoorDist > maxRadius) return;

          // Find nearest interior marker distance
          let nearestInteriorDist = Infinity;
          interiorPixels.forEach(ip => {
            const dist = Math.hypot(midX - ip.x, midY - ip.y);
            if (dist < nearestInteriorDist) nearestInteriorDist = dist;
          });

          // Wall closer to outdoor than interior → terrace boundary → remove
          if (nearestOutdoorDist < nearestInteriorDist) {
            wallsToRemove.add(idx);
          }
        });

        if (wallsToRemove.size > 0) {
          // Build old→new index mapping for door references
          const indexMap = new Map();
          let newIdx = 0;
          result.walls.forEach((_, oldIdx) => {
            if (!wallsToRemove.has(oldIdx)) {
              indexMap.set(oldIdx, newIdx++);
            }
          });

          result.walls = result.walls.filter((_, idx) => !wallsToRemove.has(idx));
          result.doors = result.doors
            .filter(door => indexMap.has(door.wallIndex))
            .map(door => ({ ...door, wallIndex: indexMap.get(door.wallIndex) }));

          console.log(`[FloorPlan API] Removed ${wallsToRemove.size} terrace/balcony boundary walls`);
        }
      }
    }

    // Multi-model validation: Cross-check Roboflow predictions against Claude walls
    // Add any Roboflow-detected walls that Claude missed
    if (roboflowData?.predictions?.length > 0 && result.walls.length > 0) {
      const roboWalls = roboflowData.predictions.filter(p => p.class === 'wall');
      const MATCH_THRESHOLD = 30; // pixels — how close a Roboflow wall center must be to a Claude wall

      let addedCount = 0;
      for (const rw of roboWalls) {
        if (rw.confidence < 0.5) continue; // Only consider higher-confidence Roboflow predictions

        // Get Roboflow wall centerline
        const halfW = rw.width / 2;
        const halfH = rw.height / 2;
        const isHorizontal = rw.width > rw.height;
        const rwStart = isHorizontal
          ? { x: rw.x - halfW, y: rw.y }
          : { x: rw.x, y: rw.y - halfH };
        const rwEnd = isHorizontal
          ? { x: rw.x + halfW, y: rw.y }
          : { x: rw.x, y: rw.y + halfH };
        const rwMid = { x: rw.x, y: rw.y };

        // Check if any Claude wall is near this Roboflow wall's midpoint
        let matched = false;
        for (const cw of result.walls) {
          // Distance from Roboflow midpoint to Claude wall segment
          const dx = cw.end.x - cw.start.x;
          const dy = cw.end.y - cw.start.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          const t = Math.max(0, Math.min(1,
            ((rwMid.x - cw.start.x) * dx + (rwMid.y - cw.start.y) * dy) / lenSq
          ));
          const projX = cw.start.x + t * dx;
          const projY = cw.start.y + t * dy;
          const dist = Math.hypot(rwMid.x - projX, rwMid.y - projY);

          if (dist < MATCH_THRESHOLD) {
            matched = true;
            break;
          }
        }

        // Roboflow found a wall that Claude missed → add it with lower confidence
        if (!matched) {
          result.walls.push({
            start: { x: Math.round(rwStart.x), y: Math.round(rwStart.y) },
            end: { x: Math.round(rwEnd.x), y: Math.round(rwEnd.y) },
            thickness: Math.round(isHorizontal ? rw.height : rw.width),
            isExterior: false, // Assume interior since Claude likely got exterior
            confidence: Math.min(rw.confidence * 0.7, 0.6), // Cap at 0.6 — these are unverified
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        console.log(`[FloorPlan] Multi-model validation: added ${addedCount} Roboflow walls missed by Claude`);
      }
    }

    // If knownWidthMeters was provided, override scale with exact calculation
    if (knownWidthMeters && result.imageSize?.width) {
      result.scale = {
        pixelsPerMeter: result.imageSize.width / knownWidthMeters,
        confidence: 1.0,
        source: 'user_provided',
      };
    }

    // If OCR found dimensions and Claude's scale source isn't user_provided or dimension_label,
    // validate/improve the scale using OCR data
    if (!knownWidthMeters && ocrDimensions.length > 0 && result.scale?.source !== 'dimension_label') {
      const withPixels = ocrDimensions.filter(d => d.pixelLength && d.pixelLength > 20);
      if (withPixels.length > 0) {
        // Use the dimension with the longest pixel line (most reliable measurement)
        const best = withPixels.reduce((a, b) => (b.pixelLength > a.pixelLength) ? b : a);
        const ocrPixelsPerMeter = best.pixelLength / best.meters;
        // Only override if Claude's estimate is significantly different (>30% off)
        const currentPPM = result.scale?.pixelsPerMeter || 50;
        const diff = Math.abs(ocrPixelsPerMeter - currentPPM) / currentPPM;
        if (diff > 0.3) {
          console.log(`[FloorPlan] OCR scale override: ${currentPPM.toFixed(1)} → ${ocrPixelsPerMeter.toFixed(1)} ppm (${best.value}${best.unit})`);
          result.scale = {
            pixelsPerMeter: ocrPixelsPerMeter,
            confidence: 0.9,
            source: 'dimension_label',
          };
        }
      }
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
      rooms: result.rooms.length,
      stairs: result.stairs?.length || 0,
      shape: result.overallShape,
      scaleSource: result.scale?.source,
      pixelsPerMeter: result.scale?.pixelsPerMeter?.toFixed(1),
      knownWidthUsed: !!knownWidthMeters,
      roomHintsProvided: roomHints?.length || 0,
      cvHintsUsed: cvHints.length > 0,
      roboflowDetections: roboflowData ? roboflowData.predictions?.length || 0 : 'skipped',
      ocrDimensionsFound: ocrDimensions.length,
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
