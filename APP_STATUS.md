# Sitea - 3D Land & Building Visualizer: Complete Status Report

**Last Updated:** February 9, 2026
**Live URL:** https://sitea-one.vercel.app
**Deployment:** Vercel via `npx vercel --prod`

---

## Vision & Purpose

**Sitea** is a **browser-based 3D land and building visualization platform** that transforms abstract property measurements and floor plans into immersive, explorable 3D experiences — no CAD skills, no downloads, no install.

**Core value proposition:** *See your land before you build. Walk through it. Design on it. Share it.*

**Target Users:**
- Real estate agents showing land to buyers
- Homeowners planning a build or renovation
- Architects doing early concept visualization
- Property developers comparing lot utilization
- Urban planners and investors evaluating parcels
- Anyone who needs to understand "how big is this land, really?"

**What makes Sitea unique:**
1. **Instant scale understanding** — compare your land to a soccer field, a Walmart, or the Great Pyramid
2. **Sims 4-style building tools** — intuitive room/wall/door/window design, no CAD knowledge needed
3. **AI floor plan import** — photograph a floor plan, Claude Vision + Roboflow CV extract walls/doors/windows automatically
4. **First-person walkthrough** — walk through your design at human scale, experience the space
5. **Browser-based** — works on desktop and mobile, nothing to install

---

## Current State: Production — Shipping

All core features are **stable and deployed**. Payment system is fully wired (PayPal + Supabase). Hybrid AI analysis (Roboflow CV + Claude Vision) is live. Mobile experience is polished.

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19.2 + Vite 7.2 + Tailwind CSS 4.1 |
| 3D Engine | Three.js 0.181 + React Three Fiber 9.4 + Drei 10.7 |
| Backend | Vercel Serverless Functions |
| AI (Vision) | Claude Sonnet 4 (claude-sonnet-4-20250514) |
| AI (CV) | Roboflow CubiCasa5K object detection model |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Payments | PayPal (react-paypal-js) |
| PDF | jsPDF |
| Mobile | nipplejs virtual joystick |
| Asset Hosting | Supabase Storage (GLB models, public bucket + CORS) |

### Codebase Metrics
| Metric | Value |
|--------|-------|
| Total source code | ~25,000+ lines |
| App.jsx | ~4,100 lines |
| LandScene.jsx | ~3,700 lines |
| Components | 35+ |
| Utilities | 10 |
| Custom hooks | 4 |
| Services | 3 |
| API endpoints | 2 (floor plan analysis, site plan analysis) |
| Bundle (gzipped) | ~880KB total (Three.js = 382KB) |
| Build time | ~8-12 seconds |
| Build errors | 0 |

---

## Features: Complete Inventory

### 1. Land Definition & Setup
| Feature | Status |
|---------|--------|
| Rectangle land (length x width input) | Done |
| Custom polygon boundaries (click to draw) | Done |
| Land templates (7 preset lot sizes: 600m2 to 1 acre) | Done |
| Upload site plan (AI boundary detection) | Done |
| Area calculation (m2, ft2, acres, hectares) | Done |
| Unit switching (meters / feet / mm) | Done |
| Setback boundary visualization | Done |
| Polygon vertex editing with snapping | Done |
| Touch-friendly polygon dragging (pointer events) | Done |
| Onboarding walkthrough (3-step, close button) | Done |

### 2. Building Design System (Sims 4-Style)
| Feature | Status |
|---------|--------|
| Rectangular rooms (click-click corners) | Done |
| Polygon rooms (multi-click freeform) | Done |
| Standalone walls (thickness customizable) | Done |
| Half walls (railings, counters, dividers) | Done |
| Fences (5 styles: picket, privacy, chain-link, iron, ranch) | Done |
| Doors (single, double, sliding, garage with swing arcs) | Done |
| Windows (customizable width, height, sill height) | Done |
| Pools (polygon-based, depth 0.5-3m, deck, water color) | Done |
| Foundations/Platforms (polygon, adjustable height) | Done |
| Stairs (straight, L-shaped with railings) | Done |
| Roofs (gable, adjustable pitch 5-60 degrees, overhang) | Done |
| 10 preset buildings (house, garage, shed, barn, greenhouse, gazebo, etc.) | Done |
| Multi-story buildings (up to 5+ floors per room) | Done |
| Click-to-add-floors (extrude rooms vertically) | Done |
| Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) | Done |
| Grid snapping (1m default, adjustable) | Done |
| Vertex/edge snapping (2m threshold) | Done |
| Shift+draw for 45-degree angle snapping | Done |
| Spacebar to confirm drawing point | Done |
| Ctrl+Z undoes individual drawing points | Done |
| Right-click exits drawing mode | Done |
| Auto-exit drawing on polygon close | Done |
| Select, move, drag, rotate, delete tools | Done |
| Context-sensitive "Clear all" button | Done |
| 7 property panels (Room, Wall, Fence, Pool, Foundation, Stairs, Roof) | Done |

