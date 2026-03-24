# Floor Plan Analysis — Accuracy Improvements (Phase 2)

## Goal
Make floor plan upload → wall/room detection the killer feature. Walls, rooms, and interior partitions should be drawn perfectly from any standard floor plan image.

## Analysis of Current Pipeline
The architecture is solid (two-pass Claude, Roboflow CV, OCR scale, preprocessing). But the accuracy has 5 weak points:

1. **Binarization destroys detail** — threshold 140 wipes thin partition walls, door arcs, and room labels before Claude sees them
2. **Claude only sees preprocessed image** — never the original with full detail
3. **Thinking budget too small** — 5K/8K tokens not enough for complex 6+ room plans
4. **No wall connectivity validation** — walls that almost touch stay disconnected, rooms don't close
5. **Snap threshold too tight** — 5px misses junctions that are 6-10px apart

## Plan

- [x] **1. Send both original AND preprocessed images to Claude**
  - Pass both images in the Claude message (original for detail, preprocessed for structure)
  - Highest-impact single change — Claude can now see door arcs, thin walls, room labels
  - File: `api/analyze-floor-plan.js`

- [x] **2. Increase thinking budget**
  - Pass 1: 5,000 → 10,000 tokens
  - Pass 2: 8,000 → 16,000 tokens
  - Single-pass fallback: 10,000 → 16,000 tokens
  - More reasoning = more accurate pixel coordinates and fewer missed walls
  - File: `api/analyze-floor-plan.js`

- [x] **3. Widen snap threshold in API post-processing**
  - 5px → 12px for the API-level snap
  - Connects wall junctions that are close but not quite touching
  - File: `api/analyze-floor-plan.js`

- [x] **4. Add wall connectivity validation in post-processing**
  - After snapping, find interior wall endpoints not connected to any other wall
  - If an endpoint is within 15px of another wall's LINE (not just endpoint), extend it to connect
  - Close exterior wall loop if gap < 20px (find 2 unmatched exterior endpoints, snap together)
  - File: `api/analyze-floor-plan.js`

- [x] **5. Improve prompts for dual-image analysis**
  - SYSTEM_PROMPT updated: explains dual-image approach, tells Claude to cross-reference both
  - Added rule 9: room-count cross-check (N rooms need N-1 interior walls minimum)
  - Added rule 10: wall connectivity (every interior wall must connect at both endpoints)
  - Pass 1/Pass 2/single-pass prompts all label images as "Image 1 — ORIGINAL" and "Image 2 — PREPROCESSED"
  - File: `api/analyze-floor-plan.js`

---

## Phase 1 (completed previously)

### Changes Made
- Image preprocessing (grayscale → sharpen → binarize → trim via sharp)
- OCR dimension extraction (Claude Haiku on original image)
- Two-pass analysis (exterior shell → interior partitions)
- Multi-model validation (Roboflow cross-check)
- Feedback loop (save user corrections to Supabase)

## Review

All changes in one file: `api/analyze-floor-plan.js`

### What changed
1. **Dual-image input** — Claude now receives both the original (detail) and preprocessed (structure) images in Pass 1, Pass 2, and single-pass fallback. Pixel coordinates measured from original.
2. **Thinking budget 2-3x** — Pass 1: 5K→10K, Pass 2: 8K→16K, single-pass: 10K→16K. More reasoning for complex plans.
3. **Snap threshold 5→12px** — More wall junctions connect automatically.
4. **Wall connectivity validation** — New post-processing step: finds disconnected wall endpoints within 15px of another wall's line and extends them to connect. Also closes exterior wall loop gaps under 20px.
5. **Enhanced SYSTEM_PROMPT** — Explains dual-image approach, adds room-count cross-check rule, adds wall connectivity rule. All prompts label images clearly.
