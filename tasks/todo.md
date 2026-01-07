# Land Visualizer - Task History

## Task: Fix Double Door Rendering in AI Floor Plan Generator (COMPLETED)

### Goal
When AI analyzes a floor plan and detects a double door, render it correctly with two swing arcs (butterfly pattern) instead of one.

### Changes Made

**1. Updated AI Prompt (`api/analyze-floor-plan.js`)**
- Added `doorType: "single|double|sliding"` to door output schema
- Added detection guidelines for door types:
  - Single door: ONE quarter-circle arc
  - Double door: TWO quarter-circle arcs forming butterfly pattern
  - Sliding door: parallel lines, no swing arc
- Double doors are typically 1.4-2.0m wide

**2. Updated Floor Plan Converter (`src/utils/floorPlanConverter.js`)**
- Preserved `doorType` property when attaching doors to walls
- Increased max width for double doors (2.4m vs 1.8m for single)

**3. Updated 2D Door Rendering (`src/components/LandScene.jsx`)**
- Added `isDoubleDoor` check based on `opening.doorType === 'double'`
- Double doors render:
  - Left swing arc (swings to negative Z)
  - Right swing arc (swings to positive Z)
  - Left door leaf (closed position)
  - Right door leaf (closed position)
- Single doors unchanged (one arc, one leaf)

**4. Updated 3D Door Frames (`src/components/LandScene.jsx`)**
- Added center mullion for double doors (vertical divider between leaves)

### Visual Reference

**Single Door:**
```
│  ╭────
│
└──────
```

**Double Door (butterfly pattern):**
```
────╮╭────
    ││
───╯  ╰───
```

---

## Task: Floor Plan Editor - Zoom/Pan & Element Editing (COMPLETED)

### Goal
Add interactive editing capabilities to the floor plan preview:
1. Zoom in/out with mouse wheel on image preview
2. Pan with middle mouse button drag
3. Edit walls, doors, windows when AI detection makes mistakes
4. Draw new elements that AI missed

### Changes Made

**Phase 1: Zoom & Pan Controls**
- [x] Add zoom state (scale factor, min 0.5x, max 4x)
- [x] Add pan state (offset x, y)
- [x] Handle mouse wheel for zoom (centered on cursor)
- [x] Handle middle mouse drag for pan
- [x] Transform canvas drawing with zoom/pan
- [x] Add zoom indicator/reset button

**Phase 2: Element Selection & Editing**
- [x] Add edit mode toggle button
- [x] Click to select wall/door/window
- [x] Highlight selected element with handles (yellow)
- [x] Drag wall endpoints to modify
- [x] Delete selected element (Delete key or button)

**Phase 3: Drawing New Elements**
- [x] Draw new wall (click two points)
- [x] Update aiData when elements change

### Implementation Details

**DetectionOverlay Component** (`FloorPlanGeneratorModal.jsx`):
- Complete rewrite with zoom/pan support
- `screenToImage()` and `imageToScreen()` coordinate conversion
- `findElementAt()` for hit detection on walls/doors/windows
- Mouse wheel zoom centered on cursor position
- Middle mouse button drag for panning
- Wall endpoint handles in edit mode
- Selected element highlighting (yellow color)
- Drag wall endpoints to reposition
- Delete key support for removing elements

**Edit Mode UI**:
- "Edit Elements" toggle button
- "+ Wall" button to draw new walls
- "Delete" button when element selected
- Instructions panel showing available actions

---

## Task: Improve AI Floor Plan Analysis for Better 3D Generation (COMPLETED)

### Goal
Fix the issue where AI was generating oversimplified floor plans that didn't match the uploaded image. Missing interior walls, most rooms, doors, windows, and the actual layout shape.

### Changes Made

**1. Improved AI Prompt (`api/analyze-floor-plan.js`)**
- Increased max_tokens from 8192 to 16384 for complex floor plans
- Added detailed instructions to trace ALL walls (exterior + interior)
- Added shape detection (L-shaped, U-shaped, rectangular, irregular)
- Added dimension label extraction from image
- Added room area detection from labels
- Added better guidance for doors, windows, and wall connections

**2. Added Wall Endpoint Snapping (`src/utils/floorPlanConverter.js`)**
- New `snapWallEndpoints()` function to connect walls at corners
- Walls within 5 pixels of each other are snapped together
- Ensures proper wall connections in the 3D model

**3. Enhanced Generator Modal (`src/components/FloorPlanGeneratorModal.jsx`)**
- Added debug view showing AI detection details:
  - Overall shape (L-shaped, rectangular, etc.)
  - Total area from image labels
  - Detected rooms with area values
  - Dimensions extracted from image
