# Fix Missing Openings + OCR-Prioritized CV Scan + Dashed Line Filtering

## Task 1: Fix Missing Windows (DONE)
- [x] Add window detection to Step 3 prompt
- [x] Pass windows through in new pipeline result
- [x] Add window detection to legacy two-pass prompt
- [x] Add window coordinate rescaling

## Task 2: OCR-Prioritized CV — Filter text from wall detection (DONE)
- [x] Add bounding boxes to OCR prompt
- [x] Pass OCR bboxes to `extractWallsFromCleanImage`
- [x] Filter wall candidates in CV scan
- [x] Scale OCR bboxes to clean image space

## Task 3: Dashed Line Filtering — Thin-line suppression (DONE)
- [x] **1. Replace blur with morphological erosion→dilation in `preprocessImage`** — Erosion (3x3 kernel) removes lines ≤1px thick; dilation restores thick walls. No smearing of dashed lines.
- [x] **2. Add morphological open to CV scan binarization** — Same erode→dilate before the run-link scan in `extractWallsFromCleanImage`.
- [x] **3. Raise `MIN_ROWS` from 2 to 4** — Wall bands must now be at least 4 rows thick to be kept, rejecting thin artifacts.

## Files Edited
- `api/analyze-floor-plan.js`

## Review
**Task 1** — Windows were never extracted. Added window detection to both Gemini prompts and passed data through.

**Task 2** — OCR now returns bounding boxes. CV scan filters walls that overlap text regions.

**Task 3** — Replaced `blur(2).threshold(180)` with proper morphological opening (`morphErode` → `morphDilate` with 3x3 kernel). Blur smeared dashed lines (stairs, property boundaries) into solid bands that looked like walls. Erosion cleanly removes thin lines without creating false solids — a pixel stays black only if all 3x3 neighbors are black, so 1-2px lines vanish. Dilation then restores thick walls to original size. Applied to both `preprocessImage` (legacy/Roboflow) and `extractWallsFromCleanImage` (new pipeline CV). Also raised `MIN_ROWS` from 2 to 4 as an additional safety net.
