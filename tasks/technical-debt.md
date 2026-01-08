# Technical Debt - LandScene.jsx

## Deferred Refactoring

### 1. Scene Component Props Grouping
**Status:** Deferred
**Risk:** High - 100+ reference updates required
**Priority:** Low (works fine as-is)

The Scene component has 50+ props that could be grouped into logical objects:
```javascript
// Current
function Scene({ length, width, cameraMode, setCameraMode, ... })

// Proposed
function Scene({ landConfig, cameraConfig, buildConfig, ... })
```

Groups identified:
- `landConfig` - length, width, polygonPoints, labels
- `cameraConfig` - cameraMode, followDistance, viewMode, etc.
- `buildConfig` - activeBuildTool, walls, rooms, etc.
- `comparisonConfig` - comparisonObjects, positions, rotations

### 2. Extract Comparison Objects
**Status:** Deferred
**Risk:** Medium - Large move (~2000 lines), many imports
**Priority:** Low (works fine as-is)

30+ 3D components could be extracted to separate files:
```
src/components/scene/comparison/
├── Pool3D.jsx
├── CarSedan3D.jsx
├── House3D.jsx
├── BasketballCourt3D.jsx
├── TennisCourt3D.jsx
├── ShippingContainer3D.jsx
├── SchoolBus3D.jsx
└── index.js
```

---

## Completed Extractions ✅

| Component | Location | Lines Moved |
|-----------|----------|-------------|
| Constants | `src/constants/landSceneConstants.js` | ~170 |
| Grass hooks | `src/hooks/useGrassTextures.js` | ~50 |
| Environment | `src/components/scene/SceneEnvironment.jsx` | ~200 |
| Player/NPC | `src/components/scene/AnimatedPlayerMesh.jsx`, `NPCCharacter.jsx` | ~150 |
| Grid components | `src/components/scene/GridComponents.jsx` | ~100 |

---

## Recommendations

1. **Focus on features and bug fixes** - The current architecture works
2. **Tackle incrementally** - If touching a comparison object for a bug fix, extract it then
3. **Revisit when painful** - Only refactor when the complexity actively slows development

---

*Last updated: January 7, 2026*
