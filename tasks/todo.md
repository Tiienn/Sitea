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
- [x] Upgrade Vercel CLI to `54.5.0`
- [x] SIT-5: Fix paid AI visualization endpoint crash
- [x] Verify SIT-5 with targeted lint/build checks
- [x] SIT-11: Finish PayPal and Supabase entitlement readiness
- [x] SIT-6: Persist AI-generated floor-plan buildings in saved projects and shared links
- [x] SIT-7: Add scanned PDF upload support for floor plans and site plans
- [x] SIT-8: Make the AI agent the primary Sitea workflow
- [x] SIT-9: Create a floor-plan accuracy QA loop for scanned PDFs
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
- Upgraded Vercel CLI from `50.26.0` to `54.4.1`, then from `54.4.1` to `54.5.0`.
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
- SIT-11 is complete: `sitea.live` is now aliased to production deployment `dpl_9n2Hg7WeyVNVQL2f9q4HyRrnqntW`, created on 2026-05-26 23:36 MUT, and includes the server PayPal API functions.

### SIT-9 Execution Plan
- [x] Run the existing floor-plan QA report to confirm the fixture baseline.
- [x] Review the generated fixture manifest and analyzer response shape so improvements target measurable counts.
- [x] Add a local analyzer runner that posts fixture PDFs/images directly to `api/analyze-floor-plan.js` with a paid test token or a safe dev bypass only if the production auth path remains untouched.
- [x] Add an OpenAI-first floor-plan analyzer path using the configured GPT Image model for clean wall-mask generation and OpenAI vision structured output for dimensions/semantics.
- [x] Keep the existing Gemini analyzer path as fallback until SIT-9 fixture evidence shows OpenAI is better.
- [x] Run all three fixtures through the analyzer and record real detected counts.
- [x] Identify the weakest category across walls, doors, windows, rooms, and stairs.
- [x] Make the smallest analyzer/prompt/CV change that improves that category without weakening the others.
- [x] Re-run the fixtures, update `tasks/floor-plan-qa-results.md`, and document remaining accuracy gaps.

### SIT-9 Credential Status
- Local fixture execution is unblocked. A non-empty `OPENAI_API_KEY` is present in ignored `.env.qa.local`, and Vercel Production has `OPENAI_API_KEY` configured by name/scope.

### Real Floor Plan QA Plan
- [x] Add the three supplied real floor-plan images as stable QA fixture files without modifying the originals.
- [x] Extend the QA report to support review-only real fixtures so unknown ground-truth counts do not distort the synthetic demo-ready baseline.
- [x] Run one real fixture first through the OpenAI-first analyzer to control paid API spend.
- [x] Review detected walls, doors, windows, rooms, stairs, dimensions, and scale notes from the first real result.
- [x] If the first result is useful, run the remaining two real fixtures and update the QA report with detected counts and review notes.
- [x] Decide whether the real samples expose one small analyzer fix before the next deploy/commit.

### Real Floor Plan QA Review
- Added the supplied plans as review-only fixtures: `real-wide-40x30`, `real-site-ground-floor`, and `real-site-upper-floor`.
- Real fixture results are now in `tasks/floor-plan-qa-results.md` without changing the `3/3` synthetic demo-ready score.
- Real measured counts:
  - `real-wide-40x30`: 16 walls, 8 doors, 6 windows, 9 rooms, 0 stairs; scale from dimension labels at 93% confidence.
  - `real-site-ground-floor`: 35 walls, 5 doors, 5 windows, 7 rooms, 1 stair; scale from dimension labels at 95% confidence.
  - `real-site-upper-floor`: 48 walls, 7 doors, 4 windows, 10 rooms, 1 stair; scale from dimension labels at 93% confidence.
- The first real plan used the clean-wall CV path successfully. The two dimensioned site-plan screenshots needed the direct OpenAI fallback because the clean generated mask under-extracted walls; the existing fallback handled this correctly.
- No analyzer code change is recommended before visual 3D QA. The next focused check should confirm the real-plan wall segmentation produces clean 3D geometry, especially for the two direct-fallback site plans.
- Verification after adding real fixtures: `npm run qa:floor-plans:check`, `npx eslint scripts/floor-plan-qa.mjs --format stylish`, and `npm run build` pass.

### Vercel CLI + Visual 3D Placement Plan
- [x] Upgrade Vercel CLI from `54.4.1` to the latest available version and verify `vercel --version`.
- [x] Trace the Sitea path that converts analyzer output into placed 3D building geometry.
- [x] Add or run a small local visual-placement check for the three real floor-plan results without making extra paid analyzer calls.
- [x] Inspect desktop and mobile views for obvious placement defects: blank canvas, off-scale geometry, extreme fragmentation, missing rooms, and unplaceable buildings.
- [x] Record findings and the next smallest fix, if any, in this review section.

### Vercel CLI + Visual 3D Placement Review
- Vercel CLI is now `54.5.0`; the install emitted a Node `v25` engine warning, but `vercel --version`, `npm view vercel version`, and `npm ls -g vercel --depth=0` all verified the latest installed CLI.
- Added `scripts/floor-plan-placement-qa.mjs` and `npm run qa:floor-plans:placement` to convert real analyzer outputs into a local scene fixture for repeatable 3D placement checks.
- Found and fixed the main visual placement defect: the 40ft x 30ft plan could accept an incomplete CV wall mask, making the placed building too small. The analyzer now rejects CV wall results that under-cover printed dimensions and can correct scale from wall bounds when dimension labels are trustworthy.
- `src/utils/floorPlanConverter.js` now skips zero-length wall segments, so the upper-floor real fixture places 47 usable 3D walls from 48 raw walls instead of carrying an invalid segment into the scene.
- Current placement report: `real-wide-40x30` is `12.19m x 9.13m`, `real-site-ground-floor` is `17.58m x 12.06m`, and `real-site-upper-floor` is `13.41m x 10m`.
- Browser QA passed on desktop 3D, desktop 2D, and mobile 3D with nonblank canvases and all three real buildings placeable. The 3D orbit camera now accounts for narrow portrait viewports and auto-fits when entering orbit mode, so the mobile view starts with all three real buildings visible.
- Saved QA screenshots under `output/playwright/sitea-placement/`.
- Verification after the placement fix: `npm run qa:floor-plans:placement`, `npm run qa:floor-plans:check`, targeted ESLint for the analyzer/converter/QA scripts, mobile browser QA, and `npm run build` pass. `npx eslint src/components/LandScene.jsx --format stylish` still fails on the existing scene-file lint baseline.

