# Code Review - Land Visualizer

**Date:** January 7, 2026
**Reviewed Commits:** 1ecafa3, 441edaa, d64702b, 3355182, 378dde6
**Reviewer:** Claude

---

## Executive Summary

This is a well-structured 3D land visualization app built with React and Three.js (React Three Fiber). The recent commits show solid bug fixes and feature improvements. Overall code quality is good, with some areas that could benefit from refactoring.

**Overall Grade: B+**

---

## Positives ✅

### 1. Good Problem Identification and Fixes
The camera jump fix (1ecafa3) correctly identified the root cause - the camera useEffect was re-running during room drawing. The solution using a `cameraInitialized` ref is clean and minimal.

```javascript
// src/components/LandScene.jsx:3379
const cameraInitialized = useRef(false)
```

### 2. Consistent Code Style
The codebase maintains consistent patterns:
- Component organization is logical
- Props are well-defined
- State management follows React best practices

### 3. Well-Documented Task History
The `tasks/todo.md` file provides excellent documentation of past changes, making it easy to understand design decisions.

### 4. Clean SVG Icons Update
Replacing emojis with SVG icons in BuildPanel.jsx improves consistency and accessibility:

```javascript
// src/components/BuildPanel.jsx - Before
<span className="text-lg">🏠</span>

// After
<span className="w-5 h-5">{Icons.room}</span>
```

### 5. Good Use of Three.js Features
The 3D comparison objects (Pool3D, CarSedan3D, House3D) demonstrate good understanding of Three.js geometry and materials.

---

## Areas for Improvement ⚠️

### 1. **Critical: LandScene.jsx is Too Large (5014 lines)**

This file has grown significantly and handles too many responsibilities. It contains:
- Camera controllers
- 30+ 3D object components (Pool3D, CarSedan3D, House3D, etc.)
- Wall/Room/Building renderers
- Event handlers
- Preview components

**Recommendation:** Extract into smaller modules:
```
src/components/
├── LandScene.jsx (main orchestrator, ~500 lines)
├── scene/
│   ├── CameraController.jsx
│   ├── comparison/
│   │   ├── Pool3D.jsx
│   │   ├── CarSedan3D.jsx
│   │   ├── House3D.jsx
│   │   ├── BasketballCourt3D.jsx
│   │   └── index.js
│   ├── building/
│   │   ├── Wall3D.jsx
│   │   ├── RoomFloor.jsx
│   │   └── BuildingPreview.jsx
│   └── ...
```

### 2. **Unused Import Detected**

In Pool3D, the texture is no longer used after the latest refactor:

```javascript
// src/components/LandScene.jsx:1661 (HEAD commit)
function Pool3D({ obj }) {
  // texture variable was removed but usePoolTexture might still be called elsewhere
  const poolDepth = 2
```

The `usePoolTexture` hook was being used but the texture material was replaced with a solid color box. Verify if the hook is still needed.

### 3. **Magic Numbers**

Several hardcoded values without explanation:

```javascript
// src/components/LandScene.jsx
const groundClearance = 0.12  // What unit? Why this value?
const totalHeight = 1.4       // Sedan height assumption
const beltLine = 0.65         // Window sill height

// Consider:
const SEDAN_HEIGHT_M = 1.4  // Average sedan height in meters
const WINDOW_SILL_HEIGHT_M = 0.65  // Belt line height
```

### 4. **Prop Drilling in Scene Component**

The Scene component has 50+ props, which is a code smell:

```javascript
// src/components/LandScene.jsx:3373
function Scene({ length, width, isExploring, comparisonObjects = [], polygonPoints,
  placedBuildings = [], selectedBuilding, selectedBuildingType, onPlaceBuilding,
  onDeleteBuilding, joystickInput, lengthUnit = 'm', onCameraUpdate, buildingRotation = 0,
  snapInfo, onPointerMove, setbacksEnabled = false, setbackDistanceM = 0,
  placementValid = true, overlappingBuildingIds = new Set(), labels = {},
  canEdit = true, analyticsMode = 'example', cameraMode, setCameraMode, ...
})
```