### 3. AI Floor Plan Generator (Pro Feature)
| Feature | Status |
|---------|--------|
| Image upload with preview (drag/drop or file select) | Done |
| Roboflow CubiCasa5K CV detection (walls, doors, windows) | Done |
| Claude Vision analysis with CV hints (guided detection) | Done |
| Graceful fallback (no API key or timeout = Claude-only) | Done |
| Scale calibration (click-to-calibrate dimension labels) | Done |
| 2D interactive editor (zoom, pan, select, drag walls) | Done |
| Wall endpoint snapping (0/45/90 degrees) | Done |
| 3D preview before committing to scene | Done |
| JWT auth + subscription check on API | Done |
| 1 free upload for free users, unlimited for Pro | Done |

### 4. Camera & Navigation
| Feature | Status |
|---------|--------|
| First-person mode (WASD + mouse look) | Done |
| Third-person follow camera (smooth lerp) | Done |
| Orbit camera (free rotation, scroll zoom) | Done |
| 2D top-down orthographic view | Done |
| Jump with gravity physics (9.81 m/s2) | Done |
| Head bob + lateral sway (walk/run) | Done |
| Camera lock during item drag | Done |
| Fit-to-land auto-frame | Done |
| Smooth mode transitions (FP <-> TP via scroll) | Done |
| Mobile touch look (pitch + yaw) | Done |
| Pinch zoom on mobile | Done |

### 5. Character & NPC System
| Feature | Status | Notes |
|---------|--------|-------|
| Player character (GLB from Supabase Storage) | Done | Auto-scaled via Box3 |
| 13 animation clips (idle, walk, run, jump, strafe, turn) | Done | |
| Animation crossfading (smooth transitions) | Done | |
| Root motion lock (Hips bone X/Z) | Done | |
| NPC guide characters (colored) | Done | |
| Proximity detection (E key / mobile Talk button) | Done | |
| Dialog system (chat bubbles) | Done | |
| Character arms T-pose | Bug | Arms stuck horizontal, needs bind-pose debugging |

### 6. Graphics & Environment
| Feature | Status |
|---------|--------|
| Day/Night cycle (1-hour auto-cycle for Pro, manual slider) | Done |
| Moonlight at night (ambient 0.9 + directional 0.4) | Done |
| Collapsible time slider on mobile (button + dropdown) | Done |
| Night stars (200 points, fade in/out at dusk/dawn) | Done |
| Realistic sky shader (7 time-of-day stops) | Done |
| Golden hour lighting (sun, ambient, fill) | Done |
| Dynamic fog (color/density varies with time) | Done |
| Procedural grass textures (canvas-based) | Done |
| Dirt/earth land plot texture | Done |
| 2000m ground plane (no visible edge) | Done |
| 120 scattered low-poly trees (InstancedMesh) | Done |
| 3-ring mountain silhouettes (parallax) | Done |
| Shadow mapping (quality-dependent) | Done |
| FAST/BEST quality presets | Done |

### 7. Comparison Objects (24+)
| Category | Objects |
|----------|---------|
| Sports (4) | Soccer Field, Basketball Court, Tennis Court, Olympic Pool |
| Buildings (2) | House (10x10m), Studio Apartment |
| Vehicles (3) | Sedan, School Bus, Shipping Container |
| Commercial (6) | 7-Eleven, McDonald's, Gas Station, Supermarket, Starbucks, Walmart |
| Landmarks (6) | Eiffel Tower, Statue of Liberty, Great Pyramid, Taj Mahal, Colosseum, Big Ben |
| Gaming (6) | Pokemon Center, Minecraft House, AC Villager House, Fortnite 1x1, Link's House, Sims Starter Home |
| Other (2) | Parking Space, King Size Bed |

All draggable, rotatable, with fit count calculations ("X fit on your land").

