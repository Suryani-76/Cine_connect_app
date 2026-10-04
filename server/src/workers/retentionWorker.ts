import { runRetentionPurge } from '../services/retentionService'

/**
 * Retention worker: purges read notifications older than 90 days and
 * email_outbox records older than 30 days.
 */
export async function executeRetentionPurge(): Promise<void> {
  console.log('[RetentionWorker] Starting retention purge...')
  try {
    const result = await runRetentionPurge()
    console.log(
      `[RetentionWorker] Purge complete at ${result.executedAt}: ` +
      `${result.notificationsPurged} notifications purged, ${result.outboxPurged} outbox records purged, ` +
      `${result.consentMetadataPurged} consent network metadata records anonymized.`
    )
  } catch (err) {
    console.error('[RetentionWorker] Error running retention purge:', err)
    throw err
  }
}

if (require.main === module) {
  executeRetentionPurge()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
