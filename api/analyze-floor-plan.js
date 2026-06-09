// api/analyze-floor-plan.js (Vercel serverless function)
// v5: OpenAI-first floor-plan analysis with Gemini fallback

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import sharp from 'sharp';
import { requireActiveSubscription, sendError } from '../server/subscriptions.js';
import { consumeUploadCreditForUser } from '../server/uploadQuota.js';

const FLOOR_PLAN_MAX_DURATION_SECONDS = 300;
const FLOOR_PLAN_SOFT_TIMEOUT_MS = Number(process.env.FLOOR_PLAN_SOFT_TIMEOUT_MS || 285000);
const FLOOR_PLAN_ANALYSIS_TIMEOUT_CODE = 'FLOOR_PLAN_ANALYSIS_TIMEOUT';
const FLOOR_PLAN_ANALYSIS_TIMEOUT_MESSAGE = 'The floor-plan scan took too long. Please try again, or upload a smaller, clearer image.';

export const config = {
  maxDuration: FLOOR_PLAN_MAX_DURATION_SECONDS,
};

function sendFloorPlanTimeout(res) {
  if (res.headersSent) return;
  return res.status(504).json({
    success: false,
    code: FLOOR_PLAN_ANALYSIS_TIMEOUT_CODE,
    error: FLOOR_PLAN_ANALYSIS_TIMEOUT_MESSAGE,
    retryable: true,
  });
}

// --- Morphological operations for binary images (0=black/foreground, 255=white) ---

// Erosion: removes black regions thinner than kernel — a pixel stays black only if
// ALL neighbors in the kernel are also black. Kills thin lines and dashed segments.
function morphErode(pixels, W, H, kernelSize = 3) {
  const out = new Uint8Array(W * H);
  const r = (kernelSize - 1) >> 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let maxVal = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) { maxVal = 255; break; }
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const v = (nx >= 0 && nx < W) ? pixels[ny * W + nx] : 255;
          if (v > maxVal) { maxVal = v; if (maxVal === 255) break; }
        }
        if (maxVal === 255) break;
      }
      out[y * W + x] = maxVal;
    }
  }
  return out;
}

// Dilation: expands black regions back — a pixel becomes black if ANY neighbor is black.
// Restores thick walls that erosion thinned.
function morphDilate(pixels, W, H, kernelSize = 3) {
  const out = new Uint8Array(W * H);
  out.fill(255);
  const r = (kernelSize - 1) >> 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let minVal = 255;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          const v = pixels[ny * W + nx];
          if (v < minVal) { minVal = v; if (minVal === 0) break; }
        }
        if (minVal === 0) break;
      }
      out[y * W + x] = minVal;
    }
  }
  return out;
}

// --- Image preprocessing for better AI detection ---

// Standard resolution for model input — we control this so we know exact scale factor
const GEMINI_INPUT_MAX = 1500;
const MIN_CV_WALLS_FOR_STRUCTURAL_RESULT = 15;
const OPENAI_FLOOR_PLAN_MODEL = process.env.OPENAI_FLOOR_PLAN_MODEL || 'gpt-5.2';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';

async function preprocessImage(base64Image) {
  try {
    const inputBuffer = Buffer.from(base64Image, 'base64');

    // Binarize: grayscale → sharpen → threshold
    const { data: rawPixels, info } = await sharp(inputBuffer)
      .grayscale()
      .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 })
      .threshold(140)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Morphological open (erode → dilate): removes thin lines and dashed segments
    // without smearing them into solid bands like blur does
    const eroded = morphErode(rawPixels, info.width, info.height, 3);
    const opened = morphDilate(eroded, info.width, info.height, 3);

    const processed = await sharp(Buffer.from(opened), {
      raw: { width: info.width, height: info.height, channels: 1 }
    }).png().toBuffer();

    console.log(`[FloorPlan] Preprocessed image: ${inputBuffer.length} → ${processed.length} bytes`);
    return processed.toString('base64');
  } catch (err) {
    console.warn('[FloorPlan] Preprocessing failed, using original image:', err.message);
    return base64Image;
  }
}

// Resize image to standard resolution for model input
async function resizeForGemini(base64Image) {
  try {
    const inputBuffer = Buffer.from(base64Image, 'base64');
    const meta = await sharp(inputBuffer).metadata();
    const { width, height } = meta;

    // Keep model inputs consistently PNG so mime types and base64 payloads match.
    if (width <= GEMINI_INPUT_MAX && height <= GEMINI_INPUT_MAX) {
      const png = await sharp(inputBuffer).png().toBuffer();
      return { base64: png.toString('base64'), width, height };
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

function hasEnvValue(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim() !== '';
}

function imageDataUrl(base64Image, mediaType) {
  return `data:${mediaType};base64,${base64Image}`;
}

function getOpenAIOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;

  return (response.output || [])
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(part => part.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n');
}

function parseOpenAIJson(response, fallback = {}) {
  if (response.output_parsed) return response.output_parsed;

  const text = getOpenAIOutputText(response);
  if (!text) return fallback;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      console.warn('[FloorPlan] OpenAI JSON parse failed:', error.message);
      return fallback;
    }
  }
}

function openAIJsonSchema(name, schema, description) {
  return {
    type: 'json_schema',
    name,
    description,
    strict: false,
    schema,
  };
}

function pointSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
    },
    required: ['x', 'y'],
  };
}

function wallSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      start: pointSchema(),
      end: pointSchema(),
      thickness: { type: 'number' },
      isExterior: { type: 'boolean' },
      confidence: { type: 'number' },
    },
    required: ['start', 'end'],
  };
}

