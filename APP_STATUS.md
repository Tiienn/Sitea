# Sitea - Land Visualizer: Complete Status Report

**Last Updated:** February 9, 2026
**Live URL:** https://sitea-one.vercel.app
**Deployment:** Vercel via `npx vercel --prod` (not git push due to large files in history)

---

## Vision & Purpose

**Sitea** is a **web-based 3D land and building visualization tool** that transforms abstract property measurements and floor plans into immersive, explorable 3D experiences.

**Core value proposition:** *Turn abstract land measurements into tangible, explorable 3D experiences — no CAD skills required.*

**Target Users:**
- Real estate professionals (agents, developers)
- Architects and designers
- Homeowners planning renovations/builds
- Urban planners
- Property investors
- Anyone needing to visualize land and building scale

**What makes it unique:** Users can draw their land boundaries, design buildings with Sims 4-style tools, import AI-analyzed floor plans, and then walk through their designs in first-person — all in a browser with no install.

---

## Current State: Production — Revenue-Ready

All core features are **stable and deployed**. Payment system is fully wired (PayPal + Supabase). Pro features are gated and functional.

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19.2 + Vite 7.2 + Tailwind CSS 4.1 |
| 3D Engine | Three.js 0.181 + React Three Fiber 9.4 + Drei 10.7 |
| Backend | Vercel Serverless Functions |
| AI | Claude Vision (claude-sonnet-4-20250514) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Payments | PayPal (react-paypal-js) |
| PDF | jsPDF |
| Mobile | nipplejs virtual joystick |
| Asset Hosting | Supabase Storage (GLB models, public bucket) |

### Codebase Metrics
| Metric | Value |
|--------|-------|
| Total source code | ~25,000+ lines |
| App.jsx | ~4,100 lines |
| LandScene.jsx | ~3,700 lines |
| Components | 35+ (panels, modals, scene components, property panels) |
| Utilities | 10 |
| Custom hooks | 4 |
| Services | 3 |
| Bundle (gzipped) | ~880KB total (Three.js alone is 382KB) |
| Build time | ~8-12 seconds |
| Build errors | 0 |

---

## Features: Complete Inventory

### 1. Land Definition & Setup
| Feature | Status |
|---------|--------|
| Rectangle land (length x width input) | Done |
| Custom polygon boundaries (click to draw) | Done |
| Land templates (preset lot sizes) | Done |
| Upload floor plan (AI-assisted tracing) | Done |
| Area calculation (m2, ft2, acres, hectares) | Done |
| Unit switching (meters / feet / mm) | Done |
| Setback boundary visualization | Done |
| Polygon vertex editing with snapping | Done |
| Onboarding walkthrough (3-step) | Done |

### 2. Building Design System (Sims 4-Style)
| Feature | Status |
|---------|--------|
| Rectangular rooms (click-click) | Done |
| Polygon rooms (multi-click) | Done |
| Standalone walls | Done |
| Half walls (railings, counters) | Done |
| Fences (5 styles: picket, privacy, chain-link, iron, ranch) | Done |
| Doors (single, double, sliding, garage) | Done |
| Windows (customizable width, height, sill) | Done |
| Pools (polygon-based, depth, deck, water color) | Done |
| Foundations/Platforms (polygon, adjustable height) | Done |
| Stairs (straight, L-shaped, railings) | Done |
| Roofs (gable, adjustable pitch, overhang) | Done |
| Preset buildings (houses, garage, shed, barn) | Done |
| Multi-story buildings (up to 5+ floors) | Done |
| Click-to-add-floors (extrude rooms) | Done |
| Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) | Done |
| Grid snapping (adjustable size) | Done |
| Vertex/edge snapping (walls, corners) | Done |
| Shift+draw for 45-degree angle snapping | Done |
| Spacebar to confirm drawing point | Done |
| Ctrl+Z undoes drawing points (not objects) | Done |
| Right-click exits drawing mode | Done |
| Auto-exit drawing mode on polygon close | Done |
| Select, move, drag, rotate, delete tools | Done |
| Context-sensitive "Clear all" button | Done |
| 7 property panels (Room, Wall, Fence, Pool, Foundation, Stairs, Roof) | Done |

