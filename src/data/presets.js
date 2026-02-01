/**
 * Quick Plan Presets - predefined building combinations
 * All offsets in meters, relative to anchor point
 */

export const PRESETS = [
  {
    id: 'house',
    name: 'House',
    buildings: [
      { typeId: 'smallHouse', offsetForward: 0, offsetRight: 0 }
    ]
  },
  {
    id: 'house-garage',
    name: 'House + Garage',
    buildings: [
      { typeId: 'smallHouse', offsetForward: 3, offsetRight: 0 },
      { typeId: 'garage', offsetForward: -5, offsetRight: 0 } // behind house
    ]
  },
  {
    id: 'house-pool',
    name: 'House + Pool',
    buildings: [
      { typeId: 'smallHouse', offsetForward: 3, offsetRight: 0 },
      { typeId: 'pool', offsetForward: -5, offsetRight: 0 } // behind house
    ]
  },
  {
    id: 'two-houses',
    name: '2 Houses',
    buildings: [
      { typeId: 'smallHouse', offsetForward: 4, offsetRight: 0 },
      { typeId: 'smallHouse', offsetForward: -4, offsetRight: 0 } // stacked front-to-back
    ]
  }
]
