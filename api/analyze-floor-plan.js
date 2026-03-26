// api/analyze-floor-plan.js (Vercel serverless function)
// v4: Gemini-powered analysis (switched from Anthropic)

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const config = {
  maxDuration: 120,
};

// --- Image preprocessing for better AI detection ---

// Standard resolution for Gemini input — we control this so we know exact scale factor
const GEMINI_INPUT_MAX = 1500;

async function preprocessImage(base64Image) {
  try {
    const inputBuffer = Buffer.from(base64Image, 'base64');

    const processed = await sharp(inputBuffer)
      .grayscale()
      .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 })
      .threshold(140)
      // Thin-line suppression: blur softens thin furniture lines, re-threshold removes them
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

// Resize image to standard resolution for Gemini input
async function resizeForGemini(base64Image) {
  try {
    const inputBuffer = Buffer.from(base64Image, 'base64');
    const meta = await sharp(inputBuffer).metadata();
    const { width, height } = meta;

    // Skip if already small enough
    if (width <= GEMINI_INPUT_MAX && height <= GEMINI_INPUT_MAX) {
      return { base64: base64Image, width, height };
    }

    const scale = GEMINI_INPUT_MAX / Math.max(width, height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    const resized = await sharp(inputBuffer)
      .resize(newW, newH)
      .png()
      .toBuffer();

    return { base64: resized.toString('base64'), width: newW, height: newH };
  } catch (err) {
    console.warn('[FloorPlan] Resize failed, using original:', err.message);
    const inputBuffer = Buffer.from(base64Image, 'base64');
    const meta = await sharp(inputBuffer).metadata();
    return { base64: base64Image, width: meta.width, height: meta.height };
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

// --- OCR: Extract dimension labels from floor plan using Gemini Flash ---

async function extractDimensionLabels(base64Image, mediaType, genai) {
  try {
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const response = await model.generateContent([
      {
        inlineData: { mimeType: mediaType, data: base64Image },
      },
      `Look at this floor plan image. Find ALL dimension/measurement labels printed on it.
These are numbers with units like "3500", "3500mm", "12ft", "4.2m", "2100", etc.
They usually appear next to lines with arrows or tick marks at both ends.

Return ONLY a JSON array of objects. No markdown, no explanation.
Each object: { "value": number, "unit": "mm"|"m"|"cm"|"ft"|"in"|"unknown", "pixelLength": number|null }
- value: the numeric value shown
- unit: the unit (if no unit shown, guess from context — values >100 are likely mm, <20 are likely meters)
- pixelLength: approximate pixel length of the dimension line if visible, otherwise null

If no dimension labels found, return an empty array: []`,
    ]);

    const text = response.response.text() || '[]';
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

// ============================================================
// NEW PIPELINE: Gemini Image Gen → CV Extraction → Semantic Info
// ============================================================

// Step 1: Ask Gemini to generate a clean walls-only diagram
async function generateCleanDiagram(base64Image, mediaType, apiKey) {
  console.log('[FloorPlan] Step 1: Generating clean walls-only diagram via Gemini...');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: mediaType, data: base64Image } },
            { text: `Look at this architectural floor plan. Generate a NEW clean image that shows ONLY the structural walls.

Rules for the generated image:
- WHITE background
- BLACK thick lines for ALL walls (exterior and interior partition walls)
- Exterior walls should be THICKER than interior walls
- Follow the EXACT same layout, proportions, and positions as the original
- Do NOT include: furniture, appliances, fixtures, dimension labels, text, room names, door arcs, window symbols, hatching, or any annotations
- Do NOT include: dimension lines, arrows, measurement text
- Make walls as STRAIGHT horizontal or vertical lines (no wobble)
- Every room must be fully enclosed by walls
- The output should look like a simple black line drawing of just the wall structure` }
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.warn('[FloorPlan] Gemini image gen failed:', response.status, err);
    return null;
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts) {
    console.warn('[FloorPlan] No image in Gemini response');
    return null;
  }

  const imagePart = candidate.content.parts.find(p => p.inlineData);
  if (!imagePart) {
    console.warn('[FloorPlan] No inlineData in response parts');
    return null;
  }

  console.log('[FloorPlan] Step 1 complete: clean diagram generated');
  return imagePart.inlineData.data; // base64 PNG
}

// Step 2: Extract wall coordinates from clean image using row/column run-linking
//
// Approach: scan each row for horizontal runs, link adjacent rows into wall bands.
// Same for columns → vertical walls.
//
// Why NOT connected components + PCA:
//   Wall junctions (T, L, X shapes) merge crossing walls into one blob.
//   PCA on a cross/T shape gives a diagonal axis → not usable.
//
// Why this works:
//   Horizontal scan ignores vertical walls (they're thin columns, not wide rows).
//   Vertical scan ignores horizontal walls (thin rows, not tall columns).
//   Each pass sees walls cleanly because orthogonal walls are too narrow to register.
async function extractWallsFromCleanImage(cleanImageBase64) {
  console.log('[FloorPlan] Step 2: Extracting walls via run-link scan...');

  const { data: pixels, info } = await sharp(Buffer.from(cleanImageBase64, 'base64'))
    .grayscale()
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;

  const MIN_RUN   = 12;   // min horizontal/vertical run length (filters cross-section noise)
  const MIN_WALL  = 25;   // min wall segment length to keep
  const MAX_GAP   = 4;    // max row/col gap to bridge (anti-aliasing, slight unevenness)
  const MIN_ROWS  = 2;    // min number of rows in a wall band (rejects 1-pixel noise)

  // ─── Helper: overlap fraction of two runs ────────────────────────────────────
  function overlapFrac(a1, a2, b1, b2) {
    const overlap = Math.min(a2, b2) - Math.max(a1, b1);
    const shorter = Math.min(a2 - a1, b2 - b1);
    return shorter > 0 ? overlap / shorter : 0;
  }

  // ─── Scan rows → horizontal walls ────────────────────────────────────────────
  // Build per-row run list
  const rowRuns = new Array(H);
  for (let y = 0; y < H; y++) {
    rowRuns[y] = [];
    let start = -1;
    for (let x = 0; x <= W; x++) {
      const black = x < W && pixels[y * W + x] === 0;
      if (black && start === -1) { start = x; }
      else if (!black && start !== -1) {
        if (x - start >= MIN_RUN) rowRuns[y].push({ x1: start, x2: x - 1 });
        start = -1;
      }
    }
  }

  // Link runs downward: each unlinked run starts a new wall band
  const rowRunUsed = rowRuns.map(runs => new Uint8Array(runs.length));
  const hWalls = [];

  for (let y = 0; y < H; y++) {
    for (let ri = 0; ri < rowRuns[y].length; ri++) {
      if (rowRunUsed[y][ri]) continue;

      let { x1: curX1, x2: curX2 } = rowRuns[y][ri];
      let sumX1 = curX1, sumX2 = curX2, count = 1;
      let minY = y, maxY = y;
      rowRunUsed[y][ri] = 1;

      let gap = 0;
      for (let ny = y + 1; ny < H; ny++) {
        let bestJ = -1, bestOvlp = 0;
        for (let j = 0; j < rowRuns[ny].length; j++) {
          if (rowRunUsed[ny][j]) continue;
          const { x1, x2 } = rowRuns[ny][j];
          const ovlp = overlapFrac(curX1, curX2, x1, x2);
          if (ovlp > 0.5 && ovlp > bestOvlp) { bestOvlp = ovlp; bestJ = j; }
        }

        if (bestJ === -1) {
          if (++gap > MAX_GAP) break;
          continue;
        }
        gap = 0;
        const { x1, x2 } = rowRuns[ny][bestJ];
        rowRunUsed[ny][bestJ] = 1;
        // Update current run reference (tracks shifting wall edge)
        curX1 = x1; curX2 = x2;
        sumX1 += x1; sumX2 += x2; count++;
        maxY = ny;
      }

      const thickness = maxY - minY + 1;
      if (count < MIN_ROWS) continue;

      const avgX1 = Math.round(sumX1 / count);
      const avgX2 = Math.round(sumX2 / count);
      const length = avgX2 - avgX1;

      if (length >= MIN_WALL && length > thickness * 1.5) {
        hWalls.push({
          start: { x: avgX1, y: Math.round((minY + maxY) / 2) },
          end:   { x: avgX2, y: Math.round((minY + maxY) / 2) },
          thickness,
          isExterior: false,
          confidence: 0.9,
        });
      }
    }
  }

  // ─── Scan columns → vertical walls ───────────────────────────────────────────
  const colRuns = new Array(W);
  for (let x = 0; x < W; x++) {
    colRuns[x] = [];
    let start = -1;
    for (let y = 0; y <= H; y++) {
      const black = y < H && pixels[y * W + x] === 0;
      if (black && start === -1) { start = y; }
      else if (!black && start !== -1) {
        if (y - start >= MIN_RUN) colRuns[x].push({ y1: start, y2: y - 1 });
        start = -1;
      }
    }
  }

  const colRunUsed = colRuns.map(runs => new Uint8Array(runs.length));
  const vWalls = [];

  for (let x = 0; x < W; x++) {
    for (let ri = 0; ri < colRuns[x].length; ri++) {
      if (colRunUsed[x][ri]) continue;

      let { y1: curY1, y2: curY2 } = colRuns[x][ri];
      let sumY1 = curY1, sumY2 = curY2, count = 1;
      let minX = x, maxX = x;
      colRunUsed[x][ri] = 1;

      let gap = 0;
      for (let nx = x + 1; nx < W; nx++) {
        let bestJ = -1, bestOvlp = 0;
        for (let j = 0; j < colRuns[nx].length; j++) {
          if (colRunUsed[nx][j]) continue;
          const { y1, y2 } = colRuns[nx][j];
          const ovlp = overlapFrac(curY1, curY2, y1, y2);
          if (ovlp > 0.5 && ovlp > bestOvlp) { bestOvlp = ovlp; bestJ = j; }
        }

        if (bestJ === -1) {
          if (++gap > MAX_GAP) break;
          continue;
        }
        gap = 0;
        const { y1, y2 } = colRuns[nx][bestJ];
        colRunUsed[nx][bestJ] = 1;
        curY1 = y1; curY2 = y2;
        sumY1 += y1; sumY2 += y2; count++;
        maxX = nx;
      }

      const thickness = maxX - minX + 1;
      if (count < MIN_ROWS) continue;

      const avgY1 = Math.round(sumY1 / count);
      const avgY2 = Math.round(sumY2 / count);
      const length = avgY2 - avgY1;

      if (length >= MIN_WALL && length > thickness * 1.5) {
        vWalls.push({
          start: { x: Math.round((minX + maxX) / 2), y: avgY1 },
          end:   { x: Math.round((minX + maxX) / 2), y: avgY2 },
          thickness,
          isExterior: false,
          confidence: 0.9,
        });
      }
    }
  }

  const allWalls = [...hWalls, ...vWalls];

  // ─── Classify exterior walls ──────────────────────────────────────────────────
  if (allWalls.length > 0) {
    let allMinX = Infinity, allMaxX = 0, allMinY = Infinity, allMaxY = 0;
    allWalls.forEach(w => {
      allMinX = Math.min(allMinX, w.start.x, w.end.x);
      allMaxX = Math.max(allMaxX, w.start.x, w.end.x);
      allMinY = Math.min(allMinY, w.start.y, w.end.y);
      allMaxY = Math.max(allMaxY, w.start.y, w.end.y);
    });
    const margin = Math.max(W, H) * 0.05;

    allWalls.forEach(w => {
      const midX = (w.start.x + w.end.x) / 2;
      const midY = (w.start.y + w.end.y) / 2;
      w.isExterior =
        Math.abs(w.start.x - allMinX) < margin || Math.abs(w.end.x - allMaxX) < margin ||
        Math.abs(w.start.y - allMinY) < margin || Math.abs(w.end.y - allMaxY) < margin ||
        Math.abs(midX - allMinX)      < margin || Math.abs(midX - allMaxX)    < margin ||
        Math.abs(midY - allMinY)      < margin || Math.abs(midY - allMaxY)    < margin;
    });
  }

  console.log(`[FloorPlan] Step 2 complete: ${hWalls.length} horizontal + ${vWalls.length} vertical = ${allWalls.length} walls`);
  return { walls: allWalls, imageWidth: W, imageHeight: H };
}

// Step 3: Extract semantic info (doors, rooms, stairs, scale) from original image
async function extractSemanticsFromOriginal(genai, base64Image, mediaType, walls, knownWidthMeters, dimensionHints, roomHints, geminiW, geminiH) {
  console.log('[FloorPlan] Step 3: Extracting semantic info (doors, rooms, scale)...');

  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 8000 },
    },
  });

  // Format wall positions so Gemini can snap doors to them
  const wallSummary = walls.slice(0, 40).map((w, i) =>
    `  Wall ${i}: (${w.start.x},${w.start.y})→(${w.end.x},${w.end.y}) ${w.isExterior ? 'EXTERIOR' : 'interior'}`
  ).join('\n');

  const scaleHint = knownWidthMeters
    ? `The building width is ${knownWidthMeters} meters.`
    : `Estimate the building width in meters from dimension labels or standard door width (0.9m).`;

  const response = await model.generateContent([
    { inlineData: { mimeType: mediaType, data: base64Image } },
    `This floor plan image is ${geminiW}x${geminiH} pixels. Walls have already been extracted by computer vision:
${wallSummary}

Your job: extract ONLY semantic information — doors, rooms, stairs, and scale. Do NOT extract walls.

For DOORS:
- Find door symbols (quarter-circle arcs, double arcs, sliding markers)
- Report their center position as pixel coordinates ON the nearest wall from the list above
- wallIndex = the wall number from the list above that the door is ON

For ROOMS:
- Name each room (Living Room, Bedroom, Kitchen, etc.)
- Report center position as pixel coordinates
- Include labeledArea in m² if printed in the image

For STAIRS:
- Find stair symbols (parallel diagonal lines)
- Report center position

For SCALE:
${scaleHint}
${dimensionHints}
${formatRoomHints(roomHints)}

Return JSON:
{
  "doors": [{ "center": {"x":N,"y":N}, "width": N, "wallIndex": N, "rotation": 0, "doorType": "single"|"double"|"sliding" }],
  "rooms": [{ "name": STRING, "center": {"x":N,"y":N}, "labeledArea": NUMBER|null }],
  "stairs": [{ "center": {"x":N,"y":N}, "direction": "up"|"down"|"unknown" }],
  "scale": { "pixelsPerMeter": NUMBER, "confidence": NUMBER, "source": STRING },
  "overallShape": "rectangular"|"L-shaped"|"U-shaped"|"complex",
  "totalArea": { "value": NUMBER, "unit": "m²" } | null
}`
  ]);

  const text = response.response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : {};
  }

  console.log(`[FloorPlan] Step 3 complete: ${result.doors?.length || 0} doors, ${result.rooms?.length || 0} rooms`);
  return result;
}

