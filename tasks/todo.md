# Floor Plan Upload — Competitive Moat Improvements

## Plan

### 1. Feedback Loop — Save User Corrections as Training Data
Capture the diff between AI output and user edits. Store to Supabase so we can feed corrections back into prompts.

- [x] 1a. Created `floor_plan_corrections` Supabase table SQL (sql/create_floor_plan_corrections.sql) — needs to be run in Supabase dashboard
- [x] 1b. Store original AI output snapshot in ref when it arrives (before user edits)
- [x] 1c. On confirm, detect changes (wall/door count + JSON diff) and save to Supabase (fire-and-forget)
- [ ] 1d. Short-term use: Load recent corrections as few-shot examples in the Claude prompt — deferred until we have data

### 2. OCR for Dimension Labels — Scale Accuracy Boost
Many floor plans have "3500mm" or "12ft" printed on them. Extract those before Claude to give explicit scale hints.

- [x] 2a. Add Claude Haiku OCR pass in API (on original image, before preprocessing) — no new deps
- [x] 2b. Parse + normalize values to meters (mm, m, cm, ft, in, unknown)
- [x] 2c. Pass extracted dimensions as explicit hints to the Claude Sonnet prompt
- [x] 2d. Post-processing: validate/override Claude's scale if OCR has pixel-length data and Claude's estimate is >30% off

### 3. Image Preprocessing — Better Detection on Messy Inputs
Raw photos, bad PDFs, hand-drawn sketches fail more than clean scans. Preprocess before sending to Claude.

- [x] 3a. Add server-side preprocessing pipeline in the API (sharp library)
- [x] 3b. Binarize (black/white threshold=140) to remove color noise
- [x] 3c. Sharpen edges (sigma=1.5) for clearer wall detection
- [x] 3d. Auto-crop to floor plan boundary (trim threshold=20)
- [ ] 3e. Deskew if image is rotated — skipped for now, complex and low ROI

### 4. Two-Pass Claude Call — Completeness
Claude misses interior walls doing everything in one shot. Split into two passes.

- [x] 4a. Pass 1: Extract exterior shell only (outer perimeter walls) — focused prompt, 5K thinking budget
- [x] 4b. Pass 2: Given exterior walls as context, find all interior partitions, doors, rooms, stairs, scale
- [x] 4c. Automatic fallback to single-pass if Pass 1 fails or finds <3 walls
- [x] 4d. Bumped maxDuration to 120s for two-pass + OCR

### 5. Multi-Model Validation — Cross-Check Roboflow vs Claude
Roboflow hints are currently one-way. Validate Claude output against Roboflow post-hoc.

- [x] 5a. After Claude responds, compare Roboflow wall predictions against Claude walls (30px match threshold)
- [x] 5b. Identify Roboflow walls with >50% confidence not matched by any Claude wall
- [x] 5c. Auto-add unmatched walls with capped confidence (0.6 max) — user can review/delete in editor
- [ ] 5d. Surface "AI disagreement" zones to user for review — deferred, editing UI already allows review

---

## Priority Order
1. **Image Preprocessing (#3)** — quickest accuracy win, low complexity
2. **OCR Dimensions (#2)** — scale is the #1 user complaint, big impact
3. **Two-Pass Claude (#4)** — fixes missing interior walls, the second biggest issue
4. **Multi-Model Validation (#5)** — catches Claude misses with existing Roboflow data
5. **Feedback Loop (#1)** — long-term moat, needs more infra but highest strategic value

## Review

### Changes Made

**api/analyze-floor-plan.js** — the core of all 5 improvements:
- **Image preprocessing** (`preprocessImage`): grayscale → sharpen → binarize → trim via `sharp`. Falls back to original if it fails.
- **OCR dimension extraction** (`extractDimensionLabels`): Fast Claude Haiku call on original image extracts printed measurements. Runs in parallel with Roboflow. Skipped if user provides known scale.
- **Two-pass analysis** (`twoPassAnalysis`): Pass 1 = exterior shell only (focused prompt). Pass 2 = interior partitions given exterior context. Falls back to single-pass if Pass 1 fails.
- **Multi-model validation**: After Claude responds, Roboflow walls not matched by Claude (>30px away) are auto-added at capped confidence (0.6 max).
- **OCR scale override**: If OCR found dimensions with pixel lengths and Claude's scale is >30% off, override with OCR-derived scale.
- **maxDuration**: Bumped to 120s for two-pass + OCR.

**src/components/FloorPlanGeneratorModal.jsx** — feedback loop:
- Stores original AI output snapshot in `originalAiDataRef` before user edits.
- On confirm (`handleGenerate`), compares original vs edited data. If walls/doors changed, saves diff to `floor_plan_corrections` Supabase table (fire-and-forget).

**sql/create_floor_plan_corrections.sql** — new Supabase table:
- Stores original AI output + user corrections as JSONB.
- RLS policies for user isolation.
- Needs to be run in Supabase SQL Editor.

**vercel.json** — bumped maxDuration from 60 → 120s.

**package.json** — added `sharp` dependency.

### Deferred Items
- 1d: Few-shot examples from corrections — needs data first
- 3e: Image deskew — complex, low ROI for now
- 5d: UI for "AI disagreement" zones — editing UI already allows review
