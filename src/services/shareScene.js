/**
 * Share Scene Service
 *
 * Creates and fetches shared scenes from Supabase.
 *
 * Security note: RLS allows select/insert for anon. IDs are unguessable UUIDs,
 * so public-by-link is acceptable for MVP. We always fetch by specific ID,
 * never list all scenes. For production, consider rate limiting inserts.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const TABLE_NAME = 'shared_scenes'
const SCENE_VERSION = 3
export const SHARE_LINK_EXPIRATION_DAYS = 30

export function getShareExpirationDate(now = new Date()) {
  return new Date(now.getTime() + SHARE_LINK_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
}

export function formatShareExpiration(expiresAt) {
  if (!expiresAt) return 'Legacy link'

  const expires = new Date(expiresAt)
  if (Number.isNaN(expires.getTime())) return 'Expiration unknown'

  const msRemaining = expires.getTime() - Date.now()
  if (msRemaining <= 0) return 'Expired'

  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000))
  if (daysRemaining <= 1) return 'Expires tomorrow'
  return `Expires in ${daysRemaining} days`
}

/**
 * Build scene payload from app state
 * @param {Object} state - Current app state
 * @returns {Object} Scene payload
 */
export function buildScenePayload(state) {
  const {
    shapeMode,
    dimensions,
    confirmedPolygon,
    placedBuildings,
    lengthUnit,
    areaUnit,
    setbacksEnabled,
    setbackDistanceM,
    labels,
    activeComparisons,
    cameraState,
    walls,
    pools,
    foundations,
    stairs,
    furnitureItems,
    roomLabels,
    roomStyles,
    comparisonPositions,
    comparisonRotations,
    generatedBuildings
  } = state

  return {
    version: SCENE_VERSION,
    createdAt: new Date().toISOString(),
    land: {
      type: shapeMode === 'rectangle' ? 'rectangle' : 'polygon',
      dimensions: { length: dimensions.length, width: dimensions.width },
      vertices: confirmedPolygon || null
    },
    buildings: placedBuildings.map(b => ({
      id: b.id,
      typeId: b.type.id,
      x: b.position.x,
      z: b.position.z,
      rotationY: b.rotationY,
      source: b.source || null
    })),
    generatedBuildings: (generatedBuildings || []).map(b => ({
      id: b.id,
      position: b.position,
      rotation: b.rotation || 0,
      walls: b.walls || [],
      rooms: b.rooms || [],
      stairs: b.stairs || [],
      stats: b.stats || null
    })),
    // Walls with doors/windows (rooms auto-detect from walls)
    walls: (walls || []).map(wall => ({
      id: wall.id,
      start: { x: wall.start.x, z: wall.start.z },
      end: { x: wall.end.x, z: wall.end.z },
      height: wall.height || 2.7,
      thickness: wall.thickness || 0.15,
      openings: (wall.openings || []).map(opening => ({
        id: opening.id,
        type: opening.type,
        position: opening.position,
        width: opening.width,
        height: opening.height,
        sillHeight: opening.sillHeight || 0
      }))
    })),
    // v2 fields
    pools: (pools || []).map(p => ({
      id: p.id, points: p.points, depth: p.depth,
      deckMaterial: p.deckMaterial, waterColor: p.waterColor, center: p.center
    })),
    foundations: (foundations || []).map(f => ({
      id: f.id, points: f.points, height: f.height,
      material: f.material, center: f.center
    })),
    stairs: (stairs || []).map(s => ({
      id: s.id, start: s.start, end: s.end, mid: s.mid, mid2: s.mid2,
      topY: s.topY, style: s.style, width: s.width
    })),
    furniture: (furnitureItems || []).map(f => ({
      id: f.id, catalogId: f.catalogId, position: f.position, rotation: f.rotation
    })),
    roomLabels: roomLabels || {},
    roomStyles: roomStyles || {},
    comparisonPositions: comparisonPositions || {},
    comparisonRotations: comparisonRotations || {},
    settings: {
      unitSystem: { lengthUnit, areaUnit },
      setbacksEnabled,
      setbackDistanceM,
      labels
    },
    comparisons: Object.keys(activeComparisons).filter(k => activeComparisons[k]),
    camera: cameraState ? {
      x: cameraState.position.x,
      y: cameraState.position.y,
      z: cameraState.position.z,
      yaw: cameraState.rotation
    } : undefined
  }
}

/**
 * Create a shared scene in Supabase
 * @param {Object} scenePayload - Scene data to store
 * @returns {Promise<{id: string}|{error: string}>}
 */
export async function createSharedScene(scenePayload) {
  if (!isSupabaseConfigured()) {
    return { error: 'Sharing unavailable - Supabase not configured' }
  }

  try {
    const expiresAt = getShareExpirationDate().toISOString()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({ scene_json: scenePayload, scene_version: SCENE_VERSION, expires_at: expiresAt })
      .select('id, expires_at')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return { error: 'Sharing unavailable right now' }
    }

    return { id: data.id, expiresAt: data.expires_at || expiresAt }
  } catch (err) {
    console.error('Share scene error:', err)
    return { error: 'Sharing unavailable right now' }
  }
}

/**
 * Fetch a shared scene by ID
 * @param {string} shareId - UUID of the shared scene
 * @returns {Promise<{payload: Object}|{error: string}>}
 */
export async function fetchSharedScene(shareId) {
  if (!isSupabaseConfigured()) {
    return { error: 'Sharing unavailable - Supabase not configured' }
  }

  // Validate UUID format to prevent unnecessary queries
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(shareId)) {
    return { error: 'Invalid link' }
  }

  try {
    // Always fetch by specific ID - never list all scenes
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('scene_json, expires_at')
      .eq('id', shareId)
      .maybeSingle()

    if (error || !data) {
      if (error) console.error('Fetch scene error:', error)
      return {
        error: 'This shared link has expired or no longer exists.',
        title: 'Shared link unavailable',
        reason: 'expired'
      }
    }

    if (data.expires_at && new Date(data.expires_at) <= new Date()) {
      return {
        error: 'This shared layout link has expired. Ask the owner to share it again.',
        title: 'Shared link expired',
        reason: 'expired'
      }
    }

    return { payload: data.scene_json, expiresAt: data.expires_at }
  } catch (err) {
    console.error('Fetch scene error:', err)
    return { error: 'Failed to load shared scene' }
  }
}
