# Full Sitea Discovery, Product Questions, and Linear Issue Plan

## Todo
- [x] Re-read product docs, status docs, task history, and design constraints
- [x] Map app architecture, core user flows, backend/API surfaces, data model, and deployment setup
- [x] Inspect UI/product surfaces for unfinished or risky workflows
- [x] Run codebase health scans for hotspots, TODOs, lint/build state, and dependency/deployment risks
- [x] Ask focused product/business/technical questions to fill gaps
- [x] Convert answers into detailed Linear-ready issues
- [x] Begin work on the highest-priority confirmed issue

## Active Implementation
- [x] Upgrade Vercel CLI to `54.4.1`
- [x] SIT-5: Fix paid AI visualization endpoint crash
- [x] Verify SIT-5 with targeted lint/build checks
- [ ] SIT-11: Finish PayPal and Supabase entitlement readiness
- [x] SIT-6: Persist AI-generated floor-plan buildings in saved projects and shared links
- [x] SIT-7: Add scanned PDF upload support for floor plans and site plans
- [x] SIT-8: Make the AI agent the primary Sitea workflow
- [ ] SIT-9: Create a floor-plan accuracy QA loop for scanned PDFs
- [ ] SIT-10: Polish the mobile demo path end to end
- [x] Update review notes with completed work

## Review
### Discovery So Far
- Sitea is a Vite/React + Three.js land/site planning app with Supabase auth/projects/sharing, AI floor/site plan APIs, PayPal pricing, and Capacitor iOS/Android shells.
- The largest implementation hotspots are `src/App.jsx`, `src/components/LandScene.jsx`, `src/components/FloorPlanGeneratorModal.jsx`, `src/components/BuildPanel.jsx`, `src/components/ComparePanel.jsx`, and `api/analyze-floor-plan.js`.
- `npm run build` passes, with expected large-chunk warnings for the main app and Three.js vendor bundle.
- `npm run lint` fails with 3,357 findings, mostly because ESLint is scanning generated Capacitor/mobile build assets. A narrower first-party scan still shows real cleanup work.
- Immediate risks found: `api/ai-visualize.js` references `user.email` without defining `user`, docs disagree about payment/backend readiness, generated AI floor-plan building state appears under-persisted in save/share flows, and upload/paywall authority is still partly client-side.

### Product Direction From User
- Primary audience: land buyers and homeowners.
- Demo target: demo-ready, with mobile polished.
- Brand: Sitea.
- Production URLs: both `sitea.live` and the Vercel URL matter.
- Sitea should become more agent-led: users talk to an AI agent, upload scanned PDFs, and the agent helps them visualize land/site/building options.
- PDF upload is required, especially scanned PDFs.
- Room labeling should be optional.
- Floor-plan detection quality is critical: walls, doors, windows, rooms, and related structure should be detected as completely as possible.
- Save should require sign-in.
- Shared links should expire.
- Supabase SQL should be applied, not only written.
- Homeowner plan should be `$20` for `20 uploads forever`.

### Linear Project Created
- Project: Sitea Demo Readiness
- URL: https://linear.app/sitea/project/sitea-demo-readiness-7a71ee8b2ae6

### Linear Issues Created
- SIT-5: Fix paid AI visualization endpoint crash
- SIT-6: Persist AI-generated floor-plan buildings in saved projects and shared links
- SIT-7: Add scanned PDF upload support for floor plans and site plans
- SIT-8: Make the AI agent the primary Sitea workflow
- SIT-9: Create a floor-plan accuracy QA loop for scanned PDFs
- SIT-10: Polish the mobile demo path end to end
- SIT-11: Finish PayPal and Supabase entitlement readiness
- SIT-12: Move upload quota tracking from localStorage to Supabase
- SIT-13: Require sign-in for saving projects
- SIT-14: Add expiring public share links
- SIT-15: Clean and update Sitea docs for demo readiness
- SIT-16: Fix lint scope and first-party lint baseline

### Recommended Work Order
1. Fix SIT-5 first because it is a tiny runtime bug in a paid API path.
2. Finish SIT-11 enough to align payment pricing and apply subscription SQL.
3. Fix SIT-6 so generated AI buildings survive save/share.
4. Build SIT-7 and SIT-9 together: scanned PDF ingestion plus a repeatable accuracy QA loop.
5. Reframe the product around the agent in SIT-8, then polish the mobile path in SIT-10.
6. Add sign-in save, expiring share links, server-side upload quotas, docs, and lint cleanup as the next demo-readiness layer.

