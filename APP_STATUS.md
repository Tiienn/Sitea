# Sitea - Land Visualizer: Complete Status Report

**Last Updated:** February 1, 2026
**Live URL:** https://sitea-one.vercel.app
**Deployment:** Vercel (auto-builds from local push)

---

## Vision & Purpose

**Sitea** is a **web-based 3D land and building visualization tool** that transforms abstract property measurements and floor plans into immersive, explorable 3D experiences.

**Core value proposition:** *Turn abstract land measurements into tangible, explorable 3D experiences.*

**Target Users:**
- Real estate professionals (agents, developers)
- Architects and designers
- Homeowners planning renovations/builds
- Urban planners
- Property investors
- Anyone needing to visualize land and building scale

**What makes it unique:** Users can draw their land boundaries, design buildings with Sims 4-style tools, import AI-analyzed floor plans, and then walk through their designs in first-person — all in a browser with no install.

---

## Current State: Production Ready

All core features are **stable and deployed**. The only blocker for revenue is PayPal backend setup (frontend is complete).

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19.2 + Vite 7.2 + Tailwind CSS 4.1 |
| 3D Engine | Three.js 0.181 + React Three Fiber 9.4 + Drei 10.7 |
| Backend | Vercel Serverless Functions |
| AI | Claude Vision (claude-sonnet-4-20250514) |
| Database | Supabase (PostgreSQL) |
| Payments | PayPal (react-paypal-js) — frontend only |
| PDF | jsPDF |
| Mobile | nipplejs virtual joystick |
| TypeScript | Partial migration (types/ + labels.ts) |

### Codebase Metrics
| Metric | Value |
|--------|-------|
| Total source code | ~20,000+ lines |
| Components | 33 (13 panels/modals, 12 scene, 8 property panels) |
| Utilities | 10 |
| Custom hooks | 3 |
| Services | 3 |
| Bundle (initial) | 348KB gzipped (down from 2MB) |
| Build time | ~9 seconds |
| Build errors | 0 |

---

## Features: What's Working

### 1. Land Definition & Visualization
- Rectangle land (input length x width)
- Custom polygon boundaries (click to draw)
- Image upload for AI-assisted tracing
- Area calculation (m², ft², acres, hectares)
- Unit switching (meters / feet)
- Setback boundary visualization
- Polygon vertex editing with snapping
- Land templates (preset lot sizes)

### 2. Building Design System (Sims 4-Style)
- Wall tool (click-drag with snapping)
- Room auto-detection from enclosed walls
- Door placement on walls (single/double)
- Window placement (customizable size/sill height)
- Half walls
- Fences (5 styles: picket, privacy, chain-link, iron, ranch)
- Pools (custom polygon drawing, adjustable depth)
- Foundations (adjustable height)
- Stairs (straight + L-shaped)
- Roofs (gable, flat, hip, shed, adjustable pitch)
- Preset buildings (houses, garage, shed, barn)
- Building rotation (15-degree snapping)
- Overlap detection (yellow highlight)
- Undo/redo history (full state)
- Grid snapping (adjustable size)
- Select, move, and delete tools

### 3. Multi-Story Buildings
- Floor state management (ground, 1st, 2nd, etc.)
- Floor switching UI in Build panel
- Floor height customization (2.4m-4m, default 2.7m)
- Walls render at correct Y offset per floor
- Inactive floors shown with transparency
- Click-to-add-floors (select room, choose floor count, click)
- Room detection runs per floor independently

### 4. Comparison Objects (24+)
Soccer fields, basketball courts, tennis courts, swimming pools, parking spaces, vehicles (car, bus, container), buildings (house, apartment), landmarks, commercial establishments — all draggable and rotatable on the land.

### 5. AI Floor Plan Generator (Paid Feature)
- Image upload with preview
- Claude Vision analysis via Vercel serverless function
- Full 2D interactive editor with zoom (0.5x-4x) and pan
- Wall extraction (exterior + interior)
- Door/window detection with symbols
- Room labeling with areas
- Shape detection (L/U-shaped, rectangular)
- Edit mode (select, drag, delete, draw new walls)
- Wall endpoint snapping (0°/45°/90°)
- Scale calibration (click-to-calibrate)
- 3D preview before committing to scene

