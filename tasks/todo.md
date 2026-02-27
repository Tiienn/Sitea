# Simplified Onboarding — Landing Hero

## Plan

Replace the complex FSM-based GuidedOnboarding with a dead-simple landing hero overlay that gets users to the "wow moment" in under 10 seconds.

### Tasks

- [ ] **1. Create `src/components/LandingHero.jsx`**
  - Fullscreen overlay with dark glass style (panel-premium, CSS vars)
  - Headline: "Can't picture how big your land is?"
  - Subline: "Type in any size and walk through it at real scale."
  - Number input with sqm/sqft toggle
  - Big "Explore in 3D" CTA button (btn-primary)
  - Preset chips: 449 m² (standard plot), 1000 m², 3000 m², 1 acre
  - Small text: "No signup. No download. Free forever."
  - Calls `onExplore({ sizeM2 })` prop when user clicks Explore or a preset
  - Follows DESIGN.md spacing/padding rules

- [ ] **2. Modify `src/App.jsx`**
  - Import LandingHero
  - Show LandingHero when `!userHasLand && !isReadOnly` and fsmCompleted not set
  - Change the FSM init useEffect: instead of `setGuidedStep(1)`, keep guidedStep at 0 — LandingHero takes over
  - Add `handleLandingExplore({ sizeM2 })` handler that sets dimensions, marks land as user's, drops into first-person, enables basketball + tennis court comparisons
  - Comparison IDs: `basketballCourt` and `tennisCourt` (camelCase)

- [ ] **3. Update `index.html` meta tags**
  - Title: "Sitea — Visualize Your Land in 3D"
  - Description: "Can't picture how big 449 sqm is? Type any land size and walk through it at real scale. Free, no download, no signup."
  - Update OG + Twitter tags to match

- [ ] **4. Build verification** — run `npm run build`

- [ ] **5. Run completion event**
