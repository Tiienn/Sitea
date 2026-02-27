# New Entry Experience — Build Plan

Based on `sitea-entry-brief.md`. This is a new front door — the 3D tools, payments, auth all stay as-is.

---

## Tasks (Build Priority Order)

### Phase 1: Homepage
- [x] **1. Rewrite LandingHero** — Light background, mobile-first, new copy
  - Warm white (#FAFAF8) background, Outfit display font
  - "You can't picture 800m². Neither could we."
  - Pre-filled 800 input with m²/ft²/acres cycle toggle
  - "Show me →" CTA, now passes `{ sizeM2, unit }`

### Phase 2: Instant Visualization
- [x] **2. Create PlotReveal component** — 2D top-down plot to scale
  - SVG-based, instant rendering, no Three.js
  - 7-object comparison library with auto-select (one smaller, one larger)
  - Ratio text: "Your plot fits 1.9 basketball courts"
  - Staggered entrance animations

- [x] **3. Comparison auto-select logic** — built into PlotReveal

### Phase 3: Share
- [x] **4. Share image generation** — Canvas API, 1080x1080 PNG
  - Plot to scale, size label, comparison text, sitea.live branding

- [x] **5. Share button + link**
  - Mobile: native share sheet with image file
  - Desktop: copies URL to clipboard + downloads PNG
  - Share URL: `?size=800` — auto-triggers reveal on load

### Phase 4: 3D Handoff
- [x] **6. "Start designing in 3D →" CTA** — passes plot size to existing 3D scene

- [x] **7. App.jsx routing changes**
  - `landingStep` state: 'hero' → 'reveal' → null
  - `revealData` state: { sizeM2, unit }
  - URL param handling for `?size=` shared links
  - Back button: reveal → hero
  - PlotReveal imported (not lazy — it's lightweight)

### Phase 5: Polish
- [x] **8. Unit toggle with acres** — built into LandingHero (3-state cycle)

- [x] **9. Build verification** — `npm run build` passes

---

## Review

**Files changed:**
- `src/components/LandingHero.jsx` — Full rewrite. Light design, new copy, acres support.
- `src/components/PlotReveal.jsx` — **NEW.** 2D SVG visualization + share + 3D handoff.
- `src/App.jsx` — Added `landingStep`/`revealData` state, PlotReveal import, URL param handling, updated render flow.

**Architecture:**
- Flow: LandingHero (hero) → PlotReveal (reveal) → 3D scene (null)
- Three.js doesn't load until user clicks "Start designing in 3D"
- Share links (`?size=800`) skip the hero and go straight to reveal
- Back button from reveal returns to hero with no state loss