- Added quality validation with warning for oversimplified results
- Set USE_MOCK = false for production (real API calls)

### Expected Results
For complex floor plans, the AI should now detect:
- 15-20 wall segments (exterior + interior)
- All rooms with correct names and areas
- 4-6 doors with swing directions
- 3-4 windows
- L-shaped, U-shaped, or irregular layouts
- Dimensions from image labels for accurate scale

---

## Task: Auto-Generate 3D Building from Floor Plan Image (COMPLETED)

### Goal
Allow users to upload a floor plan image and automatically generate 3D walls, doors, windows, and rooms from it using AI (Claude Vision).

**User Flow:**
1. User uploads floor plan image in Build panel
2. App detects it's a floor plan (existing detection)
3. Shows "Analyzing floor plan..." with spinner
4. AI extracts: walls, doors, windows, rooms
5. User calibrates scale (enter known wall length)
6. Preview 3D layout
7. User confirms → 3D building is created
8. User can edit/refine with existing tools

### Plan

**Phase 1: Create AI Analysis API Endpoint** ✅
- [x] Create `api/analyze-floor-plan.js` (Vercel serverless function)
- [x] Install `@anthropic-ai/sdk` dependency
- [x] Implement Claude Vision prompt to extract:
  - Walls (start/end positions, thickness, isExterior)
  - Doors (position, width, wallId, swingDirection)
  - Windows (position, width, wallId)
  - Rooms (name, center, boundaryWallIds, area)
- [x] Return structured JSON response

**Phase 2: Create Floor Plan Converter Utility** ✅
- [x] Create `src/utils/floorPlanConverter.js`
- [x] Implement `convertFloorPlanToWorld(aiData, settings)`:
  - Scale conversion (pixels → meters)
  - Origin offset
  - Rotation support
  - Wall height settings
- [x] Implement helper functions:
  - `findNearestWall()` - Match doors/windows to walls
  - `calculatePositionAlongWall()` - Position openings
  - `pointToLineDistance()` - Distance calculations

**Phase 3: Create Generation Modal UI** ✅
- [x] Create `src/components/FloorPlanGeneratorModal.jsx`
- [x] States: 'analyzing' | 'calibrating' | 'preview' | 'error' | 'upgrade'
- [x] Analyzing state: Spinner + "Analyzing floor plan..."
- [x] Calibrating state:
  - Image preview with detection summary
  - Scale calibration input (longest wall length in meters)
  - Wall height input
  - Detected rooms list
  - "Generate 3D Preview" button
- [x] Preview state:
  - 3D preview canvas
  - Scale/position/rotation sliders
  - Stats (walls, doors, windows, rooms count)
  - "Build 3D Floor Plan" button
- [x] Error state: Retry + Cancel buttons
- [x] Upgrade state: For free users (paid feature)

**Phase 4: Create 3D Preview Component** ✅
- [x] Create `src/components/FloorPlanPreview3D.jsx`
- [x] Simple Three.js canvas with OrbitControls
- [x] Render preview walls as boxes
- [x] Render room labels
- [x] Grid helper

**Phase 5: Integrate into App** ✅
- [x] Add `showFloorPlanGenerator` state in App.jsx
- [x] Add `handleFloorPlanGenerated(data)` callback:
  - Convert walls to app format
  - Add to walls state
  - Push to undo history
  - Switch to build mode
- [x] Update BuildPanel upload to trigger generator modal for floor plans
- [x] Pass necessary props

### Review

**Files Created:**

1. **`api/analyze-floor-plan.js`** - Vercel serverless function
   - Uses Claude Vision (claude-sonnet-4-20250514) to analyze floor plan images
   - Returns structured JSON with walls, doors, windows, rooms
   - Includes scale estimation and confidence scores
   - Handles JSON parsing and validation

2. **`src/utils/floorPlanConverter.js`**
   - `convertFloorPlanToWorld(aiData, settings)` - Main conversion function
   - `calculateScaleFromReference(aiData, knownLengthMeters)` - Scale calibration
   - Converts pixel coordinates to world meters
   - Attaches doors/windows to nearest walls
   - Supports rotation and offset

3. **`src/components/FloorPlanGeneratorModal.jsx`**
   - Multi-step modal: analyzing → calibrating → preview → error/upgrade
   - Shows detection summary (wall/door/window/room counts)
   - AI confidence indicator
   - Scale calibration with reference wall length
   - Wall height configuration
   - Detected rooms display
   - Uses app design tokens for consistent styling

