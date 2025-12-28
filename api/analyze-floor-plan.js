// api/analyze-floor-plan.js (Vercel serverless function)

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  maxDuration: 60, // Allow up to 60 seconds for AI analysis
};

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
      max_tokens: 8192,
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
            text: `Analyze this floor plan image and extract all architectural elements.

Return a JSON object with this EXACT structure:

{
  "success": true,
  "imageSize": {
    "width": <estimated pixels>,
    "height": <estimated pixels>
  },
  "scale": {
    "estimatedMetersPerPixel": <number between 0.01 and 0.1>,
    "confidence": <0.0 to 1.0>,
    "reasoning": "<brief explanation>"
  },
  "walls": [
    {
      "id": "wall_1",
      "start": { "x": <pixels from left>, "y": <pixels from top> },
      "end": { "x": <pixels>, "y": <pixels> },
      "thickness": <pixels, typically 5-15>,
      "isExterior": <true for outer walls, false for interior>
    }
  ],
  "doors": [
    {
      "id": "door_1",
      "center": { "x": <pixels>, "y": <pixels> },
      "width": <pixels>,
      "nearestWallId": "wall_1",
      "type": "single" | "double" | "sliding"
    }
  ],
  "windows": [
    {
      "id": "window_1",
      "center": { "x": <pixels>, "y": <pixels> },
      "width": <pixels>,
      "nearestWallId": "wall_2"
    }
  ],
  "rooms": [
    {
      "id": "room_1",
      "name": "Living Room",
      "center": { "x": <pixels>, "y": <pixels> },
      "approximateArea": <square pixels>
    }
  ]
}

IMPORTANT GUIDELINES:
1. Coordinates are in PIXELS from the top-left corner of the image
2. Trace ALL visible walls as line segments (start to end points)
3. Walls should connect at corners - ensure endpoints match
4. Exterior walls are usually thicker than interior walls
5. Doors appear as gaps in walls with arc symbols or door rectangles
6. Windows appear as parallel lines or rectangles in exterior walls
7. Room names: infer from labels OR typical positions (kitchen near exterior, bathroom small, etc.)
8. Scale estimation: standard doors are ~0.9m wide, rooms are typically 3-6m
9. If uncertain about an element, include it with lower confidence

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`
          }
        ]
      }]
    });

    // Parse the response
    const content = response.content[0].text;

    // Try to extract JSON from the response
    let result;
    try {
      // Try direct parse first
      result = JSON.parse(content);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    }

    // Validate required fields
    if (!result.walls || !Array.isArray(result.walls)) {
      result.walls = [];
    }
    if (!result.doors || !Array.isArray(result.doors)) {
      result.doors = [];
    }
    if (!result.windows || !Array.isArray(result.windows)) {
      result.windows = [];
    }
    if (!result.rooms || !Array.isArray(result.rooms)) {
      result.rooms = [];
    }

    result.success = true;
    return res.status(200).json(result);

  } catch (error) {
    console.error('Floor plan analysis error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze floor plan',
      details: error.message
    });
  }
}