### Remove Size Landing Page Plan
- [x] Remove the startup `LandingHero` page with the "You can't picture 800m²" headline.
- [x] Remove the follow-up `PlotReveal` gate from startup and size-link flow.
- [x] Make `?size=` links open directly into the 3D workspace with that plot size.
- [x] Verify the app builds and opens on mobile without the landing overlay.

### Remove Size Landing Page Review
- Removed the `LandingHero` and `PlotReveal` imports, state, handlers, and render gates from `src/App.jsx`.
- Deleted the unused `src/components/LandingHero.jsx` and `src/components/PlotReveal.jsx` files so the old landing headline is gone from `src/`.
- `?size=800` now opens straight into the 3D workspace as a square 800m² plot with comparison objects enabled.
- Verification: `rg` finds no old landing headline in `src/`; `npm run build` passes; mobile browser QA confirms no landing overlay and a visible 3D canvas. `npx eslint src/App.jsx --format stylish` still fails on the existing App lint baseline.
- QA screenshot saved at `output/playwright/sitea-landing-removed/mobile-size-link.png`.

### Agent-First Landing Plan
- [x] Open Sitea Agent by default on the first workspace screen.
- [x] Replace the empty chat card with a direct "How can we help you?" welcome.
- [x] Make the mobile chat a compact floating overlay without a full-screen backdrop.
- [x] Verify desktop/mobile still show the open world behind the chat.

### Agent-First Landing Review
- `src/App.jsx` now starts with Sitea Agent open by default and hides it for read-only, auth/pricing, guided, and land-definition states.
- `src/components/AIChatPanel.jsx` now uses a compact mobile floating panel, no dark full-screen backdrop, and a welcome card that says "How can we help you?"
- Fixed the empty-state auto-scroll so the welcome card stays visible instead of jumping to the suggestions/input area.
- Added a dark, thin scrollbar style in `src/index.css` for the agent message area.
- Verification: `npx eslint src/components/AIChatPanel.jsx --format stylish` passes, `npm run build` passes, and desktop/mobile browser QA show the open world behind the chat.
- QA screenshots saved under `output/playwright/sitea-agent-landing/`.

### Agent-Owned Upload Flow Plan
- [x] Let users drag and drop a PDF/image directly onto the Sitea Agent panel.
- [x] Show the uploaded file name in the user chat message.
- [x] Make the analyzer response read like an agent action: detected counts plus the next placement step.
- [x] Verify the UI/build without making another paid analyzer call.

### Agent-Owned Upload Flow Review
- `src/components/AIChatPanel.jsx` now handles drag/drop on the agent panel and shows a "Drop your plan here" overlay while a file is hovering.
- Chat file uploads now send `Analyze {file.name}` when the user did not type a prompt, so the user message reflects the actual uploaded plan.
- `src/hooks/useAIChat.js` now responds after analysis with agent-style detected counts and next placement guidance, then still hands the converted building to the existing 3D placement mode.
- Fixed the mobile panel positioning by removing the conflicting `relative` class from the fixed chat panel and pinning mobile height to `54vh`.
- Linear updated: comments added to `SIT-8` and `SIT-10` with the shipped behavior and verification notes.
- Verification: `npx eslint src/components/AIChatPanel.jsx src/hooks/useAIChat.js --format stylish`, `npm run build`, and mobile browser QA pass. No paid analyzer call was made for this verification.
- QA screenshot saved at `output/playwright/sitea-agent-upload/mobile-agent-upload-ready.png`.

### Agent UI + Site-Plan Fit Plan
- [x] Improve Sitea Agent button colors, suggestion hierarchy, and upload/send controls without changing the compact overlay layout.
- [x] Route uploaded plans by type so site plans do not automatically run through the paid floor-plan analyzer.
- [x] When a site plan is uploaded, have the agent explain what can fit using the current land area and offer a tennis-court comparison action.
- [x] Wire the comparison action into the existing 3D comparison-object system.
- [x] Verify focused lint/build/browser behavior and update Linear with the shipped agent improvements.

### Agent UI + Site-Plan Fit Review
- `src/components/AIChatPanel.jsx` now makes the upload action the strongest first suggestion, uses cleaner accent/border treatment for action buttons, and gives the upload/send icon controls stable 44px touch targets on mobile.
- `src/hooks/useAIChat.js` now classifies uploaded files before analysis. Site plans are routed to a site-plan review response instead of the paid floor-plan analyzer, while floor plans still use the OpenAI-first floor-plan analyzer.
- `src/services/imageAnalysis.js` now gives site-plan uploads a stronger heuristic when it sees colored property, setback, or dimension lines, helping dimensioned site-plan screenshots avoid the floor-plan analyzer path.
- Site-plan review messages now estimate how many tennis courts fit in the current land area and include a one-tap comparison action.
- `src/App.jsx` now lets the agent set a site-plan image into the existing land tracing flow and activate the existing `tennisCourt` comparison object. The stale `?size=` comparison IDs were corrected to `basketballCourt` and `tennisCourt`.
- Verification: `npx eslint src/components/AIChatPanel.jsx src/hooks/useAIChat.js src/services/imageAnalysis.js --format stylish` passes; `npm run build` passes; desktop and 390px mobile browser checks pass with no horizontal overflow and 44px input icon buttons.
- `npx eslint src/App.jsx --format stylish` still fails on the existing App file lint baseline, not from the new changes.
- Linear updated: `SIT-8` and `SIT-10` have shipped-behavior comments for the agent upload, comparison action, and mobile UI polish.
- QA screenshot saved at `output/playwright/sitea-agent-site-plan/mobile-agent-ui.png`.

