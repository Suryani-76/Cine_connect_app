import { processMatchRecomputeQueue } from '../services/recomputeService'

/**
 * Recompute worker loop: continually processes pending match recompute items.
 */
export async function runRecomputeWorkerLoop(pollIntervalMs = 5000): Promise<void> {
  console.log(`[RecomputeWorker] Starting recompute worker (poll: ${pollIntervalMs}ms)...`)
  let isRunning = true

  const stop = () => {
    console.log('[RecomputeWorker] Shutting down...')
    isRunning = false
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  while (isRunning) {
    try {
      const result = await processMatchRecomputeQueue(20)
      if (result.processedQueueItems > 0) {
        console.log(
          `[RecomputeWorker] Processed ${result.processedQueueItems} queue items, ` +
          `updated ${result.updatedApplicationsCount} applications.`
        )
      }
    } catch (err) {
      console.error('[RecomputeWorker] Error in recompute cycle:', err)
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
}

if (require.main === module) {
  runRecomputeWorkerLoop().catch((err) => {
    console.error('[RecomputeWorker] Fatal error:', err)
    process.exit(1)
  })
}
