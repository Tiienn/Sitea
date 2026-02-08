// api/analyze-site-plan.js (Vercel serverless function)
// Detects land boundary polygon from site plan images using Claude Vision

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

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

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
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
            text: `This image is ${width || 'unknown'} x ${height || 'unknown'} pixels. Find the LAND PARCEL boundary.

THE LAND PARCEL is the LARGEST filled/colored/shaded polygon in the image (yellow, orange, green, blue, or gray). It has dimension labels on its edges (e.g. "21.45m"). It is usually a trapezoid or rectangle with 4 corners.

IGNORE: roads/paths (thin strips labeled "chemin", "road"), setback lines, text labels.

RULES:
- Place each vertex EXACTLY at a corner of the colored/filled shape
- All vertices must be INSIDE or ON the border of the colored region
- Coordinates are pixels from top-left: x ranges 0 to ${width || 'image width'}, y ranges 0 to ${height || 'image height'}
- List vertices clockwise
- For scale: read a dimension label, measure that edge in pixels, compute pixelsPerMeter

Return ONLY this JSON, nothing else:
{
  "boundary": [{ "x": NUMBER, "y": NUMBER }],
  "scale": { "pixelsPerMeter": NUMBER_OR_NULL, "confidence": NUMBER_0_TO_1, "referenceDistance": "STRING_OR_NULL" },
  "imageSize": { "width": ${width || 0}, "height": ${height || 0} }
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

    result.success = true;
    result.boundary = result.boundary || [];
    result.scale = result.scale || null;
    result.imageSize = result.imageSize || { width: 0, height: 0 };

    console.log('[SitePlan API] Analysis:', {
      boundaryPoints: result.boundary.length,
      hasScale: !!result.scale?.pixelsPerMeter,
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
