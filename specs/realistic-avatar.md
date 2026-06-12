# Realistic avatar — mocap motion, intact worker, camera feel

Status: ready-to-build
Created: 2026-06-12

## Summary
Replace the blocky low-poly player character with the realistic Mixamo human the project already owns, restored intact (helmet + vest — no hidden meshes, no holes), driven by its full 13-clip motion-capture set so movement finally feels human: a real jump instead of a frozen straight pose, a natural walk instead of a robotic keyframe loop, true backward/strafe/turn motion. Add the third-person camera tricks (follow lag, shoulder offset, sprint FOV) that make game characters feel alive, and an avatar registry so future Mixamo exports drop in with zero code changes.

## User story
As a Sitea visitor walking my land, I want my character to move like a real person in a real game, so the walkthrough feels like actually being there instead of steering a toy.

## Background (why the current one fails)
- Current avatar is the Quaternius "Casual Character" (low-poly, CC0): user verdict — "looks like a block, walks like a robot, jumps straight, doesn't feel real".
- Its `jump` is mapped to the **idle** clip (the character freezes mid-air), and walk/run are stylized keyframe loops.
- The project's Supabase assets bucket already hosts a realistic Mixamo character (`character.glb`) plus 13 separate mocap clips: idle, walk, run, **jump**, walkback, strafe ×4, turn ×4 (all on the `mixamorig1:` rig). This was the original avatar; it was replaced only because hiding its helmet/vest meshes exposed missing geometry. Shown intact, it is a complete realistic human — and a hard-hat site visitor fits a land app.

## Happy path
1. User enters Walk mode and zooms out to third person: a realistic construction-site visitor (helmet, vest — fully intact) stands on the land.
2. W to walk: natural mocap walk cycle, feet matching ground speed (true 1.6 m/s). Shift: mocap run, and the camera FOV eases slightly wider (~60→66) while sprinting, back when stopping.
3. Space: a real jump animation plays through takeoff/air/landing (no frozen pose).
4. S walks backward with the mocap backward clip; A/D strafe with the proper strafe clips.
5. In third person the camera follows with a subtle lag and sits slightly over the right shoulder instead of dead-center — turning and stopping feel weighty, not glued.
6. The choice infrastructure: avatars are declared in one registry array (name, model URL, clip source). With one avatar registered, no UI appears. When a second is added (e.g. a user-exported Mixamo character dropped into the registry), an "Avatar" row appears in the View panel with one-tap switching, persisted per device (localStorage).

