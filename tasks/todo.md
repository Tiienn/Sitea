# ImageTracer Phase 2: Precision Tools

## Tasks

- [x] 1. Add Shift+Drag angle snapping (15° increments) with visual guide
- [x] 2. Add double-click edge to straighten (nearest H/V/45°)
- [x] 3. Add "Straighten" button to fix all near-H/V edges
- [x] 4. Update hint text with new controls
- [x] 5. Verify build passes (`npm run build`)

## Review

### Summary
Added 3 precision tools to ImageTracer.jsx. Single file change, ~80 lines added.

### Changes Made (all in `src/components/ImageTracer.jsx`)

**Shift+Drag Angle Snapping:**
- New state: `snapInfo` — stores anchor point + snapped angle for visual feedback
- New helper: `snapPointToAngle(anchorX, anchorY, targetX, targetY, snapDegrees)` — snaps to nearest 15° increment
- New helper: `snapToAngle(pointIndex, imgX, imgY)` — picks best snap relative to prev/next adjacent point
- Modified `handleMouseMove`: when Shift held during drag, snaps position + sets snapInfo
- Canvas draws teal dashed guide line from anchor to dragged point with angle label (e.g. "45°")
- `snapInfo` cleared on mouseUp, ESC, mouseLeave

**Double-Click Edge Straighten:**
- New handler: `handleDoubleClick` — finds nearest edge within 12px, snaps it to closest H/V/45° angle
- Keeps p1 fixed, moves p2 to maintain edge length at the snapped angle
- Target angles: 0°, ±45°, ±90°, ±135°, 180°
- Pushes undo history before straightening
- Wired to canvas `onDoubleClick`

**Straighten All Button:**
- New handler: `handleStraightenAll` — iterates all edges, straightens any within 10° of H or V
- Horizontal (within 10°): sets p2.y = p1.y
- Vertical (within 10°): sets p2.x = p1.x
- Pushes undo history before batch operation
- New "Straighten" button in action bar (between Clear and Done)

**UI:**
- Hint text updated: "Drag to adjust · Shift+drag to snap 45°/90° · Right-click to delete"
- Secondary hint: "Double-click edge to straighten · Ctrl+Z to undo"
