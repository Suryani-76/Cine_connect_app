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
 * Runs full automated retention purge.
 */
export async function runRetentionPurge(): Promise<RetentionPurgeResult> {
  const notificationsPurged = await purgeOldReadNotifications(90)
  const outboxPurged = await purgeOldEmailOutbox(30)

  return {
    notificationsPurged,
    outboxPurged,
    executedAt: new Date().toISOString(),
  }
}
