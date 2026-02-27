/**
 * Project Service
 *
 * CRUD operations for saved projects in Supabase.
 * RLS handles auth — queries automatically scoped to current user.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const TABLE = 'projects'

/**
 * List all projects for current user (metadata only, no scene_json)
 */
export async function listProjects() {
  if (!isSupabaseConfigured()) return { error: 'Not configured' }

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('listProjects error:', error)
    return { error: 'Failed to load projects' }
  }
  return { data }
}

/**
 * Count projects for current user (for free tier limit check)
 */
export async function countProjects() {
  if (!isSupabaseConfigured()) return { count: 0 }

  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.error('countProjects error:', error)
    return { count: 0 }
  }
  return { count }
}

/**
 * Create a new project
 */
export async function createProject(userId, name, scenePayload) {
  if (!isSupabaseConfigured()) return { error: 'Not configured' }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, name, scene_json: scenePayload })
    .select('id, name, updated_at')
    .single()

  if (error) {
    console.error('createProject error:', error)
    return { error: 'Failed to create project' }
  }
  return { data }
}

/**
 * Update project scene data
 */
export async function updateProject(projectId, scenePayload) {
  if (!isSupabaseConfigured()) return { error: 'Not configured' }

  const { error } = await supabase
    .from(TABLE)
    .update({ scene_json: scenePayload })
    .eq('id', projectId)

  if (error) {
    console.error('updateProject error:', error)
    return { error: 'Failed to save project' }
  }
  return { success: true }
}

/**
 * Rename a project
 */
export async function renameProject(projectId, name) {
  if (!isSupabaseConfigured()) return { error: 'Not configured' }

  const { error } = await supabase
    .from(TABLE)
    .update({ name })
    .eq('id', projectId)

  if (error) {
    console.error('renameProject error:', error)
    return { error: 'Failed to rename project' }
  }
  return { success: true }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId) {
  if (!isSupabaseConfigured()) return { error: 'Not configured' }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', projectId)

  if (error) {
    console.error('deleteProject error:', error)
    return { error: 'Failed to delete project' }
  }
  return { success: true }
}

/**
 * Fetch a project with full scene data
 */
export async function fetchProject(projectId) {
  if (!isSupabaseConfigured()) return { error: 'Not configured' }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', projectId)
    .single()

  if (error || !data) {
    console.error('fetchProject error:', error)
    return { error: 'Project not found' }
  }
  return { data }
}