### 3. AI Floor Plan Generator (Pro Feature)
| Feature | Status |
|---------|--------|
| Image upload with preview | Done |
| Claude Vision analysis (wall/door/window extraction) | Done |
| Scale calibration (click-to-calibrate) | Done |
| 2D interactive editor (zoom, pan, select, drag) | Done |
| Wall endpoint snapping (0/45/90 degrees) | Done |
| 3D preview before committing | Done |
| JWT auth + subscription check on API | Done |
| 1 free upload for free users | Done |

### 4. Camera & Navigation
| Feature | Status |
|---------|--------|
| First-person mode (WASD + mouse) | Done |
| Third-person follow camera | Done |
| Orbit camera (scroll zoom) | Done |
| 2D top-down orthographic view | Done |
| Jump with gravity physics | Done |
| Head bob + lateral sway | Done |
| Camera lock during item drag | Done |
| Fit-to-land auto-frame | Done |
| Smooth mode transitions | Done |

### 5. Character & NPC System
| Feature | Status | Notes |
|---------|--------|-------|
| Player character (GLB from Supabase Storage) | Done | |
| 13 animation clips (idle, walk, run, jump, strafe, turn) | Done | |
| Auto-scale model detection (Box3) | Done | |
| Animation crossfading | Done | |
| Root motion lock (Hips bone X/Z) | Done | |
| NPC guide characters | Done | |
| Proximity detection (E to talk / mobile Talk button) | Done | |
| Dialog system | Done | |
| Character arms T-pose | Bug | Arms stuck horizontal, needs bind-pose debugging |

### 6. Graphics & Environment
| Feature | Status |
|---------|--------|
| Day/Night cycle (Pro: auto-cycling, slider) | Done |
| Night stars (200 points, fade in/out) | Done |
| Realistic sky shader (7 time stops) | Done |
| Golden hour lighting (sun, ambient, fill) | Done |
| Dynamic fog (color varies with time) | Done |
| Procedural grass textures (canvas-based) | Done |
| Dirt/earth land plot texture | Done |
| 2000m ground plane (no visible edge) | Done |
| 120 scattered low-poly trees (InstancedMesh) | Done |
| 3-ring mountain silhouettes | Done |
| Shadow mapping (BEST quality mode) | Done |
| FAST/BEST quality presets | Done |
| Z-fighting prevention | Done |
| Transparent material depth sorting | Done |

### 7. Comparison Objects (24+)
Soccer fields, basketball courts, tennis courts, swimming pools, parking spaces, vehicles (car, bus, container), buildings (house, apartment), landmarks, commercial establishments — all draggable and rotatable.

### 8. Export System
| Export | Status |
|--------|--------|
| PNG floor plan | Done |
| PDF report (A4, stats, floor plan) | Done |
| 3D screenshot (1x/2x/4x) | Done |
| GLB/GLTF/OBJ model export | Done |

### 9. Sharing & Persistence
| Feature | Status |
|---------|--------|
| Shareable URLs via Supabase | Done |
| Read-only mode for shared scenes | Done |
| Scene serialization/deserialization | Done |
| localStorage session persistence | Done |

### 10. Payment & Monetization
| Feature | Status |
|---------|--------|
| PricingModal with PayPal buttons | Done |
| Monthly plan: $9.99/month | Done |
| Lifetime plan: $149 one-time | Done |
| Feature gating (isPaidUser check) | Done |
| Supabase subscriptions table | Done |
| JWT auth on API endpoints | Done |
| Subscription status checking | Done |
| UpgradePrompt component | Done |

### 11. Mobile Support
| Feature | Status |
|---------|--------|
| useIsMobile + useIsLandscape hooks | Done |
| Virtual joystick (nipplejs) | Done |
| Action buttons (Jump, Talk, Use, Run) | Done |
| Bottom nav (4 items + More overflow) | Done |
| Collapsible side panels | Done |
| Safe area CSS (notch, home indicator) | Done |
| Touch controls (pinch zoom, tap) | Done |

