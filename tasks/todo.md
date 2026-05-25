# Project Audit: What Should Come Next

## Todo
- [x] Map current product state from docs, tasks, and code structure
- [x] Inspect architecture hotspots and large files
- [x] Check build/lint health
- [x] Identify the highest-leverage next tasks
- [x] Add review summary with recommended next steps

## Review
### What I Read
- Product/status docs: `README.md`, `APP_STATUS.md`, `PRD.md`, previous task notes, technical debt notes, and code review notes.
- Core app surfaces: `src/App.jsx`, `src/components/LandScene.jsx`, `src/components/FloorPlanGeneratorModal.jsx`, `src/hooks/useUser.jsx`, `src/hooks/useAIChat.js`, payment/auth/project/share services, and the API routes.
- Health checks: `npm run build`, `npm run lint`, and a narrowed `npx eslint src api --format stylish`.

### Current Shape
- Sitea is a large Vite/React + Three.js app with Supabase, PayPal UI, AI floor/site plan APIs, and Capacitor iOS/Android shells.
- The core product appears feature-rich and shippable, but several docs disagree about the state of payment/backend readiness.
- Biggest complexity hotspots by line count:
  - `src/App.jsx` ~4,831 lines
  - `src/components/LandScene.jsx` ~4,333 lines
  - `src/components/FloorPlanGeneratorModal.jsx` ~2,836 lines
  - `api/analyze-floor-plan.js` ~1,456 lines

### Health Check Results
- `npm run build` passes.
- Build still warns about large chunks, especially `vendor-three` and a large generated `index` chunk. This is expected for a 3D app but worth monitoring.
- `npm run lint` fails partly because ESLint scans generated Capacitor/mobile assets in `android/` and `ios/`. The lint config only ignores `dist`.
- `npx eslint src api --format stylish` still reports first-party issues: 249 errors and 42 warnings. Main categories are unused imports/props, missing Node globals for `api/*.js`, React hook/compiler-style rules, and a few stale helper functions.

### Highest-Leverage Next Work
1. **Harden payments/subscriptions before adding new features.**
   - `PricingModal.jsx` writes subscription status from client-side PayPal callbacks and falls back to localStorage on database errors.
   - API routes require an active Supabase subscription, which is good, but subscription creation should be server-verified before granting paid state.
   - Next task should add server-side PayPal order/subscription verification, tighten Supabase subscription writes, and remove localStorage as an authority for paid access.

2. **Fix lint scope and first-party lint baseline.**
   - Update ESLint ignores for generated mobile/build assets.
   - Add Node globals or API-specific config for `api/*.js`.
   - Remove obvious dead code and stale props/imports in small batches.
   - This is low-risk and will make future bug work much safer.

3. **Reconcile stale project docs.**
   - `README.md` is still the default Vite template.
   - `PRD.md` says payment backend is pending while `APP_STATUS.md` says payment is fully wired.
   - Update docs after payment reality is clarified so future planning does not fork.

4. **Only then tackle architecture cleanup.**
   - `App.jsx`, `LandScene.jsx`, `FloorPlanGeneratorModal.jsx`, and `api/analyze-floor-plan.js` are the long-term maintainability targets.
   - Keep this incremental: extract only when touching a working area for a real bug or feature.

### Recommended Immediate Task
Start with **server-verified PayPal + subscription hardening**. It protects revenue and paid AI features, resolves the biggest doc contradiction, and is more urgent than terrain, new comparison objects, or broad refactors.

---

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
