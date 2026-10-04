import { runEmailWorkerLoop } from './emailWorker'
import { runRecomputeWorkerLoop } from './recomputeWorker'

console.log('[WorkerRunner] Initializing background workers (Email & Recompute)...')

Promise.all([
  runEmailWorkerLoop(3000),
  runRecomputeWorkerLoop(5000),
]).catch((err) => {
  console.error('[WorkerRunner] Fatal error running background workers:', err)
  process.exit(1)
})
