/* global process */
import OpenAI from 'openai';
import { requireActiveSubscription, sendError } from '../server/subscriptions.js';

export const config = {
  maxDuration: 30,
};

// Simple in-memory rate limiting (resets on cold start — acceptable for serverless)
const rateLimitMap = new Map(); // userId → { count, resetAt }
const RATE_LIMIT = 20; // max requests per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini';

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const SYSTEM_PROMPT = `You are Sitea Agent, an AI planning partner for land buyers and homeowners using Sitea's 3D land and home visualization editor.

PRIMARY JOB:
- Help users understand what can fit on their land, turn scanned plans into a usable layout, and iterate practical site/building ideas.
- Treat the scene as the source of truth. Use the current scene context before changing an existing layout.
- If the user uploads a scanned PDF or plan image, Sitea routes it through a detector before you respond. Explain the detected walls, doors, windows, rooms, and next placement step clearly.

COORDINATE SYSTEM:
- The scene uses meters. X = left/right, Z = forward/back.
- Furniture is placed at an {x, z} position.

AVAILABLE FURNITURE (catalogId → name):
sofa, armchair, coffeeTable, tvStand, bed, nightstand, desk, diningTable, chair, fridge, toilet, bathtub, tree, bench

GUIDELINES:
- Ask for missing constraints when they affect the layout: site size, setbacks, road/front orientation, room count, parking, outdoor space, or budget priorities.
- When creating rooms, use realistic dimensions (e.g., bedroom: 4x3m, living room: 5x4m, bathroom: 2.5x2m, kitchen: 3x3m).
- IMPORTANT: When placing multiple rooms, share walls by placing them adjacent (e.g., if the first room spans X=0 to X=5, start the next room at X=5). Never overlap rooms. Use get_scene_summary first if unsure where existing rooms are.
- Place furniture sensibly inside rooms (e.g., bed centered in bedroom, sofa against wall in living room). Calculate positions within the room's bounds.
- When asked to create a room with furniture, create the room first, then add furniture.
- Be concise and helpful. Describe what you did after using tools, then suggest one sensible next step.
- If the user asks something unrelated to land or home design, answer briefly but steer back to how you can help visualize their site.`;

const TOOLS = [
  {
    name: 'create_room',
    description: 'Create a rectangular room by specifying width and depth in meters, and an optional center position. Walls will be created automatically.',
    input_schema: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Room width in meters (X axis)' },
        depth: { type: 'number', description: 'Room depth in meters (Z axis)' },
        centerX: { type: 'number', description: 'Center X position in meters (default 0)', default: 0 },
        centerZ: { type: 'number', description: 'Center Z position in meters (default 0)', default: 0 },
        label: { type: 'string', description: 'Room label (e.g. Bedroom, Kitchen, Living Room)' },
      },
      required: ['width', 'depth'],
    },
  },
  {
    name: 'add_furniture',
    description: 'Add a furniture item to the scene at a given position.',
    input_schema: {
      type: 'object',
      properties: {
        catalogId: {
          type: 'string',
          enum: ['sofa', 'armchair', 'coffeeTable', 'tvStand', 'bed', 'nightstand', 'desk', 'diningTable', 'chair', 'fridge', 'toilet', 'bathtub', 'tree', 'bench'],
          description: 'The furniture item ID from the catalog',
        },
        x: { type: 'number', description: 'X position in meters' },
        z: { type: 'number', description: 'Z position in meters' },
      },
      required: ['catalogId', 'x', 'z'],
    },
  },
  {
    name: 'delete_furniture',
    description: 'Delete a furniture item by its instance ID.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The furniture instance ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'clear_scene',
    description: 'Remove all walls and furniture from the scene. Use when the user wants to start fresh.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_scene_summary',
    description: 'Get a summary of what is currently in the scene (walls, rooms, furniture). Use this to understand the current state before making changes.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

const OPENAI_TOOLS = TOOLS.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}));

function safeJsonParse(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n');
}

function toOpenAIMessages(messages) {
  const openaiMessages = [];

  for (const message of messages) {
    if (message.role === 'user' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block?.type === 'tool_result') {
          openaiMessages.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
          });
        }
      }
      continue;
    }

    if (message.role === 'assistant' && Array.isArray(message.content)) {
      const toolUses = message.content.filter(block => block?.type === 'tool_use');
      const text = contentText(message.content);
      const assistantMessage = {
        role: 'assistant',
        content: text || null,
      };

      if (toolUses.length > 0) {
        assistantMessage.tool_calls = toolUses.map(tool => ({
          id: tool.id,
          type: 'function',
          function: {
            name: tool.name,
            arguments: JSON.stringify(tool.input || {}),
          },
        }));
      }

      openaiMessages.push(assistantMessage);
      continue;
    }

    if (message.role === 'assistant') {
      openaiMessages.push({
        role: 'assistant',
        content: contentText(message.content),
      });
      continue;
    }

    if (message.role === 'user') {
      openaiMessages.push({
        role: 'user',
        content: contentText(message.content),
      });
    }
  }

  return openaiMessages;
}

function toSiteaContent(message) {
  const content = [];
  if (message.content) {
    content.push({ type: 'text', text: message.content });
  }

  for (const toolCall of message.tool_calls || []) {
    content.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.function?.name,
      input: safeJsonParse(toolCall.function?.arguments),
    });
  }

  return content;
}

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

  // Rate limiting
  if (!checkRateLimit(user.id)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { messages, sceneContext } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Build system prompt with optional scene context
  let systemPrompt = SYSTEM_PROMPT;
  if (sceneContext) {
    systemPrompt += `\n\nCURRENT SCENE STATE:\n${sceneContext}`;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      max_completion_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        ...toOpenAIMessages(messages),
      ],
      tools: OPENAI_TOOLS,
      tool_choice: 'auto',
    });

    const responseMessage = response.choices?.[0]?.message;
    if (!responseMessage) {
      throw new Error('OpenAI returned no message');
    }

    return res.status(200).json({
      content: toSiteaContent(responseMessage),
      stop_reason: responseMessage.tool_calls?.length ? 'tool_use' : 'end_turn',
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return res.status(500).json({ error: 'Failed to get AI response' });
  }
}
