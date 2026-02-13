# Post-Onboarding Soft Upgrade Banner

## Plan
Add a subtle floating banner at bottom-center for free users, 30s after onboarding. Nudges them to upload their floor plan. Dismissable with localStorage persistence.

## Tasks

- [x] 1. **App.jsx** — Add `showProBanner` state, 30s timer useEffect, dismiss/click handlers, auto-hide effects
- [x] 2. **App.jsx** — Render banner JSX at bottom-center with mobile positioning
- [x] 3. **App.jsx** — Add analytics tracking (shown/clicked/dismissed)
- [x] 4. **Verify** — `npm run build` passes

## Review

### Changes Made

**`src/App.jsx`** — ~60 lines added, no other files changed

**State:**
- `showProBanner` state, default `false`

**Logic (useEffects + handlers):**
- Timer useEffect: 30s delay after `userHasLand` becomes true, only for free users who haven't dismissed or uploaded
- Auto-hide useEffect: hides banner when upload modal/floor plan generator opens, or when user upgrades to Pro
- `dismissProBanner()`: hides + sets `sitea_proBannerDismissed` in localStorage (permanent)
- `handleProBannerClick()`: hides banner, opens `showUploadModal`

**Analytics:**
- `pro_banner_shown` — fires when banner appears
- `pro_banner_clicked` — fires when user clicks banner text
- `pro_banner_dismissed` — fires when user clicks X

**Banner JSX:**
- Floating at bottom-center, `z-40`, `animate-slide-in-bottom`
- Teal house icon + "Have your own floor plan? See it in 3D →"
- X dismiss button (subtle, white/30 opacity)
- Mobile: `bottom-20` (clears joystick/nav), Desktop: `bottom-6`
- `backdrop-blur-md`, rounded-xl, border — matches app design system

### Behavior Rules Implemented
- Only free users (double-check: `!isPaidUser` in render + useEffect guard)
- localStorage permanent dismiss
- Only after onboarding (`userHasLand` check)
- Auto-hides on upload/upgrade
- 30s delay
- Not shown if `hasUsedUpload`
- Not shown if `isReadOnly`
- Non-blocking (not a modal)
