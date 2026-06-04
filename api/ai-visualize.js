import OpenAI from 'openai';
import { requireActiveSubscription, sendError } from '../server/subscriptions.js';

export const config = {
  maxDuration: 60,
};

const STYLE_PROMPTS = {
  modern: 'Transform this 3D architectural model into a photorealistic modern architectural photograph. Clean lines, large glass windows, minimalist aesthetic, warm interior lighting visible through windows, manicured landscaping, concrete and wood materials, golden hour lighting, shot with a Canon EOS R5, architectural photography style.',
  traditional: 'Transform this 3D architectural model into a photorealistic traditional home photograph. Classic brick or stone facade, pitched roof with shingles, warm earthy tones, mature trees and garden, colonial or craftsman style details, welcoming front porch, natural daylight, shot with a Canon EOS R5, architectural photography style.',
  minimalist: 'Transform this 3D architectural model into a photorealistic minimalist architectural photograph. Pure white and concrete surfaces, flat roof, floor-to-ceiling glass, geometric forms, zen garden, sparse vegetation, dramatic shadow play, overcast soft lighting, shot with a Canon EOS R5, architectural photography style.',
  rustic: 'Transform this 3D architectural model into a photorealistic rustic home photograph. Natural stone and timber construction, exposed wooden beams, warm cabin aesthetic, surrounded by nature, mountain or countryside setting, stone pathway, warm interior glow, late afternoon sunlight, shot with a Canon EOS R5, architectural photography style.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let user;
  try {
    ({ user } = await requireActiveSubscription(req));
  } catch (error) {
    return sendError(res, error);
  }

  const { image, style = 'modern' } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  const prompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Convert base64 string to a Buffer for the file upload
    const imageBuffer = Buffer.from(image, 'base64');

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: new File([imageBuffer], 'scene.png', { type: 'image/png' }),
      prompt,
      size: '1024x1024',
    });

    const resultBase64 = response.data[0].b64_json;

    console.log('[AI Visualize] Success:', { style, userEmail: user.email });

    return res.status(200).json({
      success: true,
      image: resultBase64,
    });

  } catch (error) {
    console.error('[AI Visualize] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI visualization',
    });
  }
}