## Scope
### In
- Restore `character.glb` + the 13-clip Supabase animation pack as the default avatar, fully intact (no mesh hiding, no material edits)
- Correct moveType → clip mapping: jump→jump, walkback→walkback, strafe/straferight→strafe clips, straferun→run-strafes, turns→turn clips where CameraController emits them
- Avatar registry (`src/constants/avatars.js`): `{ id, label, modelUrl, clipSource: 'pack' | 'embedded' }`; AnimatedPlayerMesh reads the registry entry; selection persisted in localStorage (`siteaAvatar`)
- View panel "Avatar" row — rendered only when the registry has ≥2 entries (hidden in v1)
- Third-person camera feel: follow lag tune, ~0.35 m right-shoulder offset (lerped in/out so it doesn't snap), sprint FOV ease 60→66 with `updateProjectionMatrix()`
- Remove the Quaternius character file + its ATTRIBUTION entry (registry keeps support for `embedded` clip sources for future characters)
### Out (explicitly)
- New character assets (user may export more from Mixamo later; registry is the drop-in point)
- Avatar customization (skin/outfit colors), Ready Player Me integration
- First-person body/hands rendering
- NPC changes (the procedural architect NPCs stay as-is)
- Changing walk/run speeds or physics (embodiment constants stay)

## UX details
- Desktop & mobile: identical scene behavior; FOV ease applies in both FP and TP while running.
- View modes: Walk only (avatar invisible in 3D orbit and 2D as today). Camera polish applies to Walk's first/third person.
- Free vs Pro: everything free.
- Audio/HUD: unchanged (footsteps, step counter, breadcrumbs keep working — they key off movement, not the mesh).

## Technical approach
- `src/constants/avatars.js` (new): registry array; first entry `{ id: 'visitor', label: 'Site visitor', modelUrl: '<SUPABASE>/character.glb', clipSource: 'pack' }`. Read selected id from localStorage with fallback to first entry.
- `src/components/scene/AnimatedPlayerMesh.jsx` — accept the registry entry: for `clipSource: 'pack'`, load the 13 clip GLBs from the Supabase `ASSET_BASE` (the pre-Xbot loading code in git history at commit `15a03cc^` is the reference — restore it, including hips X/Z lock and walk/run timeScale matching); for `embedded`, use the current findClip-by-suffix path. NO mesh hiding/material traversal hacks — render the model as authored (castShadow only).
- `src/components/scene/CameraController.jsx` —
  - shoulder offset: in TP branch, offset the look target & camera laterally by `0.35 * smoothFactor` along camera-right; lerp the factor 0→1 over ~0.5 s when entering TP so it doesn't pop.
  - sprint FOV: track a target fov (66 when `currentSpeed > WALK_SPEED * 1.2`, else 60), `THREE.MathUtils.damp` each frame, call `camera.updateProjectionMatrix()` only when |delta fov| > 0.01.
  - follow lag: keep existing lerp but lower the positional catch-up slightly (tune by feel, ~FOLLOW_SMOOTH 0.1 → 0.08) so stops/starts read weighty.
- `public/models/` — delete `character-casual.glb`; update `ATTRIBUTION.md` (keep file: note Mixamo character/anims hosted on Supabase under Adobe's Mixamo license, registry may host CC0 GLBs later).
- Persistence: localStorage only; no save/share payload changes.
- Performance: identical to the original pre-Xbot setup (13 GLB fetches happen once, drei caches; mobile unchanged). FAST/BEST irrelevant (no quality gating on the avatar).

## Edge cases
- A registry entry's model fails to load (404/offline) → drei Suspense keeps the old behavior (player mesh absent) but the app must not crash; controls/HUD keep working. Verify by pointing a dev-only entry at a bad URL.
- localStorage has a stale avatar id (entry removed) → fall back to first registry entry.
- Switching avatar mid-walk (future, ≥2 entries) → mixer/actions rebuilt cleanly; no orphaned mixers (cleanup already in useEffect return).
- Jump pressed repeatedly → jump clip uses LoopOnce + clampWhenFinished (as the original code did); re-trigger on each takeoff; landing crossfades back to locomotion.
- Sprint FOV + jump simultaneously → FOV logic keys off ground speed only; no conflict.

## Acceptance criteria
- [ ] Third-person shows the intact realistic worker (helmet + vest, no see-through gaps) — screenshot
- [ ] Walk and run are visibly mocap-natural (feet planted, arm swing) — screenshot mid-stride
- [ ] Jump plays a real jump animation: screenshot mid-air shows a jumping pose, not a frozen idle
- [ ] S shows backward-walk animation; A/D show strafe animations (screenshots)
- [ ] Sprint eases FOV wider and back (verify via `camera.fov` logging or visual screenshot comparison)
- [ ] Third-person camera sits slightly over the right shoulder and follows with smooth lag (screenshot framing)
- [ ] Avatar row absent from View panel with a single registry entry; adding a second (dev test) shows the row and switching + reload persists via localStorage
- [ ] Quaternius GLB removed; bundle/public has no orphan model files; ATTRIBUTION updated
- [ ] No console errors; eslint clean; `npm run build` passes
- [ ] Footsteps, step counter, breadcrumbs, door-walkthrough features all still work in a quick regression walk

## Open questions
None — direction locked in interview: intact worker restored (realistic-only lineup), registry for future user-provided Mixamo exports, camera feel polish included.
