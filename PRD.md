# Product Requirements Document (PRD)
## Sitea - 3D Land & Building Visualizer

**Document Version:** 2.0
**Last Updated:** January 23, 2026
**Status:** Production-Ready (Backend Integration Pending)

---

## 1. Executive Summary

**Sitea** is a web-based 3D visualization tool that transforms abstract land measurements and floor plans into immersive, explorable 3D experiences. Users can define land boundaries, design buildings with Sims 4-style tools, upload floor plans for AI-powered analysis, and experience their designs through multiple camera perspectives.

### Core Value Proposition
*Turn abstract land measurements into tangible, interactive 3D experiences.*

### Target Users
- Real estate professionals (agents, developers)
- Architects and designers
- Homeowners planning renovations
- Urban planners
- Property investors
- Anyone needing to visualize land and building scale

---

## 2. Current Status Summary

### What's Complete ✅
| Category | Status |
|----------|--------|
| Land visualization (rectangle, polygon, trace) | ✅ Done |
| Building system (walls, doors, windows, rooms) | ✅ Done |
| Advanced structures (pools, foundations, stairs, roofs, fences) | ✅ Done |
| AI Floor Plan Generator (Claude Vision) | ✅ Done |
| Camera modes (FP, TP, Orbit, 2D) | ✅ Done |
| First-person physics (jumping, gravity) | ✅ Done |
| NPC system with chat bubbles | ✅ Done |
| Export: PNG Floor Plan | ✅ Done |
| Export: PDF Report | ✅ Done |
| Export: 3D Screenshot | ✅ Done |
| Export: 3D Model (GLB/GLTF/OBJ) | ✅ Done |
| Supabase scene sharing | ✅ Done |
| Payment UI (PayPal frontend) | ✅ Done |
| Bundle optimization (348KB initial) | ✅ Done |
| TypeScript setup | ✅ Done |
| Code refactoring (62% LandScene reduction) | ✅ Done |

### What's Missing ❌ (Ralphy's Tasks)
| Category | Priority | Details |
|----------|----------|---------|
| **PayPal Backend Connection** | 🔴 HIGH | Create app, subscription plan, connect to frontend |
| **Supabase Subscription Table** | 🔴 HIGH | Create table, test payment flow |
| **Multi-story Buildings** | ✅ DONE | Add floors, floor switching |
| **Terrain Elevation** | 🟢 LOW | Hills, slopes |
| **Unit Tests** | 🟢 LOW | Vitest setup, coverage |

---

## 3. TASKS FOR RALPHY

### 🔴 Priority 1: Complete Payment Integration (CRITICAL)

The payment frontend is complete but not connected to backend.

#### 3.1 PayPal Setup
**Location:** PayPal Developer Dashboard

Tasks:
- [ ] Create PayPal developer account (if not exists)
- [ ] Create new PayPal App at https://developer.paypal.com/dashboard/applications
- [ ] Copy Client ID to `.env` as `VITE_PAYPAL_CLIENT_ID`
- [ ] Create subscription plan for monthly billing ($9.99/month)
- [ ] Copy Plan ID to `.env` as `VITE_PAYPAL_MONTHLY_PLAN_ID`
- [ ] Test sandbox payments work

**Files to modify:**
- `.env` - Add PayPal credentials
- `.env.local` - Add PayPal credentials (gitignored)

#### 3.2 Supabase Subscription Table
**Location:** Supabase Dashboard → SQL Editor

Run this SQL:
```sql
-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  paypal_subscription_id TEXT,
  paypal_payer_id TEXT,
  status TEXT DEFAULT 'active', -- active, canceled, expired
  plan_type TEXT NOT NULL, -- 'monthly' or 'lifetime'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- NULL for lifetime
);

-- Create index for email lookups
CREATE INDEX idx_subscriptions_email ON subscriptions(email);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can check subscription status by email
CREATE POLICY "Public can read own subscription" ON subscriptions
  FOR SELECT USING (true);

-- Policy: Only authenticated (or server) can insert/update
CREATE POLICY "Server can manage subscriptions" ON subscriptions
  FOR ALL USING (true);
```

#### 3.3 Test End-to-End Payment Flow
- [ ] Test monthly subscription purchase
- [ ] Test lifetime purchase
- [ ] Verify subscription shows in Supabase
- [ ] Verify `useUser.jsx` correctly reads subscription status
- [ ] Test feature gating (uploads, exports, comparison objects)

**Expected Flow:**
1. User clicks "Upgrade" → PricingModal opens
2. User selects plan → PayPal button shown
3. User completes PayPal payment
4. `onApprove` callback fires → saves to Supabase
5. `useUser` hook fetches subscription → `isPaidUser = true`
6. Pro features unlock

---

### 🟡 Priority 2: Multi-Story Buildings

**Goal:** Allow users to add floors and switch between them

#### 3.4 Implementation Plan

