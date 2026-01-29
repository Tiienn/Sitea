# Ralphy's Tasks - January 2026

## 🔴 Mobile Responsive Redesign

**Goal:** Make the UI work properly on mobile (S20 Ultra and similar).

### Approach
Rather than extracting into entirely new component files (which requires massive prop-passing refactors), we'll modify the existing code in-place using a `useIsMobile` hook. This keeps changes minimal and avoids introducing bugs.

### Tasks
- [ ] 1. Create `src/hooks/useIsMobile.js` - mobile detection hook
- [ ] 2. Add safe area CSS + slide animations to `src/index.css`
- [ ] 3. Bottom nav: show 4 items + "More" overflow menu on mobile (currently 7 items overflow)
- [ ] 4. Left panel (CTA card): make compact/collapsible on mobile
- [ ] 5. Right panel (View Controls): hide behind settings icon, slide-up sheet on mobile
- [ ] 6. Minimap: smaller on mobile, positioned above nav
- [ ] 7. "Upgrade to Pro" button: move into overflow menu on mobile

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
- [ ] Create PayPal developer app at https://developer.paypal.com/dashboard/applications
- [ ] Copy Client ID to `.env` as `VITE_PAYPAL_CLIENT_ID`
- [ ] Create subscription plan in PayPal for $9.99/month
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

## Review

### Session: January 23, 2026 (Ralphy)
**Multi-Story Buildings Implementation:**
1. Added floor state management to App.jsx:
   - `currentFloor` (0 = ground floor)
   - `floors` array with walls/rooms per floor
   - `floorHeight` (default 2.7m)
   - Helper functions: addFloor, switchFloor, removeFloor

2. Updated BuildPanel.jsx with Floors section:
   - Floor tabs showing all floors
   - Active floor highlighting
   - Add/Remove floor buttons
   - Floor height slider (2.4m - 4m)

3. Updated LandScene.jsx for multi-floor rendering:
   - Walls render at correct Y offset based on floor
   - Inactive floors shown with 40% opacity
   - Rooms render on correct floor with Y offset

4. Updated room detection in App.jsx:
   - Walls grouped by floor level before detection
   - Each detected room includes `floorLevel` property
   - Rooms only detect from walls on same floor

5. Updated RoomFloor.jsx:
   - Added `floorYOffset` and `isInactiveFloor` props
   - Group position uses floorYOffset for Y axis
   - Inactive floor rooms show with reduced opacity

**Files Modified:**
- `src/App.jsx` - Floor state management + room detection per floor
- `src/components/BuildPanel.jsx` - Floor controls UI
- `src/components/LandScene.jsx` - Multi-floor 3D rendering (walls + rooms)
- `src/components/scene/WallSegment.jsx` - Y offset support
- `src/components/scene/RoomFloor.jsx` - Y offset and inactive floor support

### Session: January 24, 2026 (Ralphy)
**Fixtures Feature Removed:**
User requested removal of fixtures/furniture feature - removed all fixture-related code.

**Files Deleted:**
- `src/data/fixtures.js`
- `src/components/scene/FixtureItem.jsx`

**Files Modified (fixtures code removed):**
- `src/App.jsx` - Removed BUILD_TOOLS.FIXTURE, fixtures state, fixture operations
- `src/components/BuildPanel.jsx` - Removed Fixtures section and imports
- `src/components/LandScene.jsx` - Removed fixture rendering, handlers, and props

**Click-to-Add-Floors Feature:**
Implemented new workflow to add multiple floors to a room with one click.

1. Updated `src/App.jsx`:
   - Added `BUILD_TOOLS.ADD_FLOORS` tool
   - Added `floorCountToAdd` state (default: 2)
   - Added `addFloorsToRoom(roomId)` function that duplicates room's walls for each new floor

2. Updated `src/components/BuildPanel.jsx`:
   - Added floor count selector (1-5 buttons)
   - Added "Add X Floors to Room" button in Floors section
   - Button shows active state when tool is selected

3. Updated `src/components/LandScene.jsx`:
   - Added `addFloorsToRoom` prop
   - Added room click handler for ADD_FLOORS tool
   - Added Escape key handler to cancel tool
   - Updated OrbitControls to allow camera movement when tool is active
