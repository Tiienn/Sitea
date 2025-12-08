# Task: UI Clarity Fixes

## Requirements
1. Land Input - Add placeholder text in dimension inputs
2. Polygon Editor - Add instruction text inside mini-map
3. Building Placement - Show message when building selected, highlight on hover with "Click to remove"
4. General - Add responsive scrolling for control panel

## Completed

- [x] Land Input placeholders (already had "e.g. 50" and "e.g. 30")
- [x] Polygon Editor instruction text (already had "Click to add points • Double-click to finish")
- [x] Building placement indicator - green pulsing message at bottom of screen: "Click on land to place [Building Name]"
- [x] Building hover effects - buildings turn red on hover, show "Click to remove" text
- [x] Responsive control panel - added max-height with overflow-y auto for smaller screens

## Review

Changes made:
1. **App.jsx**: Added building placement indicator overlay that shows when a building is selected
2. **App.jsx**: Added `max-h-[calc(100vh-2rem)] overflow-y-auto` to control panel for responsive scrolling
3. **LandScene.jsx**: Added hover state to PlacedBuilding with visual feedback (red highlight, emissive glow)
4. **LandScene.jsx**: Label text changes to "Click to remove" on hover
