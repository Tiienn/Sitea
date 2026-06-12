# Realistic avatar — mocap motion, intact worker, camera feel

Status: approved
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
- [x] Third-person shows the intact realistic worker (helmet + vest, no see-through gaps) — screenshot (`tp-idle-intact-worker.jpg`)
- [x] Walk and run are visibly mocap-natural (feet planted, arm swing) — screenshot mid-stride (`tp-walk-midstride.jpg`, `tp-run-midstride.jpg`)
- [x] Jump plays a real jump animation: screenshot mid-air shows a jumping pose, not a frozen idle (`jump-arc-1/2/3` — takeoff, tucked-knees apex, landing; player y telemetry 1.65→2.43→1.88)
- [x] S shows backward-walk animation; A/D show strafe animations (`tp-walkback.jpg`, `tp-strafe-left/right.jpg`)
- [x] Sprint eases FOV wider and back (camera.fov telemetry: 60 → 65.87 while sprinting → 60.13 after stop)
- [x] Third-person camera sits slightly over the right shoulder and follows with smooth lag (camera x = player x + 0.35 in telemetry; walking camera trails target by ~0.14 m; framing visible in all TP screenshots)
- [x] Avatar row absent from View panel with a single registry entry; adding a second (dev test) shows the row and switching + reload persists via localStorage (`view-panel-avatar-row.png`; localStorage `siteaAvatar` = `visitor-b` survived reload; stale-id fallback to first entry also verified)
- [x] Quaternius GLB removed; bundle/public has no orphan model files; ATTRIBUTION updated
- [x] No console errors; eslint clean; `npm run build` passes (0 console errors across the full QA session incl. the broken-model test)
- [x] Footsteps, step counter, breadcrumbs, door-walkthrough features all still work in a quick regression walk (HUD "18 steps · 13 m"; breadcrumb dots visible behind the walking avatar; footstep audio fires off the same stride accumulator — code-verified only, headless browser can't unlock Web Audio; door/room systems untouched by this diff and read the same playerPos plumbing verified live)

## Open questions
None — direction locked in interview: intact worker restored (realistic-only lineup), registry for future user-provided Mixamo exports, camera feel polish included.

## Build notes
Shipped in 3 commits (`fa41318` feature core, `58215fd` asset cleanup, plus the QA-fix commit). What shipped matches the spec; structure highlights:

- `src/constants/avatars.js` — registry + `getSelectedAvatar()`/`setSelectedAvatar()` + a `useAvatar()` hook (useSyncExternalStore on a custom window event). The hook lets App's View panel and the deep-in-Canvas player mesh share selection without threading a prop through Scene's ~150-prop signature.
- `AnimatedPlayerMesh` is split into `PackAvatar` (restored 13-clip Supabase loader from `15a03cc^`: jump/turn90s LoopOnce + clampWhenFinished, hips X/Z lock, walk/run timeScale matching) and `EmbeddedAvatar` (findClip-by-suffix, nearest-clip fallbacks) because hook counts can't vary per registry entry. Shared mixer/crossfade driver in `useAvatarAnimation`. Model rendered as authored — castShadow only.
- Camera: shoulder offset is applied to both the follow target and look target along camera-right, eased 0→1 over 0.5 s on TP entry; sprint FOV (60→66, λ=4 damp) keys off ground speed only and skips `updateProjectionMatrix()` below 0.01 deltas; a `useEffect` restores fov 60 if walk mode is exited mid-sprint (frame loop stops, so the ease-back can't finish on its own).

Deviations / findings:
- **z-order fix in App.jsx**: with ≥2 avatars the taller View panel slid under the Pro time slider (`zIndex: 10`), which intercepted clicks on the Avatar row. Added `z-20` to the desktop View panel (mobile counterparts already use `z-30`). This pre-existing collision could already occur on short viewports without the avatar row.
- Avatar row uses a `sitea-segment` (one-tap per spec) — comfortable at 2 entries; if the registry ever grows past ~3 or labels get long, switch to the `select-premium` row pattern.
- `scripts/qa-shot-server.mjs` (new, dev-only): tiny localhost receiver that saves in-page canvas captures to `tasks/screenshots/` — needed because the embedded preview suspends rAF when backgrounded, so QA ran through Playwright + trusted key events instead.
- Footstep audio is code-verified only (headless browser can't unlock Web Audio); worth a 10-second listen on a real machine.

Screenshots: `tasks/screenshots/realistic-avatar/` (idle/walk/run/jump-arc ×3/walkback/strafes, view-panel-avatar-row.png, broken-avatar-no-crash.jpg, final-regression-walk.jpg).

## Review — 2026-06-12
Verdict: approved

### Verified
- Spec compliance: diffed all three build commits (`fa31418`→`79a719d` range); every in-scope item implemented, no silent omissions; the two additions beyond spec (View-panel `z-20`, `scripts/qa-shot-server.mjs`) are justified and documented in Build notes. Out-of-scope items untouched (no NPC/speed/physics changes, no new assets).
- Intact worker in TP — `review-tp-idle.jpg` (helmet + vest, shadow, framed left-of-center by the shoulder offset).
- Mocap walk vs sprint + FOV ease — `review-walk.jpg` vs `review-sprint-fov.jpg`: distinct gaits and visibly wider field at sprint; `review-back-to-walk.jpg` confirms fov restores after an orbit round-trip mid-walk (the reset effect path).
- Sprint + jump simultaneously — `review-sprint-jump.jpg`: airborne jump pose, FOV stays keyed to ground speed (spec edge case).
- Stale localStorage id (`ghost-avatar`) — `review-stale-id-tp.jpg`: falls back to first registry entry and renders; HUD still counts steps after reload.
- Single-entry config — Avatar row absent on desktop panel and in the mobile View Settings sheet (`review-mobile-sheet.png`: Dimensions/Grid/Quality only, no layout change at 375 px).
- Code pass: mixer cleanup on unmount, stable hook deps (memoized `clips`, module-const `PACK_ONE_SHOTS`), `useSyncExternalStore` snapshot returns stable references, jump re-trigger via `reset()` matches the original, hips lock restored, no debug leftovers (QA instrumentation was added and fully removed pre-commit).
- eslint 0 errors (36 warnings, all the file's pre-existing `react-hooks/immutability` camera-mutation pattern); `npm run build` passes; 0 console errors across the review session.

### Findings
- [minor] src/components/LandScene.jsx:99 — SilentErrorBoundary never resets `hasError`, so after a broken avatar model 404s, switching back to a healthy avatar leaves the player invisible until reload. Unreachable in v1 (row hidden); fix when a second avatar ships, e.g. key the boundary by avatar id so it remounts on switch.
- [minor] src/components/scene/AnimatedPlayerMesh.jsx:141-155 — the 13 `useGLTF` calls suspend sequentially (network waterfall on first third-person entry). Matches the restored original per spec, but `useGLTF.preload()` of the pack URLs at module scope would parallelize and warm the cache before TP entry.
- [minor] src/components/scene/AnimatedPlayerMesh.jsx:186 — EmbeddedAvatar maps a found `Jump` clip without LoopOnce/clampWhenFinished, so a future embedded avatar with a real jump clip would loop it mid-air. Pass one-shot names for the embedded path when a true jump clip exists.
- [minor] scripts/qa-shot-server.mjs:14 — `name` from the query string is unsanitized; `..%2F` escapes the output dir. Dev-only and manually started, but `name.replace(/[^\w-]/g, '_')` closes it.
- [minor] src/App.jsx Avatar segment — three+ entries or long labels make the segment cramped (visible in the QA screenshot with 3 test entries); at >2 entries switch the row to the `select-premium` pattern used by Quality.

### Fixes applied — 2026-06-12 (post-review, user-approved)
Findings 1–4 fixed and verified in-browser (finding 5 deferred — switching to a select at >2 entries would contradict the spec's one-tap switching and is unreachable in v1):
1. `PlayerMeshWithBoundary` in LandScene keys the SilentErrorBoundary by avatar id — verified live: broken avatar → boundary trips → switch back to Site visitor → player returns with no reload (`review-fix-recovered-after-switch.jpg`).
2. `useGLTF.preload` for the pack clips + pack model URLs — verified: all 14 GLB fetches now start within 1 ms and complete in ~0.7 s (previously a sequential suspension waterfall).
3. EmbeddedAvatar applies LoopOnce/clampWhenFinished to a real `Jump` clip (idle fallback still loops).
4. qa-shot-server sanitizes the `name` query param to `[\w-]`.