function floorPlanResultSchema({ includeRejectWallIndices = false } = {}) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      success: { type: 'boolean' },
      imageSize: {
        type: 'object',
        additionalProperties: false,
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
        },
      },
      ...(includeRejectWallIndices ? {
        rejectWallIndices: { type: 'array', items: { type: 'number' } },
      } : {}),
      walls: { type: 'array', items: wallSchema() },
      doors: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            center: pointSchema(),
            width: { type: 'number' },
            wallIndex: { type: 'number' },
            positionAlongWall: { type: 'number' },
            rotation: { type: 'number' },
            doorType: { type: 'string', enum: ['single', 'double', 'sliding', 'pocket', 'unknown'] },
          },
        },
      },
      windows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            center: pointSchema(),
            width: { type: 'number' },
            wallIndex: { type: 'number' },
            positionAlongWall: { type: 'number' },
          },
        },
      },
      rooms: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            center: pointSchema(),
            labeledArea: { type: ['number', 'null'] },
          },
        },
      },
      stairs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            center: pointSchema(),
            direction: { type: 'string', enum: ['up', 'down', 'unknown'] },
          },
        },
      },
      scale: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pixelsPerMeter: { type: 'number' },
          confidence: { type: 'number' },
          source: { type: 'string' },
        },
      },
      overallShape: { type: 'string' },
      totalArea: {
        type: ['object', 'null'],
        additionalProperties: false,
        properties: {
          value: { type: 'number' },
          unit: { type: 'string' },
        },
      },
    },
  };
}

function wallAnalysisSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      imageSize: {
        type: 'object',
        additionalProperties: false,
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
        },
      },
      walls: { type: 'array', items: wallSchema() },
      scale: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pixelsPerMeter: { type: 'number' },
          confidence: { type: 'number' },
          source: { type: 'string' },
        },
      },
      overallShape: { type: 'string' },
      totalArea: {
        type: ['object', 'null'],
        additionalProperties: false,
        properties: {
          value: { type: 'number' },
          unit: { type: 'string' },
        },
      },
    },
  };
}

function normalizeDimensionLabels(dimensions) {
  if (!Array.isArray(dimensions)) return [];

  return dimensions.map(d => {
    let meters;
    switch (d.unit) {
      case 'mm': meters = d.value / 1000; break;
      case 'cm': meters = d.value / 100; break;
      case 'ft': meters = d.value * 0.3048; break;
      case 'in': meters = d.value * 0.0254; break;
      case 'm': meters = d.value; break;
      default:
        meters = d.value > 100 ? d.value / 1000 : d.value;
        break;
    }
    return { ...d, meters, pixelLength: d.pixelLength || null, bbox: d.bbox || null };
  }).filter(d => d.meters > 0.3 && d.meters < 50);
}

function splitWallsAtJunctions(walls, threshold = 2) {
  if (!Array.isArray(walls) || walls.length < 2) return walls || [];

  const splitWalls = [];
  let splitCount = 0;

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    const splits = [0, 1];

    for (let j = 0; j < walls.length; j++) {
      if (i === j) continue;
      for (const point of [walls[j].start, walls[j].end]) {
        const t = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lenSq;
        if (t <= 0.05 || t >= 0.95) continue;

        const proj = {
          x: wall.start.x + t * dx,
          y: wall.start.y + t * dy,
        };
        const distance = Math.hypot(point.x - proj.x, point.y - proj.y);
        if (distance <= threshold && !splits.some(existing => Math.abs(existing - t) < 0.02)) {
          splits.push(t);
        }
      }
    }

    splits.sort((a, b) => a - b);
    if (splits.length <= 2) {
      splitWalls.push(wall);
      continue;
    }

    splitCount += splits.length - 2;
    for (let s = 0; s < splits.length - 1; s++) {
      const t1 = splits[s];
      const t2 = splits[s + 1];
      const start = {
        x: Math.round(wall.start.x + t1 * dx),
        y: Math.round(wall.start.y + t1 * dy),
      };
      const end = {
        x: Math.round(wall.start.x + t2 * dx),
        y: Math.round(wall.start.y + t2 * dy),
      };
      if (Math.hypot(end.x - start.x, end.y - start.y) < 20) continue;
      splitWalls.push({ ...wall, start, end });
    }
  }

  if (splitCount > 0) {
    console.log(`[FloorPlan] Split walls at junctions: ${walls.length} → ${splitWalls.length}`);
  }

  return splitWalls;
}

function wallBoundsInMeters(walls, scale) {
  if (!Array.isArray(walls) || walls.length === 0 || !scale?.pixelsPerMeter) return null;

  const points = walls.flatMap(wall => [wall.start, wall.end].filter(Boolean));
  if (points.length === 0) return null;

  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    width: (Math.max(...xs) - Math.min(...xs)) / scale.pixelsPerMeter,
    depth: (Math.max(...ys) - Math.min(...ys)) / scale.pixelsPerMeter,
  };
}

function cvWallCoverageLooksIncomplete(walls, scale, dimensionLabels) {
  const bounds = wallBoundsInMeters(walls, scale);
  if (!bounds || !Array.isArray(dimensionLabels) || dimensionLabels.length < 2) return false;
  if ((scale.confidence ?? 0) < 0.75 || scale.source !== 'dimension_label') return false;

  const largeDimensions = dimensionLabels
    .map(label => label.meters)
    .filter(meters => Number.isFinite(meters) && meters >= 4)
    .sort((a, b) => b - a);

  if (largeDimensions.length < 2) return false;

  const [largest, secondLargest] = largeDimensions;
  const coverageA = Math.min(bounds.width / largest, bounds.depth / secondLargest);
  const coverageB = Math.min(bounds.width / secondLargest, bounds.depth / largest);
  const bestCoverage = Math.max(coverageA, coverageB);

  if (bestCoverage >= 0.72) return false;

  console.warn(
    `[FloorPlan] CV wall bounds ${bounds.width.toFixed(2)}m x ${bounds.depth.toFixed(2)}m cover only ${Math.round(bestCoverage * 100)}% of printed dimensions ${largest.toFixed(2)}m x ${secondLargest.toFixed(2)}m`
  );
  return true;
}

