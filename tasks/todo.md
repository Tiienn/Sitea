# Floor Plan Analysis — Phase 4: Gemini Image Gen + CV Extraction

## Architecture

**Current (broken):** Floor plan → LLM outputs pixel coordinates → render
**New:** Floor plan → Gemini generates clean walls-only image → CV extracts coordinates → render

### Why this works
- Gemini is great at **understanding** floor plans (which lines are walls vs furniture)
- Gemini is bad at outputting **precise pixel coordinates**
- Traditional CV is great at **measuring precise coordinates** from clean images
- By combining them, each does what it's good at

## Pipeline

```
[User uploads floor plan]
         ↓
[Step 1] Gemini 2.0 Flash generates a clean diagram:
         thick black walls on white background, no furniture/text
         ↓
[Step 2] CV extracts wall coordinates from the clean image:
         binarize → scan rows/cols → find wall segments → merge
         ↓
[Step 3] Gemini 2.5 Pro extracts semantic info (doors, rooms, scale)
         from the ORIGINAL image — positions snapped to nearest wall
         ↓
[Step 4] Post-processing: snap, connect, validate
         ↓
[Return JSON with walls, doors, rooms]
```

## Plan

- [ ] **1. Add `generateCleanDiagram()` function**
  - Send original floor plan to Gemini with image generation
  - Prompt: "Redraw showing ONLY structural walls as thick black lines on white"
  - Model: `gemini-2.0-flash-exp` with `responseModalities: ['IMAGE']`
  - Returns clean PNG base64

- [ ] **2. Add `extractWallsFromCleanImage()` function**
  - Binarize the generated image with sharp
  - Get raw pixel buffer
  - Scan rows for horizontal wall segments (black runs > 20px)
  - Scan columns for vertical wall segments (black runs > 20px)
  - Merge adjacent runs into wall segments with start/end/thickness
  - Classify exterior (longest perimeter walls) vs interior
  - Returns walls array

- [ ] **3. Add `extractSemanticsFromOriginal()` function**
  - Send ORIGINAL floor plan to Gemini 2.5 Pro
  - Ask for doors, rooms, stairs, scale ONLY (no wall coordinates)
  - Snap door positions to nearest extracted wall
  - Returns doors, rooms, stairs, scale

- [ ] **4. Update handler to use new pipeline**
  - Replace two-pass analysis with: diagram gen → CV extract → semantics
  - Keep existing post-processing (snap, connect, terrace removal)
  - Keep OCR and Roboflow as supplementary data

## Files to Edit
- `api/analyze-floor-plan.js` — all changes

## Review
_(to be filled after implementation)_
