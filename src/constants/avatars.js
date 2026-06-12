import { useSyncExternalStore } from 'react'

// GLB models hosted on Supabase Storage
export const ASSET_BASE = 'https://utudexexqnmaoohmnsmk.supabase.co/storage/v1/object/public/assets/models'

// Avatar registry. Add an entry here to offer a new player character —
// when there are ≥2 entries an "Avatar" row appears in the View panel.
// clipSource: 'pack' loads the 13-clip Mixamo locomotion set from
// ASSET_BASE; 'embedded' uses the clips shipped inside the model GLB.
export const AVATARS = [
  {
    id: 'visitor',
    label: 'Site visitor',
    modelUrl: `${ASSET_BASE}/character.glb`,
    clipSource: 'pack'
  }
]

const STORAGE_KEY = 'siteaAvatar'
const CHANGE_EVENT = 'sitea-avatar-changed'

export function getSelectedAvatar() {
  const id = localStorage.getItem(STORAGE_KEY)
  return AVATARS.find((a) => a.id === id) || AVATARS[0]
}

export function setSelectedAvatar(id) {
  localStorage.setItem(STORAGE_KEY, id)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(callback) {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

export function useAvatar() {
  return useSyncExternalStore(subscribe, getSelectedAvatar)
}