function adjustScaleFromWallBounds(result, dimensionLabels) {
  if (!result?.scale?.pixelsPerMeter || !Array.isArray(result.walls) || result.walls.length === 0) {
    return;
  }
  if (!Array.isArray(dimensionLabels) || dimensionLabels.length < 2) return;
  if ((result.scale.confidence ?? 0) < 0.75 || !String(result.scale.source || '').startsWith('dimension_label')) return;

  const points = result.walls.flatMap(wall => [wall.start, wall.end].filter(Boolean));
  if (points.length === 0) return;

  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const widthPx = Math.max(...xs) - Math.min(...xs);
  const depthPx = Math.max(...ys) - Math.min(...ys);
  if (widthPx <= 0 || depthPx <= 0) return;

  const largeDimensions = dimensionLabels
    .map(label => label.meters)
    .filter(meters => Number.isFinite(meters) && meters >= 4)
    .sort((a, b) => b - a);

  if (largeDimensions.length < 2) return;

  const [largest, secondLargest] = largeDimensions;
  const currentPpm = result.scale.pixelsPerMeter;
  const candidates = [
    { widthMeters: largest, depthMeters: secondLargest },
    { widthMeters: secondLargest, depthMeters: largest },
  ];

  let best = null;
  for (const candidate of candidates) {
    const wallAspect = widthPx / depthPx;
    const dimensionAspect = candidate.widthMeters / candidate.depthMeters;
    const aspectError = Math.abs(Math.log(wallAspect / dimensionAspect));
    const coverage = Math.min(
      (widthPx / currentPpm) / candidate.widthMeters,
      (depthPx / currentPpm) / candidate.depthMeters
    );
    const candidatePpm = ((widthPx / candidate.widthMeters) + (depthPx / candidate.depthMeters)) / 2;
    const score = aspectError + Math.abs(1 - coverage);
    if (!best || score < best.score) {
      best = { ...candidate, aspectError, coverage, candidatePpm, score };
    }
  }

  if (!best || best.aspectError > 0.18 || (best.coverage >= 0.8 && best.coverage <= 1.25)) return;

  const ppmRatio = best.candidatePpm / currentPpm;
  if (ppmRatio > 0.85 && ppmRatio < 1.15) return;

  console.warn(
    `[FloorPlan] Adjusted scale from ${currentPpm.toFixed(1)} to ${best.candidatePpm.toFixed(1)} px/m using wall bounds and printed dimensions ${best.widthMeters.toFixed(2)}m x ${best.depthMeters.toFixed(2)}m`
  );
  result.scale = {
    ...result.scale,
    pixelsPerMeter: best.candidatePpm,
    confidence: Math.min(0.95, Math.max(result.scale.confidence ?? 0.8, 0.9)),
    source: 'dimension_label_wall_bounds',
  };
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
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { temperature: 0 } });

    const response = await model.generateContent([
      {
        inlineData: { mimeType: mediaType, data: base64Image },
      },
      `Look at this floor plan image. Find ALL dimension/measurement labels printed on it.
These are numbers with units like "3500", "3500mm", "12ft", "4.2m", "2100", etc.
They usually appear next to lines with arrows or tick marks at both ends.

Return ONLY a JSON array of objects. No markdown, no explanation.
Each object: { "value": number, "unit": "mm"|"m"|"cm"|"ft"|"in"|"unknown", "pixelLength": number|null, "bbox": { "x": number, "y": number, "w": number, "h": number } }
- value: the numeric value shown
- unit: the unit (if no unit shown, guess from context — values >100 are likely mm, <20 are likely meters)
- pixelLength: approximate pixel length of the dimension line if visible, otherwise null
- bbox: the bounding box of the text label in pixels — x,y is the top-left corner, w,h is width and height. Include the dimension line/arrows if visible.

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

    const normalized = normalizeDimensionLabels(dimensions);

    console.log(`[FloorPlan] OCR found ${normalized.length} dimension labels:`, normalized.map(d => `${d.value}${d.unit}=${d.meters.toFixed(2)}m`));
    return normalized;
  } catch (err) {
    console.warn('[FloorPlan] OCR dimension extraction failed:', err.message);
    return [];
  }
}

async function extractDimensionLabelsWithOpenAI(base64Image, mediaType, openai) {
  try {
    const response = await openai.responses.create({
      model: OPENAI_FLOOR_PLAN_MODEL,
      reasoning: { effort: 'none' },
      max_output_tokens: 4000,
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Look at this floor plan image. Find ALL dimension/measurement labels printed on it.
These are numbers with units like "3500", "3500mm", "12ft", "4.2m", "2100", etc.
They usually appear next to dimension lines with arrows or tick marks at both ends.

Return only JSON matching the requested schema.
Each dimension must include:
- value: numeric value shown
- unit: "mm", "m", "cm", "ft", "in", or "unknown"
- pixelLength: approximate pixel length of the dimension line if visible, otherwise null
- bbox: text/line bounding box in pixels if visible, otherwise null`,
          },
          { type: 'input_image', image_url: imageDataUrl(base64Image, mediaType), detail: 'high' },
        ],
      }],
      text: {
        format: openAIJsonSchema('floor_plan_dimensions', {
          type: 'object',
          additionalProperties: false,
          properties: {
            dimensions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  value: { type: 'number' },
                  unit: { type: 'string', enum: ['mm', 'm', 'cm', 'ft', 'in', 'unknown'] },
                  pixelLength: { type: ['number', 'null'] },
                  bbox: {
                    type: ['object', 'null'],
                    additionalProperties: false,
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' },
                      w: { type: 'number' },
                      h: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        }, 'Dimension labels detected in a scanned architectural floor plan.'),
      },
    });

    const parsed = parseOpenAIJson(response, { dimensions: [] });
    const normalized = normalizeDimensionLabels(parsed.dimensions);
    console.log(`[FloorPlan] OpenAI OCR found ${normalized.length} dimension labels:`, normalized.map(d => `${d.value}${d.unit}=${d.meters.toFixed(2)}m`));
    return normalized;
  } catch (err) {
    console.warn('[FloorPlan] OpenAI dimension extraction failed:', err.message);
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
- Walls should generally separate adjacent rooms, EXCEPT when two rooms share one open-plan space (e.g. open kitchen + dining, or living + dining). In open-plan layouts, two marked rooms may exist inside the same large enclosed area with NO dividing wall between them.
- Only draw a dividing wall between two marked rooms if the original floor plan clearly shows one. Do NOT invent walls to force enclosure.
- The outer boundary of an open-plan area must still be fully enclosed by walls.
- EXCEPTION: Outdoor spaces (Terrace, Balcony) do NOT need walls drawn around them. They are open-air areas outside the building. Do NOT create walls to enclose terraces or balconies — only detect the building walls that border them.
- STAIRS: If a room is marked as "Stairs", output it in the "stairs" array (not "rooms"). Stairs appear as parallel diagonal lines in floor plans. Never classify stairs as a room.\n\n`;

  roomHints.forEach((room, i) => {
    hints += `  Room ${i + 1}: "${room.name}" at (${(room.x * 100).toFixed(1)}%, ${(room.y * 100).toFixed(1)}%)\n`;
  });

  hints += `\nTotal rooms marked: ${roomHints.length}. You should find AT LEAST ${roomHints.length - 1} interior walls to separate these rooms.\n`;

  return hints;
}

// ============================================================
// NEW PIPELINE: OpenAI/Gemini Image Gen → CV Extraction → Semantic Info
// ============================================================

function openAIImageSizeFor(width, height) {
  const ratio = width / Math.max(height, 1);
  if (ratio > 1.15) return '1536x1024';
  if (ratio < 0.87) return '1024x1536';
  return '1024x1024';
}

async function generateCleanDiagramWithOpenAI(base64Image, mediaType, openai, width, height) {
  console.log(`[FloorPlan] Step 1: Generating clean walls-only diagram via OpenAI ${OPENAI_IMAGE_MODEL}...`);

  try {
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const response = await openai.images.edit({
      model: OPENAI_IMAGE_MODEL,
      image: new File([imageBuffer], 'floor-plan.png', { type: mediaType }),
      prompt: `Create a new clean black-and-white architectural wall mask from this floor plan.

Output requirements:
- Pure white background.
- Pure black, consistently thick solid bands for structural walls only.
- Preserve the original layout, proportions, and wall positions as closely as possible.
- Exterior walls should be thicker than interior partition walls.
- Remove all text, room labels, dimensions, arrows, colored lines, dashed/dotted lines, furniture, fixtures, hatching, door arcs, window symbols, title blocks, page borders, scale bars, and decorative elements.
- Do not invent walls. If an original open-plan area has no dividing wall, keep it open.
- Keep only real structural walls that are visibly thicker than annotation/detail lines.

The result should be a simple walls-only schematic suitable for computer-vision line extraction.`,
      size: openAIImageSizeFor(width, height),
      quality: 'high',
      input_fidelity: 'high',
      output_format: 'png',
    });

    const resultBase64 = response.data?.[0]?.b64_json;
    if (!resultBase64) {
      console.warn('[FloorPlan] OpenAI image edit returned no image');
      return null;
    }

    console.log('[FloorPlan] Step 1 complete: clean diagram generated by OpenAI');
    return resultBase64;
  } catch (err) {
    console.warn('[FloorPlan] OpenAI clean diagram generation failed:', err.message);
    return null;
  }
}

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

The generated image MUST be a pure black-and-white line drawing — no color, no gray, no text, no annotations of any kind.

STRICT RULES for the generated image:
- WHITE background (pure #FFFFFF)
- BLACK THICK lines (pure #000000) for ALL walls (exterior and interior partition walls)
- CRITICAL: Walls must be drawn as CONSISTENTLY THICK solid bands — at least 6-10 pixels thick for interior walls, 10-16 pixels for exterior walls. DO NOT draw walls as thin single-pixel lines. Thin walls will be mistaken for noise and discarded by downstream processing.
- All interior walls should have a similar, consistent thickness to each other
- All exterior walls should have a similar, consistent thickness to each other (noticeably thicker than interior)
- Follow the EXACT same layout, proportions, and positions as the original

AGGRESSIVELY REMOVE everything that is NOT a structural wall. The following MUST be completely absent from the output:
- ALL colored lines of any color (orange, red, green, blue, yellow, gray, etc.) — these are typically dimension lines, setback markers, property boundaries, or annotations and are NEVER walls
- ALL dimension lines, measurement lines, and the arrows/tick marks at their ends
- ALL text and numbers (dimension labels like "3500", "4.2m", room names like "Kitchen", area labels like "127sqm", "AREA", "1.0m setback", etc.)
- ALL dashed, dotted, or double-dashed lines (property boundaries, setback lines, fold lines, invisible walls)
- ALL furniture, appliances, fixtures (beds, sofas, tables, toilets, sinks, stoves, etc.)
- ALL door arcs (quarter circles), window symbols, hatching, stair step lines
- ALL title blocks, legends, scale bars, compass/north arrows
- ALL page borders, frames, or decorative elements

If a line in the original is anything other than solid black/dark gray AND clearly represents a structural wall, OMIT it from the output.

WALL THICKNESS TEST: Only draw walls that are VISIBLY THICKER than the dimension/annotation lines in the original. Structural walls are drawn as heavy double-lines or thick filled bands — typically 3-10x thicker than dimension lines, property boundaries, or furniture outlines. Thin lines of any kind — even if they form rectangles or appear to enclose a space — are NEVER walls and must be omitted. If in doubt about whether a line is a wall or an annotation, leave it out.

LAYOUT RULES:
- Make walls as STRAIGHT horizontal or vertical lines (no wobble)
- The outer boundary of the building must be fully enclosed by walls
- Do NOT invent walls where the original floor plan has none — if two rooms share one open-plan space (e.g. open kitchen + dining, living + dining), leave the gap between them and do not draw a dividing wall
- Stairwells and open-plan areas may have gaps where there is no wall

The output must look like the simplest possible black-and-white architectural wall-only schematic — nothing else.` }
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          temperature: 0,
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
async function extractWallsFromCleanImage(cleanImageBase64, textBoxes = [], srcWidth = 0, srcHeight = 0) {
  console.log('[FloorPlan] Step 2: Extracting walls via run-link scan...');

  const { data: rawPixels, info } = await sharp(Buffer.from(cleanImageBase64, 'base64'))
    .grayscale()
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;

  // Morphological open: erode removes thin/dashed lines, dilate restores thick walls
  const eroded = morphErode(rawPixels, W, H, 3);
  const pixels = morphDilate(eroded, W, H, 3);

  const MIN_RUN   = 12;   // min horizontal/vertical run length (filters cross-section noise)
  const MIN_WALL  = 25;   // min wall segment length to keep
  const MAX_GAP   = 4;    // max row/col gap to bridge (anti-aliasing, slight unevenness)
  const MIN_ROWS  = 4;    // min number of rows in a wall band (rejects thin lines)

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

  let allWalls = [...hWalls, ...vWalls];

  // ─── Thickness filter: reject thin annotation lines ──────────────────────────
  // Hybrid: absolute minimum + median-relative adaptive threshold.
  // Real structural walls are consistently thicker than stair/dimension/furniture lines,
  // so anything significantly thinner than median is noise.
  if (allWalls.length >= 8) {
    const thicknesses = allWalls.map(w => w.thickness).sort((a, b) => a - b);
    const median = thicknesses[Math.floor(thicknesses.length / 2)];
    const MIN_THICKNESS = Math.max(3, median * 0.4);
    const before = allWalls.length;
    allWalls = allWalls.filter(w => w.thickness >= MIN_THICKNESS);
    if (before !== allWalls.length) {
      console.log(`[FloorPlan] Thickness filter: median=${median}px, threshold=${MIN_THICKNESS.toFixed(1)}px, dropped ${before - allWalls.length}/${before} walls`);
    }
  } else {
    // Too few walls for a reliable median — just apply the absolute floor
    const before = allWalls.length;
    allWalls = allWalls.filter(w => w.thickness >= 3);
    if (before !== allWalls.length) {
      console.log(`[FloorPlan] Thickness filter (absolute only): dropped ${before - allWalls.length}/${before} walls with thickness < 3px`);
    }
  }

  // ─── Filter walls that overlap OCR text bounding boxes ───────────────────────
  if (textBoxes.length > 0 && srcWidth > 0 && srcHeight > 0) {
    // Scale bounding boxes from original image space to clean diagram space
    const scaleX = W / srcWidth;
    const scaleY = H / srcHeight;
    const scaledBoxes = textBoxes.map(tb => ({
      x: tb.x * scaleX,
      y: tb.y * scaleY,
      w: tb.w * scaleX,
      h: tb.h * scaleY,
    }));

    const PAD = 5; // pixels of padding around each text box
    const before = allWalls.length;
    allWalls = allWalls.filter(wall => {
      const midX = (wall.start.x + wall.end.x) / 2;
      const midY = (wall.start.y + wall.end.y) / 2;
      for (const tb of scaledBoxes) {
        if (midX >= tb.x - PAD && midX <= tb.x + tb.w + PAD &&
            midY >= tb.y - PAD && midY <= tb.y + tb.h + PAD) {
          return false;
        }
      }
      return true;
    });
    if (before !== allWalls.length) {
      console.log(`[FloorPlan] Filtered ${before - allWalls.length} walls overlapping OCR text boxes`);
    }
  }

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
    model: 'gemini-2.5-pro',
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

Your job: extract semantic information (doors, windows, rooms, stairs, scale) AND audit the wall list.

WALL AUDIT (rejectWallIndices):
The CV scan above sometimes mistakes dimension lines, property boundaries, or annotation lines for walls. Look at each wall in the list and compare it to the original image. Return an array of wall indices that should be REJECTED (removed from the final output).

A wall MUST be rejected if:
- It sits on top of a dimension line (vertical or horizontal line with arrows/ticks and a numeric label like "5500", "3600", etc.)
- It is drawn with a colored (orange, red, green, blue) line in the original — these are always annotations, never structural walls
- It passes through the middle of a single clearly-marked room (e.g. a vertical line splitting a "Living Room" down the middle — that line is a dimension, not a wall)
- It sits inside an open-plan area and has no corresponding thick black line in the original
- It is a setback line, property boundary, or garden/terrace edge rather than a building wall
- It forms a small "phantom room" box around a staircase where the original plan shows the stairs as open (stairs are usually open on at least one side; look for walls that enclose the stair footprint that do NOT exist in the original drawing)

When in doubt, KEEP the wall (do not reject). Only reject walls that you are confident are non-structural.

For DOORS — CRITICAL, every enclosed room MUST have at least one door:
- Find ALL door symbols: quarter-circle arcs (hinged doors), double arcs (double doors), straight line with parallel marks (sliding doors), rectangular opening with small arc (pocket doors)
- Look carefully at EVERY enclosed room — bedrooms, bathrooms, toilets, closets, utility rooms ALL need a door. Small interior doors are easy to miss; scan each room perimeter.
- If you can identify a room but cannot see its door symbol, infer the door at the most likely position (usually the wall closest to a hallway or main living area) and report it with doorType "single"
- Report position using BOTH formats below:
  - center: {x, y} pixel coordinates of the door center
  - wallIndex: the wall number from the list above that the door is ON (use the ORIGINAL index)
  - positionAlongWall: distance in PIXELS from the wall's start point (wall.start) along the wall direction to the door center. This is more robust than absolute pixel coordinates.
- width: door width in pixels (typical: 60-120 px for a standard 0.8-0.9m door)

For WINDOWS:
- Find window symbols: parallel lines on walls, glass markers, large glazing panels, thin double-line segments on exterior walls
- Large sliding glass doors that act as windows (floor-to-ceiling glazing) should be reported as windows, not doors
- Report position using BOTH formats:
  - center: {x, y} pixel coordinates
  - wallIndex: the ORIGINAL wall index
  - positionAlongWall: distance in pixels from wall.start to window center
- width: window width in pixels

For ROOMS:
- Name each room (Living Room, Bedroom, Kitchen, etc.)
- Report center position as pixel coordinates
- Include labeledArea in m² if printed in the image

For STAIRS:
- Find stair symbols (parallel diagonal lines, usually with an "UP" or "DN" label)
- Report center position
- Stairs should NOT be enclosed on all sides — they typically open into a hallway or living space

For SCALE:
${scaleHint}
${dimensionHints}
${formatRoomHints(roomHints)}

Return JSON:
{
  "rejectWallIndices": [N, N, ...],
  "doors": [{ "center": {"x":N,"y":N}, "width": N, "wallIndex": N, "positionAlongWall": N, "rotation": 0, "doorType": "single"|"double"|"sliding" }],
  "windows": [{ "center": {"x":N,"y":N}, "width": N, "wallIndex": N, "positionAlongWall": N }],
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

  console.log(`[FloorPlan] Step 3 complete: ${result.doors?.length || 0} doors, ${result.windows?.length || 0} windows, ${result.rooms?.length || 0} rooms, ${result.rejectWallIndices?.length || 0} walls flagged for rejection`);
  return result;
}

async function extractSemanticsFromOriginalWithOpenAI(openai, base64Image, mediaType, walls, knownWidthMeters, dimensionHints, roomHints, modelW, modelH) {
  console.log(`[FloorPlan] Step 3: Extracting semantic info via OpenAI ${OPENAI_FLOOR_PLAN_MODEL}...`);

  const wallSummary = walls.slice(0, 60).map((w, i) =>
    `  Wall ${i}: (${Math.round(w.start.x)},${Math.round(w.start.y)}) -> (${Math.round(w.end.x)},${Math.round(w.end.y)}) ${w.isExterior ? 'EXTERIOR' : 'interior'}`
  ).join('\n');

  const scaleHint = knownWidthMeters
    ? `The building width is ${knownWidthMeters} meters.`
    : 'Estimate the building width in meters from dimension labels or standard door width (0.9m).';

  const response = await openai.responses.create({
    model: OPENAI_FLOOR_PLAN_MODEL,
    reasoning: { effort: 'medium' },
    max_output_tokens: 12000,
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `This floor plan image is ${modelW}x${modelH} pixels. Walls have already been extracted by computer vision:
${wallSummary}

Your job: extract semantic information and audit the wall list.

Return JSON only. Use pixel coordinates in the ${modelW}x${modelH} image coordinate space.

Wall audit:
- Return rejectWallIndices for CV walls that are clearly dimension lines, colored annotation lines, setback/property boundary lines, furniture/fixture/detail lines, or phantom walls inside open-plan areas.
- When in doubt, keep the wall.

Doors:
- Find all hinged, double, sliding, and pocket doors.
- Every enclosed room should have at least one door. If the symbol is ambiguous, infer the likely doorway with lower confidence by still returning the most likely center/wall.
- Include center, width, wallIndex from the original wall list, positionAlongWall, rotation, and doorType.

Windows:
- Find all exterior wall windows, glass markers, parallel wall segments, and large glazing panels.
- Include center, width, wallIndex, and positionAlongWall.

Rooms:
- Extract room names and centers. Room labeling is optional; use visible labels when present and sensible generic names otherwise.

Stairs:
- Detect stair symbols as stairs, not rooms.

Scale:
${scaleHint}
${dimensionHints}
${formatRoomHints(roomHints)}

Keep the JSON compact:
- At most 20 doors.
- At most 20 windows.
- At most 20 rooms.
- At most 5 stairs.
- Do not include explanations, markdown, comments, or trailing commas.`,
        },
        { type: 'input_image', image_url: imageDataUrl(base64Image, mediaType), detail: 'high' },
      ],
    }],
    text: {
      format: openAIJsonSchema('floor_plan_semantics', floorPlanResultSchema({ includeRejectWallIndices: true }), 'Semantic floor-plan elements and wall audit.'),
    },
  });

  const result = parseOpenAIJson(response, {});
  console.log(`[FloorPlan] OpenAI Step 3 complete: ${result.doors?.length || 0} doors, ${result.windows?.length || 0} windows, ${result.rooms?.length || 0} rooms, ${result.rejectWallIndices?.length || 0} walls flagged for rejection`);
  return result;
}

