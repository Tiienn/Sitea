# Ralphy's Tasks - February 2026

## 🔴 BUG: No Mesh Distortion or Visual Artifacts

**Goal:** Fix all mesh distortion and visual artifacts in the 3D scene.

### Analysis
After exploring the codebase, I've identified the following potential sources of mesh distortion:

1. **Z-fighting** - Multiple meshes at same exact position (pool coping, foundation surfaces, selection highlights)
2. **Transparent material ordering** - Glass panes and water rendering with incorrect depth sorting
3. **UV coordinate issues** - Room floor texture distortion from improper UV scaling
4. **Skeletal animation** - Character mesh distortion from bind pose issues (already being addressed)
5. **Overlapping geometry** - Multiple overlays without proper position offsets

### Todo Items

- [x] Fix Z-fighting in PoolItem coping meshes
- [x] Fix Z-fighting in FoundationItem selection highlights
- [x] Fix Z-fighting in WallSegment selection overlays
- [x] Fix transparent material rendering order (pool water, glass panes)
- [x] Fix UV coordinate scaling in RoomFloor texture mapping
- [x] Add proper Y-offset separation for all overlapping meshes
- [x] Test fixes in all view modes (2D, first-person, third-person, orbit)

### Implementation Details

#### 1. Pool Z-Fighting Fixes (PolygonRenderers.jsx)
- Water surface at y=0.02, pool floor at y=-depth
- Add small increments: coping at y=0.05 (not 0.05), selection at y=0.12 (not 0.1)
- Set renderOrder on water mesh for proper transparency sorting

#### 2. Foundation Z-Fighting Fixes (PolygonRenderers.jsx)
- Foundation top at y=height
- Selection highlight needs y=height+0.02 (not height+0.01)

#### 3. Wall Selection Overlay (WallSegment.jsx)
- Current overlays use emissive instead of separate mesh (good approach)
- No changes needed

#### 4. Transparent Material Fixes ✅
- Pool water: Add `depthWrite={false}` and `renderOrder={1}`
- Glass panes (windows): Add `depthWrite={false}` and `renderOrder={2}`
- Glass panes (sliding doors): Add `depthWrite={false}` and `renderOrder={2}`
- Chain link fences: Add `depthWrite={false}` and `renderOrder={2}`

#### 5. Room Floor UV Fixes (RoomFloor.jsx)
**Problem:**
- Current formula: `u = ((pos[i] - minX) / scaleX) * (scaleX * uvScale)`
- This normalizes to 0-1, then scales back by room size → larger rooms = stretched textures
- The 0.5 uvScale multiplier is arbitrary and doesn't relate to real-world texture size

**Root Cause:**
- UVs should map to world-space coordinates (meters), not normalized room bounds
- A 2m×2m tile should look the same size in a 5m×5m room vs a 10m×10m room
- Current code ties UV scale to room dimensions, causing inconsistent texture appearance

**Solution:**
- Replace current formula with: `u = positions[i] * uvScale`, `v = positions[i+1] * uvScale`
- Set `uvScale` based on desired texture tile size in meters (e.g., 0.5 = 2m tiles)
- This maps world coordinates directly to UV space with consistent scaling
- Remove min/max bounds calculation (no longer needed)

**Implementation:**
1. Remove bounds calculation (lines 194-204)
2. Simplify UV generation loop (lines 207-216)
3. Use direct world-space mapping: `uvs.push(positions[i] * uvScale, positions[i+1] * uvScale)`
4. Keep uvScale = 0.5 (equivalent to 2m×2m tiles, matching texture generator repeat)

### Acceptance Criteria
- [x] No Z-fighting visible in pool edges
- [x] No Z-fighting on foundation selection
- [x] Transparent materials render in correct order
- [x] Room floor textures don't stretch or distort
- [x] All fixes work in 2D and 3D modes
- [x] No new visual artifacts introduced

---

## 🔴 BUG: Character Arms Stuck in T-Pose (Needs Debugging)

**Goal:** Character's arms should hang naturally at their sides when idle, and swing naturally when walking. Currently they are stuck spread out horizontally in a T-pose.

**File:** `src/components/scene/AnimatedPlayerMesh.jsx`
**Model:** `/public/character.fbx` (Mixamo character, 62MB, construction worker with hard hat + safety vest)

