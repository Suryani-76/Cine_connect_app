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
 * Fetches a production profile by user id, joining the users table
 * so the caller gets company info + public user data in one response.
 */
export async function getProductionProfileById(
  id: string
): Promise<DbProductionProfile & { users: { username: string; email: string } }> {
  const { data, error } = await supabase
    .from('production_profiles')
    .select('*, users(username, email)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw Object.assign(new Error('Production profile not found'), { statusCode: 404 })
  }

  return data as DbProductionProfile & { users: { username: string; email: string } }
}