// ============================================================
// LEGACY: Two-pass analysis (kept as fallback if image gen fails)
// ============================================================

const SYSTEM_PROMPT = `You are a precise architectural floor plan parser. Extract STRUCTURAL ELEMENTS: walls, doors, and stairs with pixel-accurate coordinates.

You are given TWO versions of the same floor plan:
- Image 1 (ORIGINAL): Full detail — door arcs, room labels, thin partition walls, dimension text.
- Image 2 (PREPROCESSED): Black/white — thick wall bands prominent, thin furniture lines removed.
Cross-reference BOTH images. Include walls visible in either image.

CRITICAL RULES:
1. IGNORE all furniture, fixtures, appliances, and room labels
2. IGNORE dimension lines and measurement annotations
3. For EVERY wall, follow the actual drawn line — do not infer or estimate
4. Confidence (0.0–1.0) for each wall: 1.0 = clearly structural, 0.4 = uncertain minimum
5. FIND ALL WALLS — typical houses have 15–40 wall segments. If fewer than 12, look harder.
6. Every room MUST be enclosed by walls. Adjacent rooms MUST have a wall between them.
7. STAIRS are NOT rooms — output in "stairs" array only.
8. OUTDOOR SPACES (terraces, balconies) are NOT enclosed by walls.
9. ROOM-COUNT CROSS-CHECK: For N rooms, need at least N-1 interior walls.
10. WALL CONNECTIVITY: Every interior wall connects at BOTH endpoints. Junctions share EXACT pixel coordinates.
11. COORDINATE PRECISION: Report wall endpoints to the nearest WHOLE PIXEL. No decimals.
12. WALL ALIGNMENT: Horizontal walls must have identical Y values for start and end. Vertical walls must have identical X values. Diagonal walls are rare — only use if clearly visible.
13. CORNER JUNCTIONS: When walls meet at a corner, BOTH walls must share the EXACT same pixel coordinate at the junction point.
14. MINIMUM WALL LENGTH: Ignore any wall segment shorter than 20 pixels — these are noise.
15. WALL THICKNESS: Report thickness as a whole number. Exterior walls: 15–25px typical. Interior walls: 8–15px typical.

COORDINATE SYSTEM:
- Origin (0,0) = TOP-LEFT of image
- X increases RIGHT, Y increases DOWN
- All values in PIXELS

OUTPUT: Pure JSON only. No markdown, no explanations, no code fences.`;