### 12. Security
| Feature | Status |
|---------|--------|
| JWT auth on API endpoints | Done |
| Subscription check before AI analysis | Done |
| Error message sanitization (no stack traces) | Done |
| Email validation (regex) | Done |
| Supabase RLS policies | Done |

### 13. Drawing UX (Added Feb 7-9, 2026)
| Feature | Status |
|---------|--------|
| Shift+draw snaps to 0/45/90 degree angles | Done |
| Spacebar confirms drawing point (alternative to click) | Done |
| Spacebar + typed length = exact distance placement | Done |
| Ctrl+Z undoes last drawing point (not last object) | Done |
| Right-click exits any drawing tool | Done |
| Auto-exit drawing mode on polygon close | Done |
| Selection instructions toast for all item types | Done |
| Camera locks when dragging pools/platforms/stairs | Done |

---

## User Flow

```
New Visitor → Landing page with example land (~2750 m2)
    ↓
Walkthrough: "Use WASD to walk" (auto-advance or on movement)
    ↓
Explore example land in first-person
    ↓
┌─────────────────────────────────────────────┐
│ Define Land → Rectangle / Polygon / Upload  │
│ Design Building → Walls, Rooms, Pools, etc  │
│ Explore → Walk through in first-person      │
│ Export → PNG / PDF / GLB / Share link        │
└─────────────────────────────────────────────┘
    ↓
Pro Upgrade Trigger (2nd floor plan upload)
    → PricingModal → PayPal → Subscription saved
    → Day/night cycle + unlimited uploads unlocked
```

---

## Known Issues & Bugs

| Issue | Severity | Notes |
|-------|----------|-------|
| Character arms T-pose | Medium | Arms stuck horizontal when idle/walking. Multiple fix attempts failed. Needs full XYZ bind-pose debugging. See tasks/todo.md for details. |
| Mobile landscape refinements | Low | Some button positioning inconsistencies in landscape orientation |
| Large design PDF export | Low | 50+ wall designs may timeout on slow connections |

---

## File Structure

```
Sitea1/
├── api/
│   └── analyze-floor-plan.js          # Claude Vision serverless endpoint (JWT auth)
├── src/
│   ├── main.jsx                       # Entry point (providers, router)
│   ├── App.jsx (~4100 lines)          # Main app state, callbacks, UI shell
│   ├── index.css                      # Tailwind + custom animations
│   ├── components/
│   │   ├── LandScene.jsx (~3700 lines)  # 3D scene engine (R3F)
│   │   ├── LandPanel.jsx               # Land definition UI
│   │   ├── BuildPanel.jsx              # Building tools + floor controls
│   │   ├── ComparePanel.jsx            # Comparison objects
│   │   ├── ExportPanel.jsx             # 4 export types
│   │   ├── AuthModal.jsx               # Sign in/up (Google OAuth + email)
│   │   ├── PricingModal.jsx            # PayPal subscription UI
│   │   ├── FloorPlanGeneratorModal.jsx # AI floor plan editor
│   │   ├── UploadImageModal.jsx        # Image upload
│   │   ├── Onboarding.jsx             # Welcome walkthrough
│   │   ├── PolygonEditor.jsx           # Land polygon drawing
│   │   ├── ImageTracer.jsx             # Wall tracing on uploaded image
│   │   ├── Minimap.jsx                 # Mini 2D map
│   │   ├── NPCDialog.jsx              # NPC chat overlay
│   │   ├── UpgradePrompt.jsx           # Pro upgrade prompts
│   │   ├── *PropertiesPanel.jsx        # 7 property panels
│   │   └── scene/
│   │       ├── AnimatedPlayerMesh.jsx  # Player model + skeletal animation
│   │       ├── CameraController.jsx   # FP/TP/Orbit camera + physics
│   │       ├── SceneEnvironment.jsx   # Sky, ground, trees, mountains, day/night
│   │       ├── PolygonRenderers.jsx   # Pools, foundations, stairs, roofs
│   │       ├── WallSegment.jsx        # Wall mesh + openings
│   │       ├── RoomFloor.jsx          # Room floor planes
│   │       ├── BuildingComponents.jsx # Building meshes + preview
│   │       ├── ComparisonObjects.jsx  # Draggable comparisons
│   │       ├── GridComponents.jsx     # Grid overlay + CAD dots
│   │       └── NPCCharacter.jsx       # NPC figures
│   ├── hooks/
│   │   ├── useUser.jsx                # Auth + subscription context
│   │   ├── useIsMobile.js             # Mobile + landscape detection
│   │   ├── useBuildHistory.js         # Undo/redo state
│   │   └── useGrassTextures.js        # Procedural texture generation
│   ├── services/
│   │   ├── analytics.js               # Event tracking
│   │   ├── imageAnalysis.js           # Frontend API wrapper
│   │   └── shareScene.js             # Scene serialization + Supabase
│   ├── utils/                         # 10 utility modules
│   ├── constants/landSceneConstants.js
│   ├── data/presets.js + landTemplates.js
│   └── lib/supabaseClient.js
├── APP_STATUS.md                      # This file
├── CLAUDE.md                          # Claude Code instructions
├── tasks/todo.md                      # Dev task tracker + session reviews
└── package.json
```

