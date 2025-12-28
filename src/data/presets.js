/**
 * Quick Plan Presets - predefined building combinations
 * All offsets in meters, relative to anchor point
 */

export const PRESETS = [
  {
    id: 'house',
    name: 'House',
    buildings: [
      { typeId: 'mediumHouse', offsetForward: 0, offsetRight: 0 }
    ]
  },
  {
    id: 'house-garage',
    name: 'House + Garage',
    buildings: [
      { typeId: 'mediumHouse', offsetForward: 0, offsetRight: -4.5 },
      { typeId: 'garage', offsetForward: 3, offsetRight: 5.5 } // beside house, 2m gap
    ]
  },
  {
    id: 'house-pool',
    name: 'House + Pool',
    buildings: [
      { typeId: 'mediumHouse', offsetForward: 3, offsetRight: 0 },
      { typeId: 'pool', offsetForward: -9.5, offsetRight: 0 } // behind house, 4m gap
    ]
  },
  {
    id: 'two-houses',
    name: '2 Houses',
    buildings: [
      { typeId: 'smallHouse', offsetForward: 0, offsetRight: -6 },
      { typeId: 'smallHouse', offsetForward: 0, offsetRight: 6 } // side by side, 4m gap
    ]
  }
]