### 8. Export System
| Export | Status |
|--------|--------|
| PNG floor plan (dimensions, room labels, legend, grid) | Done |
| PDF report (A4, stats, floor plan, metadata) | Done |
| 3D screenshot (1x/2x/4x resolution) | Done |
| GLB/GLTF/OBJ model export (full scene geometry) | Done |

### 9. Sharing & Persistence
| Feature | Status |
|---------|--------|
| Shareable URLs via Supabase | Done |
| Read-only mode for shared scenes | Done |
| Scene serialization/deserialization (JSON) | Done |
| localStorage session persistence | Done |

### 10. Payment & Monetization
| Feature | Status |
|---------|--------|
| PricingModal with PayPal buttons | Done |
| Monthly plan: $9.99/month | Done |
| Lifetime plan: $149 one-time | Done |
| Feature gating (isPaidUser hook) | Done |
| Supabase subscriptions table | Done |
| JWT auth on API endpoints | Done |
| UpgradePrompt component | Done |
| Google OAuth + email/password auth | Done |

### 11. Mobile Support
| Feature | Status |
|---------|--------|
| Virtual joystick (nipplejs) | Done |
| Action buttons (Jump, Talk, Use, Run) | Done |
| Bottom nav (4 items + More overflow) | Done |
| Collapsible side panels | Done |
| CTA card hides when panel is open | Done |
| Safe area CSS (notch, home indicator) | Done |
| Touch controls (pinch zoom, tap, drag) | Done |
| Touch-friendly polygon point dragging (35px hit area) | Done |
| Touch camera look (pitch + yaw fix) | Done |
| Landscape mode support | Done |
| Collapsible day/night button (below minimap) | Done |

### 12. Security
| Feature | Status |
|---------|--------|
| JWT auth on API endpoints | Done |
| Subscription check before AI analysis | Done |
| Error message sanitization (no stack traces) | Done |
| Email validation | Done |
| Supabase RLS policies | Done |

---

## AI Analysis Pipeline

```
Floor Plan Image Upload
  |
  v
Roboflow CubiCasa5K (object detection)  ─── 1-3s, 10s timeout
  |  Returns: bounding boxes for walls, doors, windows
  |  Fallback: skipped if no API key or timeout
  v
formatRoboflowHints()
  |  Converts bboxes to approximate wall lines + door/window centers
  v
Claude Vision (claude-sonnet-4, temp=0)  ─── 20-45s
  |  Input: image + CV hints + detailed prompt
  |  Output: walls, doors, windows, rooms, stairs, scale
  v
Post-processing
  |  Ensure required fields, validate wall connectivity
  v
Client: 2D editor → 3D preview → commit to scene
```

**Total pipeline:** 22-49 seconds (within 60s Vercel limit)
**Verified metrics:** cvHintsUsed: true, roboflowDetections: 25 (test run)

---

## User Flow

```
New Visitor → Landing page with example land (~2750 m2)
    |
    v
Walk around in first-person (WASD or mobile joystick)
    |
    v
  +---------------------------------------------------+
  | Define Land  → Rectangle / Polygon / Template      |
  | Compare      → Overlay soccer fields, buildings    |
  | Build        → Walls, rooms, pools, roofs, stairs  |
  | Export       → PNG / PDF / GLB / Share link         |
  +---------------------------------------------------+
    |
    v
Pro Upgrade Trigger (2nd floor plan upload or pro feature)
    → PricingModal → PayPal → Subscription saved
    → Day/night cycle + unlimited AI uploads unlocked
```

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Character arms T-pose | Medium | Arms stuck horizontal when idle/walking. Needs bind-pose bone axis debugging. |
| Mobile landscape refinements | Low | Minor button positioning inconsistencies |
| Large design PDF export | Low | 50+ wall designs may timeout on slow connections |

---

## File Structure

