#!/usr/bin/env tsx
/**
 * Validates that all required environment variables are set and valid.
 * Run before starting the server: `npx tsx scripts/validate-env.ts`
 */

interface EnvRule {
  key: string
  description: string
  validate?: (value: string) => boolean
  validationMessage?: string
}

const SERVER_RULES: EnvRule[] = [
  {
    key: 'SUPABASE_URL',
    description: 'Supabase project URL',
    validate: (v) => /^https:\/\/.+\.supabase\.co$/.test(v),
    validationMessage: 'Must be a valid Supabase URL (https://xxx.supabase.co)',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Supabase service role key',
    validate: (v) => v.startsWith('eyJ') && v.length > 100,
    validationMessage: 'Must be a valid JWT token starting with "eyJ"',
  },
  {
    key: 'PORT',
    description: 'Server port (optional, defaults to 3000)',
    validate: (v) => !isNaN(Number(v)) && Number(v) > 0 && Number(v) < 65536,
    validationMessage: 'Must be a valid port number (1-65535)',
  },
  {
    key: 'ALLOWED_ORIGINS',
    description: 'Comma-separated list of allowed CORS origins',
  },
]

const CLIENT_RULES: EnvRule[] = [
  {
    key: 'VITE_SUPABASE_URL',
    description: 'Supabase project URL for the client',
    validate: (v) => /^https:\/\/.+\.supabase\.co$/.test(v),
    validationMessage: 'Must be a valid Supabase URL',
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    description: 'Supabase anon (public) key',
    validate: (v) => v.startsWith('eyJ') && v.length > 100,
    validationMessage: 'Must be a valid JWT token starting with "eyJ"',
  },
  {
    key: 'VITE_API_URL',
    description: 'Backend API base URL',
    validate: (v) => /^https?:\/\//.test(v),
    validationMessage: 'Must be a valid URL',
  },
]

// ── Helpers ───────────────────────────────────────────────────

const RESET  = '\x1b[0m'
const RED    = '\x1b[31m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD   = '\x1b[1m'

function check(rules: EnvRule[], source: string, envVars: Record<string, string | undefined>): boolean {
  console.log(`\n${BOLD}${source}${RESET}`)
  let allPassed = true

  const optionalKeys = ['PORT', 'ALLOWED_ORIGINS']

  for (const rule of rules) {
    const value = envVars[rule.key]

    if (!value || value.trim() === '') {
      if (optionalKeys.includes(rule.key)) {
        console.log(`  ${YELLOW}⚠  ${rule.key}${RESET} — not set (optional)`)
      } else {
        console.log(`  ${RED}✗  ${rule.key}${RESET} — MISSING (${rule.description})`)
        allPassed = false
      }
      continue
    }

    // Check for placeholder values
    if (value.includes('placeholder') || value.includes('YOUR_')) {
      console.log(`  ${RED}✗  ${rule.key}${RESET} — still contains placeholder value`)
      allPassed = false
      continue
    }

    // Run custom validator
    if (rule.validate && !rule.validate(value)) {
      console.log(`  ${RED}✗  ${rule.key}${RESET} — ${rule.validationMessage}`)
      allPassed = false
      continue
    }

    console.log(`  ${GREEN}✓  ${rule.key}${RESET}`)
  }

  return allPassed
}

function loadEnvFile(path: string): Record<string, string | undefined> {
  try {
    const fs = require('fs')
    const content = fs.readFileSync(path, 'utf8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = val
    }
    return env
  } catch {
    return {}
  }
}

// ── Main ──────────────────────────────────────────────────────

console.log(`${BOLD}CineConnect — Environment Validation${RESET}`)
console.log('─'.repeat(40))

const serverEnv = { ...loadEnvFile('./server/.env'), ...process.env }
const clientEnv = { ...loadEnvFile('./client/.env'), ...process.env }

const serverOk = check(SERVER_RULES, 'server/.env', serverEnv)
const clientOk = check(CLIENT_RULES, 'client/.env', clientEnv)

console.log('\n' + '─'.repeat(40))
if (serverOk && clientOk) {
  console.log(`${GREEN}${BOLD}All environment variables are valid ✓${RESET}`)
  process.exit(0)
} else {
  console.log(`${RED}${BOLD}Fix the above issues before starting the app ✗${RESET}`)
  process.exit(1)
}