### Completed Work This Pass
- Upgraded Vercel CLI from `50.26.0` to `54.4.1`.
- Completed Linear issue SIT-5 by preserving the authenticated user returned from `requireActiveSubscription(req)` in `api/ai-visualize.js`.
- Added local server-global lint declarations in `api/ai-visualize.js`.
- Verified SIT-5 with `npx eslint api/ai-visualize.js --format stylish` and `npm run build`.
- Updated homeowner pricing to `$20` and the homeowner upload limit to `20`.
- Applied Supabase migrations `harden_subscriptions_paypal` and `remove_public_subscription_policies`.
- Verified live `subscriptions` columns and RLS policies in Supabase.
- Confirmed Vercel Production is missing `PAYPAL_CLIENT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`, so production payment verification still needs those real secret values.
- Completed Linear issue SIT-6 by adding `generatedBuildings` to scene payload version 3 and restoring it through project/share/local draft loads.
- Completed Linear issue SIT-7 by adding PDF rendering through `pdfjs-dist`, multi-page controls in the unified upload modal, and PDF support across upload entry points.
- Added the SIT-9 floor-plan QA harness with three generated baseline PDF fixtures, a manifest, result recorder, summary/check scripts, and documented demo-ready criteria.
- Left SIT-9 in progress until the fixtures are run through the paid analyzer and real detected counts are recorded.
- Completed Linear issue SIT-8 by reframing the floating assistant as Sitea Agent, routing free users to Pro pricing, giving paid users earlier access in the main workspace, upgrading the empty chat state around scanned PDF/site-plan workflows, and passing land/building context into AI chat.
- Verified SIT-8 with focused ESLint, `npm run build`, and desktop/mobile browser smoke checks. The browser run showed no console errors; only existing Three.js alpha-color warnings remain.
- Started Linear issue SIT-10 with a focused mobile pricing pass: moved the pricing close button inside the modal so it is reachable on phone/desktop, removed mobile card scaling that caused horizontal overflow, stacked trust indicators on narrow screens, and hid the Sitea Agent launcher while pricing/auth overlays are open.
- Verified the SIT-10 pricing pass with focused ESLint, `npm run build`, and mobile/desktop browser checks. Pricing now opens and closes from the agent CTA on a 390px viewport with no horizontal overflow.
- SIT-11 production secret blocker is resolved in Vercel: `PAYPAL_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `PAYPAL_ENV` are present for Production. A fresh production deployment is still needed for the live app to pick up the new variables and server-verified PayPal code.

---

# Server-Verified PayPal + Subscription Hardening

## Todo
- [x] Add shared server helpers for PayPal OAuth/API calls, Supabase admin writes, and subscription validation
- [x] Add a server endpoint to create fixed-price one-time PayPal orders for `homeowner` and `lifetime`
- [x] Add a server endpoint to capture one-time PayPal orders, verify amount/status/plan, then upsert the subscription
- [x] Add a server endpoint to verify monthly PayPal subscriptions before upserting the subscription
- [x] Update `PricingModal.jsx` so PayPal order creation/capture and subscription verification go through the server
- [x] Update `useUser.jsx` so localStorage is only a UI cache, not trusted paid-state authority
- [x] Add SQL guidance for secure subscription columns/policies if the existing Supabase table needs tightening
- [x] Run build/lint-targeted checks and record results

## Review
### Changes Made
- Added `server/paypal.js` and `server/subscriptions.js` for PayPal OAuth/API calls, authenticated Supabase user lookup, active-subscription checks, and service-role subscription upserts.
- Added three Vercel API routes:
  - `api/paypal-create-order.js`
  - `api/paypal-capture-order.js`
  - `api/paypal-verify-subscription.js`
- Updated `PricingModal.jsx` so one-time PayPal orders are created and captured server-side, and monthly subscriptions are verified server-side before granting access.
- Updated `useUser.jsx` so localStorage is only a cache. Paid state is now based on the Supabase `subscriptions` row.
- Updated paid AI endpoints to use shared subscription validation that also checks `expires_at`.
- Added `sql/harden_subscriptions_paypal.sql` with optional PayPal audit columns and stricter RLS guidance.

### Required Environment Variables
- `PAYPAL_CLIENT_SECRET` must be set on Vercel.
- `SUPABASE_SERVICE_ROLE_KEY` must be set on Vercel.
- `PAYPAL_ENV=live` for production PayPal; omit or set anything else for sandbox.
- `PAYPAL_CLIENT_ID` and `PAYPAL_MONTHLY_PLAN_ID` are supported, with fallback to existing `VITE_PAYPAL_CLIENT_ID` and `VITE_PAYPAL_MONTHLY_PLAN_ID`.

### Verification
- `npm run build` passes.
- `node -e "await import(...)"` server import smoke test passes for the new payment endpoints/helpers.
- `npx eslint api/paypal-create-order.js api/paypal-capture-order.js api/paypal-verify-subscription.js server/paypal.js server/subscriptions.js --format stylish` passes.
- `npx eslint src/components/PricingModal.jsx --format stylish` passes after the SIT-10 pricing cleanup.
- `npx eslint src/hooks/useUser.jsx --format stylish` still fails on pre-existing React lint rules around effect state and Fast Refresh exports.

---

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