```
Sitea1/
├── api/
│   ├── analyze-floor-plan.js          # Claude Vision + Roboflow CV, JWT auth
│   └── analyze-site-plan.js           # Land boundary detection from site plans
├── src/
│   ├── main.jsx                       # Entry point (providers, router)
│   ├── App.jsx (~4100 lines)          # Main state, callbacks, UI shell
│   ├── index.css                      # Tailwind + custom animations
│   ├── components/
│   │   ├── LandScene.jsx (~3700)      # 3D scene engine (R3F Canvas)
│   │   ├── LandPanel.jsx              # Land definition UI
│   │   ├── BuildPanel.jsx             # Building tools + floor controls
│   │   ├── ComparePanel.jsx           # Comparison objects (24+)
│   │   ├── ExportPanel.jsx            # 4 export types
│   │   ├── AuthModal.jsx              # Sign in/up (Google OAuth + email)
│   │   ├── PricingModal.jsx           # PayPal subscription UI
│   │   ├── FloorPlanGeneratorModal.jsx # AI floor plan editor
│   │   ├── Onboarding.jsx             # Welcome walkthrough (close button)
│   │   ├── PolygonEditor.jsx          # Land polygon drawing
│   │   ├── ImageTracer.jsx            # Wall tracing on images
│   │   ├── ShapeEditor.jsx            # Shape editing (pointer events)
│   │   ├── Minimap.jsx                # Mini 2D map
│   │   ├── UpgradePrompt.jsx          # Pro upgrade prompts
│   │   ├── *PropertiesPanel.jsx (x7)  # Room, Wall, Fence, Pool, Foundation, Stairs, Roof
│   │   └── scene/
│   │       ├── AnimatedPlayerMesh.jsx  # Player model + 13 animations
│   │       ├── CameraController.jsx    # FP/TP/Orbit + physics + touch fix
│   │       ├── SceneEnvironment.jsx    # Sky, ground, trees, mountains
│   │       ├── PolygonRenderers.jsx    # Pools, foundations, stairs, roofs
│   │       ├── WallSegment.jsx         # Wall mesh + openings
│   │       ├── ComparisonObjects.jsx   # Draggable comparisons
│   │       └── NPCCharacter.jsx        # NPC figures
│   ├── hooks/                          # useUser, useIsMobile, useBuildHistory, useGrassTextures
│   ├── services/                       # analytics, imageAnalysis, shareScene
│   ├── utils/                          # 10 modules (export, collision, texture, etc.)
│   ├── constants/landSceneConstants.js
│   └── data/                           # landTemplates, presets
├── APP_STATUS.md                       # This file
├── CLAUDE.md                           # Claude Code instructions
├── tasks/todo.md                       # Dev task tracker
└── package.json
```

---

## Development Timeline

| Date | Focus | Status |
|------|-------|--------|
| Feb 9, 2026 | Hybrid AI: Roboflow CV + Claude Vision for floor plans | Done |
| Feb 9, 2026 | Night lighting fix (moonlight, ambient boost to 0.9) | Done |
| Feb 9, 2026 | Day/night cycle: 1-hour auto, collapsible mobile slider | Done |
| Feb 9, 2026 | Mobile touch camera fix (pitch/yaw in 1P mode) | Done |
| Feb 9, 2026 | Mobile polygon point dragging (pointer events, 35px hit area) | Done |
| Feb 9, 2026 | Mobile CTA hides behind side panels | Done |
| Feb 9, 2026 | Onboarding modal close button (X) | Done |
| Feb 9, 2026 | Olympic Pool moved to Sports category | Done |
| Feb 7-9, 2026 | Drawing UX: Shift snap, spacebar, undo points, right-click exit | Done |
| Feb 7, 2026 | Character model: FBX to GLB, auto-scale, Supabase hosting | Done |
| Feb 6, 2026 | Day/Night cycle, sky shader, stars, time slider | Done |
| Feb 6, 2026 | Security: JWT auth, subscription check, error sanitization | Done |
| Feb 6, 2026 | Open world: golden hour, mountains, trees, fog | Done |
| Feb 5, 2026 | Terrain: dirt texture, 2000m ground plane, transparency fixes | Done |
| Feb 1, 2026 | Mobile: Talk/Use buttons, landscape mode, responsive layout | Done |
| Jan 23, 2026 | Multi-story buildings, floor management, export overhaul | Done |
| Jan 22, 2026 | NPC dialog system, payment frontend | Done |
| Earlier | First-person camera, bundle optimization, LandScene refactor | Done |

---

## What's Next: Roadmap to Keep Improving

### Phase 1: Ship & Validate (Now)
The app is production-ready. Focus on getting users, collecting feedback, and validating the payment flow.

| Item | Why | Effort |
|------|-----|--------|
| PayPal end-to-end testing (sandbox + live) | Validate revenue works | Low |
| Analytics dashboard (track key funnels) | Know where users drop off | Low |
| Landing page / marketing site | Drive signups | Medium |
| SEO + social sharing meta tags | Organic discovery | Low |
| Fix character arm T-pose | Visual polish | Medium |

