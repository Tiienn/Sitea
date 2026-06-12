# Floor-plan walkthrough — doors, room labels, morning light

Status: approved
Created: 2026-06-11
Built: 2026-06-12
Reviewed: 2026-06-12

## Summary
Make walking through a home on your land feel like visiting it: doors swing open as you approach, a label tells you which room you're in and how big it is, and one tap fills the room with morning light. This is the emotional payoff of the floor-plan upload flow — the moment a plan becomes "my future house".

## User story
As a homeowner who uploaded a floor plan (or drew rooms), I want to walk through the house and *feel* its rooms — see doors open for me, know each room's size, and preview the morning light — so I can judge whether this home works for me before it exists.

## Happy path
1. User has a building with walls/door openings on the plot (placed floor-plan building or hand-drawn rooms) and enters Walk mode.
2. User walks toward a doorway. Within ~1.5 m, the door panel swings open away from them (~0.4 s ease); after they pass and move ~2.5 m away, it eases closed.
3. A soft door sound plays on open (procedural, matching the existing audio style).
4. Crossing a room threshold fades a chip into the walk HUD: "Master bedroom · 16 m²" (named) or "Room · 14 m²" (unnamed). It fades out after ~3 s. Re-entering shows it again.
5. While the player is inside any room, a small "☀ Morning light" button appears next to the walk HUD. Tapping it eases timeOfDay to ~8 AM (≈0.27) over ~1.5 s — sun streams through windows. Works for free users too. Tapping again ("↺ Reset light") returns to the previous time.
6. While indoors, the ambient wind/birds gently muffle; stepping back outside restores them.

