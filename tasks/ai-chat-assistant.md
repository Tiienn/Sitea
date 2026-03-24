# AI Chat Assistant for Sitea

## Overview

Add a floating chat button to Sitea that opens an AI assistant panel. The AI can answer questions about Sitea AND control the 3D scene using tool calling — so users can say "build a 12x10m room with a bedroom" and it actually builds it.

---

## Stack

- **AI:** Anthropic Claude (`@anthropic-ai/sdk` already installed)
- **Tool calling:** Claude's native tool use API
- **UI:** React component, no new dependencies needed
- **State bridge:** Expose scene actions to the AI via a context/ref

---

## Phase 1 — Chat UI

### New files
- `src/components/AIChatButton.jsx` — floating button (bottom-right)
- `src/components/AIChatPanel.jsx` — slide-up chat panel
- `src/hooks/useAIChat.js` — chat logic + Anthropic API calls

### AIChatButton
```jsx
// Floating button, bottom-right corner
// Shows unread dot when AI has a message
// Toggles panel open/close
```

### AIChatPanel
```jsx
// Slide-up from bottom, ~60% screen height on mobile, 400px wide on desktop
// Header: "Sitea AI" + close button
// Message list (user + assistant bubbles)
// Input bar + send button + image upload icon
// "Powered by Claude" in footer
```

### Design tokens
- Background: `#0d1117`
- User bubble: `#1a2332` with blue-ish border
- AI bubble: `#111827`
- Accent: `#6366f1` (indigo — differentiates from Sitea's green)
- Font: same DM Sans / system font

---

## Phase 2 — Tool Calling (Scene Control)

### Scene Action Bridge

Create `src/hooks/useSceneActions.js` that exposes imperative actions:

```js
const sceneActions = {
  createWall: (x1, y1, x2, y2) => { ... },
  createRoom: (widthM, heightM, originX, originY) => { ... },
  addFurniture: (type, x, y, rotation) => { ... },
  deleteObject: (id) => { ... },
  clearScene: () => { ... },
  getSceneState: () => ({ walls: [...], furniture: [...] }),
}
```

Wire these to the existing scene state setters (walls array, furniture array, etc).

### Claude Tools Definition

Pass these tools to the Anthropic API call:

```js
const tools = [
  {
    name: "create_room",
    description: "Create a rectangular room with 4 walls. Width and height in meters.",
    input_schema: {
      type: "object",
      properties: {
        width_m: { type: "number", description: "Room width in meters" },
        height_m: { type: "number", description: "Room height in meters" },
        label: { type: "string", description: "Room label e.g. Bedroom, Kitchen" }
      },
      required: ["width_m", "height_m"]
    }
  },
  {
    name: "add_furniture",
    description: "Add a furniture item to the scene",
    input_schema: {
      type: "object",
      properties: {
        type: { 
          type: "string", 
          enum: ["sofa", "bed", "table", "chair", "wardrobe", "desk", "tv", "bathtub", "toilet", "sink"],
          description: "Furniture type"
        },
        room_label: { type: "string", description: "Which room to place it in" },
        position_hint: { type: "string", description: "Where in the room: center, corner, against-wall" }
      },
      required: ["type"]
    }
  },
  {
    name: "delete_object",
    description: "Delete a wall or furniture item by id",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Object id to delete" }
      },
      required: ["id"]
    }
  },
  {
    name: "clear_scene",
    description: "Clear everything from the scene and start fresh",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "get_scene_summary",
    description: "Get a summary of what's currently on the scene",
    input_schema: { type: "object", properties: {} }
  }
]
```

### API Call (useAIChat.js)

```js
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ 
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true 
})

const SYSTEM_PROMPT = `You are the AI assistant for Sitea, a browser-based 3D home designer.
You help users design floor plans by answering questions and building layouts using tools.

Scale: 1 unit = 0.1 meters in the Sitea coordinate system.
When creating rooms, use create_room tool. When adding furniture, use add_furniture tool.
Always confirm what you built after using a tool.
Be concise and friendly.`

async function sendMessage(messages, sceneActions) {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  })

  // Handle tool use
  if (response.stop_reason === 'tool_use') {
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input, sceneActions)
        // Continue conversation with tool result...
      }
    }
  }
  
  return response
}

async function executeTool(name, input, sceneActions) {
  switch (name) {
    case 'create_room':
      return sceneActions.createRoom(input.width_m, input.height_m, input.label)
    case 'add_furniture':
      return sceneActions.addFurniture(input.type, input.room_label, input.position_hint)
    case 'delete_object':
      return sceneActions.deleteObject(input.id)
    case 'clear_scene':
      return sceneActions.clearScene()
    case 'get_scene_summary':
      return JSON.stringify(sceneActions.getSceneState())
    default:
      return { error: 'Unknown tool' }
  }
}
```

---

## Phase 3 — Image Upload (Floor Plan)

- Add image upload button in chat input
- On image send: encode as base64, send to Claude with vision
- Claude analyzes the floor plan and calls tools to recreate it
- This hooks into the existing AI floor plan conversion feature

```js
// In the message payload:
{
  role: 'user',
  content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
    { type: 'text', text: 'Recreate this floor plan in Sitea' }
  ]
}
```

---

## Environment Variables

Add to `.env.local`:
```
VITE_ANTHROPIC_API_KEY=your_key_here
```

> ⚠️ For production, proxy through a Supabase Edge Function to hide the API key.

---

## Integration Points in App.jsx

1. Import and render `<AIChatButton />` at the bottom of the main return
2. Pass `sceneActions` ref down via context or props
3. The chat panel sits outside the 3D canvas, as an overlay

---

## Build Order

1. `AIChatButton.jsx` + `AIChatPanel.jsx` — static UI, no AI yet
2. `useAIChat.js` — wire up Anthropic, basic Q&A (no tools)
3. `useSceneActions.js` — expose scene state/actions
4. Wire tools into the API call
5. Add image upload
6. Test end-to-end: "Build a 3 bedroom house" → scene populates

---

## Example Interactions

| User says | AI does |
|-----------|---------|
| "Build a 12x10m room" | calls `create_room(12, 10)` |
| "Add a bed and wardrobe" | calls `add_furniture("bed")` + `add_furniture("wardrobe")` |
| "What's in my scene?" | calls `get_scene_summary()` |
| "Start over" | calls `clear_scene()` |
| "How do I add walls?" | Answers from knowledge, no tool |
| [uploads image] | Analyzes + calls multiple tools to recreate layout |

---

## Notes

- Keep the chat panel non-blocking — user can still interact with the 3D scene while chat is open
- Show a typing indicator while Claude is thinking
- Tool calls should show a subtle "Building..." status in the chat
- Mobile: chat panel slides up from bottom, 80% height