### Phase 2: Retention & Engagement
Once users are coming in, keep them coming back.

| Item | Why | Effort |
|------|-----|--------|
| Saved projects (multiple designs per user) | Users can't save today, biggest gap | Medium |
| Better onboarding (guided tour: define land -> build -> walk) | First-time user experience | Medium |
| Furniture library (beds, tables, chairs, appliances) | Interior design use case | High |
| Room textures (floor materials, wall paint colors) | Visual quality | Medium |
| Undo/redo for all operations (not just walls) | Core UX | Medium |

### Phase 3: Professional Features
Expand into professional use cases.

| Item | Why | Effort |
|------|-----|--------|
| Site plan AI improvement (OpenCV contour detection) | More accurate site plan boundaries | Medium |
| Cost estimation (material lists + rough pricing) | Real estate / builder value | High |
| Terrain elevation (hills, slopes, grading) | Realistic site modeling | High |
| Driveways, pathways, hardscape tools | Completeness | Medium |
| Vegetation tools (trees, bushes, gardens) | Landscaping use case | Medium |
| CAD import (DXF/DWG) | Professional interop | High |

### Phase 4: Scale & Differentiate
Long-term vision features.

| Item | Why | Effort |
|------|-----|--------|
| Real-time collaboration (multi-user editing) | Team workflows | Very High |
| WebXR / AR preview (walk through in VR, view in AR on phone) | Wow factor, differentiation | High |
| AI room layout suggestions | "Design this room for me" | High |
| Neighborhood context (import surrounding buildings) | Realistic context | High |
| API for integrations (embed viewer in real estate sites) | B2B revenue | High |

---

## Technical Debt

### Resolved
- Bundle: 2MB -> 880KB gzipped (code splitting)
- LandScene.jsx: 9109 -> 3700 lines (component extraction)
- Character model: 62MB FBX -> 3.1MB optimized GLB
- Asset hosting: Git LFS -> Supabase Storage (Vercel-compatible)
- Error boundary for 3D canvas crashes
- Z-fighting and transparent material rendering
- Touch camera look not updating pitch (fixed: removed setFromQuaternion)
- Mobile polygon dragging not working (fixed: switched to pointer events)

### Remaining
| Issue | Impact | Priority |
|-------|--------|----------|
| App.jsx ~4100 lines | Maintainability | Medium |
| No unit tests | Reliability | Medium |
| Three.js chunk 382KB gzipped | Load time | Low (inherent to 3D) |
| Partial TypeScript (2 files) | Code quality | Low |

---

## Environment Variables (Vercel)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PAYPAL_CLIENT_ID
VITE_PAYPAL_MONTHLY_PLAN_ID
VITE_PAYPAL_LIFETIME_PLAN_ID
ANTHROPIC_API_KEY
ROBOFLOW_API_KEY
```

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
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Right-click (drawing) | Exit drawing mode |
| V | Toggle FP / TP |
| E | Talk to NPC |
| R | Rotate selected |
| Del | Delete selected |
| Escape | Cancel / deselect |

### Mobile
| Control | Action |
|---------|--------|
| Left joystick | Move |
| Swipe on screen | Look around |
| Run button | Toggle run |
| Jump button | Jump |
| Talk button | Talk to NPC |
| Sun/Moon button | Open day/night slider |

---

## Summary

**Sitea is shipping.** It's a complete 3D land visualization platform with:

- **4 ways to define land** (rectangle, polygon, templates, AI upload)
- **Full Sims 4-style building toolkit** (walls, rooms, doors, windows, pools, roofs, stairs, fences, multi-story)
- **Hybrid AI floor plan import** (Roboflow CV + Claude Vision, 22s pipeline)
- **Immersive open world** (day/night cycle, terrain, trees, mountains, stars, moonlight)
- **4 camera modes** (first-person walkthrough, third-person, orbit, 2D)
- **24+ comparison objects** across 7 categories
- **4 export formats** (PNG, PDF, GLB, screenshot)
- **Mobile-first** (joystick, touch controls, responsive panels)
- **Revenue-ready** (PayPal monthly $9.99 / lifetime $149, feature gating, JWT auth)

The next focus is **getting users, validating payments, and collecting feedback** to drive the roadmap.
