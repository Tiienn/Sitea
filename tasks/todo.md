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
- [ ] Pricing simplification: single $20 one-time Pro; remove subscription + lifetime
- [ ] Curate default comparison panel; hide DXF/GLB from primary export UI

Not code (Tien, weekly, ~2 h): the listing-visualization post loop per spec section 5 — Facebook land groups + r/mauritius. Starts before the build queue finishes; first post can use manual screenshots.

### v1 reset docs Review
- New product spec at specs/v1-reset-mauritius.md, written from the 2026-06-12 founder interview: zero users, Mauritius-first wedge ("see exactly how big that land really is, before you visit it"), pre-purchase land buyer persona, side-project economics (goal ≈ $200–300/month), distribution loop as the roadmap, 90-day kill criteria, and a freeze list.
- PRD.md rewritten as v4.0 around the reset; old v3.0 content superseded (its history is in git). README.md and APP_STATUS.md updated to match — both keep all operational content and honestly mark the deployed 3-tier pricing as "until the pricing-simplification task lands" so docs never contradict production.
- tasks/todo.md history (2,684 lines) archived to tasks/todo-archive-2026-06.md; IOS-SETUP.md moved to docs/frozen/ (Capacitor frozen, Apple account not renewed); docs/competitive-analysis.html deleted (duplicate of the .md).
- Frozen, not deleted: open-world/Genshin direction, building-editor depth, Capacitor shells, DXF/GLB in primary UI, subscription billing, analyzer investment. Code stays; work stops.
- Next: product build queue above, one small task at a time. Items 1–4 (analytics, deep links, Mauritian units, share image) are the launch-critical ones.

## Archive

Completed plans and reviews through June 2026 live in tasks/todo-archive-2026-06.md.
