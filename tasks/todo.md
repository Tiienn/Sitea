# AI Visualization (P5)

## Plan

### Step 1: Install OpenAI SDK
- [x] `npm install openai`

### Step 2: Create API endpoint — `api/ai-visualize.js`
- [x] Copy auth pattern from `api/analyze-floor-plan.js`
- [x] POST only, `maxDuration: 60`
- [x] JWT auth + subscription check
- [x] Takes `{ image, style }`, calls OpenAI gpt-image-1
- [x] Returns `{ success: true, image: base64Result }`

### Step 3: Add AI Render handler in `src/App.jsx`
- [x] Add new state: `isGeneratingAI`, `aiRenderResult`, `showAiRenderModal`
- [x] Add `handleAiVisualize` handler (requirePaid, capture canvas, call API)
- [x] Pass new props to ExportPanel
- [x] Add AI render result modal

### Step 4: Add AI Render tab to `src/components/ExportPanel.jsx`
- [x] Add 'airender' to SECTIONS with sparkles icon
- [x] Add `aiStyle` state, style selector (4 styles)
- [x] Add generate button with PRO badge + spinner
- [x] Add preview area for result
- [x] Add 2D mode warning

### Step 5: Build verification
- [x] `npm run build` passes

## Review

### Changes Made

**New file: `api/ai-visualize.js`**
- Vercel serverless endpoint with same auth pattern as `analyze-floor-plan.js`
- JWT Bearer token auth → Supabase user verification → subscription check
- 4 style prompts (modern, traditional, minimalist, rustic)
- Calls OpenAI `gpt-image-1` model via `images.edit()` with the captured 3D view
- Returns base64 image result

**Modified: `src/App.jsx`**
- Added `captureScreenshot` import (was only importing `captureAndDownload`)
- Added `supabase` import from supabaseClient
- 3 new state variables: `isGeneratingAI`, `aiRenderResult`, `showAiRenderModal`
- New `handleAiVisualize` handler: captures canvas → converts to base64 → calls API → shows result
- 4 new props passed to ExportPanel
- New modal for viewing/downloading AI render result (dark overlay, centered image, download + close buttons)

**Modified: `src/components/ExportPanel.jsx`**
- Added 5th section 'airender' with sparkles icon (Heroicons outline)
- 4 new props: `onAiVisualize`, `isGeneratingAI`, `aiRenderResult`, `onShowAiRender`
- New `aiStyle` state (default: 'modern')
- AI Render tab with: preview area (shows last result or placeholder), 2x2 style grid, generate button with PRO badge, time estimate hint, 2D mode warning

### Remaining Manual Step
- Add `OPENAI_API_KEY` to Vercel environment variables