**Recommendation:** Group related props into objects:
```javascript
function Scene({
  landConfig,        // { length, width, polygonPoints, labels }
  buildingState,     // { placedBuildings, selectedBuilding, ... }
  cameraConfig,      // { cameraMode, setCameraMode, followDistance, ... }
  editConfig,        // { canEdit, activeBuildTool, ... }
  ...
})
```

### 5. **Duplicated FEET_PER_METER Constant**

The constant is defined in two places:

```javascript
// src/constants/landSceneConstants.js:80
export const FEET_PER_METER = 3.28084

// src/components/LandScene.jsx:3303 (inside RoomFloor)
const FEET_PER_METER = 3.28084
```

Use the imported constant consistently.

### 6. **Missing Error Boundaries**

The 3D scene has no error boundaries. If a component crashes (e.g., invalid geometry), it could take down the entire app.

```jsx
// Recommendation: Wrap Canvas in error boundary
<ErrorBoundary fallback={<Canvas3DError />}>
  <Canvas>
    <Scene {...props} />
  </Canvas>
</ErrorBoundary>
```

### 7. **Performance: useMemo Dependencies**

Some useMemo hooks have large dependency arrays that could cause unnecessary recalculations:

```javascript
// src/components/LandScene.jsx:3388
const overlappingComparisonIds = useMemo(() => {
  // Heavy computation
}, [comparisonObjects, comparisonPositions, comparisonRotations])
```

Consider memoizing individual object bounds separately.

---

## Potential Bugs 🐛

### 1. **Possible Memory Leak in CameraController**

Event listeners are added but may not be fully cleaned up:

```javascript
// src/components/LandScene.jsx:180-190
useEffect(() => {
  // Event listeners added...
  return // Cleanup function exists but verify all listeners removed
}, [enabled, orbitEnabled])
```

Ensure `lockPointer`, `onPointerLockChange`, `onMouseMove` are all properly removed.

### 2. **Race Condition in Camera Initialization**

```javascript
// src/components/LandScene.jsx:3378-3379
const cameraInitialized = useRef(false)
// Later in useEffect...
if (cameraInitialized.current) return
cameraInitialized.current = true
```

The ref check and set are not atomic. In React 18 concurrent mode, this could theoretically allow the effect to run twice. Low risk but worth noting.

---

## Security Considerations 🔒

1. **API Key Exposure**: The `ANTHROPIC_API_KEY` is used server-side in `/api/analyze-floor-plan.js` - good, it's not exposed to the client.

2. **Image Processing**: Floor plan images are processed server-side. Ensure file size limits are enforced to prevent DoS.

---

## Recommendations Summary

| Priority | Item | Effort |
|----------|------|--------|
| High | Extract LandScene.jsx into smaller modules | Large |
| Medium | Group Scene component props | Medium |
| Medium | Add error boundaries around Canvas | Small |
| Low | Clean up unused texture code in Pool3D | Small |
| Low | Consolidate FEET_PER_METER constant | Trivial |
| Low | Add comments for magic numbers | Small |

---

## Fixes Applied ✅

The following issues from this review have been addressed:

| Issue | Status | Details |
|-------|--------|---------|
| Duplicated FEET_PER_METER constant | **Fixed** | Removed local definition in RoomFloor, using imported constant |
| SQ_FEET_PER_SQ_METER missing from constants | **Fixed** | Added to `landSceneConstants.js` |
| Unused usePoolTexture hook | **Fixed** | Removed 45 lines of dead code |
| Missing error boundary | **Fixed** | Added `Canvas3DErrorBoundary` component |
| Group Scene component props | **Deferred** | Large refactor - risk of introducing bugs |
| Extract comparison objects | **Deferred** | Large refactor - would move ~2000 lines |

**Commit:** `3068071` - Fix code review issues: constants, unused code, error boundary

---

## Conclusion

The codebase is functional and the recent bug fixes were well-executed. The main architectural concern is the size of `LandScene.jsx` at 5000+ lines - this should be the top priority for future refactoring to improve maintainability.

The team has done good work documenting changes in `tasks/todo.md`. Keep up this practice!

