/**
 * Supabase Client
 *
 * Gracefully handles missing env vars - sharing will be disabled but app still works.
 *
 * Env vars required:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Check if Supabase is configured
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

/**
 * Supabase client instance (null if not configured)
 */
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
