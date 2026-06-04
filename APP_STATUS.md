# Sitea App Status

Last updated: June 4, 2026

Production: https://sitea.live

## Current Read

Sitea is demo-ready as an agent-led land and home visualization workspace. The first screen opens the 3D world with Sitea Agent available, so users can ask for help, upload a scanned plan, compare land to real objects, and move into 3D placement without a marketing landing page.

The current target audience is land buyers and homeowners. The product should feel simple, trustworthy, visual, and guided: the user talks to the agent, uploads a site plan or floor plan, then Sitea helps them understand scale and placement.

## Production State

| Area | Status | Notes |
|---|---|---|
| 3D workspace | Demo-ready | Land definition, 3D/2D/1P views, comparison objects, placement, exports, and mobile controls are active. |
| Sitea Agent | Demo-ready | Agent opens by default and can route site-plan and floor-plan uploads. |
| Floor-plan analysis | Demo-ready with review | OpenAI-first analyzer supports scanned PDFs/images and extracts walls, doors, windows, rooms, stairs, scale, and 3D placement data. |
| Site-plan analysis | Demo-ready | OpenAI vision extracts parcel boundary/dimensions for the land tracing flow. |
| Saved projects | Active | Save requires sign-in and stores projects through Supabase. |
| Sharing | Active | Public shared scenes are read-only and new links expire after 30 days. |
| Payments | Active | PayPal is verified on the server before subscription rows are written. |
| Upload quota | Active | Quota is enforced by server API/RPC, not localStorage. |
| Mobile | Demo-ready, keep testing | Main demo path is polished; continue mobile QA when touching dense panels or WebGL camera logic. |
| Lint baseline | Needs cleanup | Full `npm run lint` still includes legacy/generated-file findings. Focused lint is used for touched files until SIT-16. |

## Current Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| 3D | Three.js, React Three Fiber, Drei |
| Backend | Vercel Functions in `api/` |
| Auth/data | Supabase Auth and Postgres |
| Payments | PayPal checkout/subscriptions with server verification |
| AI | OpenAI-first chat, site-plan, floor-plan, and visualization APIs |
| Optional AI fallback | Gemini and Roboflow paths remain available for floor-plan analysis |
| Mobile shell | Capacitor |

## AI Pipeline Reality

Sitea uses OpenAI at runtime. The agent and site-plan APIs default to OpenAI models, and the floor-plan analyzer is OpenAI-first:

- Sitea Agent chat: `/api/ai-chat`, default `OPENAI_CHAT_MODEL=gpt-5-mini`
- Site-plan boundary detection: `/api/analyze-site-plan`, default `OPENAI_SITE_PLAN_MODEL` or `OPENAI_CHAT_MODEL`
- Floor-plan analysis: `/api/analyze-floor-plan`, default `OPENAI_FLOOR_PLAN_MODEL=gpt-5.2` and `OPENAI_IMAGE_MODEL=gpt-image-1.5`
- Optional fallback keys: `GEMINI_API_KEY`, `ROBOFLOW_API_KEY`

The floor-plan QA suite currently reports `3/3` synthetic demo-ready fixtures. Three real user-supplied fixtures are recorded as review-only samples and should be visually checked when analyzer or placement logic changes.

## Payments And Plans

PayPal payment flows are server-verified:

- Monthly subscription: `$9.99/month`, `3` uploads per calendar month
- Homeowner: `$20`, `20` uploads forever
- Lifetime: `$149`, unlimited uploads
- Free signed-in user: `1` upload forever

Required production secrets include `PAYPAL_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `PAYPAL_ENV=live`. Browser-exposed values use `VITE_` names where needed.

## Supabase State

The app expects Supabase Auth plus these public data surfaces:

- `subscriptions`
- `projects`
- `shared_scenes`
- `upload_usage`
- `floor_plan_corrections`
- `consume_upload_credit(...)`

Relevant SQL is in `sql/`. Recent readiness work hardened subscription writes, moved upload quota to the server, and added expiring shared links.

## Demo Path

1. Open https://sitea.live.
2. Use Sitea Agent to ask what can fit or upload a plan.
3. For a site plan, confirm/trace the land boundary and compare scale with a tennis court or other object.
4. For a floor plan, let the analyzer detect the structure and place the generated 3D building on the land.
5. Use 3D orbit for overview, 2D for precision, and 1P for walkthrough scale.
6. Sign in to save, then create a share link when ready.

## Known Gaps

- Full lint cleanup remains tracked separately by SIT-16.
- The 3D/build workspace is large and still has legacy code hotspots in `src/App.jsx` and `src/components/LandScene.jsx`.
- Real scanned plans should keep going through QA before analyzer prompt/CV changes ship.
- Generated floor-plan geometry can be busy when the analyzer intentionally over-segments walls to avoid missing structure.
- Mobile is good enough for the demo path, but any new modal, side panel, or camera flow needs fresh 390px viewport testing.

## Operational Notes

- Local dev: `npm run dev`
- Build: `npm run build`
- Focused lint: `npx eslint <files> --format stylish`
- Floor-plan QA check: `npm run qa:floor-plans:check`
- Vercel production deploy: install Vercel CLI with `npm i -g vercel`, then use `vercel deploy --prod`
- Shared links rely on the `/s/:id` rewrite in `vercel.json`