async function directAnalysisWithOpenAI(openai, processedImage, originalImage, originalMediaType, processedMediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, modelW, modelH) {
  console.log(`[FloorPlan] Running direct OpenAI wall analysis via ${OPENAI_FLOOR_PLAN_MODEL}...`);

  const scaleHint = knownWidthMeters
    ? `The building width is ${knownWidthMeters} meters.`
    : 'Estimate scale from printed dimensions first, then standard door width if needed.';

  const response = await openai.responses.create({
    model: OPENAI_FLOOR_PLAN_MODEL,
    reasoning: { effort: 'medium' },
    max_output_tokens: 8000,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Image 1 - ORIGINAL full-detail floor plan:' },
        { type: 'input_image', image_url: imageDataUrl(originalImage, originalMediaType), detail: 'high' },
        { type: 'input_text', text: 'Image 2 - PREPROCESSED black/white floor plan with thick wall bands emphasized:' },
        { type: 'input_image', image_url: imageDataUrl(processedImage, processedMediaType), detail: 'high' },
        {
          type: 'input_text',
          text: `Extract ONLY structural walls, scale, shape, and total area from this floor plan.
The image is ${modelW}x${modelH} pixels. All coordinates must be in pixels within this image size.

Wall rules:
- Include all exterior and interior structural wall segments.
- Ignore all furniture, fixtures, text, dimensions, property/setback lines, dashed lines, door arcs, window symbols, hatching, and page borders.
- Split walls at corners, T-junctions, crossings, and clear door/window openings.
- Do not merge separate room wall segments across junctions or openings.
- Only merge collinear fragments when they truly form one uninterrupted structural wall with no junction/opening between them.
- Keep wall endpoints axis-aligned when the wall is horizontal or vertical.
- Typical houses have 15-40 wall segments. If fewer than 12, look harder before returning.

Keep the JSON compact:
- At most 40 wall segments.
- Do not include explanations, markdown, comments, or trailing commas.

Scale is mandatory:
- Never return pixelsPerMeter as 0.
- If no printed dimensions are visible, estimate from a standard 0.9m door width or typical residential proportions.

${scaleHint}
${cvHints}
${dimensionHints}

Return JSON matching the schema. Do not include markdown.`,
        },
      ],
    }],
    text: {
      format: openAIJsonSchema('floor_plan_wall_analysis', wallAnalysisSchema(), 'Structural wall geometry and scale extracted from a floor plan.'),
    },
  });

  const wallResult = parseOpenAIJson(response, null);
  if (!wallResult?.walls?.length) return null;
  wallResult.walls = splitWallsAtJunctions(wallResult.walls);

  const semantics = await extractSemanticsFromOriginalWithOpenAI(
    openai, originalImage, originalMediaType,
    wallResult.walls, knownWidthMeters, dimensionHints, roomHints, modelW, modelH
  );

  const result = {
    success: true,
    imageSize: wallResult.imageSize || { width: modelW, height: modelH },
    walls: wallResult.walls,
    doors: semantics.doors || [],
    windows: semantics.windows || [],
    rooms: semantics.rooms || [],
    stairs: semantics.stairs || [],
    scale: semantics.scale || wallResult.scale || { pixelsPerMeter: modelW / 15, confidence: 0.3, source: 'estimated' },
    overallShape: semantics.overallShape || wallResult.overallShape || 'rectangular',
    totalArea: semantics.totalArea || wallResult.totalArea || null,
  };

  console.log(`[FloorPlan] Direct OpenAI analysis: ${result.walls.length} walls, ${result.doors.length} doors, ${result.windows.length} windows, ${result.rooms.length} rooms`);
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
6. The building outer boundary MUST be enclosed by walls. Adjacent rooms usually have a wall between them, EXCEPT open-plan layouts where two rooms (e.g. kitchen + dining, living + dining) share one large enclosed space with no dividing wall — only draw a wall if the original plan clearly shows one.
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
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 8000 },
    },
  });
  // Pass 2: higher thinking budget for full interior analysis
  const modelPass2 = genai.getGenerativeModel({
    model: 'gemini-2.5-pro',
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
3. ALL windows (parallel lines on walls, glass markers, large glazing panels). Large sliding glass doors that act as windows should be reported as windows.
4. ALL rooms (name + center)
5. ALL stairs
${dimensionHints}${formatRoomHints(roomHints)}
IMPORTANT: The exterior walls are already detected. Copy them EXACTLY into your output with isExterior: true — do not move, adjust, or re-detect them. Your job is ONLY interior elements.
When interior walls meet exterior walls, their endpoints must SNAP to the nearest exterior wall coordinate.
The building outer boundary must be enclosed by walls. Adjacent rooms usually have a wall between them, EXCEPT open-plan layouts (e.g. open kitchen + dining, living + dining) where two rooms share one large enclosed space with no dividing wall — only draw a wall if the original plan clearly shows one.
The image is ${geminiW}x${geminiH} pixels. All coordinates in PIXELS.

Return JSON:
{
  "success": true,
  "imageSize": { "width": ${geminiW}, "height": ${geminiH} },
  "walls": [ { "start": {"x":N,"y":N}, "end": {"x":N,"y":N}, "thickness": N, "isExterior": BOOLEAN, "confidence": 0.0-1.0 } ],
  "doors": [ { "center": {"x":N,"y":N}, "width": N, "wallIndex": N, "rotation": N, "doorType": "single"|"double"|"sliding" } ],
  "windows": [ { "center": {"x":N,"y":N}, "width": N, "wallIndex": N } ],
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

  let authContext;
  try {
    authContext = await requireActiveSubscription(req);
  } catch (error) {
    return sendError(res, error);
  }

  const { image, knownWidthMeters, roomHints } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  const openai = hasEnvValue('OPENAI_API_KEY')
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
  const genai = hasEnvValue('GEMINI_API_KEY')
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

  if (!openai && !genai) {
    return res.status(500).json({
      success: false,
      error: 'Missing floor-plan AI provider configuration',
    });
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

  try {
    await consumeUploadCreditForUser(authContext.user, authContext.subscription);
  } catch (error) {
    return sendError(res, error);
  }

  let softTimedOut = false;
  const softTimeout = setTimeout(() => {
    softTimedOut = true;
    console.warn(`[FloorPlan API] Soft timeout after ${FLOOR_PLAN_SOFT_TIMEOUT_MS}ms`);
    sendFloorPlanTimeout(res);
  }, FLOOR_PLAN_SOFT_TIMEOUT_MS);
  softTimeout.unref?.();
  const clearSoftTimeout = () => clearTimeout(softTimeout);

  try {
    // Resize both images to standard resolution for model input (we control the input = deterministic scaling)
    const { base64: resizedOriginal, width: geminiW, height: geminiH } = await resizeForGemini(image);
    const processedImage = await preprocessImage(resizedOriginal);
    const resizedOriginalMediaType = 'image/png'; // resizeForGemini outputs PNG

    // Scale factor to convert model pixel coords back to actual image coords
    const coordScaleX = actualWidth / geminiW;
    const coordScaleY = actualHeight / geminiH;
    console.log(`[FloorPlan] Model input: ${geminiW}x${geminiH}, scale factor: ${coordScaleX.toFixed(2)}x${coordScaleY.toFixed(2)}`);

    // After preprocessing, image is always PNG
    const mediaType = 'image/png';

    const dimensionPromise = (async () => {
      if (knownWidthMeters) return [];

      if (openai) {
        const openaiDimensions = await extractDimensionLabelsWithOpenAI(image, originalMediaType, openai);
        if (openaiDimensions.length > 0 || !genai) return openaiDimensions;
      }

      return genai ? extractDimensionLabels(image, originalMediaType, genai) : [];
    })();

    // Run OCR (on original image — text is readable before binarization)
    // and Roboflow (on preprocessed image) in parallel.
    const [ocrDimensions, roboflowData] = await Promise.all([
      dimensionPromise,
      callRoboflow(processedImage),
    ]);
    const cvHints = formatRoboflowHints(roboflowData);
    const dimensionHints = knownWidthMeters ? '' : formatDimensionHints(ocrDimensions);

    // ============================================================
    // NEW PIPELINE: OpenAI Image Gen → CV → OpenAI Semantics
    // Falls back to legacy two-pass if image gen fails
    // ============================================================
    let result;

    // Step 1: Generate clean walls-only diagram
    let cleanDiagram = openai
      ? await generateCleanDiagramWithOpenAI(resizedOriginal, resizedOriginalMediaType, openai, geminiW, geminiH)
      : null;

    if (!cleanDiagram && genai) {
      cleanDiagram = await generateCleanDiagram(resizedOriginal, resizedOriginalMediaType, process.env.GEMINI_API_KEY);
    }

    if (cleanDiagram) {
      // Collect OCR text bounding boxes in original image space
      const ocrTextBoxes = ocrDimensions
        .filter(d => d.bbox && d.bbox.w > 0 && d.bbox.h > 0)
        .map(d => d.bbox);

      // Step 2: Extract wall coordinates from clean image via CV
      // Pass OCR bboxes + original image size so CV can scale them to clean diagram space
      const cvResult = await extractWallsFromCleanImage(cleanDiagram, ocrTextBoxes, actualWidth, actualHeight);

      if (cvResult.walls.length >= MIN_CV_WALLS_FOR_STRUCTURAL_RESULT) {
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
        cvResult.walls = splitWallsAtJunctions(cvResult.walls);

        // Step 3: Extract semantic info from original image + audit walls
        let semantics = null;
        if (openai) {
          try {
            semantics = await extractSemanticsFromOriginalWithOpenAI(
              openai, resizedOriginal, resizedOriginalMediaType,
              cvResult.walls, knownWidthMeters, dimensionHints, roomHints, geminiW, geminiH
            );
          } catch (error) {
            console.warn('[FloorPlan] OpenAI semantic extraction failed:', error.message);
          }
        }
        if (!semantics && genai) {
          semantics = await extractSemanticsFromOriginal(
            genai, resizedOriginal, resizedOriginalMediaType,
            cvResult.walls, knownWidthMeters, dimensionHints, roomHints, geminiW, geminiH
          );
        }
        if (!semantics) {
          console.warn('[FloorPlan] No semantic extractor succeeded, falling back to direct analysis');
        }

        // Apply model wall audit: reject flagged walls and remap door/window wallIndex refs
        if (semantics) {
          let auditedWalls = cvResult.walls;
          let auditedDoors = semantics.doors || [];
          let auditedWindows = semantics.windows || [];
          const rejectSet = new Set(
            Array.isArray(semantics.rejectWallIndices) ? semantics.rejectWallIndices : []
          );
          if (rejectSet.size > 0 && rejectSet.size < cvResult.walls.length) {
            const indexMap = new Map();
            auditedWalls = [];
            cvResult.walls.forEach((w, oldIdx) => {
              if (!rejectSet.has(oldIdx)) {
                indexMap.set(oldIdx, auditedWalls.length);
                auditedWalls.push(w);
              }
            });
            // Drop doors/windows referencing rejected walls, remap the rest
            auditedDoors = auditedDoors
              .filter(d => d.wallIndex == null || indexMap.has(d.wallIndex))
              .map(d => d.wallIndex != null ? { ...d, wallIndex: indexMap.get(d.wallIndex) } : d);
            auditedWindows = auditedWindows
              .filter(w => w.wallIndex == null || indexMap.has(w.wallIndex))
              .map(w => w.wallIndex != null ? { ...w, wallIndex: indexMap.get(w.wallIndex) } : w);
            console.log(`[FloorPlan] Wall audit: rejected ${rejectSet.size} walls (${cvResult.walls.length} → ${auditedWalls.length})`);
          }

          const semanticScale = semantics.scale || { pixelsPerMeter: geminiW / 15, confidence: 0.3, source: 'estimated' };
          if (cvWallCoverageLooksIncomplete(auditedWalls, semanticScale, ocrDimensions)) {
            console.warn('[FloorPlan] CV wall coverage looks incomplete; falling back to direct structured analysis');
          } else {
            // Combine CV walls + semantic info
            result = {
              success: true,
              imageSize: { width: geminiW, height: geminiH },
              walls: auditedWalls,
              doors: auditedDoors,
              windows: auditedWindows,
              rooms: semantics.rooms || [],
              stairs: semantics.stairs || [],
              scale: semanticScale,
              overallShape: semantics.overallShape || 'rectangular',
              totalArea: semantics.totalArea || null,
            };

            console.log(`[FloorPlan] New pipeline success: ${result.walls.length} walls (CV), ${result.doors.length} doors, ${result.rooms.length} rooms`);
          }
        }
      } else {
        console.warn(`[FloorPlan] CV extracted only ${cvResult.walls.length} walls; falling back to direct structured analysis`);
      }
    }

    // Fallback: direct OpenAI analysis, then legacy Gemini two-pass.
    if (!result) {
      if (openai) {
        result = await directAnalysisWithOpenAI(openai, processedImage, resizedOriginal, resizedOriginalMediaType, mediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, geminiW, geminiH);
      }
      if (!result && genai) {
        console.log('[FloorPlan] Falling back to legacy Gemini two-pass analysis');
        result = await twoPassAnalysis(genai, processedImage, resizedOriginal, resizedOriginalMediaType, mediaType, cvHints, dimensionHints, roomHints, knownWidthMeters, geminiW, geminiH);
      }
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
    if (!Number.isFinite(result.scale.pixelsPerMeter) || result.scale.pixelsPerMeter <= 0) {
      result.scale = { pixelsPerMeter: 50, confidence: 0.3, source: 'estimated_fallback' };
    }

    // Rescale coordinates from model input resolution to actual image dimensions
    result.imageSize = { width: actualWidth, height: actualHeight };
    if (coordScaleX !== 1 || coordScaleY !== 1) {
      (result.walls).forEach(wall => {
        if (wall.start) { wall.start.x *= coordScaleX; wall.start.y *= coordScaleY; }
        if (wall.end) { wall.end.x *= coordScaleX; wall.end.y *= coordScaleY; }
        if (wall.thickness) wall.thickness *= Math.max(coordScaleX, coordScaleY);
      });
      const avgScale = (coordScaleX + coordScaleY) / 2;
      (result.doors).forEach(door => {
        if (door.center) { door.center.x *= coordScaleX; door.center.y *= coordScaleY; }
        if (door.width) door.width *= Math.max(coordScaleX, coordScaleY);
        if (typeof door.positionAlongWall === 'number') door.positionAlongWall *= avgScale;
      });
      (result.windows).forEach(win => {
        if (win.center) { win.center.x *= coordScaleX; win.center.y *= coordScaleY; }
        if (win.width) win.width *= Math.max(coordScaleX, coordScaleY);
        if (typeof win.positionAlongWall === 'number') win.positionAlongWall *= avgScale;
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

    adjustScaleFromWallBounds(result, ocrDimensions);

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
      exteriorWalls.forEach(w => {
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
      result.stairs.forEach(stair => {
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
      roomHintsProvided: roomHints?.length || 0,
      cvHintsUsed: cvHints.length > 0,
      roboflowDetections: roboflowData ? roboflowData.predictions?.length || 0 : 'skipped',
      ocrDimensionsFound: ocrDimensions.length,
    });

    clearSoftTimeout();
    if (res.headersSent || softTimedOut) return;
    return res.status(200).json(result);

  } catch (error) {
    clearSoftTimeout();
    if (res.headersSent || softTimedOut) return;
    console.error('[FloorPlan API] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze floor plan',
      _debug: error?.message || String(error),
    });
  }
}