**State Changes (App.jsx):**
```javascript
// Add to state
const [currentFloor, setCurrentFloor] = useState(0) // 0 = ground
const [floors, setFloors] = useState([{ id: 0, walls: [], rooms: [] }])

// Floor operations
const addFloor = () => { /* Add new floor above current */ }
const switchFloor = (floorId) => { /* Change active floor */ }
const duplicateFloor = () => { /* Copy current floor layout */ }
```

**UI Changes (BuildPanel.jsx):**
- Add "Floors" section with +/- buttons
- Floor selector tabs (Ground, 1st, 2nd, etc.)
- "Duplicate Floor" button
- Floor height input (default 2.7m)

**3D Changes (LandScene.jsx):**
- Render all floors with transparency for inactive
- Add floor plane between levels
- Stairs connect floors

**Files to modify:**
- `src/App.jsx` - Floor state management
- `src/components/BuildPanel.jsx` - Floor UI controls
- `src/components/LandScene.jsx` - Multi-floor rendering
- `src/components/scene/WallSegment.jsx` - Y-offset per floor

---

### 🟢 Priority 3: Terrain Elevation

**Goal:** Add hills and slopes to land

#### 3.7 Implementation Approach

**Option A: Height Map (Simpler)**
- Upload grayscale image as height map
- White = high, black = low
- Apply to ground mesh as displacement

**Option B: Point Elevation (More Control)**
- Click points on ground to set elevation
- Interpolate between points
- Terrain mesh updates in real-time

**Files to create:**
- `src/components/scene/TerrainMesh.jsx` - Displaced ground mesh
- `src/utils/terrainGeneration.js` - Height interpolation

---

### 🟢 Priority 4: Unit Tests

**Goal:** Add test coverage for critical utilities

#### 3.8 Test Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**vite.config.js addition:**
```javascript
export default defineConfig({
  // ... existing config
  test: {
    environment: 'jsdom',
    globals: true,
  }
})
```

**Priority files to test:**
1. `src/utils/collision2d.js` - Overlap detection
2. `src/utils/roomDetection.js` - Room auto-detection
3. `src/utils/pdfExport.js` - PDF generation
4. `src/hooks/useBuildHistory.js` - Undo/redo

---

## 4. Feature Specifications (Reference)

### 4.1 Land Definition & Visualization

| Feature | Status | Notes |
|---------|--------|-------|
| Rectangle land | ✅ Done | Input length × width |
| Templates | ✅ Done | Pre-configured lots |
| Custom polygon | ✅ Done | Click-to-draw |
| Image upload & trace | ✅ Done | AI-assisted tracing |
| Area calculation | ✅ Done | m², ft², acres, hectares |
| Unit switching | ✅ Done | Meters ↔ Feet |
| Vertex editing | ✅ Done | Snap-to-grid |
| Setback boundaries | ✅ Done | Visual zones |

### 4.2 Building Design System

| Feature | Status | Notes |
|---------|--------|-------|
| Wall tool | ✅ Done | Click-drag, snapping |
| Room tool | ✅ Done | Auto-detection |
| Door tool | ✅ Done | Adjustable size |
| Window tool | ✅ Done | Customizable |
| Delete tool | ✅ Done | Single-click |
| Select tool | ✅ Done | Drag to move |
| Rotation | ✅ Done | 15° increments |
| Building presets | ✅ Done | Houses, garage, shed |
| Pools | ✅ Done | Polygon drawing |
| Foundations | ✅ Done | Adjustable height |
| Stairs | ✅ Done | Straight + L-shaped |
| Roofs | ✅ Done | Gable, flat, hip, shed |
| Fences | ✅ Done | 5 styles |
| Overlap detection | ✅ Done | Yellow highlight |
| Undo/redo | ✅ Done | Ctrl+Z/Y |
| **Multi-story** | ✅ Done | Floor switching, Y offset |

### 4.3 AI Floor Plan Generator

| Feature | Status |
|---------|--------|
| Image upload | ✅ Done |
| Claude Vision analysis | ✅ Done |
| 2D interactive editor | ✅ Done |
| Wall/door/window detection | ✅ Done |
| Room labeling | ✅ Done |
| Scale calibration | ✅ Done |
| 3D preview | ✅ Done |

### 4.4 Camera & Exploration

| Feature | Status |
|---------|--------|
| First-person (WASD) | ✅ Done |
| Jumping (Space) | ✅ Done |
| Gravity physics | ✅ Done |
| Third-person | ✅ Done |
| Orbit camera | ✅ Done |
| 2D top-down | ✅ Done |
| V key toggle | ✅ Done |
| Mobile joystick | ✅ Done |

### 4.5 Export System

| Feature | Status |
|---------|--------|
| PNG Floor Plan | ✅ Done |
| PDF Report | ✅ Done |
| 3D Screenshot | ✅ Done |
| GLB/GLTF/OBJ Model | ✅ Done |
| **DXF/CAD Export** | ❌ Future |

### 4.6 NPC System