### Focused UI/Button Polish Plan
- [x] Add small reusable button/action tokens for primary, secondary, icon, and agent actions.
- [x] Apply the tokens to the Sitea Agent panel so suggestions, follow-up actions, and input controls share one hierarchy.
- [x] Upgrade the Sitea Agent launcher from a plain teal bubble into a more premium agent pill without changing its placement.
- [x] Lightly refine the land CTA card to use the same action language.
- [x] Verify focused lint/build and desktop/mobile browser behavior, then record the review.

### Focused UI/Button Polish Review
- Added reusable UI tokens in `src/index.css`: `sitea-btn`, `sitea-btn-primary`, `sitea-btn-secondary`, `sitea-icon-btn`, `sitea-icon-btn-primary`, `sitea-agent-panel`, `sitea-agent-action`, and `sitea-agent-launcher`.
- Updated `src/components/AIChatPanel.jsx` to use those tokens for suggestion buttons, assistant action buttons, header controls, upload/send controls, and the panel shell.
- Updated `src/components/AIChatButton.jsx` so the Sitea Agent launcher feels more premium while keeping the same desktop/mobile placement.
- Updated the main land CTA buttons in `src/App.jsx` to use the new primary action token.
- Verification: `npx eslint src/components/AIChatPanel.jsx src/components/AIChatButton.jsx --format stylish` passes and `npm run build` passes.
- Browser checks passed on desktop and 390px mobile: the agent panel remains compact, no horizontal overflow was detected, upload/send controls stay 44px, and the launcher remains 58px on mobile.
- The in-app browser screenshot capture timed out on the WebGL page; visual verification used live DOM/layout metrics instead.

### OpenAI Chat Agent Migration Plan
- [x] Replace Anthropic in `api/ai-chat.js` with OpenAI for the Sitea Agent chat route.
- [x] Use a cheaper default chat model while keeping an environment override for model tuning.
- [x] Preserve the frontend response shape so existing tool execution stays unchanged.
- [x] Verify import/lint/build and record remaining cost-related AI endpoints.

### OpenAI Chat Agent Migration Review
- `api/ai-chat.js` now uses the OpenAI SDK instead of Anthropic for the Sitea Agent chat route.
- Default chat model is `gpt-5-mini`, with `OPENAI_CHAT_MODEL` available for production overrides such as `gpt-5-nano` for maximum savings or a larger model for quality.
- The route translates the existing frontend/Anthropic-style `text`, `tool_use`, and `tool_result` blocks into OpenAI chat tool calls, then translates OpenAI tool calls back to the same response shape expected by `useAIChat`.
- Cost note from current OpenAI pricing docs: `gpt-5-mini` is listed at `$0.25` input and `$2.00` output per 1M tokens; `gpt-5-nano` is listed at `$0.05` input and `$0.40` output per 1M tokens.
- Verification: `npx eslint api/ai-chat.js --format stylish`, `node -e "await import('./api/ai-chat.js')"`, and `npm run build` pass.
- Remaining cost-related AI endpoint at this point was `api/analyze-site-plan.js`, which still used Claude Sonnet 4 before the follow-up migration below.

### OpenAI Site-Plan Boundary Migration Plan
- [x] Replace Anthropic in `api/analyze-site-plan.js` with OpenAI vision.
- [x] Preserve the existing API response shape for `detectSitePlanBoundary`.
- [x] Keep a cheap default model with an environment override for quality/cost tuning.
- [x] Remove the unused Anthropic SDK dependency from `package.json` and `package-lock.json`.
- [x] Verify lint/import/build and confirm no Anthropic package/code references remain.

### OpenAI Site-Plan Boundary Migration Review
- `api/analyze-site-plan.js` now uses the OpenAI SDK and Responses API image input instead of Claude Vision.
- Default site-plan model is `gpt-5-mini`, with `OPENAI_SITE_PLAN_MODEL` override first and `OPENAI_CHAT_MODEL` fallback second.
- The endpoint still returns `success`, `boundary`, `dimensions`, `scale`, and `imageSize`, so the existing land tracing flow remains unchanged.
- Removed `@anthropic-ai/sdk` from the installed dependencies and lockfile.
- Verification: `npx eslint api/analyze-site-plan.js --format stylish`, `node -e "await import('./api/analyze-site-plan.js')"`, `npm ls @anthropic-ai/sdk --depth=0`, `rg` for Anthropic code/package references, and `npm run build` pass.
- There are no remaining Anthropic runtime imports or package dependencies in the app.