---

## What's Done vs What's Next

### Completed (Production-Ready)
- Full land definition system (4 methods)
- Complete building design toolkit (walls, rooms, doors, windows, pools, stairs, roofs, fences)
- Multi-story buildings with floor management
- AI floor plan analysis (Claude Vision)
- 4 camera modes with smooth transitions
- Player character with 13 animation clips
- NPC system with dialog
- Day/night cycle (Pro feature)
- Open-world environment (sky, terrain, trees, mountains)
- Quality presets (FAST/BEST)
- Mobile support (joystick, touch, responsive UI)
- 4 export types (PNG, PDF, GLB, screenshot)
- Scene sharing via Supabase
- Payment system (PayPal monthly + lifetime)
- Security hardening (JWT auth, RLS, error sanitization)
- Drawing UX improvements (Shift snap, spacebar, undo points, right-click exit)

### Improvements to Make

#### High Priority — Polish & Revenue
| Item | Impact | Effort |
|------|--------|--------|
| Fix character arm T-pose | Visual quality | Medium (needs bone axis debugging) |
| PayPal sandbox testing end-to-end | Revenue | Low (manual testing) |
| Onboarding improvement (guide users to build) | Retention | Medium |
| Loading screen / progress indicator | First impression | Low |
| Performance profiling (large designs 50+ walls) | Usability | Medium |

#### Medium Priority — Feature Expansion
| Item | Impact | Effort |
|------|--------|--------|
| Furniture library (beds, tables, chairs, etc.) | Interior design use case | High |
| Terrain elevation (hills, slopes) | Realism | High |
| Driveways & pathways (hardscape tools) | Completeness | Medium |
| Vegetation tools (trees, bushes, gardens) | Landscaping use case | Medium |
| Cost estimation (material lists + pricing) | Professional use case | High |
| Saved projects (multiple designs per user) | User retention | Medium |
| Undo/redo for all operations (not just walls) | UX | Medium |

#### Low Priority — Advanced Features
| Item | Impact | Effort |
|------|--------|--------|
| CAD import (DXF/DWG) | Professional users | High |
| Real-time collaboration (multi-user) | Team use case | Very High |
| WebXR/AR (VR walkthrough, mobile AR) | Wow factor | High |
| TypeScript full migration | Code quality | Medium |
| Unit test suite (Vitest) | Reliability | Medium |
| App.jsx refactor (extract into hooks) | Maintainability | Medium |

---

## Technical Debt

### Resolved
- Bundle: 2MB → 880KB gzipped (code splitting)
- LandScene.jsx: 9109 → 3700 lines (component extraction)
- Character model: 62MB FBX → 3.1MB optimized GLB
- Asset hosting: Git LFS → Supabase Storage (Vercel-compatible)
- Error boundary for 3D canvas crashes
- Z-fighting and transparent material rendering
- Dead code cleanup (unused move handlers)

