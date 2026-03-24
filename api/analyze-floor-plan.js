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
      // Morphological thin-line suppression: blur softens thin lines (1-3px furniture),
      // re-threshold removes them while keeping thick wall bands (10-20px)
      .blur(2)
      .threshold(180)
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

const SYSTEM_PROMPT = `You are a precise architectural floor plan parser. Extract STRUCTURAL ELEMENTS: walls, doors, and stairs.

You are given TWO versions of the same floor plan:
- Image 1 (ORIGINAL): Full detail — door arcs, room labels, thin partition walls, dimension text.
- Image 2 (PREPROCESSED): Black/white — thick wall bands are prominent, thin furniture lines removed. Use this to confirm wall locations.
Cross-reference BOTH images. Include walls visible in either image.

CRITICAL RULES:
1. IGNORE all furniture, fixtures, appliances, and room labels
2. IGNORE dimension lines and measurement annotations
3. For EVERY wall, follow the actual drawn line — do not infer or estimate
4. Confidence (0.0–1.0) for each wall: 1.0 = clearly structural, 0.4 = uncertain minimum
5. FIND ALL WALLS — typical houses have 15–40 wall segments. If fewer than 12, look harder for interior partitions.
6. Every room MUST be enclosed by walls. If two rooms are adjacent, there MUST be a wall between them.
7. STAIRS are NOT rooms — output in "stairs" array only.
8. OUTDOOR SPACES (terraces, balconies) are NOT enclosed by walls. Only detect the building wall bordering them.
9. ROOM-COUNT CROSS-CHECK: For N rooms, need at least N-1 interior walls.
10. WALL CONNECTIVITY: Every interior wall must connect at BOTH endpoints. Junctions share EXACT coordinates.

COORDINATE SYSTEM — FRACTIONAL (0.0 to 1.0):
- All x values are fractions of image WIDTH (0.0 = left edge, 1.0 = right edge)
- All y values are fractions of image HEIGHT (0.0 = top edge, 1.0 = bottom edge)
- Thickness is a fraction of image width
- Door/window width is a fraction of image width
- Example: a wall from top-left quarter to center = start: {x: 0.25, y: 0.25}, end: {x: 0.5, y: 0.5}

OUTPUT: Pure JSON only. No markdown, no explanations, no code fences.`;

// --- Two-pass Claude analysis for better completeness ---