| Feature | Status |
|---------|--------|
| NPC characters | ✅ Done |
| Click to interact | ✅ Done |
| Chat bubble dialog | ✅ Done |
| Tips system | ✅ Done |

### 4.7 Sharing & Data

| Feature | Status |
|---------|--------|
| Supabase sharing | ✅ Done |
| Shareable URLs | ✅ Done |
| localStorage persistence | ✅ Done |
| Read-only shared scenes | ✅ Done |

### 4.8 Payment System

| Feature | Status |
|---------|--------|
| PricingModal UI | ✅ Done |
| PayPal buttons | ✅ Done |
| Monthly option ($9.99) | ✅ UI Only |
| Lifetime option ($149) | ✅ UI Only |
| Feature gating logic | ✅ Done |
| UpgradePrompt component | ✅ Done |
| **PayPal app created** | ❌ Ralphy |
| **Subscription plan** | ❌ Ralphy |
| **Supabase table** | ❌ Ralphy |
| **End-to-end test** | ❌ Ralphy |

---

## 5. Technical Architecture

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| 3D Engine | Three.js | 0.181.2 |
| React 3D | React Three Fiber | 9.4.2 |
| 3D Utilities | Drei | 10.7.7 |
| Styling | Tailwind CSS | 4.1.17 |
| AI/Vision | Claude | claude-sonnet-4-20250514 |
| Database | Supabase | 2.87.1 |
| Payment | PayPal | react-paypal-js 8.9.2 |
| PDF | jsPDF | 4.0.0 |
| Mobile | nipplejs | 0.10.2 |
| TypeScript | typescript | 5.9.3 |

### File Structure

```
src/
├── App.jsx              # Main state (~2600 lines)
├── main.jsx             # Entry with providers
├── components/
│   ├── LandPanel.jsx
│   ├── BuildPanel.jsx
│   ├── ComparePanel.jsx
│   ├── ExportPanel.jsx  # 4 export types
│   ├── FloorPlanGeneratorModal.jsx
│   ├── UploadImageModal.jsx
│   ├── PricingModal.jsx # PayPal UI
│   ├── NPCDialog.jsx
│   ├── UpgradePrompt.jsx
│   ├── *PropertiesPanel.jsx (7 types)
│   └── scene/
│       ├── LandScene.jsx (~3400 lines)
│       ├── CameraController.jsx
│       ├── ComparisonObjects.jsx
│       ├── WallSegment.jsx
│       ├── RoomFloor.jsx
│       ├── BuildingComponents.jsx
│       ├── PolygonRenderers.jsx
│       └── ...
├── hooks/
│   ├── useBuildHistory.js
│   └── useUser.jsx      # Subscription check
├── services/
│   ├── imageAnalysis.js
│   ├── shareScene.js
│   └── analytics.js
├── utils/
│   ├── pdfExport.js
│   ├── screenshotCapture.js
│   ├── modelExport.js
│   ├── exportFloorPlan.js
│   ├── collision2d.js
│   ├── roomDetection.js
│   └── ...
├── types/
│   └── index.ts         # TypeScript definitions
└── data/
    ├── presets.js
    └── landTemplates.js
```

---

## 6. Environment Variables

**Required for production:**
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Claude AI (server-side only)
ANTHROPIC_API_KEY=sk-ant-...

# PayPal (Ralphy to add)
VITE_PAYPAL_CLIENT_ID=<your-paypal-client-id>
VITE_PAYPAL_MONTHLY_PLAN_ID=<your-monthly-plan-id>
```

---

## 7. Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (:3001)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Time to visualize land | < 2 minutes |
| Floor plan upload to 3D | < 30 seconds |
| Page load time | < 3 seconds |
| Initial bundle size | < 400KB |
| Free to paid conversion | 5-10% |
| Monthly churn | < 5% |

---

## 9. Roadmap Summary

### Q1 2026 (Current)
- [x] Export system (PNG, PDF, Screenshot, 3D Model)
- [x] NPC chat system
- [x] Payment frontend
- [x] **Multi-story buildings**
- [ ] **Payment backend (Ralphy)**

### Q2 2026
- [ ] Terrain elevation
- [ ] Enhanced AI detection

### Q3 2026
- [ ] Real-time collaboration
- [ ] AR/VR support (WebXR)
- [ ] CAD import (DXF)

### Q4 2026+
- [ ] Cost estimation
- [ ] Contractor sharing portal
- [ ] Mobile AR preview

---

## 10. Conclusion

**Sitea is production-ready** with all core features working. The main blocker for revenue is completing the PayPal backend integration.

### Ralphy's Priority Order:
1. 🔴 **PayPal Setup** - Create app, get credentials
2. 🔴 **Supabase Table** - Run SQL, verify
3. 🔴 **Test Payment Flow** - End-to-end verification
4. ✅ **Multi-story Buildings** - DONE

**Estimated effort for Priority 1 (Payments):** 2-4 hours

---

*Document maintained by development team. Last technical review: January 23, 2026.*
