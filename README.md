# Sitea

**Sitea — see exactly how big that land really is, before you visit it.**

Sitea turns a quoted land size ("80 perches, Flacq", "2000 m²") into a physical feeling in seconds: see the plot in 3D, drop a house and two cars on it, walk it in first person, and decide whether the site visit is worth the drive. Built first for Mauritian land buyers browsing listings (toise/perche/arpent units, Facebook-first distribution); works anywhere. Floor-plan upload and 3D walkthrough of a future house is the paid Pro feature.

Production: https://sitea.live

Product direction since June 2026: `specs/v1-reset-mauritius.md` (positioning, pricing reset, freeze list, distribution loop). `PRD.md` v4.0 reflects it.

## Demo Path

1. Open the app and keep the 3D world visible behind Sitea Agent.
2. Tell the agent what you want to see, or upload a site plan/floor plan image or scanned PDF.
3. For site plans, Sitea prepares the land workspace and can add a comparison object such as a tennis court.
4. For floor plans, Sitea extracts walls, doors, windows, rooms, stairs, and scale, then prepares a 3D building preview for review/placement.
5. Use the visual handoff actions from the agent to inspect the result in 3D, 2D, or first-person view.
6. Sign in before saving projects. Shared links are read-only and expire after 30 days.

Product rule: manual measuring, tracing, and drawing tools remain available for review and correction, but the default journey should be chat-first automation. Sitea should do the setup work and ask the user for confirmation only when the next decision needs human judgment.

## Stack

- Frontend: React 19, Vite 7, Tailwind CSS 4
- 3D: Three.js, React Three Fiber, Drei
- Backend: Vercel Functions in `api/`
- Auth/database: Supabase Auth and Postgres
- Payments: PayPal, verified on the server before subscriptions are saved
- AI: OpenAI-first agent, floor-plan, site-plan, and visualization APIs; Gemini and Roboflow remain optional floor-plan analyzer fallbacks
- Mobile shell: Capacitor (**frozen** since the June 2026 reset — web/PWA only; setup notes archived in `docs/frozen/IOS-SETUP.md`)

## Local Setup

```bash
npm install
npm run dev
```

Vite prints the local URL, usually `http://127.0.0.1:5173/`.

For a production-style build:

```bash
npm run build
npm run preview
```

## Environment Variables

Create `.env.local` for local browser/server development. Never commit real secrets.

Required for Supabase-backed auth, saving, sharing, subscriptions, and upload quota:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Required for Sitea Agent and OpenAI-first analyzers:

```bash
OPENAI_API_KEY=
```

Optional OpenAI model overrides:

```bash
OPENAI_CHAT_MODEL=gpt-5-mini
OPENAI_SITE_PLAN_MODEL=gpt-5-mini
OPENAI_FLOOR_PLAN_MODEL=gpt-5.2
OPENAI_IMAGE_MODEL=gpt-image-1.5
```

Optional floor-plan analyzer fallbacks:

```bash
GEMINI_API_KEY=
ROBOFLOW_API_KEY=
```

Required for PayPal payments:

```bash
VITE_PAYPAL_CLIENT_ID=
VITE_PAYPAL_MONTHLY_PLAN_ID=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MONTHLY_PLAN_ID=
PAYPAL_ENV=live
```

`PAYPAL_ENV` defaults to sandbox behavior unless set to `live`. The client ID and monthly plan ID are exposed to the browser through `VITE_` variables; `PAYPAL_CLIENT_SECRET` must only exist on the server/Vercel.

Analytics flags (enabled in production since the June 2026 reset):

```bash
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_DEBUG=false
```

Events are appended to the Supabase `analytics_events` table (`sql/analytics_events.sql` — insert-only RLS, read it from the Supabase SQL editor). Analytics is fire-and-forget and never blocks the app; if the table or env vars are missing, events are dropped silently.

## Scripts

```bash
npm run dev                      # start Vite
npm run build                    # build dist/
npm run preview                  # preview dist/
npm run lint                     # full ESLint scan; currently includes known legacy baseline issues
npm run qa:floor-plans           # summarize floor-plan QA results
npm run qa:floor-plans:check     # enforce demo-ready fixture thresholds
npm run qa:floor-plans:fixtures  # regenerate synthetic QA fixture PDFs
npm run qa:floor-plans:run       # run analyzer against QA fixtures; uses paid AI keys
npm run qa:floor-plans:placement # convert real QA outputs into a placement report
npm run cap:build                # build web assets and sync Capacitor
npm run cap:open:ios             # open iOS Capacitor shell
npm run cap:open:android         # open Android Capacitor shell
```

## Supabase SQL

Production Supabase migrations live in `sql/`:

- `create_floor_plan_corrections.sql`
- `harden_subscriptions_paypal.sql`
- `server_upload_quota.sql`
- `server_upload_quota_monthly_period.sql`
- `shared_scene_expiration.sql`

Apply them through the Supabase SQL editor or Supabase tooling before relying on payments, upload limits, project saves, or expiring share links. The app expects these public tables/RPCs:

- `subscriptions`
- `upload_usage`
- `projects`
- `shared_scenes`
- `floor_plan_corrections`
- `consume_upload_credit(uuid, integer, text)`

## Plans And Upload Limits

Upload quota is enforced on the server and tied to the signed-in Supabase user.

Currently deployed tiers (until the pricing-simplification task from `specs/v1-reset-mauritius.md` lands):

- Free signed-in user: `1` upload forever
- Monthly: `$9.99/month`, `3` uploads per calendar month
- Homeowner: `$20`, `20` uploads forever
- Lifetime: `$149`, unlimited uploads

Reset target: a single **Sitea Pro** `$20` one-time tier (20 uploads, unlimited saved projects, time-of-day). Monthly and Lifetime will be removed.

Floor-plan analyzer usage is consumed inside `/api/analyze-floor-plan`. Site-plan boundary analysis is consumed inside `/api/analyze-site-plan`. Local upload flows that do not call a paid analyzer consume through `/api/upload-quota`.

## PayPal Flow

- Monthly subscriptions use the browser PayPal subscription button and `/api/paypal-verify-subscription`.
- Homeowner and lifetime are one-time PayPal orders created by `/api/paypal-create-order` and captured by `/api/paypal-capture-order`.
- Server functions verify PayPal status, amount, currency, payer/order/subscription identifiers, and plan IDs before writing `subscriptions`.
- A valid Supabase auth token is required for payment API calls.

## Vercel Deployment

The project is configured for Vercel with `vercel.json`:

- framework: `vite`
- build command: `npm run build`
- output directory: `dist`
- function timeout for `api/*.js`: `120` seconds
- rewrite `/s/:id` to `/index.html` so shared links survive direct loads

Install the Vercel CLI when deployment or env inspection is needed:

```bash
npm i -g vercel
```

Useful commands:

```bash
vercel env pull .env.local
vercel deploy --prod
vercel logs https://sitea.live
```

Set production secrets in Vercel before deploying payment or AI changes.

## Known Demo Gaps

- Full `npm run lint` still has a legacy first-party/generated-file baseline; use focused lint checks for touched files until SIT-16 narrows the lint scope.
- The floor-plan QA suite passes synthetic demo-ready thresholds, but real scanned plans should still be reviewed visually for clean 3D placement.
- The OpenAI-first floor-plan analyzer can over-segment walls to avoid missed structure; this is preferable for detection completeness but can make generated geometry busier.
- Roboflow and Gemini are optional fallbacks, not required for the default OpenAI-first path.