## Scope
### In
- Door panel meshes for door openings (single + double doors) with proximity swing animation in Walk mode
- Room entry/exit detection for both building rooms and hand-drawn rooms
- HUD room chip with name/fallback + area (m², respecting the user's unit setting if available)
- Morning-light button + transient time-of-day override (free users included)
- Procedural door sound; indoor ambience muffling
### Out (explicitly)
- Guided auto-tour camera path (separate spec)
- Furniture changes, window glass rendering changes
- Door interaction in 3D orbit / 2D modes (panels render statically there; no proximity animation)
- Multi-floor logic changes (current floor behavior stays as-is)
- Persisting door open/closed state in save/share payloads

## UX details
- Desktop: chip + button join the existing WalkStats HUD cluster (top-center); button is keyboard-reachable but mouse-first.
- Mobile: same HUD placement (top-center under the hint); button min 44px touch target; no layout shift when chip appears (reserve space or absolute overlay).
- View modes: animation + chip + button are Walk-mode only. Door panels are visible (closed) in 3D orbit view. 2D mode unchanged.
- Free vs Pro: morning-light works for free users via a transient override (DayNightController currently pins free users to t=0.35 — the override must win for the moment, then restore). After reset, a subtle one-line hint may suggest the Pro time slider (no modal, no nag).

## Technical approach
- `src/components/scene/WallSegment.jsx` — door panels: thin box mesh per door leaf, hinged at jamb (group pivot), single = 1 leaf, double = 2 leaves; swing angle animated in useFrame toward open/closed target based on player distance (player position via a shared ref to avoid re-renders).
- `src/components/scene/CameraController.jsx` or LandScene — expose `playerPosRef` (position already reported each frame via onPlayerPositionUpdate; add a ref alongside to read without re-render).
- New `src/hooks/useRoomPresence.js` (or small util) — throttled (~5 Hz) point-in-polygon test of player x/z against room polygons: hand-drawn `rooms` (world coords) and `buildings[].rooms` (building-local coords — apply building position/rotation transform). Returns current room {name, area} or null. Area via shoelace formula; reuse existing room polygon data; name from `roomLabels[room.id]` / analyzer-provided label, fallback "Room".
- `src/components/LandScene.jsx` — extend the WalkStats HUD cluster: room chip (fade in/out) + morning light button when `currentRoom != null`.
- Time override: new state `timeOverride` in App or LandScene; DayNightController uses `timeOverride ?? (isPaidUser ? timeOfDay : 0.35)`; button eases the override toward 0.27 (lerp in the controller, ~1.5 s) and Reset clears it (restoring prior behavior).
- `src/utils/ambientAudio.js` — add `playDoorSound()` (short filtered click/creak) and `setIndoor(bool)` (ease wind gain down / lowpass tighter while indoors).
- Performance: door proximity checks are O(doors) distance² comparisons per frame (cheap); room point-in-polygon throttled to 5 Hz; no new per-frame React state (refs + imperative updates, chip state changes only on enter/exit).

## Edge cases
- Player spawns inside a room (e.g., enters Walk while already over the footprint) → chip shows once on first detection.
- Overlapping/nested room polygons → innermost (smallest area) wins.
- Door at building edge with player approaching from outside the plot → same behavior.
- Two doors close together → each animates independently; sounds don't stack (≥150 ms min gap).
- Room with no polygon area (degenerate) → skip chip.
- Free user taps morning light, then opens nothing else → on leaving Walk mode the override clears and the pin to 0.35 returns.
- FAST quality: everything ships in FAST too (door panels are trivial geometry; no quality gating needed).

## Acceptance criteria
- [x] Walking toward a single door opens it before contact; it closes after passing; double doors open both leaves
- [x] Door sound plays on open (audible with sound on, silent when muted) — *code path verified; headless QA browser cannot play audio (see Build notes)*
- [x] Entering a named room shows "«name» · «area» m²" chip for ~3 s; unnamed shows "Room · «area» m²"
- [x] Entering a hand-drawn room and a floor-plan building room both trigger the chip
- [x] "☀ Morning light" button appears only while inside a room, in Walk mode, on desktop and mobile widths
- [x] Tapping it as a FREE user visibly warms the light over ~1.5 s; Reset restores prior light
- [x] Ambient sound audibly muffles indoors, restores outdoors — *wiring verified (setIndoor flips on enter/exit); audio inaudible in headless QA (see Build notes)*
- [x] No console errors; eslint clean on changed files; `npm run build` passes
- [x] 3D orbit view shows closed door panels, no animation; 2D mode visually unchanged
- [x] No per-frame React re-renders introduced (chip state changes only on room enter/exit)

## Build notes

**What shipped** (branch `feature/open-world-genshin`):
- `src/utils/ambientAudio.js` — `playDoorSound()` (filtered noise creak with rising bandpass + low sine thump, global ≥150 ms gap) and `setIndoor(bool)` (wind lowpass 380→160 Hz, gain 0.045→0.016, LFO depth eased over 0.8 s; bird chirps 0.035→0.01 while indoors).
- `src/components/scene/WallSegment.jsx` — `SwingDoor`: hinge-pivot leaf groups (1 leaf single, 2 leaves double) animated in `useFrame` with `THREE.MathUtils.damp` (~0.4 s feel), open at <1.5 m, close at >2.5 m (hysteresis), swing direction away from the player captured at open time via `worldToLocal` (works inside rotated building groups). Sliding/garage doors untouched. Static closed when not in walk mode.
- `src/hooks/useRoomPresence.js` — 5 Hz interval poll of the shared `playerPosRef`; hand-drawn rooms via point-in-polygon (innermost wins), floor-plan building rooms via nearest room center inside the building's wall bounding box (transformed to building-local coords); React state changes only on room enter/exit.
- `src/components/LandScene.jsx` — shared `playerPosRef` (written in the existing `onPlayerPositionUpdate` callback), `RoomPresenceHUD` (chip with 3 s fade + Morning light button, absolute row under the WalkStats pill at top:70 → zero layout shift; 44 px button), `timeOverride` state with 1.5 s eased rAF animation, free-user Pro-slider hint (4 s, one line) after reset, `setIndoor` wiring. `DayNightController` + `RealisticSky`/`NightStars`/`MountainSilhouettes`/`DistantTreeline` now use `timeOverride ?? (isPaidUser ? timeOfDay : 0.35)`; the Pro auto-cycle pauses while the override holds.

**Pre-existing bugs found and fixed (root causes, both predate this spec):**
1. `roomDetection.js` filtered walls by legacy `wall-`/`fsm-` id prefixes; commit `ebe31f2` switched ids to `crypto.randomUUID()`, silently breaking room detection (no rooms, no floors/labels) for all newly drawn walls. Filter now accepts any wall with an id and valid endpoints (`da93120`).
2. The wall-click door placement path (`onPlaceOpening`) dropped the selected `doorType`, so "Double"/"Sliding"/"Garage" doors placed by clicking a wall always became wide singles (`71d6747`).

**Deviations:**
- Building rooms carry only `center` + `area` (no polygons exist in the converter output), so building-room detection is nearest-room-center within the building footprint instead of the spec's point-in-polygon. Hand-drawn rooms use true polygons.
- The static center mullion on double doors was removed — the two swinging leaves replace it.
- Door sound + indoor muffling could not be heard in the headless QA browser (Web Audio requires a real user gesture; `AudioContext` stays suspended, the code no-ops safely). The code paths (open-transition trigger, 150 ms gap, mute early-return, indoor ramps) were verified by review and exercised without errors.
- Unit setting: chip area converts to ft² when `lengthUnit === 'ft'` (no separate area-unit plumbing exists in LandScene).

**Verification:** driven end-to-end in the dev preview (drawn 226 m² room + injected rotated floor-plan building): door swings both approach directions, double-door leaves, close-after-pass, chip text/fade timings (DOM opacity probes at 0.6 s/2 s/4.5 s), free-user morning light + reset + hint, mobile 375 px layout (button 50 px tall, cluster fits), 2D/orbit modes, 0 console errors. Screenshots: `tasks/screenshots/floor-plan-walkthrough/` (WebGL canvas captures; the DOM HUD layer is excluded by capture method — HUD verified via measured DOM geometry and inline preview screenshots).

## Open questions
None — all forks resolved in the interview (doors swing on approach; HUD chip labels; button-triggered light, free included; all walls/rooms; light-touch sound; "Room · m²" fallback; tour deferred to its own spec).

## Review — 2026-06-12
Verdict: approved

### Verified
- Spec compliance: diffed all four code commits (`a62f824`, `bb1c17a`, `da93120`, `71d6747`) line by line against the spec. Every in-scope behavior is implemented; everything in "Out" is untouched (no tour, no furniture/window changes, no orbit/2D door animation, no door-state persistence). The two out-of-spec fixes (room detection, doorType) are root-cause repairs of pre-existing bugs that blocked acceptance criteria, both documented.
- Door opens before contact, player passes through, closes beyond 2.5 m — fresh page, room built via the app's own `addWallFromPoints`/`addOpeningToWall`, walked from (0, 11.8) through the door at (0, 3) to (0.2, 0.0); position telemetry confirmed the doorway pass; build-phase screenshots 03/04/06/07/08 show open/closed states and the swing flipping direction with approach side.
- Room detection from a cold start — 4 UUID-id walls produced 1 detected room (the `da93120` fix working without prior state).
- Chip on entry through the door — DOM probe immediately after crossing: "Room · 48 m²" at opacity 1 (8×6 room = 48 m² exact); fades to 0 (timing exact in a focused tab; the headless tab throttles `setTimeout`, observed late fade is environmental).
- Spawn-inside edge case — entering walk mode while inside the polygon announced the room on first detection.
- Morning light (free user) — button label flips to "Reset light" while the eased override is active; canvas captures show the warmed sky; leaving walk mode with the override active and returning shows "Morning light" again (override cleared, free pin restored).
- 3D orbit shows closed static panels (review-02 screenshot); 2D mode renders flat symbols only (SwingDoor exists solely in the 3D branch).
- `npx eslint` on all five changed files: 0 errors (39 pre-existing warnings). `npm run build` passes. Browser console: 0 errors.

### Findings
- [minor] src/hooks/useRoomPresence.js:18 — hand-drawn room matching ignores `floorLevel`; on a multi-storey build, an upstairs room with the same footprint can win the innermost-area tiebreak while walking the ground floor. Walk mode is ground-level only, so filtering to `room.floorLevel === 0` (or preferring the lowest floor) would be correct. Multi-floor was explicitly out of scope, but the chip is new behavior that can mislabel there.
- [minor] src/components/scene/WallSegment.jsx (SwingDoor) — proximity distance uses local x/z only, so a door on an upper floor directly above the player would swing and play its sound. Low impact today (added floors are created without openings); guard by including the local y offset in the distance test.
- [minor] src/components/LandScene.jsx (setIndoor effect) — the cleanup-then-run on room→room transitions schedules an outdoor ramp and an indoor ramp in the same commit. Inaudible in practice; deriving a single `isIndoor` boolean as the effect dep (or `cancelAndHoldAtTime` in ambientAudio) would be cleaner.
- [minor] src/components/LandScene.jsx (toggleMorningLight) — a Pro user who drags the time slider while the override is active has that input discarded on Reset (restores the pre-tap time). Edge interaction not covered by the spec; consider hiding/disabling the slider while the override holds.
- [minor][pre-existing, out of scope] Floor-plan building walls have no walk-mode collision (CameraController only collides with the hand-drawn `walls` array), so players walk through building walls and the swinging doors there are cosmetic. Pre-dates this spec; worth its own task.

No blockers or majors. The minor findings are all in multi-floor or Pro-edge territory the spec scoped out; fine to ship and fold the first two into the next walkthrough iteration.
