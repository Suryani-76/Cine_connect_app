import { supabase } from '../db/supabase'
import { DbTalentProfile } from '../types'
import { enqueueMatchRecompute } from './recomputeService'

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

  try {
    await enqueueMatchRecompute({
      talentProfileId: (data as DbTalentProfile).id,
      reason: 'Talent profile created',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }

  return data as DbTalentProfile
}

// ── Update talent profile ─────────────────────────────────────

export async function updateTalentProfile(
  talentProfileId: string,
  input: Partial<CreateTalentProfileInput>
): Promise<DbTalentProfile> {
  const updatePayload: Record<string, unknown> = {}
  if (input.full_name !== undefined)        updatePayload.full_name = input.full_name
  if (input.bio !== undefined)              updatePayload.bio = input.bio
  if (input.role !== undefined)             updatePayload.role = input.role
  if (input.skills !== undefined)           updatePayload.skills = input.skills
  if (input.experience_years !== undefined) updatePayload.experience_years = input.experience_years
  if (input.language !== undefined)         updatePayload.language = input.language
  if (input.location !== undefined)         updatePayload.location = input.location
  if (input.avatar_url !== undefined)       updatePayload.avatar_url = input.avatar_url
  if (input.portfolio_url !== undefined)    updatePayload.portfolio_url = input.portfolio_url

  const { data, error } = await supabase
    .from('talent_profiles')
    .update(updatePayload)
    .eq('id', talentProfileId)
    .select('id, user_id, full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at, created_at')
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  try {
    await enqueueMatchRecompute({
      talentProfileId,
      reason: 'Talent profile updated',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }

  return data as DbTalentProfile
}

// ── Search talent ─────────────────────────────────────────────

export interface SearchTalentFilter {
  skills?: string[]
  role?: string
  location?: string
  language?: string
  limit?: number
  offset?: number
}

/**
 * Returns talent profiles matching the given filters.
 * Never returns email. Paginated (default 20, max 50).
 */
export async function searchTalent(
  filter: SearchTalentFilter
): Promise<DbTalentProfile[]> {
  const limit  = Math.min(filter.limit  ?? 20, 50)
  const offset = filter.offset ?? 0

  let query = supabase
    .from('talent_profiles')
    // explicitly exclude user_id to avoid leaking linkable identity
    .select('id, full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at, created_at')
    .order('last_active_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter.skills && filter.skills.length > 0) {
    query = query.overlaps('skills', filter.skills)
  }
  if (filter.role)     query = query.ilike('role',     `%${filter.role}%`)
  if (filter.location) query = query.ilike('location', `%${filter.location}%`)
  if (filter.language) query = query.ilike('language', `%${filter.language}%`)

  const { data, error } = await query
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
  return (data ?? []) as DbTalentProfile[]
}
