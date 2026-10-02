/**
 * matchConfigService.ts
 * ──────────────────────
 * Manages configurable match scoring weights with in-memory 5-minute caching,
 * strict sum-to-100 validation, fallback defaults, and audit logging.
 */

import { supabase } from '../db/supabase'
import { MatchWeights, DbMatchConfig } from '../types'

export type { MatchWeights, DbMatchConfig }

export const DEFAULT_WEIGHTS: MatchWeights = {
  skills_match: 30,
  role_match: 20,
  experience_match: 15,
  language_match: 10,
  location_proximity: 10,
  profile_completeness: 10,
  activity_recency: 5,
}

// ── In-Memory Cache (5-Minute TTL) ────────────────────────────

interface CacheBox {
  weights: MatchWeights
  expiresAt: number
}

let weightsCache: CacheBox | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Validates that weights sum to exactly 100 and all fields are non-negative.
 */
export function validateWeights(weights: Partial<MatchWeights>): { valid: boolean; sum: number; error?: string } {
  const keys: (keyof MatchWeights)[] = [
    'skills_match',
    'role_match',
    'experience_match',
    'language_match',
    'location_proximity',
    'profile_completeness',
    'activity_recency',
  ]

  let sum = 0
  for (const key of keys) {
    const val = weights[key]
    if (typeof val !== 'number' || isNaN(val) || val < 0) {
      return { valid: false, sum: 0, error: `Invalid weight for ${key}: must be a non-negative number` }
    }
    sum += val
  }

  // Floating point tolerance check
  const roundedSum = Math.round(sum * 1000) / 1000
  if (Math.abs(roundedSum - 100) > 0.001) {
    return { valid: false, sum: roundedSum, error: `Weights must sum to 100 (got ${roundedSum})` }
  }

  return { valid: true, sum: 100 }
}

/**
 * Loads the active match weights. Uses 5-minute cache with DB query and fallback to constants.
 */
export async function getActiveMatchWeights(): Promise<MatchWeights> {
  const now = Date.now()
  if (weightsCache && weightsCache.expiresAt > now) {
    return weightsCache.weights
  }

  try {
    const { data, error } = await supabase
      .from('match_config')
      .select('skills_match, role_match, experience_match, language_match, location_proximity, profile_completeness, activity_recency')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      const weights: MatchWeights = {
        skills_match: Number(data.skills_match),
        role_match: Number(data.role_match),
        experience_match: Number(data.experience_match),
        language_match: Number(data.language_match),
        location_proximity: Number(data.location_proximity),
        profile_completeness: Number(data.profile_completeness),
        activity_recency: Number(data.activity_recency),
      }

      const check = validateWeights(weights)
      if (check.valid) {
        weightsCache = { weights, expiresAt: now + CACHE_TTL_MS }
        return weights
      }
    }
  } catch (err) {
    console.warn('[MatchConfig] Failed to fetch match_config from DB, using fallback defaults:', err)
  }

  weightsCache = { weights: DEFAULT_WEIGHTS, expiresAt: now + CACHE_TTL_MS }
  return DEFAULT_WEIGHTS
}

/**
 * Updates match weights in DB, records an audit log entry, and refreshes the cache.
 */
export async function updateMatchWeights(
  newWeights: MatchWeights,
  userId: string | null,
  reason?: string
): Promise<{ success: boolean; weights: MatchWeights }> {
  const check = validateWeights(newWeights)
  if (!check.valid) {
    throw Object.assign(new Error(check.error), { statusCode: 400 })
  }

  const previousWeights = await getActiveMatchWeights()

  // 1. Deactivate old rows or update active row
  const { data: existing } = await supabase
    .from('match_config')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('match_config')
      .update({
        ...newWeights,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('match_config')
      .insert({
        ...newWeights,
        is_active: true,
        updated_by: userId,
      })
  }

  // 2. Audit log
  try {
    await supabase
      .from('match_config_audit_logs')
      .insert({
        user_id: userId,
        previous_weights: previousWeights,
        new_weights: newWeights,
        reason: reason ?? 'Admin weight update',
      })
  } catch (auditErr) {
    console.warn('[MatchConfig] Failed to record audit log:', auditErr)
  }

  // 3. Update cache immediately
  weightsCache = { weights: newWeights, expiresAt: Date.now() + CACHE_TTL_MS }

  return { success: true, weights: newWeights }
}

/** For tests or manual cache invalidation */
export function invalidateMatchConfigCache(): void {
  weightsCache = null
}
