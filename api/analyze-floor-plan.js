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
      max_tokens: 16384,  // Increased for complex floor plans
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
            text: `You are an expert architectural floor plan analyzer. Analyze this floor plan image VERY CAREFULLY and extract ALL structural elements with precise pixel coordinates.

CRITICAL INSTRUCTIONS:
1. Identify EVERY wall segment - both exterior (thick lines) and interior (thinner lines)
2. Trace the EXACT shape of the floor plan - it may be L-shaped, U-shaped, or irregular
3. Find ALL doors - look for swing arcs (quarter circles) or door symbols
4. Find ALL windows - look for parallel lines on exterior walls
5. Identify ALL rooms by their labels or by enclosed spaces
6. Read ANY dimension labels in the image (like "5.37 m" or "2.78 m")

COORDINATE SYSTEM:
- Origin (0,0) is at the TOP-LEFT corner of the image
- X increases to the RIGHT
- Y increases DOWNWARD
- Estimate the image size and provide coordinates in pixels

For this floor plan, I can see it contains multiple rooms. Trace EVERY wall carefully.

Return a JSON object with this EXACT structure:

{
  "success": true,
  "imageSize": {
    "width": <estimated image width in pixels>,
    "height": <estimated image height in pixels>
  },
  "dimensionsFromImage": [
    { "value": 5.37, "unit": "m", "description": "bottom left width" },
    { "value": 3.68, "unit": "m", "description": "bottom right width" }
  ],
  "scale": {
    "estimatedMetersPerPixel": <calculate based on visible dimensions>,
    "confidence": <0.0 to 1.0>,
    "reasoning": "<explain how you calculated the scale>"
  },
  "walls": [
    {
      "id": "wall_1",
      "start": { "x": <pixels>, "y": <pixels> },
      "end": { "x": <pixels>, "y": <pixels> },
      "thickness": <pixels>,
      "isExterior": true,
      "description": "north exterior wall"
    },
    {
      "id": "wall_2",
      "start": { "x": <pixels>, "y": <pixels> },
      "end": { "x": <pixels>, "y": <pixels> },
      "thickness": <pixels>,
      "isExterior": false,
      "description": "wall between kitchen and living room"
    }
  ],
  "doors": [
    {
      "id": "door_1",
      "center": { "x": <pixels>, "y": <pixels> },
      "width": <pixels>,
      "swingDirection": "inward-left" | "inward-right" | "outward-left" | "outward-right",
      "connectedRooms": ["Living Area", "Entry Hall"],
      "description": "main entry door"
    }
  ],
  "windows": [
    {
      "id": "window_1",
      "center": { "x": <pixels>, "y": <pixels> },
      "width": <pixels>,
      "wallId": "wall_1",
      "description": "living room window on south wall"
    }
  ],
  "rooms": [
    {
      "id": "room_1",
      "name": "Kitchen & Dining Area",
      "center": { "x": <pixels>, "y": <pixels> },
      "areaFromLabel": 14.8,
      "areaUnit": "m²",
      "boundaryDescription": "top-left section of floor plan"
    },
    {
      "id": "room_2",
      "name": "Living Area",
      "center": { "x": <pixels>, "y": <pixels> },
      "areaFromLabel": 21.4,
      "areaUnit": "m²",
      "boundaryDescription": "bottom-left large room"
    }
  ],
  "overallShape": "L-shaped" | "rectangular" | "U-shaped" | "irregular",
  "totalArea": {
    "value": 71,
    "unit": "m²",
    "source": "label in image"
  }
}

IMPORTANT:
- Include ALL walls, not just the outer boundary
- For an L-shaped floor plan, you need walls that create the L shape
- Interior walls separate rooms - don't skip them!
- Each wall should connect to other walls at endpoints (within a few pixels)
- If you see dimension labels like "5.37 m", use them to calculate accurate scale
- A typical door is 0.8-1.0m wide, a typical window is 1.0-1.5m wide

Return ONLY valid JSON. No markdown, no explanation outside JSON.`
          }
        ]
      }]
    });

    // Parse the response
    const content = response.content[0].text;

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

    // Validate and provide defaults
    result.success = true;
    result.walls = result.walls || [];
    result.doors = result.doors || [];
    result.windows = result.windows || [];
    result.rooms = result.rooms || [];

    // Log for debugging
    console.log('AI Analysis Result:', {
      wallCount: result.walls.length,
      doorCount: result.doors.length,
      windowCount: result.windows.length,
      roomCount: result.rooms.length,
      shape: result.overallShape,
    });

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
