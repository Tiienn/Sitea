/* global process */
// api/analyze-site-plan.js (Vercel serverless function)
// Detects land boundary polygon from site plan images using OpenAI vision

import OpenAI from 'openai';
import { requireActiveSubscription, sendError } from '../server/subscriptions.js';
import { consumeUploadCreditForUser } from '../server/uploadQuota.js';

export const config = {
  maxDuration: 60,
};

const OPENAI_SITE_PLAN_MODEL = process.env.OPENAI_SITE_PLAN_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini';

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

function parseOpenAIJson(response) {
  if (response.output_parsed) return response.output_parsed;

  const text = getOpenAIOutputText(response);
  if (!text) throw new Error('OpenAI returned no text');

  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('No valid JSON found in OpenAI response');
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

function sitePlanSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      boundary: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
      },
      dimensions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            fromVertex: { type: 'integer' },
            toVertex: { type: 'integer' },
            label: { type: 'string' },
            unit: { type: 'string', enum: ['m', 'ft', 'unknown'] },
          },
          required: ['fromVertex', 'toVertex', 'label', 'unit'],
        },
      },
      scale: { type: ['object', 'null'], additionalProperties: true },
      imageSize: {
        type: 'object',
        additionalProperties: false,
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
        },
        required: ['width', 'height'],
      },
    },
    required: ['boundary', 'dimensions', 'scale', 'imageSize'],
  };
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

  const { image, width, height } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  // Detect image media type from base64 data
  const detectMediaType = (base64Data) => {
    if (base64Data.startsWith('/9j/')) return 'image/jpeg';
    if (base64Data.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64Data.startsWith('R0lGOD')) return 'image/gif';
    if (base64Data.startsWith('UklGR')) return 'image/webp';
    return 'image/png';
  };

  const mediaType = detectMediaType(image);

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Missing site-plan AI provider configuration',
    });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    await consumeUploadCreditForUser(authContext.user, authContext.subscription);
  } catch (error) {
    return sendError(res, error);
  }

  try {
    const response = await openai.responses.create({
      model: OPENAI_SITE_PLAN_MODEL,
      reasoning: { effort: 'low' },
      max_output_tokens: 4096,
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `This image is ${width || 'unknown'} x ${height || 'unknown'} pixels. Find the LAND PARCEL boundary.

THE LAND PARCEL is the LARGEST filled/colored/shaded polygon in the image (yellow, orange, green, blue, or gray). It has dimension labels on its edges (e.g. "21.45m"). It is usually a trapezoid or rectangle with 4 corners.

IGNORE: roads/paths (thin strips labeled "chemin", "road"), setback lines, text labels.

RULES:
- Place each vertex EXACTLY at a corner of the colored/filled shape
- All vertices must be INSIDE or ON the border of the colored region
- Coordinates are pixels from top-left: x ranges 0 to ${width || 'image width'}, y ranges 0 to ${height || 'image height'}
- List vertices clockwise
- For dimensions: read any dimension labels on the edges (e.g. "21.45m", "15.30", "50ft"). For each label, identify which two boundary vertices it connects (use 0-based indices matching the boundary array order). Do NOT try to measure pixel distances — just read the text labels.

Return JSON only matching the requested schema.`
          },
          { type: 'input_image', image_url: imageDataUrl(image, mediaType), detail: 'high' },
        ],
      }],
      text: {
        format: openAIJsonSchema(
          'site_plan_boundary',
          sitePlanSchema(),
          'Land parcel boundary and printed dimensions extracted from a site plan image.'
        ),
      },
    });

    const result = parseOpenAIJson(response);

    result.success = true;
    result.boundary = result.boundary || [];
    result.scale = result.scale || null;
    result.imageSize = result.imageSize || { width: 0, height: 0 };

    console.log('[SitePlan API] Analysis:', {
      boundaryPoints: result.boundary.length,
      dimensions: result.dimensions?.length || 0,
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('[SitePlan API] Error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to analyze site plan'
    });
  }
}
