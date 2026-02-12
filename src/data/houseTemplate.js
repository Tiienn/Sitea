// First Success Moment (FSM) — Prebuilt 3-bedroom house template
// 12m x 10m house on a 25x30m lot
// 4 exterior walls + 3 interior walls = 7 walls total
// Layout: living area (left), bedroom 1 (top-right), bedrooms 2+3 (bottom-right)

export const FSM_HOUSE_WALLS = [
  // === Exterior walls ===
  // South wall (front) — has front door centered
  // Wall length: 12m
  {
    id: 'fsm-south',
    start: { x: -6, z: 5 },
    end: { x: 6, z: 5 },
    height: 2.7,
    thickness: 0.15,
    isExterior: true,
    openings: [
      { id: 'fsm-south-door', type: 'door', position: 3.0, width: 1.0, height: 2.1, doorType: 'single' }
    ],
    floorLevel: 0,
  },
  // North wall (back) — two windows
  // Wall length: 12m
  {
    id: 'fsm-north',
    start: { x: -6, z: -5 },
    end: { x: 6, z: -5 },
    height: 2.7,
    thickness: 0.15,
    isExterior: true,
    openings: [
      { id: 'fsm-north-win1', type: 'window', position: 3.0, width: 1.2, height: 1.2, sillHeight: 0.9 },
      { id: 'fsm-north-win2', type: 'window', position: 9.0, width: 1.2, height: 1.2, sillHeight: 0.9 },
    ],
    floorLevel: 0,
  },
  // West wall (left) — window
  // Wall length: 10m
  {
    id: 'fsm-west',
    start: { x: -6, z: -5 },
    end: { x: -6, z: 5 },
    height: 2.7,
    thickness: 0.15,
    isExterior: true,
    openings: [
      { id: 'fsm-west-win', type: 'window', position: 5.0, width: 1.2, height: 1.2, sillHeight: 0.9 }
    ],
    floorLevel: 0,
  },
  // East wall (right) — two windows (one per room, avoiding partition at z=0 / position 5.0)
  // Wall length: 10m
  {
    id: 'fsm-east',
    start: { x: 6, z: -5 },
    end: { x: 6, z: 5 },
    height: 2.7,
    thickness: 0.15,
    isExterior: true,
    openings: [
      { id: 'fsm-east-win1', type: 'window', position: 2.5, width: 1.2, height: 1.2, sillHeight: 0.9 },
      { id: 'fsm-east-win2', type: 'window', position: 7.5, width: 1.2, height: 1.2, sillHeight: 0.9 },
    ],
    floorLevel: 0,
  },

  // === Interior walls ===
  // Vertical divider: separates living area (left) from bedrooms (right)
  // Runs from north wall to south wall at x=0, length: 10m
  {
    id: 'fsm-div-vert',
    start: { x: 0, z: -5 },
    end: { x: 0, z: 5 },
    height: 2.7,
    thickness: 0.15,
    isExterior: false,
    openings: [
      { id: 'fsm-vert-door', type: 'door', position: 7.0, width: 0.9, height: 2.1, doorType: 'single' }
    ],
    floorLevel: 0,
  },
  // Horizontal divider: separates bedroom 1 (top-right) from bedrooms 2+3 (bottom-right)
  // Runs from vertical divider (x=0) to east wall (x=6) at z=0, length: 6m
  {
    id: 'fsm-div-horiz',
    start: { x: 0, z: 0 },
    end: { x: 6, z: 0 },
    height: 2.7,
    thickness: 0.15,
    isExterior: false,
    openings: [
      { id: 'fsm-horiz-door', type: 'door', position: 1.8, width: 0.9, height: 2.1, doorType: 'single' }
    ],
    floorLevel: 0,
  },
  // Vertical divider in bottom-right: separates bedroom 2 from bedroom 3
  // Runs from horizontal divider (z=0) to south wall (z=5) at x=3, length: 5m
  {
    id: 'fsm-div-bed23',
    start: { x: 3, z: 0 },
    end: { x: 3, z: 5 },
    height: 2.7,
    thickness: 0.15,
    isExterior: false,
    openings: [
      { id: 'fsm-bed23-door', type: 'door', position: 2.0, width: 0.9, height: 2.1, doorType: 'single' }
    ],
    floorLevel: 0,
  },
]

// Land dimensions for guided mode
export const FSM_LAND = { length: 30, width: 25 }

// Camera starts outside the front door, looking at the entrance
export const FSM_CAMERA_START = {
  position: { x: -3, y: 1.65, z: 8 },
  lookAt: { x: -3, y: 1.5, z: 5 },
}

// Bounds for detecting when player is inside the house
// 1m inset from exterior walls to avoid false positives
export const FSM_HOUSE_BOUNDS = {
  minX: -5,
  maxX: 5,
  minZ: -4,
  maxZ: 4,
}
