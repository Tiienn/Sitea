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
const SCENE_VERSION = 1

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
    walls
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
      rotationY: b.rotationY
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
    settings: {
      unitSystem: { lengthUnit, areaUnit },
      setbacksEnabled,
      setbackDistanceM,
      labels
    },
    comparisons: Object.keys(activeComparisons).filter(k => activeComparisons[k]),
    camera: {
      x: cameraState.position.x,
      y: cameraState.position.y,
      z: cameraState.position.z,
      yaw: cameraState.rotation
    }
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
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({ scene_json: scenePayload })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return { error: 'Sharing unavailable right now' }
    }

    return { id: data.id }
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
      .select('scene_json')
      .eq('id', shareId)
      .single()

    if (error || !data) {
      return { error: 'Link invalid or expired' }
    }

    return { payload: data.scene_json }
  } catch (err) {
    console.error('Fetch scene error:', err)
    return { error: 'Failed to load shared scene' }
  }
}
