#!/usr/bin/env tsx
/**
 * Health check monitoring script.
 * Pings the /health endpoint and reports status.
 * Can be run as a cron job or in CI pre-deploy checks.
 *
 * Usage:
 *   npx tsx scripts/health-check.ts                       # default localhost:3000
 *   npx tsx scripts/health-check.ts https://api.myapp.com # custom URL
 */

const BASE_URL = process.argv[2] ?? 'http://localhost:3000'
const TIMEOUT_MS = 5000

const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const BOLD  = '\x1b[1m'
const RESET = '\x1b[0m'

interface HealthResponse {
  status: string
}

async function checkHealth(): Promise<void> {
  const url = `${BASE_URL}/health`
  const start = Date.now()

  console.log(`${BOLD}CineConnect Health Check${RESET}`)
  console.log(`Checking: ${url}`)
  console.log('─'.repeat(40))

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    const latency = Date.now() - start

    if (!res.ok) {
      console.log(`${RED}✗ HTTP ${res.status} (${latency}ms)${RESET}`)
      process.exit(1)
    }

    const body = (await res.json()) as HealthResponse

    if (body.status !== 'ok') {
      console.log(`${RED}✗ Unexpected response: ${JSON.stringify(body)} (${latency}ms)${RESET}`)
      process.exit(1)
    }

    console.log(`${GREEN}${BOLD}✓ Server is healthy${RESET}`)
    console.log(`  Status:  ${body.status}`)
    console.log(`  Latency: ${latency}ms`)
    console.log(`  Time:    ${new Date().toISOString()}`)
    process.exit(0)
  } catch (err: unknown) {
    const latency = Date.now() - start
    const message = err instanceof Error ? err.message : String(err)
    const isTimeout = message.includes('abort') || message.includes('timeout')

    console.log(`${RED}${BOLD}✗ Server is not responding${RESET}`)
    console.log(`  Error:   ${isTimeout ? 'Request timed out' : message}`)
    console.log(`  Latency: ${latency}ms`)
    console.log(`  Time:    ${new Date().toISOString()}`)
    process.exit(1)
  }
}

checkHealth()