### Remaining
| Issue | Impact | Priority |
|-------|--------|----------|
| App.jsx ~4100 lines | Maintainability | Medium |
| LandScene.jsx ~3700 lines | Maintainability | Low (acceptable) |
| No unit tests | Reliability | Medium |
| Three.js chunk 382KB gzipped | Load time | Low (inherent to 3D) |
| Partial TypeScript (2 files) | Code quality | Low |

---

## Controls Quick Reference

### Desktop
| Key | Action |
|-----|--------|
| W/A/S/D | Move |
| Shift (movement) | Run |
| Shift (drawing) | Snap to 45-degree angles |
| Space (movement) | Jump |
| Space (drawing) | Confirm point |
| Ctrl+Z | Undo (drawing point or last wall action) |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Right-click (drawing) | Exit drawing mode |
| V | Toggle first-person / third-person |
| E | Talk to nearby NPC |
| R | Rotate selected object |
| Del | Delete selected object |
| Escape | Cancel current tool / deselect |
| 1/2/3 | View mode (First-person / Orbit / 2D) |
| Q/T/G/C/V/B/N/H/J/X | Build tools |

### Mobile
| Control | Action |
|---------|--------|
| Left joystick | Move |
| Run button | Toggle run |
| Jump button | Jump |
| Talk button | Talk to nearby NPC |
| Use button | Select nearby building |

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npx vercel --prod    # Deploy to production
```

---

## Development Timeline

| Date | Focus | Status |
|------|-------|--------|
| Feb 7-9, 2026 | Drawing UX: Shift snap, spacebar confirm, undo points, right-click exit, camera lock, selection toasts | Done |
| Feb 7, 2026 | Character model fix: FBX→GLB unit scale, auto-detect height, Supabase Storage hosting | Done |
| Feb 6, 2026 | Day/Night cycle (auto-cycling, sky shader, stars, time slider) | Done |
| Feb 6, 2026 | Security hardening (JWT auth, subscription check, error sanitization) | Done |
| Feb 6, 2026 | Open world visuals (golden hour, mountains, trees, warm fog) | Done |
| Feb 5, 2026 | Terrain improvements (dirt texture, 2000m ground plane) | Done |
| Feb 5, 2026 | Transparent material rendering fixes | Done |
| Feb 1, 2026 | Mobile Talk/Use buttons, landscape mode, responsive layout | Done |
| Jan 24, 2026 | Removed fixtures/furniture feature (user requested) | Done |
| Jan 23, 2026 | Multi-story buildings, click-to-add-floors, export overhaul | Done |
| Jan 22, 2026 | NPC dialog system, payment frontend | Done |
| Earlier | First-person camera, bundle optimization, LandScene refactor | Done |

---

## Summary

**Sitea is a mature, feature-rich 3D land visualization app** deployed at https://sitea-one.vercel.app.

**What's ready:**
- Complete land visualization (4 definition methods)
- Full building design toolkit (Sims 4-style: walls, rooms, doors, windows, pools, roofs, stairs, fences)
- Multi-story support with floor management
- AI floor plan import (Claude Vision)
- Immersive open world (day/night cycle, terrain, trees, mountains, sky)
- Player character with 13 animation clips
- NPC guide system
- 4 camera modes (first-person, third-person, orbit, 2D)
- 4 export types (PNG, PDF, GLB, screenshot)
- Scene sharing via Supabase
- Mobile support (joystick, touch, responsive)
- Payment system (PayPal monthly + lifetime, fully wired)
- Security (JWT auth, RLS, input validation)
- Drawing UX (shift snap, spacebar, undo points, right-click exit)

**Biggest remaining opportunities:**
1. Fix character arm T-pose animation
2. Furniture/interior design library
3. Terrain elevation (hills, slopes)
4. Saved projects (multiple designs per user)
5. Cost estimation tools