### 6. Camera & Navigation
- First-person mode (WASD + mouse look)
- Jumping with physics (Space key, gravity, acceleration)
- Movement momentum (slide to stop)
- Head bob with lateral sway
- Third-person follow camera (V key toggle)
- Orbit camera (full 3D rotation, scroll zoom)
- Orthogonal 2D top-down view (CAD-style with dot grid)
- Smooth transitions between camera modes
- Mobile virtual joystick (nipplejs)
- Mobile action buttons: Jump, Talk, Use, Run

### 7. NPC System
- 2 NPC guide characters positioned outside land boundary
- Proximity detection (green indicator + "Press E to talk")
- Chat bubble dialog (non-blocking, renders in 3D scene)
- Multiple dialog options per NPC (land advice + design tips)
- E key interaction on desktop
- Talk button interaction on mobile (DOM custom events)

### 8. Export System (4 Types)
- **PNG Floor Plan** — customizable resolution
- **PDF Report** — A4 layout with floor plan image, project stats, timestamp
- **3D Screenshot** — PNG/JPEG with 1x/2x/4x resolution
- **3D Model Export** — GLB (recommended), GLTF, OBJ for Blender/SketchUp/Unity

### 9. Data & Sharing
- Supabase scene sharing with shareable URLs
- localStorage persistence for local sessions
- Read-only mode for shared scenes

### 10. Payment System (Frontend Complete, Backend Pending)
- PricingModal with PayPal subscription buttons
- Monthly plan: $9.99/month
- Lifetime plan: $149 one-time
- Feature gating (1 free upload, then Pro required)
- UpgradePrompt component for gated actions
- useUser hook with subscription context
- localStorage fallback for subscription status
- **NOT YET CONNECTED** — needs PayPal app + Supabase table

### 11. Mobile Support
- `useIsMobile` + `useIsLandscape` hooks
- **Portrait mode:**
  - Bottom ribbon navigation (4 visible items + "More" overflow)
  - Collapsible side panels
  - Safe area CSS (notches, home indicator)
- **Landscape mode:**
  - Bottom ribbon becomes left vertical icon sidebar (48px)
  - All panels repositioned (top:0, left:48px)
  - Action buttons and joystick repositioned
  - Minimap moves to bottom-right
- Virtual joystick with movement + 4 action buttons
- Touch controls: touch-action:none, onTouchStart handlers
- Desktop completely unaffected (hooks only activate on touch devices)

### 12. UI/UX
- Dark theme design system with CSS custom properties
- Bottom ribbon navigation (icon + label)
- Icon rail + expandable side panels
- 7 property panels (Room, Wall, Fence, Pool, Foundation, Stairs, Roof)
- Collapsible sections within panels
- Onboarding walkthrough (movement → scale → ownership)
- Keyboard shortcuts (1/2/3 for view modes, R/W/D/N/S/X for tools)

---

## File Structure

