# Fix Floor Plan Analysis Failure — Expired Gemini Models

## Problem
Clicking "Analyze" on a floor plan upload results in "Analysis failed".

## Root Cause
The API at `api/analyze-floor-plan.js` uses dated preview/experimental Gemini models that Google has deprecated:
- `gemini-2.0-flash-exp` (line 267) — image generation REST API call
- `gemini-2.5-pro-preview-05-06` (lines 528, 635, 644) — semantic extraction + two-pass fallback
- `gemini-2.0-flash` (line 109) — OCR (likely still works but should be consistent)

When Step 1 (image gen) fails, it falls back to legacy two-pass which also uses the expired model — both pipelines fail.

## Fix Plan
- [x] Add `GEMINI_API_KEY` to Vercel Production environment (was only in Preview)
- [x] Update `gemini-2.0-flash-exp` → `gemini-2.0-flash` in REST API URL (line 267)
- [x] Update `gemini-2.5-pro-preview-05-06` → `gemini-2.5-pro-preview-03-25` in SDK calls (lines 528, 635, 644)

## Files to Edit
- `api/analyze-floor-plan.js` — model name updates only

## Review
Two issues found:
1. **Missing env var (primary cause):** `GEMINI_API_KEY` was only set for Preview environment, not Production. All Gemini API calls failed immediately on `sitea.live`.
2. **Expired model names (secondary):** `gemini-2.0-flash-exp` and `gemini-2.5-pro-preview-05-06` are deprecated preview models. Updated to current stable/preview versions.
