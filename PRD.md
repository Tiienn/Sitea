# Sitea Product Requirements

Document version: 4.0 (v1 reset)
Last updated: June 12, 2026
Status: Pre-launch — zero users; everything below serves getting the first 100
Source of truth for the reset: `specs/v1-reset-mauritius.md` (founder interview, 2026-06-12)

## 1. Product Summary

**Sitea — see exactly how big that land really is, before you visit it.**

Sitea turns a quoted land size ("80 perches, Flacq") into a physical feeling in under 15 seconds: see the plot in 3D, drop a house and two cars on it, walk it in first person, and decide whether the site visit is worth the drive.

The origin insight: people browsing land listings cannot picture what 2000 m² or 5 toises feels like, so they burn half a day on a site visit to find out. Sitea makes the feeling available from the listing, so buyers choose *which* visits to make. It does not replace the visit for the plot they buy — it filters the rest.

## 2. Target User and Market

**Primary (the only persona v1 ships for):** the Mauritian pre-purchase land buyer, scrolling listings on Facebook (also LexpressProperty and WhatsApp forwards from agents), who reads a size in toises/perches/arpents and has no feeling for the number.

**Why Mauritius first:** local units no global tool speaks, a buy-land-then-build housing culture that makes "will a house fit?" a mainstream question, and channels (Facebook land groups, Reddit r/mauritius, agents) the founder can physically reach. Mauritius-first is a wedge, not a ceiling — the product works anywhere.

**Secondary (paid, not optimized for):** the build planner with a floor plan who wants to walk the future house. They fund the project through the Pro tier; v1 does not invest further in them.

**Explicitly not now:** global SEO audiences, interior designers, CAD professionals, agents-as-users (until agents pull for it).

## 3. Product Principles

- **Distribution is the product.** Every feature is judged by whether it helps a stranger go from a Facebook/Reddit post to feeling a plot's size in under 60 seconds. The weekly listing-visualization post loop (spec §5) is the roadmap; features serve it.
- **Instant, anonymous, mobile.** The core flow needs no sign-in, no onboarding wall, and must work on a phone — that's where listings are read.
- **Visual proof over explanation.** Show the land, the comparisons, the walk.
- **Local credibility.** Toise/perche/arpent conversions must be exactly right. One wrong factor and Sitea is a toy.
- **Side-project economics.** Goal is a few hundred USD/month with ~2 h/week of marketing and near-zero maintenance. No feature that needs babysitting. Costs scale only with paying users.
- **Trustworthy state.** Paid access, upload quota, saves, and shares stay backed by server/Supabase state.

## 4. The Core Flow (v1)

1. Buyer hits a Sitea deep link (from a post or share) or the homepage.
2. The plot is already there (deep link) or they type a size — m², **toise, perche, arpent**, ft², acre, hectare.
3. One tap adds comparisons (car, bus, tennis court, football pitch, typical 3-bedroom house, parking).
4. One tap drops a house template — "does a 3-bedroom with parking fit?"
5. First-person walk: the existing avatar/footsteps/footprints experience is how a body understands 2000 m².
6. One-tap export of a branded, Facebook-ready share image with the size callout and `sitea.live`.
7. Sign-in only for saving; Pro ($20 one-time) only for floor-plan upload and unlimited saves.

## 5. Functional Requirements

### Instant land visualization (free, anonymous)
- Size input front and center; units include toise/perche/arpent with sourced exact factors.
- Deep links (`sitea.live/?s=80perche` style) load straight into the scene — no modal, no onboarding.
- Rectangle/templates/custom polygon and site-plan upload remain, but the typed-size path is primary.
- 3D orbit, 2D top-down, and first-person walk.

### Comparisons
- Curated default set, locally meaningful, surfaced first; the long tail stays available but not as a wall of 40 thumbnails.
- Draggable, rotatable, legible from minimap and 3D.
- Agent can add a comparison from chat.

### Share loop
- Branded share-image export composed for Facebook posts (plot + comparisons + size callout + URL).
- Read-only share links, expiring after 30 days, friendly expired state.
- Analytics ON in production: scene loads, deep-link loads, unit used, share exports, walk entries, Pro purchases.

### Sitea Agent
- Open by default, accepts text/image/PDF, routes site plans vs floor plans, explains what it did, offers one-tap visual actions. (Maintained, not expanded, in v1.)

### Floor-plan import (Pro)
- Accept images and scanned PDFs; detect walls/doors/windows/rooms/scale; place as a walkable 3D preview.
- OpenAI-first; no further analyzer investment (fallback chains, QA-harness expansion) until ≥10 Pro sales/month demand it.

### Payments and quota
- PayPal verified server-side before access; Supabase stores plans and upload usage; quota enforced server-side.

| Plan | Price | Includes |
|---|---:|---|
| Free | `$0` | full visualizer, walk, share image; sign-in adds 1 saved project + 1 upload |
| Sitea Pro | `$20` one-time | 20 floor-plan uploads, unlimited saved projects, time-of-day control |

The `$9.99/month` subscription and `$149` lifetime tiers are **removed** (subscription plumbing is maintenance a side project can't afford; two prices is one too many at zero volume).

## 6. Frozen (code stays, zero new work)

- Open-world/Genshin direction (NPCs, quests, terrain expansion). Shipped polish (avatar, footprints, doors, audio) stays because it serves the walk.
- Building-editor depth: walls/doors/windows/stairs/roof/pool/fence panels. Templates cover the v1 question.
- Capacitor iOS/Android shells. Web/PWA only; the Apple developer account is not renewed.
- DXF and GLB export in the primary UI (code kept; PNG and PDF stay).
- Subscription billing.
- Floor-plan analyzer investment beyond keep-it-running.

## 7. Success Criteria and Kill Criteria

The 90-day clock starts at the first public post (Facebook group or r/mauritius).

- Week 4: ≥10 posts published (2 real listings visualized per week).
- Day 90: ~1,000 scene loads from Mauritius · ≥50 share images exported by users · ≥10 Pro purchases (~$200/month run-rate = goal met).
- Kill/pivot: if 10 honest posts produce <100 scene loads, the channel/moment hypothesis is wrong. The response is the agent channel (conversations, not code) — never "more features."

## 8. Technical Requirements

- Vite app on Vercel; `VITE_` for browser-exposed vars, secrets server-only.
- OpenAI default provider; Supabase migrations in `sql/`; QA scripts repeatable from `package.json`.
- Prefer focused, low-risk changes — `src/App.jsx` and `src/components/LandScene.jsx` remain large legacy hotspots.

## 9. Non-Goals

- Competing globally with Planner 5D / Floorplanner / HomeByMe on features or SEO
- Interior design and furniture libraries
- CAD replacement, building-code compliance, construction drawings
- Agent portal/dashboard (until agents ask with their wallets)
- Stripe, multi-user collaboration

## 10. References

- Reset spec and distribution loop: `specs/v1-reset-mauritius.md`
- Current status: `APP_STATUS.md`
- Operator setup: `README.md`
- Running work log: `tasks/todo.md`
- Competitive context: `docs/competitive-analysis.md`
