# Improve Floor Plan 3D Preview — Richer Rendering

## Goal
When a user uploads a floor plan, the 3D preview should show stairs, door openings, bathroom fixtures, furniture, and textured floors — not just plain wall boxes.

## Current State
- `FloorPlanPreview3D.jsx` (169 lines) renders **plain wall boxes only**
- `WallSegment.jsx` (main scene) already has: door frames, window frames, opening cuts
- `RoomFloor.jsx` (main scene) already has: textured floors (wood, tile, carpet, marble)
- API already returns: walls, doors, windows, rooms, stairs — but preview ignores most of it

## Plan (ordered by impact)

### Phase 1: Use existing rendering in preview
- [ ] **1.1 Door/window openings in walls** — Cut openings where doors/windows are detected instead of rendering solid wall boxes. Reuse logic from WallSegment.jsx.
- [ ] **1.2 Textured room floors** — Render floors with room-type-appropriate textures (wood for living room, tile for bathroom/kitchen). Reuse RoomFloor.jsx patterns.
- [ ] **1.3 Room labels** — Show room names on the floor

### Phase 2: Add 3D objects
- [ ] **2.1 Stairs** — Render detected stairs as stepped geometry (API already returns stair positions)
- [ ] **2.2 Basic furniture by room type** — Place simple 3D shapes:
  - Bathroom → toilet, sink, bathtub/shower
  - Kitchen → counter, sink
  - Living room → sofa, coffee table
  - Bedroom → bed, nightstand
- [ ] **2.3 Better wall materials** — Different colors for interior vs exterior, slight roughness

## Files to Edit
- `src/components/FloorPlanPreview3D.jsx` — main changes
- `src/utils/floorPlanConverter.js` — pass more data through
- May need new simple furniture component file

## Constraints
- Use basic Three.js geometries, no external 3D model files
- Don't break existing main scene rendering
- Preview should load fast