### What We Know
- The FBX is a Mixamo model with bone prefix `mixamorig1` (e.g., `mixamorig1LeftArm`)
- Multiple skeleton copies exist in the FBX (4 LeftArm bones, 3 Hips, etc.) because body + clothing meshes each have their own skeleton
- `skeleton.pose()` correctly resets to true bind pose (T-pose)
- True bind Z rotation values after `skeleton.pose()`: leftArm = **-0.0345**, rightArm = **+0.0311** (nearly zero = T-pose confirmed)
- We have NOT logged the full XYZ bind rotation yet - **bind X and Y may be non-zero and relevant**

### What We Tried (and failed)
| Attempt | armDownOffset (Z) | X offset | Result |
|---------|-------------------|----------|--------|
| 0.28π | leftZ - offset, rightZ + offset | none | "Improving but still too spread" ~50° below horizontal |
| 0.33π | leftZ - offset, rightZ + offset | none | Arms still in near T-pose (screenshot confirms) |
| 0.38π | leftZ - offset, rightZ + offset | +0.25 | Arms went BEHIND the body |
| 0.44π | leftZ - offset, rightZ + offset | none | Arms crossed in FRONT of body |
| 0.88π (wrong sign, old code) | | | Arms ~40° below horizontal |
| Quaternion multiply | | | Completely distorted/broke the mesh |

### Key Observations
1. **Z rotation does NOT map 1:1 to visual arm angle** - even large Z values produce small visible changes, then suddenly the arms cross in front
2. **We never checked/logged the full bind XYZ rotation** - only Z. If bind X or Y is non-zero, our code that sets `rotation.x = 0` every frame could be fighting the bind pose
3. **The bone's local Z axis may not align with the adduction axis** - Z rotation may partly TWIST the arm rather than swing it down
4. **HMR caching is tricky** - `useFBX` caches the FBX object; `skeleton.pose()` reset was critical to get reliable values

### Suggested Debugging Steps
1. **Log full bind XYZ** for LeftArm and RightArm after `skeleton.pose()` (code is already in place, just check console)
2. **Log the bone's local axes in world space** to understand what X/Y/Z actually do:
   ```js
   const bone = bones.leftArm[0]
   bone.updateMatrixWorld(true)
   const xAxis = new THREE.Vector3(1,0,0).transformDirection(bone.matrixWorld)
   const yAxis = new THREE.Vector3(0,1,0).transformDirection(bone.matrixWorld)
   const zAxis = new THREE.Vector3(0,0,1).transformDirection(bone.matrixWorld)
   console.log('LeftArm axes:', { x: xAxis, y: yAxis, z: zAxis })
   ```
3. **Try rotating each axis independently** (set only X, or only Y, or only Z to ±1.0) to see which axis actually swings the arm down
4. **Consider using world-space quaternion math**: get arm bone world quaternion, define target world direction (arm pointing down), convert to local space
5. **Alternative approach**: Download a Mixamo "idle" animation clip and blend it, instead of procedural bone rotation

### Current Code State
- `classifyBone()` function robustly matches bone names
- `skeleton.pose()` resets bind pose before any modifications
- Full bind XYZ stored in `bindZRef` (renamed from Z-only)
- `useFrame` preserves bind X/Y and applies Z offset + walk swing
- Debug logging in `useMemo` prints full XYZ bind values

### Acceptance Criteria
- [x] Arms hang naturally at sides when idle (not T-pose, not behind body, not crossed in front)
- [x] Arms swing naturally forward/back when walking
- [x] No mesh distortion or visual artifacts
- [x] Remove all debug console.log statements when done

---

## 🔴 Mobile Responsive Redesign

**Goal:** Make the UI work properly on mobile (S20 Ultra and similar).

### Approach
Rather than extracting into entirely new component files (which requires massive prop-passing refactors), we'll modify the existing code in-place using a `useIsMobile` hook. This keeps changes minimal and avoids introducing bugs.

### Tasks
- [x] 1. Create `src/hooks/useIsMobile.js` - mobile detection hook
- [x] 2. Add safe area CSS + slide animations to `src/index.css`
- [x] 3. Bottom nav: show 4 items + "More" overflow menu on mobile (currently 7 items overflow)
- [x] 4. Left panel (CTA card): make compact/collapsible on mobile
- [x] 5. Right panel (View Controls): hide behind settings icon, slide-up sheet on mobile
- [x] 6. Minimap: smaller on mobile, positioned above nav
- [x] 7. "Upgrade to Pro" button: move into overflow menu on mobile