4. **`src/components/FloorPlanPreview3D.jsx`**
   - Three.js canvas with OrbitControls
   - Renders preview walls as 3D boxes
   - Room labels with teal floor indicators
   - Auto-calculates camera position from bounds
   - Grid helper for scale reference

**Files Modified:**

1. **`src/App.jsx`**
   - Added imports: FloorPlanGeneratorModal, useUser
   - Added state: showFloorPlanGenerator, floorPlanImageForGenerator
   - Added `handleFloorPlanGenerated()` callback
   - Modified `onUploadForFloorPlan` to open generator modal
   - Added `onOpenFloorPlanGenerator` prop to BuildPanel
   - Renders FloorPlanGeneratorModal when active

2. **`src/components/BuildPanel.jsx`**
   - Added `onOpenFloorPlanGenerator` prop
   - Modified upload handling to call generator instead of setting background image
   - All floor plan detections now route to AI generator

3. **`package.json`**
   - Added `@anthropic-ai/sdk` dependency

**Architecture:**
- Paid users only (free users see upgrade prompt)
- Uses existing image type detection flow
- Generated walls integrate with existing wall system (undo/redo works)
- Preview allows scale/position/rotation adjustment before committing

**Environment Setup Required:**
- Set `ANTHROPIC_API_KEY` in `.env.local` or Vercel environment variables
- Deploy to Vercel for API endpoint to work

---

## Task: Smart Image Detection — Freemium Model (COMPLETED)

### Goal
Add automatic detection to identify whether an uploaded image is a site plan (land boundary) or floor plan (building layout).
- Free users: Client-side heuristics (~70-80% accuracy)
- Paid users: AI-powered detection (~95%+ accuracy)

### Plan

**Phase 1: Create Image Analysis Service** ✅
- [x] Create `src/services/imageAnalysis.js`
  - `analyzeImage(imageBase64, isPaidUser)` - main entry point
  - `analyzeWithHeuristics(imageBase64)` - client-side detection
  - `analyzeWithAI(imageBase64)` - AI-powered detection (paid)
  - Edge detection, line density, room detection algorithms

**Phase 2: Create User Tier Hook** ✅
- [x] Create `src/hooks/useUser.jsx`
  - Track `isPaidUser` state
  - Load from localStorage or auth provider

**Phase 3: Update Upload Modal** ✅
- [x] Add analyzing state with spinner
- [x] Call `analyzeImage()` after file upload
- [x] Auto-select detected type with confidence display
- [x] Allow manual override if low confidence
- [x] Show upgrade prompt for free users

### Review

**Files Created:**

**`src/services/imageAnalysis.js`:**
- `analyzeImage(imageBase64, isPaidUser)` - Main entry point
- `analyzeWithAI(imageBase64)` - Calls `/api/analyze-plan` backend (for paid users)
- `analyzeWithHeuristics(imageBase64)` - Client-side detection using:
  - Sobel edge detection
  - Aspect ratio analysis (square = floor plan, elongated = site plan)
  - Line density (many internal lines = floor plan)
  - Perpendicular line ratio (90° angles = floor plan walls)
  - Center vs edge detail ratio (empty center = site plan boundary)
  - Room-like region detection (flood fill for enclosed spaces)
- Returns `{ type: 'site-plan' | 'floor-plan', confidence: 0-1, method: 'ai' | 'heuristics' }`

**`src/hooks/useUser.jsx`:**
- `UserProvider` context provider
- `useUser()` hook returning `{ user, isPaidUser, setIsPaidUser }`
- Persists `isPaidUser` to localStorage
- Ready for integration with Supabase or other auth providers

**Files Modified:**

**`src/components/UploadImageModal.jsx`:**
- Added `analyzing` step with spinner
- Calls `analyzeImage()` after file upload
- **Auto-routes on high confidence (≥70%)** - no user decision needed
- **Low confidence (<70%)** - shows confirmation with two buttons
- User tier indicator: "AI-powered detection" (paid) or "Smart auto-detection" (free)
- "Upload different image" link in confirmation view

**User Flow:**
1. User uploads image
2. Shows "Analyzing your plan..." spinner
3. Heuristics run (or AI for paid users)
4. **High confidence** → Auto-routes to correct mode (no extra clicks!)
5. **Low confidence** → Shows "We detected this as X. Is that correct?" with Site Plan / Floor Plan buttons
6. Proceeds to land tracing or build mode

**Backend API (TODO for paid users):**
- Create `/api/analyze-plan` endpoint
- Integrate with vision AI model (Claude, GPT-4V, etc.)
- Parse AI response for type classification

---

## Task: Merge Upload Site Plan + Upload Floor Plan (COMPLETED)