### OpenAI Floor-Plan Migration
- `api/analyze-floor-plan.js` now prefers OpenAI: dimension OCR via `gpt-5.2` structured output, clean wall-mask generation via the configured GPT Image model, semantic extraction via OpenAI structured output, and direct OpenAI analysis fallback.
- The current default image model is `gpt-image-1.5`, which is the latest GPT Image model exposed in the current OpenAI API docs/SDK. Set `OPENAI_IMAGE_MODEL` if/when the account exposes a newer model alias.
- Gemini OCR/image-gen/semantic/two-pass functions remain as fallback while SIT-9 fixture evidence is collected.
- Verification: targeted ESLint passes, import smoke passes, `npm run build` passes, and the QA runner now fails clearly when no non-empty local provider key is available.
- First SIT-9 OpenAI fixture run recorded 0/3 demo-ready fixtures. Walls were the weakest category: `5/18`, `13/22`, and `21/28`. Doors/windows/rooms/stairs were acceptable on most fixtures.
- Root cause: the GPT Image wall-mask/CV path can under-extract walls but was accepted whenever it found at least 4 walls. The analyzer now requires at least 15 CV wall segments before trusting the wall-mask pipeline; otherwise it falls back to direct OpenAI structured analysis.
- Second SIT-9 run is green by count thresholds: `3/3` fixtures demo-ready in `tasks/floor-plan-qa-results.md`.
- Final measured counts:
  - `single-storey-clear-scan`: 39 walls, 12 doors, 7 windows, 14 rooms, 0 stairs.
  - `low-contrast-phone-scan`: 23 walls, 13 doors, 8 windows, 10 rooms, 0 stairs.
  - `dimensioned-plan-with-stairs`: 80 walls, 10 doors, 10 windows, 10 rooms, 1 stair.
- Remaining SIT-9 caveat: the geometric wall splitter intentionally over-segments walls at junctions to avoid undercounting and improve structure completeness. Next visual QA should confirm the 3D generated building still looks clean and not overly fragmented.
- Verification after SIT-9 changes: targeted ESLint passes, `npm run build` passes, and `npm run qa:floor-plans:check` passes.

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

---

# Smooth, Trustworthy Agent Demo Path

## Todo
- [x] Define one simple first-run path: open Sitea, ask or upload, understand the result, take the next action, and see the land/world update.
- [x] Simplify the empty Sitea Agent state to three outcome-based choices so the first decision is obvious.
- [x] Add a small guided progress/state layer for plan uploads so users see what the agent is doing before the result appears.
- [x] Improve site-plan result messages so they explain the detected plan, the tennis-court comparison, and the next click in plain language.
- [x] Add a clearer handoff when a site plan opens the Land panel so boundary tracing feels intentional instead of surprising.
- [x] Keep button/color changes inside the existing Sitea design system tokens and avoid broad visual rewrites.
- [x] Verify the updated flow on desktop and mobile, then update Linear with the result.

## Review
- Simplified the Sitea Agent empty state to three outcome-based actions: upload a plan, see what fits, and start with land size.
- Added guided progress/next-step UI for plan analysis so uploads communicate what Sitea is doing and what the user should do next.
- Reworded floor-plan and site-plan responses to be more trustworthy and direct: detected result first, then the next action.
- Made the site-plan upload handoff clearer by opening Land tools with a toast that points to boundary tracing or scale comparison.
- Kept the visual work scoped to the existing Sitea design tokens and adjusted mobile copy/height so all three starter actions fit above the input.
- Verification: targeted ESLint for `AIChatPanel.jsx` and `useAIChat.js` passes, `npm run build` passes, desktop browser QA passes, and 390px mobile browser QA passes with no horizontal overflow and all starter actions visible.
- Linear updated: comments added to `SIT-8` and `SIT-10`.

---

# Sitea GUI Polish: Buttons, Colors, Layout, Mobile, Agent

## Todo
- [x] Capture a quick desktop and mobile UI baseline for the current first screen, Sitea Agent, bottom nav, view controls, and primary side panels.
- [x] Tighten the shared GUI tokens in `src/index.css` for panels, primary/secondary buttons, icon buttons, inputs, selects, nav items, menu rows, and status/toast surfaces.
- [x] Polish the bottom/landscape navigation so active, hover, disabled, saved, share, Pro, and More states feel consistent and easy to scan.
- [x] Polish the top HUD and view controls so `1P`, `3D`, `2D`, settings, toggles, and quality controls share the same spacing, color hierarchy, and touch targets.
- [x] Refine the Sitea Agent shell and actions so it matches the surrounding app while preserving the open-world feel and simple three-action start.
- [x] Polish the Land and Build panel basics: upload zone, rectangle inputs, template cards, Apply button, tool grid, undo/redo buttons, and cramped control spacing.
- [x] Keep the palette trustworthy and restrained: teal stays primary, with clearer neutrals and small semantic accents instead of a one-note dark/teal look.
- [x] Verify desktop and 390px mobile in the browser: no text overflow, no horizontal overflow, 44px touch targets, visible world behind the agent, and no layout jumps.
- [x] Update Linear (`SIT-8` and `SIT-10`) and complete this review section with what changed and verification results.

## Review
- Added a tighter shared GUI layer in `src/index.css`: refreshed dark panel surfaces, primary/secondary/icon buttons, agent actions, input/select styling, segmented controls, menu rows, status toasts, collapse handles, and responsive touch-target sizes.
- Polished the bottom and landscape navigation states with clearer active/hover treatment, a more distinct Pro state, and a 44px account/sign-in target.
- Refined the top view controls so `1P`, `3D`, `2D`, settings, toggles, and quality selects share the same control panel language and avoid cramped mobile sizing.
- Kept the Sitea Agent open-world direction intact while making the shell, launcher, starter actions, input controls, and upload/send actions feel more consistent with the rest of the app.
- Cleaned up Land/Build panel basics: rectangle fields, area/template cards, upload zone, Apply button, floor-plan offset fields, upload replacement button, tool grid, Undo/Redo, and responsive collapse handles.
- Removed newly introduced radial decorative shine from the agent surfaces and kept the palette restrained: teal remains the primary action color, with clearer neutrals plus small warning/danger accents.
- Verification: `npm run build` passes, `git diff --check` passes, and focused ESLint passes for `AIChatPanel.jsx`, `AIChatButton.jsx`, and `Minimap.jsx`. A broader lint run that includes `LandPanel.jsx` and `BuildPanel.jsx` is still blocked by their existing unused-prop and hook-rule baseline.
- Browser verification passed on desktop `1280x720` and mobile `390x844`: no horizontal overflow, no visible sub-40px controls, Sitea Agent leaves the 3D world visible, starter actions remain visible on mobile, and Build panel tool/Undo/Redo controls hold stable sizes.