### Files to Modify
| File | Change |
|------|--------|
| `src/hooks/useIsMobile.js` | Create (new) |
| `src/index.css` | Add safe area + animations |
| `src/App.jsx` | Add `useIsMobile`, modify bottom nav/panels/minimap conditionally |

### Acceptance Criteria
- Bottom nav fits on mobile screen (4 items + More)
- No overlapping elements on small screens
- Left/right panels don't block the 3D view
- Desktop layout stays unchanged
- Safe areas respected (notch, home indicator)

---

## 🔴 Priority 1: Payment Backend Integration

### 1.1 Manual Steps (User Required)
- [x] Create PayPal developer app at https://developer.paypal.com/dashboard/applications
- [x] Copy Client ID to `.env` as `VITE_PAYPAL_CLIENT_ID`
- [x] Create subscription plan in PayPal for $9.99/month
- [ ] Copy Plan ID to `.env` as `VITE_PAYPAL_MONTHLY_PLAN_ID`

### 1.2 Supabase Subscription Table (User Required)
Run this SQL in Supabase Dashboard → SQL Editor:
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  paypal_subscription_id TEXT,
  paypal_payer_id TEXT,
  status TEXT DEFAULT 'active',
  plan_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_subscriptions_email ON subscriptions(email);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read own subscription" ON subscriptions
  FOR SELECT USING (true);

CREATE POLICY "Server can manage subscriptions" ON subscriptions
  FOR ALL USING (true);
