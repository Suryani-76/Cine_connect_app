import { supabase } from '../db/supabase'
import { DbProductionProfile } from '../types'

export interface CreateProductionProfileInput {
  user_id: string
  company_name: string
  bio?: string
  production_details?: string
}

/**
 * Creates a production profile row.
 * Validates that the user exists and has role 'production' first.
 */
export async function createProductionProfile(
  input: CreateProductionProfileInput
): Promise<DbProductionProfile> {
  const { user_id, company_name, bio, production_details } = input

  // Guard: confirm user exists and has the production role
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user_id)
    .single()

  if (userError || !userRow) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 })
  }

  if (userRow.role !== 'production') {
    throw Object.assign(
      new Error('Only production accounts can create a production profile'),
      { statusCode: 403 }
    )
  }

  const { data, error } = await supabase
    .from('production_profiles')
    .insert({ user_id, company_name, bio: bio ?? null, production_details: production_details ?? null })
    .select()
    .single()

  if (error) {
    // Unique constraint = profile already exists
    if (error.code === '23505') {
      throw Object.assign(new Error('Profile already exists for this user'), {
        statusCode: 409,
      })
    }
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbProductionProfile
}

/**
 * Fetches a production profile by id or user_id, joining public users table
 * so the caller gets company info + public user data (username, role) without email.
 */
export async function getProductionProfileById(
  idOrUserId: string
): Promise<DbProductionProfile & { users: { username: string; role: string } }> {
  // Try by profile id first
  let { data, error } = await supabase
    .from('production_profiles')
    .select('id, user_id, company_name, bio, production_details, logo_url, verified, verified_at, verified_by, created_at, users(username, role)')
    .eq('id', idOrUserId)
    .maybeSingle()

  // Fallback to user_id
  if (!data && !error) {
    const res = await supabase
      .from('production_profiles')
      .select('id, user_id, company_name, bio, production_details, logo_url, verified, verified_at, verified_by, created_at, users(username, role)')
      .eq('user_id', idOrUserId)
      .maybeSingle()
    data = res.data
    error = res.error
  }

  if (error || !data) {
    throw Object.assign(new Error('Production profile not found'), { statusCode: 404 })
  }

  return data as unknown as DbProductionProfile & { users: { username: string; role: string } }
}

/**
 * Fetches the caller's own production profile by user_id.
 */
export async function getProductionProfileByUserId(
  userId: string
): Promise<DbProductionProfile & { users: { username: string; role: string } }> {
  const { data, error } = await supabase
    .from('production_profiles')
    .select('id, user_id, company_name, bio, production_details, logo_url, verified, verified_at, verified_by, created_at, users(username, role)')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    throw Object.assign(new Error('Production profile not found'), { statusCode: 404 })
  }

  return data as unknown as DbProductionProfile & { users: { username: string; role: string } }
}

export interface UpdateProductionProfileInput {
  company_name?: string
  bio?: string
  production_details?: string
  logo_url?: string | null
}

/**
 * Updates caller's production profile by user_id.
 */
export async function updateProductionProfile(
  userId: string,
  input: UpdateProductionProfileInput
): Promise<DbProductionProfile> {
  const updatePayload: Record<string, unknown> = {}
  if (input.company_name !== undefined)       updatePayload.company_name = input.company_name
  if (input.bio !== undefined)                updatePayload.bio = input.bio
  if (input.production_details !== undefined) updatePayload.production_details = input.production_details
  if (input.logo_url !== undefined)           updatePayload.logo_url = input.logo_url

  const { data, error } = await supabase
    .from('production_profiles')
    .update(updatePayload)
    .eq('user_id', userId)
    .select('id, user_id, company_name, bio, production_details, logo_url, created_at')
    .maybeSingle()

  if (error || !data) {
    throw Object.assign(new Error(error?.message ?? 'Production profile not found'), {
      statusCode: error ? 500 : 404,
    })
  }

  return data as DbProductionProfile
}