---

# Realistic Compare Objects Pass

## Todo
- [x] Capture the current compare-object baseline in desktop and mobile 3D: active object placement, visual readability, canvas health, and performance feel.
- [x] Do a quick reference pass for the first high-impact set: tennis court, basketball court, soccer field, parking space, sedan/SUV/pickup, swimming pool, and house sizes.
- [x] Improve sports surfaces in `src/components/scene/ComparisonObjects.jsx`: richer court/field textures, visible nets/posts/goals/hoops, edge trim, and small realistic height details without changing object dimensions.
- [x] Improve vehicle scale realism: stronger silhouettes, tires/wheels, windows, lights, bumpers, and material contrast for sedan, SUV, and Ford F-150.
- [x] Improve everyday land objects: parking space asphalt/line details, swimming pool coping/water/depth cue, and house roof/window/door/porch details.
- [x] Keep the Compare panel thumbnails consistent with the upgraded objects only where the current thumbnail undersells the 3D model.
- [x] Verify dimensions remain accurate and no new z-fighting appears.
- [x] Run focused lint/build and browser QA on desktop and `390px` mobile.
- [x] Update Linear with the realism pass and add the final review notes here.

## Review
- Upgraded the high-impact comparison objects in `src/components/scene/ComparisonObjects.jsx` without changing their configured dimensions: soccer field, basketball court, tennis court, parking space, sedan, Ford F-150, SUV, house, medium house, large house, and Olympic pool.
- Sports objects now have richer, deterministic canvas textures plus more real 3D cues: mow stripes and goals for soccer, hardwood planks/glass hoops for basketball, hard-court surfacing/net weave for tennis, and edge trim/base slabs to make the objects read from orbit view.
- Vehicles now use shared wheel geometry and stronger silhouettes with windows, lights, bumpers, mirrors, trim, fenders, and material contrast so scale reads more naturally beside houses and courts.
- Everyday objects now have more believable detail: asphalt grain and wheel stop for parking, pool coping/lane ropes/blocks/ladder/water highlight, and house roof ribs, gutters, chimneys, porches, windowsills, decks, solar-style roof details, and driveways.
- Compare panel thumbnails did not need a code change in this pass; the existing list labels/cards still match the object identities, and the biggest visual improvement is in the 3D placed models.
- Verification: `npm run build` passes, `git diff --check -- src/components/scene/ComparisonObjects.jsx tasks/todo.md` passes, desktop browser QA passed with ten active comparison objects in 3D, and `390px` mobile browser QA passed with no horizontal overflow.
- Focused ESLint for `src/components/scene/ComparisonObjects.jsx` is still blocked by the existing file baseline: unused legacy helpers/vars, hook-rule/compiler warnings, Fast Refresh export rules, and immutable `gl.domElement` writes. The realism pass did not try to refactor that large scene-file baseline.

---

# Restore Sports Marking Lines

## Todo
- [x] Confirm the reported regression: sports surface texture details are too faint/missing in 3D view.
- [x] Add raised physical markings for soccer, basketball, and tennis so field/court lines remain visible independent of texture filtering.
- [x] Keep dimensions unchanged and avoid z-fighting by placing markings slightly above each surface.
- [x] Verify in the browser that restored raised markings render in the 3D scene.
- [x] Run focused build/diff checks and add review notes.

## Review
- Fixed the missing/faint sports markings by adding reusable raised surface-marking geometry: straight lines, rectangular markings, circles/arcs, and field spots.
- Soccer now has physical boundary lines, halfway line, center circle, center spot, penalty boxes, goal boxes, and penalty spots above the turf surface.
- Basketball now has physical boundary lines, half-court line, center circle, key boxes, free-throw circles, three-point arcs, and side segments above the hardwood surface.
- Tennis now has physical doubles boundary, singles sidelines, service lines, center service line, and baseline center marks above the hard-court surface.
- The configured object dimensions were not changed. Markings sit slightly above each surface so they do not disappear into texture filtering or z-fighting.
- Verification: `npm run build` passes, `git diff --check -- src/components/scene/ComparisonObjects.jsx tasks/todo.md` passes, and browser QA on `http://127.0.0.1:5173/` confirms the soccer markings are visibly restored in 3D. Basketball and tennis use the same raised marking helpers and were covered by the build/runtime check.

---

# Keep Site Visible Under Sports Overlays

## Todo
- [x] Confirm the visual problem from the screenshot: large sports comparisons cover the land/site surface when placed on top.
- [x] Make soccer, basketball, and tennis surface/base materials semi-transparent so the underlying site remains visible.
- [x] Keep raised markings, goals, hoops, and nets opaque enough to preserve scale readability.
- [x] Verify the local browser view after hot reload.
- [x] Run focused build/diff checks and document the result.

## Review
- Updated soccer, basketball, and tennis comparison surfaces so their base slabs and textured planes are semi-transparent overlays instead of opaque carpets over the land.
- Kept raised white markings, goals, hoops, and nets opaque so users still get crisp real-world scale cues.
- The site/dimension lines are now visible through the soccer field in the local 3D browser view while the field still reads as a soccer field.
- Verification: `npm run build` passes, `git diff --check -- src/components/scene/ComparisonObjects.jsx tasks/todo.md` passes, and browser QA on `http://127.0.0.1:5173/` confirms the site remains visible under the soccer comparison.

---

# Clean Sports Surface Marking Layers

## Todo
- [x] Confirm the new regression: semi-transparent sports overlays reveal duplicate baked texture markings beneath the raised 3D markings.
- [x] Remove baked white markings from soccer, basketball, and tennis textures so there is only one marking system.
- [x] Restore opaque sports surfaces so basketball and tennis look solid again.
- [x] Keep soccer as an opaque, distinct green field instead of trying to show the site through it.
- [x] Verify in the local browser and run focused checks.

