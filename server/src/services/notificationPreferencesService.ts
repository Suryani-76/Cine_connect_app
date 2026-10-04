import { supabase } from '../db/supabase'
import { DbNotificationPreferences, DigestFrequency } from '../types'
import { z } from 'zod'

export const updateNotificationPreferencesSchema = z.object({
  new_application: z.boolean().optional(),
  status_change: z.boolean().optional(),
  new_message: z.boolean().optional(),
  job_closed: z.boolean().optional(),
  talent_alert_match: z.boolean().optional(),
  digest_frequency: z.enum(['off', 'daily', 'weekly']).optional(),
})

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>

/**
 * Retrieves notification preferences for a user, provisioning defaults if missing.
 */
export async function getNotificationPreferences(userId: string): Promise<DbNotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  if (data) {
    return data as DbNotificationPreferences
  }

  // Provision default preferences if none exist
  const { data: created, error: insertError } = await supabase
    .from('notification_preferences')
    .insert({ user_id: userId })
    .select()
    .single()

  if (insertError) {
    throw Object.assign(new Error(insertError.message), { statusCode: 500 })
  }

  return created as DbNotificationPreferences
}

/**
 * Updates notification preferences for an authenticated user.
 */
export async function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferencesInput
): Promise<DbNotificationPreferences> {
  const parsed = updateNotificationPreferencesSchema.parse(input)

  // Ensure record exists
  await getNotificationPreferences(userId)

  const { data, error } = await supabase
    .from('notification_preferences')
    .update({
      ...parsed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbNotificationPreferences
}

/**
 * Resolves notification preferences by unsubscribe token (public, unauthenticated).
 */
export async function getPreferencesByUnsubscribeToken(token: string): Promise<DbNotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbNotificationPreferences | null
}

/**
 * Handles one-click or targeted unsubscribe via public token.
 */
export async function unsubscribeByToken(
  token: string,
  options?: { disableAll?: boolean; digestOnly?: boolean }
): Promise<DbNotificationPreferences> {
  const current = await getPreferencesByUnsubscribeToken(token)
  if (!current) {
    throw Object.assign(new Error('Invalid or expired unsubscribe link'), { statusCode: 404 })
  }

  const updates: Partial<DbNotificationPreferences> = {
    updated_at: new Date().toISOString(),
  }

  if (options?.digestOnly) {
    updates.digest_frequency = 'off'
  } else {
    // Disable all email notification types by default
    updates.new_application = false
    updates.status_change = false
    updates.new_message = false
    updates.job_closed = false
    updates.talent_alert_match = false
    updates.digest_frequency = 'off'
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .update(updates)
    .eq('unsubscribe_token', token)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbNotificationPreferences
}
