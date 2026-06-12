# Full Sitea Discovery, Product Questions, and Linear Issue Plan

## Active Plan: v1 reset — Mauritius wedge (interview 2026-06-12, specs/v1-reset-mauritius.md)

Approved by Tien 2026-06-12 ("GO" — also posting on r/mauritius).

Docs:
- [x] Rewrite PRD.md around the reset: Mauritian pre-purchase land buyer, "feel the land before you drive there", one $20 Pro tier, freeze list, distribution loop as roadmap
- [x] README.md: update positioning paragraph + pricing section to match (keep all operational/setup content)
- [x] APP_STATUS.md: add reset note, mark frozen subsystems (Capacitor, building-editor depth, analyzer investment, subscription billing)
- [x] Archive this todo.md history (266 KB) to tasks/todo-archive-2026-06.md; keep only the active plan
- [x] Move IOS-SETUP.md to docs/frozen/ (Capacitor frozen; don't renew Apple dev account)
- [x] Delete docs/competitive-analysis.html (duplicate of the .md)

Product (small tasks, in spec order):
- [x] Enable + verify analytics in production (VITE_ANALYTICS_ENABLED) — wired track() to a Supabase analytics_events sink; **Tien must run sql/analytics_events.sql in the Supabase SQL editor**, then events flow on the next deploy
- [x] Deep-link scene loading (?s=80perche style) — extends the existing ?size= path; parses number+unit, lands straight on the plot with comparisons on and the agent chat closed; landing_loaded now tracks mode 'deeplink' + unit
- [x] Mauritian units: toise / perche / arpent — 1 arpent = 4220.87 m², 1 perche = 42.2087 m², 1 toise = 3.7987 m² (propertymap.mu, decordier-immobilier.mu, fody.mu); area readouts display the deep-linked unit
- [ ] Branded Facebook-ready share-image export
- [x] Launch promo: Pro free for everyone (user request 2026-06-12) — FREE_LAUNCH flag in useUser.jsx unlocks time-of-day + premium comparisons + requirePaid paths; server free upload cap 1 → 20 per signed-in user keeps AI costs bounded; flip the flag to restore the paywall
- [ ] Pricing simplification: single $20 one-time Pro; remove subscription + lifetime (PricingModal still exists for anyone who insists on paying during the promo)
- [ ] Curate default comparison panel; hide DXF/GLB from primary export UI

Not code (Tien, weekly, ~2 h): the listing-visualization post loop per spec section 5 — Facebook land groups + r/mauritius. Starts before the build queue finishes; first post can use manual screenshots.

### Launch Review (2026-06-12)
- `feature/open-world-genshin` fast-forwarded into `main` (41 commits) and pushed; Vercel git integration auto-built and **production is live at sitea.live** with the deep links, Mauritian units, and the analytics sink.
- `sql/analytics_events.sql` executed on production Supabase (via the dashboard SQL editor): table + index + RLS insert-only policy created, "Success. No rows returned". Anon-key insert smoke test returned HTTP 201 — the exact path browsers use.
- Live proof: https://sitea.live/?s=80perches renders the plot with "80.0 perches" in the header. **Sitea is shipped; the first post can go out now.**
- Remaining build queue: branded share image, single $20 Pro tier, comparison curation + DXF/GLB hiding. Future work happens on `main`; the genshin feature branch is frozen per the reset.

### v1 reset docs Review
- New product spec at specs/v1-reset-mauritius.md, written from the 2026-06-12 founder interview: zero users, Mauritius-first wedge ("see exactly how big that land really is, before you visit it"), pre-purchase land buyer persona, side-project economics (goal ≈ $200–300/month), distribution loop as the roadmap, 90-day kill criteria, and a freeze list.
- PRD.md rewritten as v4.0 around the reset; old v3.0 content superseded (its history is in git). README.md and APP_STATUS.md updated to match — both keep all operational content and honestly mark the deployed 3-tier pricing as "until the pricing-simplification task lands" so docs never contradict production.
- tasks/todo.md history (2,684 lines) archived to tasks/todo-archive-2026-06.md; IOS-SETUP.md moved to docs/frozen/ (Capacitor frozen, Apple account not renewed); docs/competitive-analysis.html deleted (duplicate of the .md).
- Frozen, not deleted: open-world/Genshin direction, building-editor depth, Capacitor shells, DXF/GLB in primary UI, subscription billing, analyzer investment. Code stays; work stops.
- Next: product build queue above, one small task at a time. Items 1–4 (analytics, deep links, Mauritian units, share image) are the launch-critical ones.

## Active Plan: Comparison-object quality pass (user feedback 2026-06-12)

- [x] Basketball (BasketballCourt3D): rim was on the baseline side of the backboard (sign flip) — rim+net now 0.38 m in front of the board (basket center lands at FIBA's 1.575 m from the endline, matching the floor marking); shooter square moved to the court-facing face; frame behind the board; pole relocated outside the baseline (and raised so the arm connects); 3-pt straights at 0.9 m from sidelines with tangent-correct depth (2.99 m) and the arc clipped to meet them
- [x] Olympic pool (SwimmingPool3D): flicker = 3 transparent planes within 15 mm (water 0.08 / white lane planes 0.09 / shimmer 0.095) fighting in the transparent sort — now a single water plane with depthWrite off, and lane markings are opaque dark-navy lines on the pool bottom (one per lane center, like real pools); ropes/floats unchanged
- [x] House wall streaks: shadow acne (1024px map stretched over the 200 m shadow camera) — `shadow-normalBias={0.6}` on the sun light in LandScene; fixes all buildings/walls scene-wide. Verified clean at 2 m in walk mode (house-approach-4.png), shadows still grounded (no peter-panning)
- [x] Visual sweep: tennis, soccer, car, school bus, parking eyeballed in orbit — clean. Long tail (~30 landmark/gaming objects) not individually audited; revisit if a user shot looks off
- [x] eslint 0 errors, build passes; evidence in tasks/screenshots/compare-objects/

### Comparison-object quality pass Review
- Walk-mode QA done via headful Playwright (pointer lock fails headless; preview embeds can't send trusted keys) — approach choreography: deep link a small plot, JS-click panel buttons, trusted canvas click for pointer lock, relative mouse move to aim, WASD bursts with per-second screenshots.
- The shadow-acne fix is scene-global and the most visible quality win — every wall in every screenshot a user shares now renders clean.

## Archive

Completed plans and reviews through June 2026 live in tasks/todo-archive-2026-06.md.
