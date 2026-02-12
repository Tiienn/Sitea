# House Template Variations

## Plan
Replace Quick Presets with 3 house template options (Compact, Modern, Luxury). Each is a set of walls with doors/windows that spawn onto the land. Also add a house picker to the onboarding flow after the Aha moment.

## Tasks

- [x] 1. Create `src/data/houseTemplates.js` with 3 templates (compact, modern, luxury) using the same wall format as `houseTemplate.js`
- [x] 2. Modify `Onboarding.jsx` — after Aha fade, show house picker instead of immediately completing. 3 cards + "Skip" option.
- [x] 3. Modify `App.jsx` — update `handleLandDefined` to accept `houseTemplate` param, load walls via `clearWallsHistory()`, override land size, switch to first-person
- [x] 4. Replace Quick Presets in `BuildPanel.jsx` — swap PRESETS import for houseTemplates, update the presets section UI to show 3 house template cards
- [x] 5. Verify build passes and update review

## Review

### Changes Made

**`src/data/houseTemplates.js`** (NEW)
- 3 house templates: compact (9×8m, 2 bed, 6 walls), modern (12×10m, 3 bed, 7 walls), luxury (16×14m, 4 bed, 9 walls)
- Each template has `id`, `label`, `description`, `land` (recommended lot size), and `walls` array
- Wall format matches existing app format exactly (id, start, end, height, thickness, isExterior, openings, floorLevel)
- All exterior walls form closed rectangles, interior walls connect at T-junctions
- Exports: `houseTemplates`, `HOUSE_TEMPLATE_ORDER`, `DEFAULT_HOUSE_TEMPLATE`

**`src/components/Onboarding.jsx`**
- Added `showHousePicker` state
- Modified `fadeAha()` to show house picker instead of immediately completing
- Modified template-click Aha path to use same `fadeAha()` flow
- Added `houseTemplate` parameter to `completeOnboarding()` and `onComplete` data
- Added house picker UI: 3 cards + "Skip — empty lot" button, dark overlay card style

**`src/App.jsx`**
- Imported `houseTemplates` from new data file
- Updated `handleLandDefined` to accept `houseTemplate` param
- When house template selected: overrides land dimensions, sets rectangle mode, loads walls via `clearWallsHistory()`, switches to first-person view
- Added analytics tracking for house template selection
- Passed `onLoadHouseTemplate` callback to BuildPanel (loads template walls, sets land, switches view)

**`src/components/BuildPanel.jsx`**
- Replaced `PRESETS` import with `houseTemplates` import
- Renamed section label from "Quick Presets" to "House Templates"
- Replaced preset buttons with house template cards (label + description + "Popular" badge on Modern)
- Removed `handlePresetClick`, `presetToast`, `placePreset` import
- Added `onLoadHouseTemplate` prop