// --- Two-pass Gemini analysis for better completeness ---

async function twoPassAnalysis(genai, processedImage, originalImage, originalMediaType, mediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, geminiW, geminiH) {
  // Pass 1: lighter thinking budget for exterior-only detection
  const modelPass1 = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 8000 },
    },
  });
  // Pass 2: higher thinking budget for full interior analysis
  const modelPass2 = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 16000 },
    },
  });

  // PASS 1: Extract exterior shell only — send both images
  const pass1Response = await modelPass1.generateContent([
    `You are a precise architectural floor plan parser. Extract ONLY the EXTERIOR PERIMETER walls — the outermost building boundary.
IGNORE all interior partition walls, furniture, fixtures, and annotations.
You are given TWO images: Image 1 (ORIGINAL) for detail, Image 2 (PREPROCESSED) for wall structure clarity.
The image is ${geminiW}x${geminiH} pixels. All coordinates in PIXELS within this space.
OUTPUT: Pure JSON only. No markdown, no explanations, no code fences.

Image 1 — ORIGINAL:`,
    { inlineData: { mimeType: originalMediaType, data: originalImage } },
    'Image 2 — PREPROCESSED (thick walls prominent, thin furniture lines removed):',
    { inlineData: { mimeType: mediaType, data: processedImage } },
    `Extract ONLY the EXTERIOR PERIMETER walls from this floor plan.
The image is ${geminiW}x${geminiH} pixels. All coordinates in PIXELS.
${cvHints}
Trace the outermost building boundary as wall segments (junction-to-junction).
The exterior walls must form a CLOSED LOOP.

Return JSON:
{
  "imageSize": { "width": ${geminiW}, "height": ${geminiH} },
  "walls": [
    { "start": { "x": NUMBER, "y": NUMBER }, "end": { "x": NUMBER, "y": NUMBER }, "thickness": NUMBER, "confidence": NUMBER }
  ],
  "overallShape": "rectangular" | "L-shaped" | "U-shaped" | "complex"
}`,
  ]);

  const pass1Text = pass1Response.response.text();
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
  const pass2Response = await modelPass2.generateContent([
    SYSTEM_PROMPT,
    'Image 1 — ORIGINAL:',
    { inlineData: { mimeType: originalMediaType, data: originalImage } },
    'Image 2 — PREPROCESSED (thick walls prominent, thin furniture lines removed):',
    { inlineData: { mimeType: mediaType, data: processedImage } },
    `The EXTERIOR PERIMETER walls have already been detected (fractional coords):
${exteriorWallsDesc}

Now find ALL INTERIOR elements:
1. ALL interior partition walls (walls INSIDE the building that divide rooms)
2. ALL doors (single, double, sliding)
3. ALL rooms (name + center)
4. ALL stairs
${dimensionHints}${formatRoomHints(roomHints)}
IMPORTANT: The exterior walls are already detected. Copy them EXACTLY into your output with isExterior: true — do not move, adjust, or re-detect them. Your job is ONLY interior elements.
When interior walls meet exterior walls, their endpoints must SNAP to the nearest exterior wall coordinate.
Every room must be bounded by walls. If two rooms are adjacent, there MUST be a wall between them.
The image is ${geminiW}x${geminiH} pixels. All coordinates in PIXELS.

Return JSON:
{
  "success": true,
  "imageSize": { "width": ${geminiW}, "height": ${geminiH} },
  "walls": [ { "start": {"x":N,"y":N}, "end": {"x":N,"y":N}, "thickness": N, "isExterior": BOOLEAN, "confidence": 0.0-1.0 } ],
  "doors": [ { "center": {"x":N,"y":N}, "width": N, "wallIndex": N, "rotation": N, "doorType": "single"|"double"|"sliding" } ],
  "rooms": [ { "name": STRING, "center": {"x":N,"y":N}, "labeledArea": NUMBER|null } ],
  "stairs": [ { "center": {"x":N,"y":N}, "direction": "up"|"down"|"unknown" } ],
  "scale": { "pixelsPerMeter": NUMBER, "confidence": NUMBER, "source": STRING },
  "overallShape": "${pass1Result.overallShape || 'rectangular'}",
  "totalArea": { "value": NUMBER, "unit": "m²" } | null
}`,
  ]);

  const pass2Text = pass2Response.response.text();
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

  // Resize both images to standard resolution for Gemini (we control the input = deterministic scaling)
  const { base64: resizedOriginal, width: geminiW, height: geminiH } = await resizeForGemini(image);
  const processedImage = await preprocessImage(resizedOriginal);
  const resizedOriginalMediaType = 'image/png'; // resizeForGemini outputs PNG

  // Scale factor to convert Gemini's pixel coords back to actual image coords
  const coordScaleX = actualWidth / geminiW;
  const coordScaleY = actualHeight / geminiH;
  console.log(`[FloorPlan] Gemini input: ${geminiW}x${geminiH}, scale factor: ${coordScaleX.toFixed(2)}x${coordScaleY.toFixed(2)}`);

  // After preprocessing, image is always PNG
  const mediaType = 'image/png';

  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  try {
    // Run OCR (on original image — text is readable before binarization),
    // Roboflow (on preprocessed image) in parallel
    const [ocrDimensions, roboflowData] = await Promise.all([
      knownWidthMeters ? [] : extractDimensionLabels(image, originalMediaType, genai),
      callRoboflow(processedImage),
    ]);
    const cvHints = formatRoboflowHints(roboflowData);
    const dimensionHints = knownWidthMeters ? '' : formatDimensionHints(ocrDimensions);

    // ============================================================
    // NEW PIPELINE: Gemini Image Gen → CV → Semantics
    // Falls back to legacy two-pass if image gen fails
    // ============================================================
    let result;
    const apiKey = process.env.GEMINI_API_KEY;

    // Step 1: Generate clean walls-only diagram
    const cleanDiagram = await generateCleanDiagram(resizedOriginal, resizedOriginalMediaType, apiKey);

    if (cleanDiagram) {
      // Step 2: Extract wall coordinates from clean image via CV
      const cvResult = await extractWallsFromCleanImage(cleanDiagram);

      if (cvResult.walls.length >= 4) {
        // Scale CV coordinates from generated image space to resized input space
        // (generated image may be different size than our resized input)
        const cvScaleX = geminiW / cvResult.imageWidth;
        const cvScaleY = geminiH / cvResult.imageHeight;
        if (Math.abs(cvScaleX - 1) > 0.05 || Math.abs(cvScaleY - 1) > 0.05) {
          cvResult.walls.forEach(w => {
            w.start.x *= cvScaleX; w.start.y *= cvScaleY;
            w.end.x *= cvScaleX; w.end.y *= cvScaleY;
            w.thickness *= Math.max(cvScaleX, cvScaleY);
          });
          console.log(`[FloorPlan] Scaled CV coords: ${cvResult.imageWidth}x${cvResult.imageHeight} → ${geminiW}x${geminiH}`);
        }

        // Step 3: Extract semantic info from original image
        const semantics = await extractSemanticsFromOriginal(
          genai, resizedOriginal, resizedOriginalMediaType,
          cvResult.walls, knownWidthMeters, dimensionHints, roomHints, geminiW, geminiH
        );

        // Combine CV walls + semantic info
        result = {
          success: true,
          imageSize: { width: geminiW, height: geminiH },
          walls: cvResult.walls,
          doors: semantics.doors || [],
          windows: [],
          rooms: semantics.rooms || [],
          stairs: semantics.stairs || [],
          scale: semantics.scale || { pixelsPerMeter: geminiW / 15, confidence: 0.3, source: 'estimated' },
          overallShape: semantics.overallShape || 'rectangular',
          totalArea: semantics.totalArea || null,
        };

        console.log(`[FloorPlan] New pipeline success: ${result.walls.length} walls (CV), ${result.doors.length} doors, ${result.rooms.length} rooms`);
      } else {
        console.warn(`[FloorPlan] CV extracted only ${cvResult.walls.length} walls, falling back to legacy`);
      }
    }

    // Fallback: legacy two-pass LLM analysis
    if (!result) {
      console.log('[FloorPlan] Falling back to legacy two-pass analysis');
      result = await twoPassAnalysis(genai, processedImage, resizedOriginal, resizedOriginalMediaType, mediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, geminiW, geminiH);
    }
    if (!result) {
      throw new Error('All analysis methods failed');
    }

    // Ensure required fields
    result.success = true;
    result.walls = result.walls || [];
    result.doors = result.doors || [];
    result.windows = result.windows || [];
    result.rooms = result.rooms || [];
    result.stairs = result.stairs || [];
    result.scale = result.scale || { pixelsPerMeter: 50, confidence: 0.5, source: 'estimated' };

    // Rescale coordinates from Gemini input resolution to actual image dimensions
    result.imageSize = { width: actualWidth, height: actualHeight };
    if (coordScaleX !== 1 || coordScaleY !== 1) {
      (result.walls).forEach(wall => {
        if (wall.start) { wall.start.x *= coordScaleX; wall.start.y *= coordScaleY; }
        if (wall.end) { wall.end.x *= coordScaleX; wall.end.y *= coordScaleY; }
        if (wall.thickness) wall.thickness *= Math.max(coordScaleX, coordScaleY);
      });
      (result.doors).forEach(door => {
        if (door.center) { door.center.x *= coordScaleX; door.center.y *= coordScaleY; }
        if (door.width) door.width *= Math.max(coordScaleX, coordScaleY);
      });
      (result.rooms).forEach(room => {
        if (room.center) { room.center.x *= coordScaleX; room.center.y *= coordScaleY; }
      });
      (result.stairs || []).forEach(stair => {
        if (stair.center) { stair.center.x *= coordScaleX; stair.center.y *= coordScaleY; }
      });
      if (result.scale?.pixelsPerMeter) {
        result.scale.pixelsPerMeter *= Math.max(coordScaleX, coordScaleY);
      }
      console.log(`[FloorPlan] Rescaled: ${geminiW}x${geminiH} → ${actualWidth}x${actualHeight} (${coordScaleX.toFixed(2)}x)`);
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
    const SNAP_THRESHOLD = 20; // More aggressive snapping for Gemini's slightly looser coords
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
    const CONNECT_THRESHOLD = 25; // px — more aggressive for Gemini's looser coords
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

    // Multi-model validation: Cross-check Roboflow predictions against Gemini walls
    // Add any Roboflow-detected walls that Gemini missed
    if (roboflowData?.predictions?.length > 0 && result.walls.length > 0) {
      const roboWalls = roboflowData.predictions.filter(p => p.class === 'wall');
      const MATCH_THRESHOLD = 30; // pixels — how close a Roboflow wall center must be to a Gemini wall

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

        // Check if any Gemini wall is near this Roboflow wall's midpoint
        let matched = false;
        for (const cw of result.walls) {
          // Distance from Roboflow midpoint to Gemini wall segment
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

        // Roboflow found a wall that Gemini missed → add it with lower confidence
        if (!matched) {
          result.walls.push({
            start: { x: Math.round(rwStart.x), y: Math.round(rwStart.y) },
            end: { x: Math.round(rwEnd.x), y: Math.round(rwEnd.y) },
            thickness: Math.round(isHorizontal ? rw.height : rw.width),
            isExterior: false, // Assume interior since Gemini likely got exterior
            confidence: Math.min(rw.confidence * 0.7, 0.6), // Cap at 0.6 — these are unverified
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        console.log(`[FloorPlan] Multi-model validation: added ${addedCount} Roboflow walls missed by Gemini`);
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

    // If OCR found dimensions and Gemini's scale source isn't user_provided or dimension_label,
    // validate/improve the scale using OCR data
    if (!knownWidthMeters && ocrDimensions.length > 0 && result.scale?.source !== 'dimension_label') {
      const withPixels = ocrDimensions.filter(d => d.pixelLength && d.pixelLength > 20);
      if (withPixels.length > 0) {
        // Use the dimension with the longest pixel line (most reliable measurement)
        const best = withPixels.reduce((a, b) => (b.pixelLength > a.pixelLength) ? b : a);
        const ocrPixelsPerMeter = best.pixelLength / best.meters;
        // Only override if Gemini's estimate is significantly different (>30% off)
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
      error: 'Failed to analyze floor plan',
      _debug: error?.message || String(error),
    });
  }
}
