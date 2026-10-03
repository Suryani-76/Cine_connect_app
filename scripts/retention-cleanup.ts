import "dotenv/config"
import { runRetentionPurge } from "../server/src/services/retentionService"

async function main() {
  console.log("🧹 [Retention Cleanup] Starting scheduled data retention purge...")
  try {
    const result = await runRetentionPurge()
    console.log("✅ [Retention Cleanup] Completed successfully at:", result.executedAt)
    console.log(`   - Read notifications purged (>90 days): ${result.notificationsPurged}`)
    console.log(`   - Email outbox rows purged (>30 days):   ${result.outboxPurged}`)
    process.exit(0)
  } catch (err) {
    console.error("❌ [Retention Cleanup] Failed:", err)
    process.exit(1)
  }
}

main()