### Goal
Combine two separate upload flows ("Upload Site Plan" and "Upload Floor Plan") into one unified experience where users upload once and choose what to trace.

### Review

**Files Created:**

**`src/components/UploadImageModal.jsx`:**
- Two-step modal: upload → choose
- Step 1: Drag & drop or click to upload PNG/JPG
- Step 2: Preview image + two choice cards:
  - "Land Boundary" (green) → calls `onUploadForLand(preview)`
  - "Floor Plan" (teal) → calls `onUploadForFloorPlan(preview)`
- Back button to close modal
- Uses app design tokens (--color-*)

**Files Modified:**

**`src/App.jsx`:**
- Replaced `FloorPlanUploadModal` import with `UploadImageModal`
- Renamed `showFloorPlanUpload` state to `showUploadModal`
- Updated modal rendering with two handlers:
  - `onUploadForLand`: Sets `uploadedImage`, switches to land panel
  - `onUploadForFloorPlan`: Sets `floorPlanImage` with default settings, switches to build panel
- Added `onOpenUploadModal` prop to LandPanel
- BuildPanel's `onUploadFloorPlan` now opens unified modal

**`src/components/LandPanel.jsx`:**
- Added `onOpenUploadModal` prop
- Upload section now shows:
  - Button to open unified modal (when no image uploaded)
  - ImageTracer for boundary tracing (when image exists)
- Kept instructions and area display

**Files Deleted:**
- `src/components/FloorPlanUploadModal.jsx` - Functionality merged into UploadImageModal

---

## Task: Floor Plan Building Placement & Selection (COMPLETED)

### Goal
After generating a 3D floor plan, allow users to place it on the land and then select/move/rotate the building.

### Changes Made

**1. Building State Management (`src/App.jsx`)**
- Added `buildings` state array for placed floor plans
- Added `floorPlanPlacementMode` state for placement mode
- Added `pendingFloorPlan` state for floor plan awaiting placement
- Added `selectedBuildingId` state for selected building
- Added `buildingPreviewPosition` and `buildingPreviewRotation` for preview

**2. Placement Mode (`src/App.jsx`)**
- `handleFloorPlanGenerated` now enters placement mode instead of directly adding walls
- User sees ghost preview following cursor
- Click on land to place building at that position
- Press R to rotate preview before placement
- Press ESC to cancel placement

**3. Building Selection (`src/components/LandScene.jsx`)**
- Click on any wall of a placed building to select it
- Selected building walls highlight yellow
- Selection ring indicator around selected building
- Pass building props through LandScene → Scene component

**4. Move/Rotate Controls (`src/App.jsx`, `src/components/LandScene.jsx`)**
- Click on land while building selected = move to that position
- Press R = rotate selected building 90°
- Press ESC = deselect building
- Press Delete/Backspace = delete selected building
- Toast message shows available controls when building selected

**5. Keyboard Shortcuts**
- R: Rotate (placement preview or selected building)
- ESC: Cancel placement / Deselect building
- Delete/Backspace: Delete selected building

### Files Modified

- `src/App.jsx`: Added building state, placement functions, keyboard handlers, toast for selection
- `src/components/LandScene.jsx`: Added building props, rendering, click handlers, preview ghost

---

---

## Task: Improve Comparison Objects - Car, Shipping Container, School Bus, Olympic Pool (IN PROGRESS)

### Goal
Improve the 3D models for 4 comparison objects to be more realistic and detailed.

### Plan

**1. Car (Sedan)**
Current: Basic gray box with simple cabin
Improvements:
- Silver/metallic paint
- Sloped hood at front
- Windshield and rear window (glass)
- Headlights and taillights
- Better wheel hubs with rim detail
- Bumpers and grille

**2. Shipping Container**
Current: Orange box with minimal detail
Improvements:
- More corrugation lines on all sides
- Door handles/latches
- Corner castings (reinforced corners)
- Bottom frame rails
- Ventilation grilles

**3. School Bus**
Current: Yellow box with black stripe
Improvements:
- Hood shape at front
- STOP sign on side
- Individual windows
- Front grille and headlights
- Black bumpers
- Emergency exit marking

**4. Olympic Pool (50m x 25m)**
Current: Basic sunken pool with lane dividers
Improvements:
- Starting blocks
- Lane ropes (buoy style)
- Touch pads at ends
- Proper deck walkway
- Ladder on side
- Lane numbers

### Progress
- [x] Car (Sedan)
- [x] Shipping Container
- [x] School Bus
- [x] Olympic Pool

### Review

**Changes Made:**

