# Floor Plan Analysis — Phase 3: Determinism & Coordinate Accuracy

## Goal
Eliminate coordinate mismatch, make results deterministic, reduce furniture false positives.

## Plan

- [x] **1. Fractional coordinates (0.0–1.0) in prompts**
  - All prompts request coords as fractions of image width/height
  - Server-side: multiply by actual dimensions after parsing
  - Deleted entire ~60-line rescaling heuristic block
  - Scale: Claude reports `estimatedBuildingWidthMeters`, server computes `pixelsPerMeter`

- [x] **2. `temperature: 0` + drop extended thinking**
  - Removed `thinking: { type: 'enabled', budget_tokens: ... }` from all 3 Claude calls
  - Added `temperature: 0` to all 3 Claude calls
  - Reduced `max_tokens` from 8192/16384 → 4096

- [x] **3. Morphological thin-line suppression in preprocessImage()**
  - After binarize(140): blur(2) + re-threshold(180)
  - Thin furniture lines (1-3px) vanish, thick wall bands (10-20px) survive

## Review

All changes in `api/analyze-floor-plan.js`:
1. **Fractional coords** — prompts request 0.0–1.0 fractions, server converts to pixels via `x * actualWidth`. Eliminates coordinate space mismatch permanently.
2. **Determinism** — `temperature: 0`, no extended thinking, `max_tokens: 4096`. Same image → same result.
3. **Furniture suppression** — preprocessed image runs blur(2)+threshold(180) after binarization. Thin lines vanish, wall bands survive. Claude sees walls-only in Image 2.
4. **Simplified post-processing** — removed 60 lines of bbox/rescaling heuristics. Fraction-to-pixel is 15 lines of straightforward multiplication.
5. **Scale handling** — Claude reports `estimatedBuildingWidthMeters`, server computes pixelsPerMeter from exterior wall pixel span. OCR and knownWidth overrides still work.