async function twoPassAnalysis(anthropic, processedImage, originalImage, originalMediaType, mediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, actualWidth, actualHeight) {
  // PASS 1: Extract exterior shell only — send both images
  const pass1Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: `You are a precise architectural floor plan parser. Extract ONLY the EXTERIOR PERIMETER walls — the outermost building boundary.
IGNORE all interior partition walls, furniture, fixtures, and annotations.
You are given TWO images: Image 1 (ORIGINAL) for detail, Image 2 (PREPROCESSED) for wall structure clarity.
COORDINATE SYSTEM — FRACTIONAL (0.0 to 1.0): x = fraction of image width, y = fraction of image height. Thickness = fraction of image width.
OUTPUT: Pure JSON only. No markdown, no explanations, no code fences.`,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Image 1 — ORIGINAL:',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: originalMediaType, data: originalImage },
        },
        {
          type: 'text',
          text: 'Image 2 — PREPROCESSED (thick walls prominent, thin furniture lines removed):',
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
All coordinates as FRACTIONS (0.0–1.0) of image width/height. Thickness as fraction of image width.
The exterior walls must form a CLOSED LOOP.

Return JSON:
{
  "walls": [
    { "start": { "x": 0.0-1.0, "y": 0.0-1.0 }, "end": { "x": 0.0-1.0, "y": 0.0-1.0 }, "thickness": 0.0-1.0, "confidence": 0.0-1.0 }
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

  // Format exterior walls for Pass 2 (fractional coords)
  const exteriorWallsDesc = pass1Result.walls.map((w, i) =>
    `  Wall ${i}: (${w.start.x.toFixed(3)},${w.start.y.toFixed(3)}) → (${w.end.x.toFixed(3)},${w.end.y.toFixed(3)}), thickness=${w.thickness.toFixed(4)}`
  ).join('\n');

  // PASS 2: Find interior partitions, doors, rooms, stairs using exterior as context
  const pass2Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Image 1 — ORIGINAL:',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: originalMediaType, data: originalImage },
        },
        {
          type: 'text',
          text: 'Image 2 — PREPROCESSED (thick walls prominent, thin furniture lines removed):',
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: processedImage },
        },
        {
          type: 'text',
          text: `The EXTERIOR PERIMETER walls have already been detected (fractional coords):
${exteriorWallsDesc}

Now find ALL INTERIOR elements:
1. ALL interior partition walls (walls INSIDE the building that divide rooms)
2. ALL doors (single, double, sliding)
3. ALL rooms (name + center)
4. ALL stairs
${dimensionHints}${formatRoomHints(roomHints)}
IMPORTANT: Do NOT re-detect exterior walls — include them from above as-is with isExterior: true. Focus on interior walls, doors, rooms, stairs.
Every room must be bounded by walls. If two rooms are adjacent, there MUST be a wall between them.

ALL coordinates as FRACTIONS (0.0–1.0) of image width/height.

Return JSON:
{
  "success": true,
  "walls": [ { "start": {"x":0.0-1.0,"y":0.0-1.0}, "end": {"x":0.0-1.0,"y":0.0-1.0}, "thickness": FRACTION, "isExterior": BOOLEAN, "confidence": 0.0-1.0 } ],
  "doors": [ { "center": {"x":0.0-1.0,"y":0.0-1.0}, "width": FRACTION, "wallIndex": N, "rotation": N, "doorType": "single"|"double"|"sliding" } ],
  "rooms": [ { "name": STRING, "center": {"x":0.0-1.0,"y":0.0-1.0}, "labeledArea": NUMBER|null } ],
  "stairs": [ { "center": {"x":0.0-1.0,"y":0.0-1.0}, "direction": "up"|"down"|"unknown" } ],
  "scale": { "estimatedBuildingWidthMeters": NUMBER, "confidence": 0.0-1.0, "source": STRING },
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
        max_tokens: 4096,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Image 1 — ORIGINAL:',
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: originalMediaType, data: image },
            },
            {
              type: 'text',
              text: 'Image 2 — PREPROCESSED (thick walls prominent, thin furniture lines removed):',
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: processedImage },
            },
            {
              type: 'text',
              text: `Extract all structural elements from this floor plan.
${cvHints}${dimensionHints}${formatRoomHints(roomHints)}
ALL coordinates as FRACTIONS (0.0–1.0) of image width/height. Thickness and door width as fractions of image width.

Return JSON:
{
  "success": true,
  "walls": [ { "start": {"x":0.0-1.0,"y":0.0-1.0}, "end": {"x":0.0-1.0,"y":0.0-1.0}, "thickness": FRACTION, "isExterior": BOOLEAN, "confidence": 0.0-1.0 } ],
  "doors": [ { "center": {"x":0.0-1.0,"y":0.0-1.0}, "width": FRACTION, "wallIndex": N, "rotation": N, "doorType": "single"|"double"|"sliding" } ],
  "rooms": [ { "name": STRING, "center": {"x":0.0-1.0,"y":0.0-1.0}, "labeledArea": NUMBER|null } ],
  "stairs": [ { "center": {"x":0.0-1.0,"y":0.0-1.0}, "direction": "up"|"down"|"unknown" } ],
  "scale": { "estimatedBuildingWidthMeters": NUMBER, "confidence": 0.0-1.0, "source": STRING },
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

    // Convert fractional coordinates (0.0–1.0) to actual pixel coordinates
    result.imageSize = { width: actualWidth, height: actualHeight };
    (result.walls || []).forEach(wall => {
      if (wall.start) { wall.start.x *= actualWidth; wall.start.y *= actualHeight; }
      if (wall.end) { wall.end.x *= actualWidth; wall.end.y *= actualHeight; }
      if (wall.thickness) wall.thickness *= actualWidth;
    });
    (result.doors || []).forEach(door => {
      if (door.center) { door.center.x *= actualWidth; door.center.y *= actualHeight; }
      if (door.width) door.width *= actualWidth;
    });
    (result.rooms || []).forEach(room => {
      if (room.center) { room.center.x *= actualWidth; room.center.y *= actualHeight; }
    });
    (result.stairs || []).forEach(stair => {
      if (stair.center) { stair.center.x *= actualWidth; stair.center.y *= actualHeight; }
    });

    // Convert scale: Claude reports estimatedBuildingWidthMeters, compute pixelsPerMeter
    if (result.scale?.estimatedBuildingWidthMeters) {
      // Find the building's pixel width from exterior walls
      let minWx = Infinity, maxWx = 0;
      (result.walls || []).filter(w => w.isExterior).forEach(w => {
        if (w.start) { minWx = Math.min(minWx, w.start.x); maxWx = Math.max(maxWx, w.start.x); }
        if (w.end) { minWx = Math.min(minWx, w.end.x); maxWx = Math.max(maxWx, w.end.x); }
      });
      const buildingPixelWidth = maxWx - minWx;
      if (buildingPixelWidth > 0) {
        result.scale = {
          pixelsPerMeter: buildingPixelWidth / result.scale.estimatedBuildingWidthMeters,
          confidence: result.scale.confidence || 0.5,
          source: result.scale.source || 'estimated',
        };
      }
    } else if (result.scale?.pixelsPerMeter) {
      // Legacy: if Claude still reports pixelsPerMeter, scale it
      result.scale.pixelsPerMeter *= actualWidth;
    }
    if (!result.scale) {
      result.scale = { pixelsPerMeter: actualWidth / 15, confidence: 0.3, source: 'estimated' };
    }

    console.log(`[FloorPlan] Converted fractional → pixel coords (${actualWidth}x${actualHeight})`);

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