```
Sitea1/
├── api/
│   └── analyze-floor-plan.js        # Claude Vision serverless endpoint
│
├── src/
│   ├── main.jsx                     # Entry point (providers, router)
│   ├── App.jsx                      # Main app state + UI (~2600 lines)
│   ├── index.css                    # Global styles + design tokens
│   │
│   ├── components/
│   │   ├── LandScene.jsx            # 3D scene engine (~3400 lines)
│   │   ├── LandPanel.jsx            # Land definition UI
│   │   ├── BuildPanel.jsx           # Building tools + floor controls
│   │   ├── ComparePanel.jsx         # Comparison objects
│   │   ├── ExportPanel.jsx          # 4 export types
│   │   ├── FloorPlanGeneratorModal.jsx  # AI floor plan editor
│   │   ├── UploadImageModal.jsx     # Image upload + detection
│   │   ├── PricingModal.jsx         # PayPal subscription UI
│   │   ├── UpgradePrompt.jsx        # Pro upgrade prompts
│   │   ├── NPCDialog.jsx            # NPC chat overlay
│   │   ├── ImageTracer.jsx          # Polygon tracing from image
│   │   ├── Minimap.jsx              # Mini 2D map (landscape-aware)
│   │   ├── Onboarding.jsx           # Welcome walkthrough
│   │   ├── *PropertiesPanel.jsx     # 7 property panels
│   │   │
│   │   └── scene/                   # 3D scene components (inside Canvas)
│   │       ├── CameraController.jsx     # FP/TP camera + physics
│   │       ├── AnimatedPlayerMesh.jsx   # Player character model
│   │       ├── NPCCharacter.jsx         # NPC figures + chat bubble
│   │       ├── ComparisonObjects.jsx    # Draggable comparisons
│   │       ├── WallSegment.jsx          # Wall rendering (multi-floor)
│   │       ├── RoomFloor.jsx            # Room floor planes (multi-floor)
│   │       ├── BuildingComponents.jsx   # Building meshes + preview
│   │       ├── PolygonRenderers.jsx     # Pools, foundations, stairs
│   │       ├── SceneEnvironment.jsx     # Lighting, sky, fog
│   │       └── GridComponents.jsx       # Grid overlay + CAD dots
│   │
│   ├── hooks/
│   │   ├── useBuildHistory.js       # Undo/redo state management
│   │   ├── useUser.jsx              # Subscription/payment context
│   │   └── useIsMobile.js           # Mobile + landscape detection
│   │
│   ├── services/
│   │   ├── imageAnalysis.js         # Image boundary detection
│   │   ├── shareScene.js            # Supabase scene sharing
│   │   └── analytics.js             # Event tracking
│   │
│   ├── utils/
│   │   ├── pdfExport.js             # PDF report generation
│   │   ├── screenshotCapture.js     # 3D screenshot capture
│   │   ├── modelExport.js           # GLB/GLTF/OBJ export
│   │   ├── exportFloorPlan.js       # PNG floor plan export
│   │   ├── floorPlanConverter.js    # Pixel-to-3D coordinate conversion
│   │   ├── collision2d.js           # Overlap detection
│   │   ├── roomDetection.js         # Room auto-detection from walls
│   │   ├── textureGenerators.js     # Procedural material textures
│   │   ├── presetPlacer.js          # Building placement logic
│   │   ├── npcHelpers.js            # NPC position calculation
│   │   └── labels.ts                # Edge labels (TypeScript)
│   │
│   ├── types/index.ts               # TypeScript type definitions
│   ├── data/presets.js              # Building presets (with floor support)
│   ├── data/landTemplates.js        # Preset lot sizes
│   └── constants/landSceneConstants.js  # Camera, quality, physics constants
│
├── PRD.md                           # Product requirements document
├── APP_STATUS.md                    # This file
├── CLAUDE.md                        # Claude Code instructions
├── tasks/todo.md                    # Session notes & review log
├── package.json                     # Dependencies
├── vite.config.js                   # Build config (code splitting)
├── tsconfig.json                    # TypeScript config
└── vercel.json                      # Vercel deployment config
```

---

## What's Not Done Yet

### Revenue Blocker (HIGH PRIORITY)

**PayPal backend is not connected.** The frontend is 100% complete — PricingModal, subscription buttons, feature gating, useUser hook all work. But no actual payments can be processed.

**To unblock revenue:**
1. Create PayPal developer app at https://developer.paypal.com/dashboard/applications
2. Copy Client ID to `.env` as `VITE_PAYPAL_CLIENT_ID`
3. Create subscription plan in PayPal for $9.99/month
4. Copy Plan ID to `.env` as `VITE_PAYPAL_MONTHLY_PLAN_ID`
5. Create Supabase `subscriptions` table (SQL in PRD.md)
6. Test end-to-end: checkout modal → PayPal → save to Supabase → feature unlock

### Medium Priority
| Item | Notes |
|------|-------|
| Unit tests | Vitest not yet configured |
| TypeScript migration | Only 2 files migrated (types/index.ts, labels.ts) |
| App.jsx size | ~2600 lines — could extract more state into hooks |

### Nice-to-Have (Future)
| Item | Notes |
|------|-------|
| Terrain elevation | Hills, slopes |
| Vegetation | Trees, bushes, landscaping |
| Driveways/pathways | Hardscape tools |
| CAD import (DXF/DWG) | Professional use case |
| Real-time collaboration | Multi-user editing |
| Cost estimation | Material lists + pricing |
| WebXR/AR | VR walkthrough, mobile AR placement |
| Furniture library | Interior design |

