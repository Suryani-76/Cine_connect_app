/**
 * scripts/smoke-test.ts
 *
 * Automated smoke test suite executed post-deployment in CI/CD pipelines.
 * Verifies:
 * 1. GET /health returns 200 OK with { status: "ok" } and uptime.
 * 2. GET /jobs (register-less public read) returns 200 OK and jobs array.
 * 3. GET /vocab/skills returns 200 OK and skills vocabulary list.
 * 4. Optional: Authenticated read using Bearer token (without registering a new user).
 *
 * Usage:
 *   npx tsx scripts/smoke-test.ts <BASE_URL> [BEARER_TOKEN]
 */

const baseUrl = (process.argv[2] || process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '')
const authToken = process.argv[3] || process.env.SMOKE_AUTH_TOKEN

interface TestResult {
  name: string
  passed: boolean
  durationMs: number
  error?: string
}

async function runCheck(name: string, fn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now()
  try {
    await fn()
    return { name, passed: true, durationMs: Date.now() - start }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    return { name, passed: false, durationMs: Date.now() - start, error }
  }
}

async function main() {
  console.log(`\n🔍 [SmokeTest] Starting deployment verification against: ${baseUrl}\n`)
  const results: TestResult[] = []

  // Check 1: GET /health
  results.push(
    await runCheck('GET /health (service liveness check)', async () => {
      const res = await fetch(`${baseUrl}/health`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json() as Record<string, unknown>
      if (data.status !== 'ok') {
        throw new Error(`Unexpected status payload: ${JSON.stringify(data)}`)
      }
      if (data.uptime !== undefined && typeof data.uptime !== 'number') {
        throw new Error(`Expected uptime number, got: ${data.uptime}`)
      }
    })
  )

  // Check 2: GET /jobs (register-less public read)
  results.push(
    await runCheck('GET /jobs (register-less public read)', async () => {
      const res = await fetch(`${baseUrl}/jobs?limit=5`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json() as Record<string, unknown>
      if (!Array.isArray(data.jobs)) {
        throw new Error(`Expected { jobs: [...] }, got: ${JSON.stringify(data)}`)
      }
    })
  )

  // Check 3: GET /vocab/skills (controlled vocabulary read)
  results.push(
    await runCheck('GET /vocab/skills (controlled vocabulary read)', async () => {
      const res = await fetch(`${baseUrl}/vocab/skills`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json() as Record<string, unknown>
      if (!Array.isArray(data.skills)) {
        throw new Error(`Expected { skills: [...] }, got: ${JSON.stringify(data)}`)
      }
    })
  )

  // Check 4: Optional authenticated read if token provided
  if (authToken) {
    results.push(
      await runCheck('GET /jobs?sort=best_match (register-less authenticated read)', async () => {
        const res = await fetch(`${baseUrl}/jobs?sort=best_match`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        const data = await res.json() as Record<string, unknown>
        if (!Array.isArray(data.jobs)) {
          throw new Error(`Expected { jobs: [...] }, got: ${JSON.stringify(data)}`)
        }
      })
    )
  }

  // Summary
  console.log('── Smoke Test Results ──────────────────────────────')
  let anyFailed = false
  for (const r of results) {
    if (r.passed) {
      console.log(`  ✅ ${r.name} (${r.durationMs}ms)`)
    } else {
      console.error(`  ❌ ${r.name} (${r.durationMs}ms) — Error: ${r.error}`)
      anyFailed = true
    }
  }
  console.log('────────────────────────────────────────────────────\n')

  if (anyFailed) {
    console.error('💥 Smoke tests failed! Immediate rollback recommended.\n')
    process.exit(1)
  }

  console.log('✨ All smoke tests passed successfully! Deployment is healthy.\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('[SmokeTest] Fatal runner error:', err)
  process.exit(1)
})
