import { supabase } from '../db/supabase'
import { DbTalentProfile } from '../types'

// ── Create / upsert talent profile ───────────────────────────

export interface CreateTalentProfileInput {
  user_id: string
  full_name?: string
  bio?: string
  role?: string
  skills?: string[]
  experience_years?: number
  language?: string
  location?: string
  avatar_url?: string
  portfolio_url?: string
}

export async function createTalentProfile(
  input: CreateTalentProfileInput
): Promise<DbTalentProfile> {
  // Guard: user must exist with talent role
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', input.user_id)
    .single()

  if (userError || !user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 })
  }

  if (user.role !== 'talent') {
    throw Object.assign(
      new Error('Only talent accounts can create a talent profile'),
      { statusCode: 403 }
    )
  }

  const { data, error } = await supabase
    .from('talent_profiles')
    .insert({
      user_id:          input.user_id,
      full_name:        input.full_name        ?? null,
      bio:              input.bio              ?? null,
      role:             input.role             ?? null,
      skills:           input.skills           ?? [],
      experience_years: input.experience_years ?? 0,
      language:         input.language         ?? null,
      location:         input.location         ?? null,
      avatar_url:       input.avatar_url       ?? null,
      portfolio_url:    input.portfolio_url    ?? null,
    })
    .select('id, user_id, full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw Object.assign(new Error('Talent profile already exists for this user'), {
        statusCode: 409,
      })
    }
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbTalentProfile
}

// ── Search talent ─────────────────────────────────────────────

export interface SearchTalentFilter {
  skills?: string[]
  role?: string
  location?: string
  language?: string
}

/**
 * Returns talent profiles matching the given filters.
 * All filters are optional and combined with AND logic.
 * Skills filter uses overlap (any skill match qualifies).
 */
export async function searchTalent(
  filter: SearchTalentFilter
): Promise<DbTalentProfile[]> {
  let query = supabase
    .from('talent_profiles')
    .select('id, user_id, full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at, created_at')
    .order('last_active_at', { ascending: false })

  // Skill overlap: at least one required skill must be in talent's skills array
  if (filter.skills && filter.skills.length > 0) {
    // Supabase overlaps operator: column && array
    query = query.overlaps('skills', filter.skills)
  }

  // Case-insensitive role match using ilike
  if (filter.role) {
    query = query.ilike('role', `%${filter.role}%`)
  }

  // Case-insensitive location match
  if (filter.location) {
    query = query.ilike('location', `%${filter.location}%`)
  }

  // Case-insensitive language match
  if (filter.language) {
    query = query.ilike('language', `%${filter.language}%`)
  }

  const { data, error } = await query

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return (data ?? []) as DbTalentProfile[]
}