---

## Technical Debt

### Resolved
- Bundle: 2MB → 348KB initial load (83% reduction via code splitting)
- LandScene.jsx: 9109 → 3432 lines (62% reduction via component extraction)
- Error boundary for 3D canvas crashes
- TypeScript setup complete (gradual migration)

### Remaining
| Issue | Impact | Priority |
|-------|--------|----------|
| App.jsx ~2600 lines | Maintainability | Medium |
| LandScene.jsx ~3400 lines | Maintainability | Low (acceptable) |
| No unit tests | Reliability | Medium |
| Large chunks (Three.js 378KB gz) | Load time | Low (inherent to 3D) |

---

## Key Technical Patterns

**R3F Canvas boundary:** React Three Fiber uses a separate React reconciler. Props and state updates from React DOM (App.jsx) don't reliably cross into the Canvas. Solutions used:
- `joystickInput` ref: shared mutable ref for joystick → CameraController
- `mobileJumpTrigger` prop + `useFrame` ref comparison: for jump trigger
- DOM custom events (`window.dispatchEvent`/`addEventListener`): for Talk/Use triggers — same pattern as the E key handler

**Multi-story architecture:** Walls have a `floorLevel` property. Room detection groups walls by floor before finding enclosed spaces. Rendering offsets walls/rooms by `floorLevel * floorHeight` on the Y axis.

**Feature gating:** `useUser` hook provides `isPaidUser` boolean. Components call `requirePaid()` which returns true for paid users or shows UpgradePrompt for free users. localStorage caches subscription status.

---

## Controls Quick Reference

### Desktop
| Key | Action |
|-----|--------|
| W/A/S/D | Move |
| Shift | Run |
| Space | Jump |
| V | Toggle first-person / third-person |
| E | Talk to nearby NPC |
| 1/2/3 | Switch view mode (1P / Orbit / 2D) |
| R/W/D/N/S/X | Room / Wall / Door / Window / Select / Delete tools |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Escape | Cancel current tool |

### Mobile
| Control | Action |
|---------|--------|
| Left joystick | Move |
| Run button | Toggle run |
| Jump button | Jump |
| Talk button | Talk to nearby NPC (highlights when near) |
| Use button | Select nearby building (highlights when near) |

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
vercel --prod        # Deploy to Vercel production
```

---

## Recent Development Timeline

| Date | Focus | Status |
|------|-------|--------|
| Feb 1, 2026 | Mobile Talk/Use buttons (DOM event pattern) | Done |
| Feb 1, 2026 | Mobile landscape mode (left sidebar nav) | Done |
| Feb 1, 2026 | Mobile responsive layout (overflow nav, collapsible panels) | Done |
| Jan 24, 2026 | Removed fixtures/furniture feature (user requested) | Done |
| Jan 23, 2026 | Multi-story buildings (floor system) | Done |
| Jan 23, 2026 | Click-to-add-floors feature | Done |
| Jan 23, 2026 | Export panel overhaul (4 export types) | Done |
| Jan 22, 2026 | NPC dialog system (chat bubbles) | Done |
| Jan 22, 2026 | Payment frontend (PricingModal + PayPal) | Done |
| Earlier | First-person camera, bundle optimization, LandScene refactor | Done |

---

## Summary

**Sitea is a mature, feature-complete 3D land visualization app** deployed at https://sitea-one.vercel.app.

**What's ready:**
- Land visualization (rectangle, polygon, image trace)
- Building design (walls, doors, windows, pools, roofs, stairs, fences)
- Multi-story support
- AI floor plan import
- 4 export types (PNG, PDF, screenshot, 3D model)
- 4 camera modes (first-person, third-person, orbit, 2D)
- Mobile UI (portrait + landscape, virtual joystick, action buttons)
- Scene sharing via Supabase
- NPC system
- Feature gating + payment UI

**What's blocking revenue:**
- PayPal developer app not created
- Supabase subscriptions table not created
- ~2-4 hours of manual setup to unlock payments

**Next big feature opportunities:**
- Terrain elevation
- Furniture/interior design library
- Real-time collaboration
- CAD import/export
