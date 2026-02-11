# Hybrid Floor Plan Detection: Roboflow CV + Claude Vision

## Plan
Use Roboflow's CubiCasa5K model to detect wall/door/window bounding boxes, then feed those hints into Claude's prompt for more accurate placement.

## Tasks

- [x] 1. Add `callRoboflow()` function (~35 lines)
- [x] 2. Add `formatRoboflowHints()` function (~55 lines)
- [x] 3. Insert Roboflow call before Claude API call
- [x] 4. Interpolate CV hints into Claude's user prompt
- [x] 5. Update logging to include CV metadata
- [x] 6. Verify build passes

## Review

### Changes — `api/analyze-floor-plan.js` only

**`callRoboflow(base64Image)` function:**
- POSTs base64 image to Roboflow CubiCasa5K endpoint
- 10-second timeout via AbortController
- Returns parsed JSON on success, `null` on any failure
- Gracefully skips if `ROBOFLOW_API_KEY` env var is not set

**`formatRoboflowHints(roboflowData)` function:**
- Filters predictions by class: wall, door, window
- Converts wall bounding boxes to approximate line segments (horizontal vs vertical based on aspect ratio)
- Formats doors/windows as center + bbox dimensions
- Returns formatted text block or empty string if no data

**Handler changes (2 lines + prompt interpolation):**
- Calls `callRoboflow()` before the Claude API call
- Passes formatted hints into Claude's user prompt between the opening line and the existing instructions
- Updated logging to include `cvHintsUsed` and `roboflowDetections` count

**Deployment verified:**
- `cvHintsUsed: true`, `roboflowDetections: 25`
- 15 walls, 4 doors, 6 windows, 6 rooms detected (L-shaped)
- End-to-end time: 22.48s (within 60s budget)
- Roboflow + Claude pipeline working correctly

---

## Capacitor Setup (Mobile App)

### Plan
- [x] Install @capacitor/core and @capacitor/cli
- [x] Initialize capacitor.config.ts (appId: live.sitea.app, appName: SiteA, webDir: dist)
- [x] Install and add @capacitor/ios and @capacitor/android platforms
- [x] Add convenience scripts to package.json
- [ ] Test on iOS Simulator (requires Mac with Xcode)
- [ ] Test on Android Emulator (requires Android Studio)
- [ ] Configure app icons and splash screens
- [ ] Set up Apple Developer Account ($99/year)
- [ ] Set up Google Play Developer Account ($25 one-time)
- [ ] Submit to Apple App Store
- [ ] Submit to Google Play Store

### Review
Summary of what was set up:
- Capacitor wraps the existing React web app in native iOS/Android shells
- Web app builds to dist/ folder, Capacitor syncs it to native projects
- iOS project in /ios folder, Android project in /android folder
- Use `npm run cap:build` to build web + sync to native
- Use `npm run cap:open:ios` or `cap:open:android` to open in IDE
- Next steps: Need Mac with Xcode for iOS builds, Android Studio for Android builds

---

## First Success Moment (FSM) — Guided Onboarding

### Plan
First-time users get a locked guided flow: prebuilt 3-bedroom house auto-spawns, camera starts outside front door, user walks inside, then full UI unlocks with action buttons. Returning users (localStorage flag) see normal app.

### Tasks
- [x] 1. Create `src/data/houseTemplate.js` — 7 walls (4 exterior + 3 interior), land dims, camera start, house bounds
- [x] 2. Create `src/components/GuidedOnboarding.jsx` — Step-based overlay (Welcome → Walk → Inside → Unlock)
- [x] 3. Modify `src/App.jsx` — Guided state, auto-start, handlers, inside detection, UI hiding
- [x] 4. Modify `src/components/LandScene.jsx` — `initialCameraPosition` prop for camera override
- [x] 5. Verify build passes

### Review

**`src/data/houseTemplate.js` (new):**
- 12×10m house with 4 exterior walls (south has door, others have windows) + 3 interior walls creating living area, bedroom 1, bedrooms 2+3
- `FSM_LAND`: 30×25m lot
- `FSM_CAMERA_START`: Position outside front door facing entrance
- `FSM_HOUSE_BOUNDS`: 1m inset from walls for inside detection

**`src/components/GuidedOnboarding.jsx` (new):**
- 4-step overlay using existing design system (panel-premium, btn-primary, CSS variables)
- Step 1: Full-screen welcome with "Start Walkthrough" + skip link
- Step 2: Bottom floating "Walk inside" prompt with bouncing arrow
- Step 3: Center "You're inside!" card, auto-advances after 4s
- Step 4: Action card with 3 buttons: "Make it yours" / "Upload floor plan" / "Change land size"

**`src/App.jsx` changes:**
- Added `guidedStep` state (0=off, 1-4 = steps) and `isGuidedMode` derived flag
- First-time detection: checks `localStorage.getItem('fsmCompleted')` in existing init useEffect
- `startGuidedFlow()`: sets 30×25 land, loads FSM walls via clearWallsHistory, sets firstPerson view
- Inside detection: useEffect watches cameraState.position against FSM_HOUSE_BOUNDS when step=2
- `handleGuidedComplete(action)`: sets fsmCompleted flag, routes to build panel / upload modal / land definition
- UI hiding: navigation ribbon, CTA card, view controls, compass, help text, walkthrough all hidden via `!isGuidedMode` conditions
- Onboarding blocked during guided mode

**`src/components/LandScene.jsx` changes:**
- Added `initialCameraPosition` prop to both outer wrapper and inner Scene
- Camera init useEffect: when prop provided, sets position and lookAt before normal init logic
- Passed through from outer to inner Scene component