## Review
- Reverted the semi-transparent sports-surface approach for soccer, basketball, and tennis.
- Removed the baked white court/field markings from their canvas textures so the raised 3D markings are the only visible line system.
- Restored opaque basketball and tennis surfaces. Soccer is also opaque again, with a more distinct turf green and darker turf edge trim so it reads as a soccer field rather than blending into the site grass.
- Verification: `npm run build` passes and `git diff --check -- src/components/scene/ComparisonObjects.jsx tasks/todo.md` passes. The local browser at `http://127.0.0.1:5173/` was refreshed and the WebGL canvas is healthy; screenshot capture timed out on the WebGL page.

---

# Keep Site Boundary Above Compare Objects

## Todo
- [x] Confirm the root cause: the land/site outline renders at nearly the same height as flat comparison objects, so a soccer field can cover it.
- [x] Add a high-priority 3D boundary rail for the land/site outline that renders above comparison surfaces.
- [x] Keep the soccer field solid/opaque and avoid returning to semi-transparent overlays.
- [x] Verify the local browser view, run focused build/diff checks, and update Linear.

## Review
- Added a raised 3D site boundary rail in `LandScene.jsx`, derived from the same land corners as the existing land fill/outline.
- The rail renders at `y=0.16`, above soccer/basketball/tennis comparison surfaces and their raised markings, so the site outline remains readable even when a large soccer field covers the land fill.
- The soccer field remains solid/opaque; this does not return to the semi-transparent overlay approach.
- Verification: `npm run build` passes, `git diff --check -- src/components/LandScene.jsx tasks/todo.md` passes, and the local browser at `http://127.0.0.1:5173/` was refreshed with a healthy WebGL canvas. Screenshot capture still times out on the WebGL page.

---

# Demo Stabilization Checkpoint

## Todo
- [x] Confirm scope: finish SIT-10 as the demo-ready checkpoint before adding new features.
- [x] Upgrade Vercel CLI from `54.5.0` to the latest available version.
- [x] Run the existing automated QA suite that protects the current demo path: floor-plan check, placement check, and production build.
- [x] Run browser QA on the live local app for desktop and mobile: first screen, agent, compare objects, land boundary visibility, and horizontal overflow.
- [x] Fix only demo-breaking regressions found during QA.
- [x] Update Linear `SIT-10` with stabilization status.
- [x] Prepare the current milestone for commit/push after verification.

## Review
- Upgraded Vercel CLI from `54.5.0` to `54.6.1`. The global install completed with a Node `v25` engine warning from one CLI dependency, but `vercel --version` and `npm view vercel version` both report `54.6.1`.
- Re-ran the current demo protection suite: `npm run qa:floor-plans:check`, `npm run qa:floor-plans:placement`, focused ESLint for the agent/minimap/QA files, and `npm run build` pass. The production build still only reports the existing large chunk warnings.
- Browser QA passed on desktop and 390px mobile for the first screen, Sitea Agent, Compare panel, sports comparisons, and horizontal overflow.
- Fixed the only demo-breaking regression found during QA: `LandPlot` now normalizes polygon points that may arrive as `{ x, y }` or `{ x, z }` before creating the Three.js land fill, outline, and raised boundary rail. This removes the mobile Compare `THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN` error without changing object placement behavior.
- Added `output/` to `.gitignore` so local browser QA screenshots stay out of the product commit.

---

# Production Deploy Verification

## Todo
- [x] Confirm the local git state is clean and the Vercel project link points at Sitea.
- [x] Deploy the pushed Sitea milestone to Vercel Production.
- [x] Inspect the production deployment result and alias/domain state.
- [x] Browser-check `sitea.live` for first screen, Sitea Agent, compare entry, and no obvious runtime errors.
- [x] Update Linear `SIT-10` with the production verification result.

## Review
- Production deploy completed on 2026-06-01 to `dpl_2wwJKBotzXisw59eH3V7R9NDYmfH`.
- New production URL: `https://sitea-haoaj8dlo-tien820-8406s-projects.vercel.app`.
- `vercel inspect` reports the deployment as `READY` and aliased to `https://sitea.live`, `https://sitea-one.vercel.app`, `https://sitea-tien820-8406s-projects.vercel.app`, and `https://sitea-tien820-8406-tien820-8406s-projects.vercel.app`.
- Build completed successfully on Vercel with the same existing large chunk warning as local builds.
- Live browser QA passed on desktop and 390px mobile: WebGL canvas renders, Sitea Agent welcome appears, Compare opens, Soccer can be selected, no horizontal overflow was detected, and no runtime console errors were captured.

---

# SIT-13 Require Sign-In For Saving

## Todo
- [x] Confirm the existing save behavior and the smallest safe change.
- [x] Change explicit Save so unsigned users are prompted to sign in before any "Saved" success state is shown.
- [x] After a successful sign-in, continue the pending Save into the existing Supabase project flow.
- [x] Keep signed-in Save and existing project auto-save behavior unchanged.
- [x] Polish Save button titles/status copy so users understand "Sign in to save" versus "Saved".
- [x] Verify with focused lint/build and browser QA for signed-out Save, auth prompt, and no layout overflow.
- [x] Update Linear `SIT-13` with shipped behavior and verification.

