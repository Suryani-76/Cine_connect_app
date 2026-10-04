import { supabase } from '../db/supabase'
import { DbEmailOutbox, DbUser } from '../types'
import { getEmailProvider } from '../services/email/emailProvider'
import { renderEmailTemplate } from '../services/email/templates'
import { getNotificationPreferences } from '../services/notificationPreferencesService'

export interface ProcessBatchResult {
  claimed: number
  sent: number
  failed: number
  dead: number
  throttled: number
  skippedByPrefs: number
  suspended: number
}

// Backoff intervals: Attempt 1 -> +1m, Attempt 2 -> +5m, Attempt 3 -> +30m, Attempt 4 -> +2h
export const BACKOFF_DELAYS_MS = [
  1 * 60 * 1000,     // 1 min
  5 * 60 * 1000,     // 5 min
  30 * 60 * 1000,    // 30 min
  120 * 60 * 1000,   // 2 hours
]

export function getBackoffDelayMs(attemptNumber: number): number {
  const index = Math.max(0, attemptNumber - 1)
  return BACKOFF_DELAYS_MS[index] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1]
}

/**
 * Claims a batch of pending/failed emails from email_outbox using FOR UPDATE SKIP LOCKED
 */
export async function claimOutboxBatch(batchSize = 20): Promise<DbEmailOutbox[]> {
  try {
    const { data, error } = await supabase.rpc('claim_email_outbox_batch', { batch_size: batchSize })
    if (!error && Array.isArray(data)) {
      return data as DbEmailOutbox[]
    }
  } catch {
    // If RPC is unavailable (e.g. test environments without migration loaded), use fallback
  }

  // Fallback for mock environments
  const nowIso = new Date().toISOString()
  const { data: rows, error: selectError } = await supabase
    .from('email_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 5)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (selectError || !rows || rows.length === 0) {
    return []
  }

  const claimed: DbEmailOutbox[] = []
  for (const row of rows) {
    const nextAttempts = (row.attempts ?? 0) + 1
    const { data: updated, error: updateError } = await supabase
      .from('email_outbox')
      .update({
        attempts: nextAttempts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .single()

    if (!updateError && updated) {
      claimed.push(updated as DbEmailOutbox)
    }
  }

  return claimed
}

/**
 * Checks if a new_message email should be throttled (max 1 per conversation per 30 minutes).
 */
export async function isConversationThrottled(row: DbEmailOutbox): Promise<boolean> {
  if (row.template_name !== 'new_message') {
    return false
  }

  const payload = (row.payload || {}) as Record<string, any>
  const conversationId = payload.conversation_id as string | undefined
  const senderId = payload.sender_id as string | undefined
  const recipientId = row.user_id || (payload.recipient_id as string | undefined)

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  let query = supabase
    .from('email_outbox')
    .select('id, payload, created_at, sent_at')
    .eq('template_name', 'new_message')
    .eq('status', 'sent')
    .or(`sent_at.gte.${thirtyMinutesAgo},created_at.gte.${thirtyMinutesAgo}`)
    .neq('id', row.id)

  if (row.recipient_email) {
    query = query.eq('recipient_email', row.recipient_email)
  }

  const { data: recentSent, error } = await query

  if (error || !recentSent || recentSent.length === 0) {
    return false
  }

  for (const prior of recentSent) {
    const pPayload = (prior.payload || {}) as Record<string, any>
    if (conversationId && pPayload.conversation_id === conversationId) {
      return true
    }
    if (senderId && pPayload.sender_id === senderId) {
      return true
    }
  }

  return false
}

/**
 * Processes a single claimed email outbox record.
 */
export async function processOutboxRecord(row: DbEmailOutbox): Promise<
  'sent' | 'failed' | 'dead' | 'throttled' | 'skipped_preference' | 'suspended'
> {
  const maxAttempts = row.max_attempts || 5
  const currentAttempt = row.attempts || 1

  // 1. Resolve recipient user & check suspension
  let recipientUser: DbUser | null = null

  if (row.user_id) {
    const { data: u } = await supabase
      .from('users')
      .select('id, email, username, role, suspended_at, created_at')
      .eq('id', row.user_id)
      .maybeSingle()
    if (u) recipientUser = u as DbUser
  }

  if (!recipientUser && row.recipient_email) {
    const { data: u } = await supabase
      .from('users')
      .select('id, email, username, role, suspended_at, created_at')
      .eq('email', row.recipient_email)
      .maybeSingle()
    if (u) recipientUser = u as DbUser
  }

  if (recipientUser?.suspended_at) {
    await supabase
      .from('email_outbox')
      .update({
        status: 'dead',
        last_error: 'Recipient account is suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    return 'suspended'
  }

  // 2. Check notification preferences & resolve unsubscribe token
  let unsubToken = 'default-unsub'
  if (recipientUser) {
    const prefs = await getNotificationPreferences(recipientUser.id)
    unsubToken = prefs.unsubscribe_token

    // Verify preference for this specific template
    let isEnabled = true
    if (row.template_name === 'new_application') isEnabled = prefs.new_application
    else if (row.template_name === 'status_change') isEnabled = prefs.status_change
    else if (row.template_name === 'new_message') isEnabled = prefs.new_message
    else if (row.template_name === 'job_closed') isEnabled = prefs.job_closed
    else if (row.template_name === 'talent_alert_match') isEnabled = prefs.talent_alert_match
    else if (row.template_name === 'digest') isEnabled = prefs.digest_frequency !== 'off'

    if (!isEnabled) {
      await supabase
        .from('email_outbox')
        .update({
          status: 'sent',
          last_error: `Skipped: ${row.template_name} disabled by user preference`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      return 'skipped_preference'
    }
  }

  // 3. Conversation-level rate limiting for new_message (30-min throttle)
  if (row.template_name === 'new_message') {
    const throttled = await isConversationThrottled(row)
    if (throttled) {
      await supabase
        .from('email_outbox')
        .update({
          status: 'sent',
          last_error: 'Throttled: 30-minute conversation rate limit',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      return 'throttled'
    }
  }

  // 4. Render email template
  const rendered = renderEmailTemplate(
    row.template_name,
    (row.payload || {}) as Record<string, any>,
    unsubToken
  )

  // 5. Send email via active provider
  const provider = getEmailProvider()
  const sendResult = await provider.send({
    to: row.recipient_email,
    subject: row.subject || rendered.subject,
    html: rendered.html,
    text: rendered.text,
  })

  // 6. Handle send outcome
  if (sendResult.success) {
    await supabase
      .from('email_outbox')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    return 'sent'
  }

  // Delivery failed - evaluate retry vs dead state
  const errorMsg = sendResult.error || 'Provider delivery error'

  if (currentAttempt >= maxAttempts) {
    await supabase
      .from('email_outbox')
      .update({
        status: 'dead',
        last_error: `Failed after ${currentAttempt} attempts: ${errorMsg}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    return 'dead'
  }

  // Calculate exponential backoff
  const delayMs = getBackoffDelayMs(currentAttempt)
  const nextAttemptAt = new Date(Date.now() + delayMs).toISOString()

  await supabase
    .from('email_outbox')
    .update({
      status: 'failed',
      last_error: errorMsg,
      next_attempt_at: nextAttemptAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  return 'failed'
}

/**
 * Runs a single pass of claiming and sending outbox records.
 */
export async function processEmailBatch(batchSize = 20): Promise<ProcessBatchResult> {
  const result: ProcessBatchResult = {
    claimed: 0,
    sent: 0,
    failed: 0,
    dead: 0,
    throttled: 0,
    skippedByPrefs: 0,
    suspended: 0,
  }

  const rows = await claimOutboxBatch(batchSize)
  result.claimed = rows.length

  for (const row of rows) {
    try {
      const outcome = await processOutboxRecord(row)
      if (outcome === 'sent') result.sent++
      else if (outcome === 'failed') result.failed++
      else if (outcome === 'dead') result.dead++
      else if (outcome === 'throttled') result.throttled++
      else if (outcome === 'skipped_preference') result.skippedByPrefs++
      else if (outcome === 'suspended') result.suspended++
    } catch (err: any) {
      result.failed++
      await supabase
        .from('email_outbox')
        .update({
          status: 'failed',
          last_error: err?.message || 'Unhandled worker error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    }
  }

  return result
}

/**
 * Continuous loop for standalone worker process
 */
export async function runEmailWorkerLoop(pollIntervalMs = 5000): Promise<void> {
  console.log(`[EmailWorker] Starting email outbox worker (poll: ${pollIntervalMs}ms)...`)
  let isRunning = true

  const stop = () => {
    console.log('[EmailWorker] Shutting down...')
    isRunning = false
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  while (isRunning) {
    try {
      const batchResult = await processEmailBatch(20)
      if (batchResult.claimed > 0) {
        console.log(
          `[EmailWorker] Processed ${batchResult.claimed} items: ` +
          `${batchResult.sent} sent, ${batchResult.throttled} throttled, ` +
          `${batchResult.skippedByPrefs} skipped by prefs, ${batchResult.failed} retried, ` +
          `${batchResult.dead} dead, ${batchResult.suspended} suspended`
        )
      }
    } catch (err) {
      console.error('[EmailWorker] Error in processing cycle:', err)
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
}

// Standalone execution support
if (require.main === module) {
  runEmailWorkerLoop().catch((err) => {
    console.error('[EmailWorker] Fatal error:', err)
    process.exit(1)
  })
}
