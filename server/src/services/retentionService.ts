import { supabase } from "../db/supabase"

export interface RetentionPurgeResult {
  notificationsPurged: number
  outboxPurged: number
  executedAt: string
}

/**
 * Purges read notifications older than 90 days.
 */
export async function purgeOldReadNotifications(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("read", true)
    .lt("created_at", cutoff)
    .select("id")

  if (error) {
    console.error("[retentionService] Failed to purge notifications:", error)
    throw error
  }

  return data ? data.length : 0
}

/**
 * Purges email_outbox records older than 30 days.
 */
export async function purgeOldEmailOutbox(days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("email_outbox")
    .delete()
    .lt("created_at", cutoff)
    .select("id")

  if (error) {
    console.error("[retentionService] Failed to purge email_outbox:", error)
    throw error
  }

  return data ? data.length : 0
}

/**
 * Purges IP address and user agent network metadata from user_consents records older than 180 days (6 months).
 * Retains statutory proof of consent (user_id, terms/privacy versions, timestamp, age confirmation)
 * while removing technical network identifiers in accordance with data minimization principles.
 */
export async function purgeOldConsentMetadata(days = 180): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("user_consents")
    .update({ ip_address: null, user_agent: null })
    .lt("consented_at", cutoff)
    .not("ip_address", "is", null)
    .select("id")

  if (error) {
    console.error("[retentionService] Failed to purge consent metadata:", error)
    throw error
  }

  return data ? data.length : 0
}

/**
 * Runs full automated retention purge.
 */
export async function runRetentionPurge(): Promise<RetentionPurgeResult & { consentMetadataPurged: number }> {
  const notificationsPurged = await purgeOldReadNotifications(90)
  const outboxPurged = await purgeOldEmailOutbox(30)
  const consentMetadataPurged = await purgeOldConsentMetadata(180)

  return {
    notificationsPurged,
    outboxPurged,
    consentMetadataPurged,
    executedAt: new Date().toISOString(),
  }
}