## Review
- Current root cause: `handleSave()` writes to `localStorage`, shows `Saved`, and only then opens auth for unsigned users. That violates the product rule that Save should require sign-in because the UI reports success before a cloud project exists.
- Planned fix: make explicit Save gate on `user` first, set a pending-save flag, open `AuthModal`, and run `saveProjectToCloud()` automatically once Supabase auth state is available. The change should stay in `src/App.jsx` unless verification reveals a small supporting copy/style tweak is needed.
- Implemented the save gate in `src/App.jsx`: unsigned Save now stores a temporary session pending-save payload, opens the auth modal, changes the Save label to `Sign in`, and waits for Supabase auth before calling the existing cloud save path.
- Signed-in Save and current project auto-save still use the existing `saveProjectToCloud()` flow.
- Updated `AuthModal.jsx` with save-specific copy when the modal is opened from Save: `Save project`, `Sign in to save`, and a short account-save explanation.
- Verification: `npx eslint src/components/AuthModal.jsx --format stylish`, `npm run build`, and `git diff --check` pass. `npx eslint src/App.jsx --quiet --format stylish` remains blocked by the existing App lint baseline of unused imports/helpers, with no new save-gate variables reported.
- Browser QA passed on desktop and 390px mobile for signed-out Save: auth opens with save-specific copy, no false `Saved` state appears, no normal `landVisualizer` local project save is written, pending session payload is created, closing auth clears the pending save, no horizontal overflow is detected, and no runtime console errors are captured.

---

# SIT-13 Production Deploy

## Todo
- [x] Confirm the pushed SIT-13 commit is the local HEAD and the Vercel project link points at Sitea.
- [x] Deploy SIT-13 to Vercel Production.
- [x] Inspect the production deployment and alias/domain state.
- [x] Browser-check `sitea.live` for signed-out Save requiring sign-in on desktop and mobile.
- [x] Update Linear `SIT-13` with production deployment and verification details.

## Review
- Production deploy completed on 2026-06-01 to `dpl_cztaBwuQXTBNqpTixb8KH7Xi9qqC`.
- New production URL: `https://sitea-ad84g7na3-tien820-8406s-projects.vercel.app`.
- `vercel inspect` reports the deployment as `READY` and aliased to `https://sitea.live`, `https://sitea-one.vercel.app`, `https://sitea-tien820-8406s-projects.vercel.app`, and `https://sitea-tien820-8406-tien820-8406s-projects.vercel.app`.
- Build completed successfully on Vercel with the same existing large chunk warning as local builds.
- Live browser QA passed on desktop and 390px mobile for signed-out Save: WebGL canvas renders, Save opens save-specific auth, the Save button label changes to `Sign in`, no false `Saved` state appears, no normal `landVisualizer` local project save is written, a temporary pending-save session payload is created, no horizontal overflow is detected, and no runtime console errors are captured.

---

# SIT-12 Server-Side Upload Quota

## Todo
- [x] Confirm the upload quota product rule: uploads should require sign-in so quota can be tied to a Supabase user.
- [x] Apply Supabase SQL for a server-owned upload quota table, RLS, explicit grants, and an atomic upload-credit consume function.
- [x] Add a Vercel API route for upload quota status and upload-credit consumption using the authenticated Supabase user.
- [x] Move `useUser.jsx` upload count/remaining state from `localStorage` authority to the server quota API.
- [x] Update upload entry points to use the server quota flow: Sitea Agent upload, Land panel, Build panel, Upload modal, and ImageTracer.
- [x] Enforce quota in paid server analyzers so `/api/analyze-floor-plan` and `/api/analyze-site-plan` cannot be bypassed by client changes.
- [x] Keep plan limits aligned with current pricing: free signed-in user `1`, monthly `3`, homeowner `20`, lifetime unlimited.
- [x] Verify Supabase SQL with test queries/advisors, focused lint/build, browser QA, and Linear `SIT-12` update.

## Review
- Current root cause: upload count is stored in `localStorage` through `useUser.jsx`, so users can reset or bypass usage locally. Multiple upload surfaces call `canUseUpload()` / `markUploadUsed()`, and Sitea Agent floor-plan upload currently reaches the paid analyzer without using those UI helpers.
- Supabase project discovered through MCP: `utudexexqnmaoohmnsmk` (`Tiienn's Project`). Current public tables are `floor_plan_corrections`, `projects`, `shared_scenes`, and `subscriptions`; no upload quota table exists yet.
- Supabase docs/changelog check: new/exposed tables need explicit grants plus RLS, and RLS policies should explicitly check `auth.uid() is not null` for authenticated-user rows.
- Proposed implementation choice: make upload quota a signed-in account feature. Anonymous users should be prompted to sign in before upload, because a trustworthy server-side quota cannot be tied to an unauthenticated browser without falling back to local-only state.
- Applied Supabase migration `server_upload_quota` to production project `utudexexqnmaoohmnsmk`: added `public.upload_usage`, RLS, explicit grants, and service-role-only `public.consume_upload_credit(uuid, integer)`.
- Applied follow-up migration `server_upload_quota_monthly_period`: monthly usage now resets by server-generated `monthly:YYYY-MM` period key, while free/homeowner/lifetime use `forever`.
- Added `/api/upload-quota` for authenticated quota reads and credit consumption; unauthenticated requests return `401 Authentication required`.
- Replaced localStorage upload authority in `useUser.jsx` with server quota state and removed the old `landVisualizerUploadCount` key.
- Upload surfaces now require sign-in and consume through the server quota flow: Sitea Agent site-plan upload, Land panel, Build panel, Upload modal, and ImageTracer.
- Paid analyzer endpoints now consume server-side quota too: `/api/analyze-floor-plan` and `/api/analyze-site-plan`.
- Floor-plan flows intentionally do not consume in the browser before the analyzer opens, avoiding double-counting; the analyzer endpoint is the source of truth for paid floor-plan analysis usage.
- Documented the server quota model, monthly reset model, and plan limits in `README.md`.
- Verification: Supabase RPC tested in rollback transactions for same-period blocking and next-period monthly reset, focused ESLint passed for new/changed server/API/upload files with one existing ImageTracer warning, `npm run build` passed, `/api/upload-quota` no-auth smoke returned 401, and the local app opened in the in-app browser with no console errors. Linear `SIT-12` was moved to In Review with implementation comments.

---

# SIT-12 Commit + Deploy

