// House Template Variations — 3 prebuilt houses users can spawn onto their land
// Wall format matches useBuildHistory / WallSegment / roomDetection exactly

export const houseTemplates = {
  compact: {
    id: 'compact',
    label: 'Compact Starter',
    description: '2 bed · Cozy & realistic',
    land: { length: 20, width: 18 },
    walls: [
      // === Exterior walls (9×8m, centered at origin) ===
      // South wall (front) — front door + 2 windows
      {
        id: 'wall-template-compact-1',
        start: { x: -4.5, z: 4 },
        end: { x: 4.5, z: 4 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'door-template-compact-1', type: 'door', doorType: 'single', position: 4.5, width: 0.9, height: 2.1 },
          { id: 'window-template-compact-1', type: 'window', position: 2.0, width: 1.0, height: 1.0, sillHeight: 0.9 },
          { id: 'window-template-compact-2', type: 'window', position: 7.0, width: 1.0, height: 1.0, sillHeight: 0.9 },
        ],
        floorLevel: 0,
      },
      // North wall (back) — 2 bedroom windows
      {
        id: 'wall-template-compact-2',
        start: { x: -4.5, z: -4 },
        end: { x: 4.5, z: -4 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-compact-3', type: 'window', position: 2.25, width: 1.0, height: 1.0, sillHeight: 0.9 },
          { id: 'window-template-compact-4', type: 'window', position: 6.75, width: 1.0, height: 1.0, sillHeight: 0.9 },
        ],
        floorLevel: 0,
      },
      // West wall (left) — living area window
      {
        id: 'wall-template-compact-3',
        start: { x: -4.5, z: -4 },
        end: { x: -4.5, z: 4 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-compact-5', type: 'window', position: 6.0, width: 1.0, height: 1.0, sillHeight: 0.9 },
        ],
        floorLevel: 0,
      },
      // East wall (right) — bedroom window
      {
        id: 'wall-template-compact-4',
        start: { x: 4.5, z: -4 },
        end: { x: 4.5, z: 4 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-compact-6', type: 'window', position: 2.0, width: 1.0, height: 1.0, sillHeight: 0.9 },
        ],
        floorLevel: 0,
      },
      // === Interior walls ===
      // Horizontal divider (z=0) — separates bedrooms from living, 2 doors
      {
        id: 'wall-template-compact-5',
        start: { x: -4.5, z: 0 },
        end: { x: 4.5, z: 0 },
        height: 2.7,
        thickness: 0.15,
        isExterior: false,
        openings: [
          { id: 'door-template-compact-2', type: 'door', doorType: 'single', position: 2.25, width: 0.8, height: 2.1 },
          { id: 'door-template-compact-3', type: 'door', doorType: 'single', position: 6.75, width: 0.8, height: 2.1 },
        ],
        floorLevel: 0,
      },
      // Vertical divider (x=0) — separates bedroom 1 from bedroom 2
      {
        id: 'wall-template-compact-6',
        start: { x: 0, z: -4 },
        end: { x: 0, z: 0 },
        height: 2.7,
        thickness: 0.15,
        isExterior: false,
        openings: [],
        floorLevel: 0,
      },
    ],
  },

  modern: {
    id: 'modern',
    label: 'Modern Open Plan',
    description: '3 bed · Spacious & bright',
    land: { length: 30, width: 25 },
    walls: [
      // === Exterior walls (12×10m, centered at origin) ===
      // South wall (front) — front door + 2 large windows
      {
        id: 'wall-template-modern-1',
        start: { x: -6, z: 5 },
        end: { x: 6, z: 5 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'door-template-modern-1', type: 'door', doorType: 'single', position: 6.0, width: 1.2, height: 2.1 },
          { id: 'window-template-modern-1', type: 'window', position: 2.5, width: 1.4, height: 1.3, sillHeight: 0.8 },
          { id: 'window-template-modern-2', type: 'window', position: 9.5, width: 1.4, height: 1.3, sillHeight: 0.8 },
        ],
        floorLevel: 0,
      },
      // North wall (back) — 3 bedroom windows
      {
        id: 'wall-template-modern-2',
        start: { x: -6, z: -5 },
        end: { x: 6, z: -5 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-modern-3', type: 'window', position: 2.0, width: 1.2, height: 1.2, sillHeight: 0.9 },
          { id: 'window-template-modern-4', type: 'window', position: 6.0, width: 1.2, height: 1.2, sillHeight: 0.9 },
          { id: 'window-template-modern-5', type: 'window', position: 10.0, width: 1.2, height: 1.2, sillHeight: 0.9 },
        ],
        floorLevel: 0,
      },
      // West wall (left) — large living window
      {
        id: 'wall-template-modern-3',
        start: { x: -6, z: -5 },
        end: { x: -6, z: 5 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-modern-6', type: 'window', position: 7.0, width: 1.4, height: 1.3, sillHeight: 0.8 },
        ],
        floorLevel: 0,
      },
      // East wall (right) — large living window
      {
        id: 'wall-template-modern-4',
        start: { x: 6, z: -5 },
        end: { x: 6, z: 5 },
        height: 2.7,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-modern-7', type: 'window', position: 7.0, width: 1.4, height: 1.3, sillHeight: 0.8 },
        ],
        floorLevel: 0,
      },
      // === Interior walls ===
      // Horizontal divider (z=-1) — separates 3 bedrooms from open living
      {
        id: 'wall-template-modern-5',
        start: { x: -6, z: -1 },
        end: { x: 6, z: -1 },
        height: 2.7,
        thickness: 0.15,
        isExterior: false,
        openings: [
          { id: 'door-template-modern-2', type: 'door', doorType: 'single', position: 2.0, width: 0.9, height: 2.1 },
          { id: 'door-template-modern-3', type: 'door', doorType: 'single', position: 6.0, width: 0.9, height: 2.1 },
          { id: 'door-template-modern-4', type: 'door', doorType: 'single', position: 10.0, width: 0.9, height: 2.1 },
        ],
        floorLevel: 0,
      },
      // Vertical divider (x=-2) — separates bedroom 1 from bedroom 2
      {
        id: 'wall-template-modern-6',
        start: { x: -2, z: -5 },
        end: { x: -2, z: -1 },
        height: 2.7,
        thickness: 0.15,
        isExterior: false,
        openings: [],
        floorLevel: 0,
      },
      // Vertical divider (x=2) — separates bedroom 2 from bedroom 3
      {
        id: 'wall-template-modern-7',
        start: { x: 2, z: -5 },
        end: { x: 2, z: -1 },
        height: 2.7,
        thickness: 0.15,
        isExterior: false,
        openings: [],
        floorLevel: 0,
      },
    ],
  },

  luxury: {
    id: 'luxury',
    label: 'Luxury Home',
    description: '4 bed · Grand & aspirational',
    land: { length: 40, width: 35 },
    walls: [
      // === Exterior walls (16×14m, centered at origin) ===
      // South wall (front) — double front door + 2 large windows
      {
        id: 'wall-template-luxury-1',
        start: { x: -8, z: 7 },
        end: { x: 8, z: 7 },
        height: 3.0,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'door-template-luxury-1', type: 'door', doorType: 'double', position: 8.0, width: 1.6, height: 2.4 },
          { id: 'window-template-luxury-1', type: 'window', position: 3.0, width: 1.6, height: 1.4, sillHeight: 0.8 },
          { id: 'window-template-luxury-2', type: 'window', position: 13.0, width: 1.6, height: 1.4, sillHeight: 0.8 },
        ],
        floorLevel: 0,
      },
      // North wall (back) — 2 bedroom windows
      {
        id: 'wall-template-luxury-2',
        start: { x: -8, z: -7 },
        end: { x: 8, z: -7 },
        height: 3.0,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-luxury-3', type: 'window', position: 3.0, width: 1.4, height: 1.2, sillHeight: 0.9 },
          { id: 'window-template-luxury-4', type: 'window', position: 13.0, width: 1.4, height: 1.2, sillHeight: 0.9 },
        ],
        floorLevel: 0,
      },
      // West wall (left) — 3 windows (master, bed2, living)
      {
        id: 'wall-template-luxury-3',
        start: { x: -8, z: -7 },
        end: { x: -8, z: 7 },
        height: 3.0,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-luxury-5', type: 'window', position: 2.5, width: 1.4, height: 1.2, sillHeight: 0.9 },
          { id: 'window-template-luxury-6', type: 'window', position: 7.5, width: 1.4, height: 1.2, sillHeight: 0.9 },
          { id: 'window-template-luxury-7', type: 'window', position: 11.5, width: 1.6, height: 1.4, sillHeight: 0.8 },
        ],
        floorLevel: 0,
      },
      // East wall (right) — 3 windows (bed3, bed4, living)
      {
        id: 'wall-template-luxury-4',
        start: { x: 8, z: -7 },
        end: { x: 8, z: 7 },
        height: 3.0,
        thickness: 0.15,
        isExterior: true,
        openings: [
          { id: 'window-template-luxury-8', type: 'window', position: 2.5, width: 1.4, height: 1.2, sillHeight: 0.9 },
          { id: 'window-template-luxury-9', type: 'window', position: 7.5, width: 1.4, height: 1.2, sillHeight: 0.9 },
          { id: 'window-template-luxury-10', type: 'window', position: 11.5, width: 1.6, height: 1.4, sillHeight: 0.8 },
        ],
        floorLevel: 0,
      },
      // === Interior walls ===
      // Horizontal divider (z=2) — separates living from bedroom zone
      {
        id: 'wall-template-luxury-5',
        start: { x: -8, z: 2 },
        end: { x: 8, z: 2 },
        height: 3.0,
        thickness: 0.15,
        isExterior: false,
        openings: [
          { id: 'door-template-luxury-2', type: 'door', doorType: 'double', position: 8.0, width: 1.2, height: 2.4 },
        ],
        floorLevel: 0,
      },
      // Left vertical (x=-2) — separates master/bed2 from central hall
      {
        id: 'wall-template-luxury-6',
        start: { x: -2, z: -7 },
        end: { x: -2, z: 2 },
        height: 3.0,
        thickness: 0.15,
        isExterior: false,
        openings: [
          { id: 'door-template-luxury-3', type: 'door', doorType: 'single', position: 2.5, width: 0.9, height: 2.1 },
          { id: 'door-template-luxury-4', type: 'door', doorType: 'single', position: 7.0, width: 0.9, height: 2.1 },
        ],
        floorLevel: 0,
      },
      // Right vertical (x=2) — separates bed3/bed4 from central hall
      {
        id: 'wall-template-luxury-7',
        start: { x: 2, z: -7 },
        end: { x: 2, z: 2 },
        height: 3.0,
        thickness: 0.15,
        isExterior: false,
        openings: [
          { id: 'door-template-luxury-5', type: 'door', doorType: 'single', position: 2.5, width: 0.9, height: 2.1 },
          { id: 'door-template-luxury-6', type: 'door', doorType: 'single', position: 7.0, width: 0.9, height: 2.1 },
        ],
        floorLevel: 0,
      },
      // Left horizontal (z=-2) — separates master from bed2
      {
        id: 'wall-template-luxury-8',
        start: { x: -8, z: -2 },
        end: { x: -2, z: -2 },
        height: 3.0,
        thickness: 0.15,
        isExterior: false,
        openings: [],
        floorLevel: 0,
      },
      // Right horizontal (z=-2) — separates bed3 from bed4
      {
        id: 'wall-template-luxury-9',
        start: { x: 2, z: -2 },
        end: { x: 8, z: -2 },
        height: 3.0,
        thickness: 0.15,
        isExterior: false,
        openings: [],
        floorLevel: 0,
      },
    ],
  },
}

export const HOUSE_TEMPLATE_ORDER = ['compact', 'modern', 'luxury']
export const DEFAULT_HOUSE_TEMPLATE = 'modern'