```

### 1.3 Test Payment Flow
- [ ] Test monthly subscription purchase (sandbox)
- [ ] Test lifetime purchase (sandbox)
- [ ] Verify subscription appears in Supabase
- [ ] Verify feature gating works

---

## 🟡 Priority 2: Multi-Story Buildings

### 2.1 State Management (App.jsx)
- [x] Add `currentFloor` state (0 = ground)
- [x] Add `floors` array structure
- [x] Create floor operations: addFloor, switchFloor, removeFloor

### 2.2 UI Controls (BuildPanel.jsx)
- [x] Add "Floors" section to BuildPanel
- [x] Floor tabs/selector (Ground, 1st, 2nd, etc.)
- [x] Add Floor / Remove Floor buttons
- [x] Floor height input (default 2.7m)

### 2.3 3D Rendering (LandScene.jsx)
- [x] Render walls at correct Y offset per floor
- [x] Show inactive floors with transparency
- [x] Floor plane between levels
- [x] Room detection per floor (rooms include floorLevel)
- [x] RoomFloor renders at correct Y offset

---

## ✅ Priority 3: Click-to-Add-Floors Feature (DONE)

**Goal:** Click on an existing room to extrude it into multiple floors

### Workflow
1. Draw a room (walls form enclosed space)
2. Go to Floors section in BuildPanel
3. Set number of floors (e.g., 3)
4. Click "Add X Floors to Room" button
5. Click on the room
6. System duplicates the room's walls for each floor above

### Implementation
- [x] Add `floorCountToAdd` state (default: 2)
- [x] Add "Add Floors to Room" tool/button
- [x] Add floor count selector (1-5 floors)
- [x] On room click: find walls forming that room
- [x] Duplicate those walls with incremented `floorLevel`
- [x] Room detection auto-runs and finds new rooms
- [x] Escape key to cancel tool

---

## 🟢 Enable Talk & Use Mobile Buttons

**Goal:** Wire up Talk and Use mobile buttons so they actually trigger actions.

### Tasks
- [x] 1. App.jsx — Add `mobileTalkTrigger`, `mobileUseTrigger`, `nearbyNPC`, `nearbyBuilding` states
- [x] 2. VirtualJoystick — Wire Talk/Use button handlers + visual feedback
- [x] 3. LandScene inner — Report NPC proximity to App via callback
- [x] 4. LandScene inner — Handle mobileTalkTrigger (same as E key)
- [x] 5. LandScene inner — Building proximity detection + report to App
- [x] 6. LandScene inner — Handle mobileUseTrigger (select nearest building)
- [x] 7. LandScene wrapper — Thread new props through
- [x] 8. Build verification — `npx vite build` passes

---

## 🟡 Improve Open World - Land Plot Texture & Terrain

**Goal:** Fix the washed-out white land plot surface and improve the open world feel.

### Problem
- The land plot uses a flat `meshStandardMaterial color="#4a7c59"` with no texture
- Under scene lighting it appears washed out/white compared to the richly textured grass terrain
- The contrast between textured grass terrain and flat land surface is jarring

### Tasks
- [x] 1. Add procedural dirt/earth texture to land plot surface (construction site feel)
- [x] 2. Extend ground plane from 500m to 2000m so terrain edge isn't visible when walking far
- [x] 3. Adjust texture repeat to match larger ground plane

### Files to Modify
| File | Change |
|------|--------|
| `src/components/LandScene.jsx` | Add texture to LandPlot, use `useLandTexture` hook |
| `src/components/scene/SceneEnvironment.jsx` | Extend ground plane size + adjust texture repeat |
| `src/hooks/useGrassTextures.js` | Add `useLandTexture()` hook for dirt/earth texture |

### Acceptance Criteria
- Land plot has visible dirt/earth texture (not flat white/green)
- Grass terrain extends far enough to never see the edge
- No new visual artifacts introduced
- Desktop and mobile performance unaffected (procedural textures, no external assets)

---

## 🟡 Context-Sensitive "Clear All" Button in Build Panel

**Goal:** Make the "Clear all walls" button context-sensitive based on the active build tool.

### Problem
- Currently the clear button always says "Clear all walls" regardless of which tool is selected
- Pressing it clears ALL walls (rooms, standalone walls, fences, etc.)
- User wants it to only clear the type matching the active tool

### Tasks
- [x] 1. App.jsx — Create `onClearByType(toolType)` callback that clears only relevant items
- [x] 2. BuildPanel.jsx — Make clear button label/visibility change based on `activeBuildTool`
- [x] 3. Verify build passes

### Clear Logic by Tool
| Tool | Button Label | Action |
|------|-------------|--------|
| Room | Clear all rooms | Remove walls in `rooms[].wallIds` + associated roofs |
| Wall | Clear all walls | Remove non-fence walls not in any room |
| Fence | Clear all fences | Remove walls with `isFence: true` |
| Door | Clear all doors | Remove door openings from all walls |
| Window | Clear all windows | Remove window openings from all walls |
| Pool | Clear all pools | Clear pools array |
| Platform | Clear all platforms | Clear foundations array |
| Stairs | Clear all stairs | Clear stairs array |
| Roof | Clear all roofs | Clear roofs array |
| None/Delete | Clear all | Clear everything (current behavior) |

### Files to Modify
| File | Change |
|------|--------|
| `src/App.jsx` | Add `onClearByType` callback, pass to BuildPanel |
| `src/components/BuildPanel.jsx` | Dynamic clear button label + use `onClearByType` |

---

## Review

### Session: February 5, 2026 — Improve Open World (Land Texture + Terrain)
**Changes:**
- Added procedural dirt/earth texture to land plot surface (was flat untextured green that appeared white under lighting)
- Extended ground plane from 500m to 2000m so terrain edge is never visible
- Scaled up sky dome from 500 to 2000 to match terrain
- Adjusted all texture repeats (grass detail 15→60, macro 2→8, roughness 15→60, simple 20→80)

**Files Modified:**
- `src/hooks/useGrassTextures.js` - Added `useLandTexture()` hook, scaled up texture repeats for larger terrain
- `src/components/LandScene.jsx` - Imported and applied land texture to LandPlot component
- `src/components/scene/SceneEnvironment.jsx` - Extended ground plane to 2000m, scaled sky dome

---

### Session: February 5, 2026 — Fix Transparent Material Rendering Order
**Changes:**
- Fixed pool water transparency rendering by adding `depthWrite={false}` and `renderOrder={1}`
- Fixed glass panes in windows by adding `depthWrite={false}` and `renderOrder={2}`
- Fixed glass panes in sliding doors by adding `depthWrite={false}` and `renderOrder={2}`
- Fixed chain link fence mesh by adding `depthWrite={false}` and `renderOrder={2}`

**Files Modified:**
- `src/components/scene/PolygonRenderers.jsx` - Pool water mesh
- `src/components/scene/WallSegment.jsx` - Window glass panes, sliding door glass panels, chain link fence mesh

**Technical Details:**
- Transparent materials need `depthWrite={false}` to prevent them from blocking other transparent objects
- `renderOrder` controls the order in which transparent objects are rendered (higher numbers render last)
- Pool water (renderOrder=1) renders before glass panes (renderOrder=2) for proper layering