## Todo
- [x] Upgrade Vercel CLI from `54.6.1` to `54.7.1` and verify the installed version.
- [x] Re-run focused quota checks before release.
- [x] Commit and push the SIT-12 server quota changes.
- [x] Deploy the pushed changes to Vercel Production.
- [x] Verify the production deployment and update Linear `SIT-12`.

## Review
- Upgraded Vercel CLI from `54.6.1` to `54.7.1`. The global install emitted the existing Node `v25` engine warning from `@renovatebot/pep440`, but `vercel --version` verifies `54.7.1`.
- Release checks passed: focused ESLint for server quota/API/upload files reports only the existing ImageTracer hook warning, `npm run build` passes with existing large chunk warnings, `git diff --check` passes, and `/api/upload-quota` unauthenticated smoke returns `401 Authentication required`.
- Committed and pushed SIT-12 code as `00d94be Move upload quota to server` on `feature/simplified-onboarding`.
- Production deploy completed on 2026-06-02 to `dpl_8CT1SG3UaN1PPfWXFSfzeJ8SFCjf`.
- New production URL: `https://sitea-o0i87kco1-tien820-8406s-projects.vercel.app`.
- `vercel inspect` reports the deployment as `READY` and aliased to `https://sitea.live`, `https://sitea-one.vercel.app`, `https://sitea-tien820-8406s-projects.vercel.app`, and `https://sitea-tien820-8406-tien820-8406s-projects.vercel.app`.
- Live smoke checks passed: `https://sitea.live/` returns `200`, `https://sitea.live/api/upload-quota` returns `401 Authentication required` without a token, and browser QA shows Sitea Agent plus Compare content with zero runtime console errors.

---

# SIT-14 Expiring Public Share Links

## Todo
- [x] Confirm product defaults: new shared links expire after 30 days; existing legacy links with no expiration remain valid for backward compatibility.
- [x] Apply Supabase SQL for `shared_scenes.expires_at`, tighter grants, and RLS policies that only expose unexpired or legacy shared links.
- [x] Update `src/services/shareScene.js` so new links save/return `expires_at` and expired links fail with a friendly message.
- [x] Update the share UI in `src/App.jsx` to tell users when copied links expire and improve the expired-link error state.
- [x] Preserve existing `/s/:id` shared-scene restore behavior for valid links, including generated buildings from SIT-6.
- [x] Verify with Supabase test queries/advisors, focused lint/build, and browser QA for new share link copy plus expired-link handling.
- [x] Update Linear `SIT-14`, commit/push, and deploy to Vercel Production once local verification passes.

## Review
- Linear `SIT-14` scope: add `shared_scenes.expires_at`, apply Supabase SQL, set a default expiration period, reject expired links clearly, show expiration timing in the share UI, keep existing non-expiring links backward-compatible or choose a deliberate fallback, and pass `npm run build`.
- Current production `shared_scenes` columns are `id`, `created_at`, `scene_version`, and `scene_json`; there is no `expires_at` yet.
- Current production policies are public insert and public select. Current grants are broader than the app needs, so the migration should reduce anon/authenticated privileges to `SELECT, INSERT` while keeping service-role management.
- Current app code creates/fetches shared scenes directly through `src/services/shareScene.js`; `src/App.jsx` builds the `/s/:id` URL, copies it, and renders the shared-scene loading/error/read-only states.
- Supabase docs/changelog check: Data API access is controlled by explicit grants plus RLS; newly exposed tables/policies should keep grants and RLS bundled. RLS remains required on public-schema tables.
- Applied `sql/shared_scene_expiration.sql` to Supabase project `utudexexqnmaoohmnsmk`.
- Verified in rollback transactions that anonymous inserts receive a future default `expires_at`, and anonymous reads see valid shared rows but not expired shared rows.
- Tightened the public insert policy so shared links must expire within 30 days plus a 5-minute clock-skew cushion; verified anonymous 45-day inserts are blocked.
- Removed the unused `idx_shared_scenes_expires_at` index after Supabase performance advisor flagged it; current `shared_scenes` indexes are back to the primary key only.
- `src/services/shareScene.js` now writes `scene_version`, sets/returns `expires_at`, formats share expiration copy, fetches via `maybeSingle()`, and returns a friendly unavailable/expired response when the link cannot be loaded.
- `src/App.jsx` now shows expiration timing after copying a share link, improves the shared-link error title, and shows valid shared-link expiry timing in the read-only banner.
- Browser QA found the in-app browser can block clipboard writes after the link is created, so `src/App.jsx` now times out clipboard writes, falls back to textarea copy, and shows a recoverable `Ready` state with the created URL plus expiry when copy is unavailable.
- Browser QA with valid public Supabase config passed: share creation produced `Ready` with `Expires in 30 days`, valid `/s/:id` restore showed `Shared layout` and `view-only • Expires in 30 days`, and a missing/expired route showed `Shared link unavailable` with no console errors.
- Production smoke found direct `https://sitea.live/s/:id` requests returned Vercel `404`; added a narrow Vercel rewrite from `/s/:id` to `/index.html` so shared links load the SPA on first open/reload without affecting `/api/*`.
- Supabase security/performance advisors report no `shared_scenes` RLS/grant/index issue after cleanup. Remaining advisor warnings are pre-existing: `update_updated_at_column` search path, public `assets` bucket listing, leaked-password protection disabled, auth RLS initplan warnings, unindexed `floor_plan_corrections.user_id`, and subscription/index cleanup.
- Verification: `git diff --check` passes, `npx eslint src/services/shareScene.js --format stylish` passes, and `npm run build` passes with the existing large-chunk warning. `npx eslint src/App.jsx --format stylish` still fails on the pre-existing large-file baseline of unused imports/handlers and hook dependency warnings.
- Linear `SIT-14` was updated with implementation and verification notes before commit/push/deploy.