1. **Car (Sedan)** - Complete redesign with:
   - Silver metallic paint with proper material properties
   - Sloped hood and trunk sections
   - Angled windshield and rear window with dark glass
   - Side windows
   - Front grille with headlights
   - Red taillights with emissive glow
   - Front and rear bumpers
   - Side mirrors
   - Detailed wheels with tires, rims, and hub caps

2. **Shipping Container** - Realistic ISO container with:
   - Corrugation lines on all sides and top
   - Corner castings (reinforced corners) with black hardware
   - Bottom frame rails and cross members
   - Double doors at back with:
     - Vertical locking bars
     - Door handles
     - Hinges
   - Ventilation grilles on front
   - ID plate area on side

3. **School Bus** - Classic American design with:
   - National School Bus Yellow color
   - Hood section at front
   - Individual windows with frames on both sides
   - Front windshield and rear window
   - Front grille with round headlights
   - Turn signals
   - Red STOP sign on left side (octagon shape)
   - Black roof cap
   - Black bumpers front and rear
   - Taillights
   - Emergency exit door marking on back
   - Side mirrors
   - Entry door on right side
   - Detailed wheels with hubs

4. **Olympic Pool** - Competition pool with:
   - Outer deck area with proper coping
   - 8-lane configuration with proper lane widths
   - Lane lines painted on pool floor
   - T-marks at lane ends
   - Floating lane ropes with buoys:
     - Blue buoys for inner lanes
     - Green buoys for outer lanes
     - Red buoys in 5m end zones
   - Starting blocks at one end with angled top
   - Yellow touch pads at both ends
   - Backstroke flag poles at 5m marks with triangular flags
   - Ladder on side with metal rails and rungs

---

---

## Task: Refactor PolygonEditor Canvas Drawing Logic (COMPLETED)

### Problem
The `useEffect` for canvas drawing in `PolygonEditor.jsx` (lines 162-392) was 230+ lines and handled multiple distinct drawing responsibilities:
1. Background and grid drawing
2. Axes drawing
3. Instruction text when empty
4. Polygon shape and fill
5. Segment length labels
6. Point markers with hover/drag states
7. Corner angle labels
8. Preview line while drawing

This made the code hard to read, maintain, and debug.

### Solution
Extracted each drawing responsibility into a separate helper function, keeping them within the same file to minimize impact. This maintains the same external behavior while improving readability.

### Tasks
- [x] Extract grid and axes drawing into `drawGrid()` helper
- [x] Extract polygon drawing (shape + fill) into `drawPolygon()` helper
- [x] Extract segment length labels into `drawSegmentLabels()` helper
- [x] Extract point markers into `drawPoints()` helper
- [x] Extract corner angles into `drawCornerAngles()` helper
- [x] Extract preview line into `drawPreviewLine()` helper
- [x] Refactor main useEffect to use the new helpers
- [x] Test that behavior remains identical

### Review

**Changes Made to `src/components/PolygonEditor.jsx`:**

Added 6 helper functions before the component (lines 24-251):
- `drawGrid(ctx, canvasWidth, canvasHeight, scale, panOffset)` - Clears canvas, draws grid lines and axes
- `drawPolygon(ctx, points, toCanvasLocal)` - Draws polygon shape with fill
- `drawSegmentLabels(ctx, points, toCanvasLocal, formatLength)` - Draws length labels on edges
- `drawPoints(ctx, points, toCanvasLocal, hoveredPoint, draggingPoint, nearFirstPoint)` - Draws point markers with hover/drag states
- `drawCornerAngles(ctx, points, toCanvasLocal, scale)` - Draws angle labels at corners
- `drawPreviewLine(ctx, points, mousePos, toCanvasLocal, shiftHeld, drawDimension, lengthUnit, formatLength)` - Draws preview line while drawing

**Refactored useEffect (lines 394-430):**
- Reduced from ~230 lines to ~35 lines
- Now calls helper functions instead of inline drawing code
- Same dependencies, same behavior

**Benefits:**
- Each drawing function has a single responsibility
- Easier to understand what each section does
- Easier to modify individual drawing aspects without affecting others
- Code is more maintainable and testable

**No changes to:**
- Component API (props, exported functions)
- External behavior
- Other files in the codebase

---

## Previous Tasks (Completed)
- Export Floor Plan (PNG)
- Build Tool Previews in All View Modes
- Sims 4-Style Build System Refactor (Phases A-H)
- Doors & Windows
- Fix Setback Boundary
- Fix 2D View Camera Issues
- AutoCAD-Style 2D Top View
- Enhanced Orbit View + 2D Top-Down View
- Wall Builder - Phase 1
