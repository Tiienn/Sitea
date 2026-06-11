# Floor-plan walkthrough — doors, room labels, morning light

Status: ready-to-build
Created: 2026-06-11

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
- [ ] Walking toward a single door opens it before contact; it closes after passing; double doors open both leaves
- [ ] Door sound plays on open (audible with sound on, silent when muted)
- [ ] Entering a named room shows "«name» · «area» m²" chip for ~3 s; unnamed shows "Room · «area» m²"
- [ ] Entering a hand-drawn room and a floor-plan building room both trigger the chip
- [ ] "☀ Morning light" button appears only while inside a room, in Walk mode, on desktop and mobile widths
- [ ] Tapping it as a FREE user visibly warms the light over ~1.5 s; Reset restores prior light
- [ ] Ambient sound audibly muffles indoors, restores outdoors
- [ ] No console errors; eslint clean on changed files; `npm run build` passes
- [ ] 3D orbit view shows closed door panels, no animation; 2D mode visually unchanged
- [ ] No per-frame React re-renders introduced (chip state changes only on room enter/exit)

## Open questions
None — all forks resolved in the interview (doors swing on approach; HUD chip labels; button-triggered light, free included; all walls/rooms; light-touch sound; "Room · m²" fallback; tour deferred to its own spec).
