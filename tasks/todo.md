# Fix Accidental Object Drag During Camera Control

## Plan
- [x] 1. Create `src/utils/pointerUtils.js` with shared `getDragThreshold` function
- [x] 2. ComparisonObjects.jsx — Add first-person early return + pointer-type-aware threshold
- [x] 3. BuildingComponents.jsx — Add first-person early return + pointer-type-aware threshold
- [x] 4. RoomFloor.jsx — Add first-person early return + pointer-type-aware threshold
- [x] 5. LandScene.jsx building groups — Add first-person early return + threshold-based drag
- [x] 6. Run `npm run build` to verify no errors

## Review

### Changes Made

**Change 1: Disabled object interaction in First-Person mode**
- All four components now early-return from `handlePointerDown` when `viewMode === 'firstPerson'`
- ComparisonObjects.jsx also skips cursor change in `onPointerEnter` for first-person mode

**Change 2: Pointer-type-aware drag thresholds**
- Created `src/utils/pointerUtils.js` with `getDragThreshold(pointerType)` — returns 20px for touch, 8px for mouse
- All drag handlers now store `pointerType` from the event and use dynamic thresholds
- This prevents accidental object drags on mobile where touch jitter is common

### Files Modified
1. `src/utils/pointerUtils.js` — NEW: shared threshold utility
2. `src/components/scene/ComparisonObjects.jsx` — first-person check + dynamic threshold
3. `src/components/scene/BuildingComponents.jsx` — first-person check + threshold-based drag confirm
4. `src/components/scene/RoomFloor.jsx` — first-person check + dynamic threshold
5. `src/components/LandScene.jsx` — building groups: first-person check + threshold-based drag

### What Was NOT Changed (per spec)
- PolygonRenderers.jsx (pools, foundations, stairs, furniture) — out of scope
- No "Edit Mode" toggle added
- No changes to selection highlight or drag mechanics once drag is confirmed
- Change 3 (removing stopPropagation from pointerDown) was not implemented — the spec said to evaluate after Changes 1+2
