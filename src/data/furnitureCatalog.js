const ASSET_BASE = 'https://utudexexqnmaoohmnsmk.supabase.co/storage/v1/object/public/assets/models/furniture'

export const FURNITURE_CATEGORIES = [
  { id: 'living', label: 'Living Room' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'outdoor', label: 'Outdoor' },
]

export const FURNITURE_ITEMS = [
  // Living Room
  { id: 'sofa', name: 'Sofa', category: 'living', url: `${ASSET_BASE}/sofa.glb`, targetWidth: 2.0 },
  { id: 'armchair', name: 'Armchair', category: 'living', url: `${ASSET_BASE}/armchair.glb`, targetWidth: 0.9 },
  { id: 'coffeeTable', name: 'Coffee Table', category: 'living', url: `${ASSET_BASE}/coffee-table.glb`, targetWidth: 1.2 },
  { id: 'tvStand', name: 'TV Stand', category: 'living', url: `${ASSET_BASE}/tv-stand.glb`, targetWidth: 1.5 },
  // Bedroom
  { id: 'bed', name: 'Bed', category: 'bedroom', url: `${ASSET_BASE}/bed.glb`, targetWidth: 1.6 },
  { id: 'nightstand', name: 'Nightstand', category: 'bedroom', url: `${ASSET_BASE}/nightstand.glb`, targetWidth: 0.5 },
  { id: 'desk', name: 'Desk', category: 'bedroom', url: `${ASSET_BASE}/desk.glb`, targetWidth: 1.2 },
  // Kitchen
  { id: 'diningTable', name: 'Dining Table', category: 'kitchen', url: `${ASSET_BASE}/dining-table.glb`, targetWidth: 1.6 },
  { id: 'chair', name: 'Chair', category: 'kitchen', url: `${ASSET_BASE}/chair.glb`, targetWidth: 0.45 },
  { id: 'fridge', name: 'Fridge', category: 'kitchen', url: `${ASSET_BASE}/fridge.glb`, targetWidth: 0.7 },
  // Bathroom
  { id: 'toilet', name: 'Toilet', category: 'bathroom', url: `${ASSET_BASE}/toilet.glb`, targetWidth: 0.4 },
  { id: 'bathtub', name: 'Bathtub', category: 'bathroom', url: `${ASSET_BASE}/bathtub.glb`, targetWidth: 0.8 },
  // Outdoor
  { id: 'tree', name: 'Tree', category: 'outdoor', url: `${ASSET_BASE}/tree.glb`, targetWidth: 2.0 },
  { id: 'bench', name: 'Bench', category: 'outdoor', url: `${ASSET_BASE}/bench.glb`, targetWidth: 1.5 },
]
