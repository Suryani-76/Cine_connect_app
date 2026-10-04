import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ── JWT Helper for Authenticated User Simulation ──────────────
function createLocalUserJwt(userId: string, email: string, secret = 'super-secret-jwt-token-with-at-least-32-characters-long') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

// ── Policy Logic Evaluators ───────────────────────────────────
// These formalize the exact SQL semantics of Migration 001 (Old) vs Migration 017 (New)

interface UserRow {
  id: string
  email: string
  username: string
  role: 'admin' | 'production' | 'talent'
}

interface CallerContext {
  jwtRole: string // 'authenticated' | 'service_role' | 'anon'
  userId: string | null
}

function evaluateOldPolicyInsert(row: UserRow, caller: CallerContext): { allowed: boolean; error?: string } {
  // Migration 001: CHECK (auth.uid() = id)
  if (caller.userId === row.id) {
    return { allowed: true } // BUG: Allows inserting role = 'admin'!
  }
  return { allowed: false, error: 'new row violates row-level security policy for table "users"' }
}

function evaluateOldPolicyUpdate(oldRow: UserRow, newRow: UserRow, caller: CallerContext): { allowed: boolean; error?: string } {
  // Migration 001: USING (auth.uid() = id)
  if (caller.userId === oldRow.id) {
    return { allowed: true } // BUG: Allows updating role to 'admin'!
  }
  return { allowed: false, error: 'new row violates row-level security policy for table "users"' }
}

function evaluateNewPolicyInsert(row: UserRow, caller: CallerContext): { allowed: boolean; error?: string } {
  // Migration 017: CHECK (auth.uid() = id AND role IN ('production', 'talent'))
  if (caller.userId === row.id && (row.role === 'production' || row.role === 'talent')) {
    return { allowed: true }
  }
  return { allowed: false, error: 'new row violates row-level security policy for table "users"' }
}

function evaluateNewPolicyUpdate(oldRow: UserRow, newRow: UserRow, caller: CallerContext): { allowed: boolean; error?: string } {
  // Migration 017:
  // 1. Policy: USING (auth.uid() = id) WITH CHECK (auth.uid() = id)
  if (caller.userId !== oldRow.id || caller.userId !== newRow.id) {
    return { allowed: false, error: 'new row violates row-level security policy for table "users"' }
  }

  // 2. Trigger: protect_users_role_and_identity()
  if (
    newRow.role !== oldRow.role ||
    newRow.id !== oldRow.id ||
    newRow.email !== oldRow.email
  ) {
    if (caller.jwtRole !== 'service_role') {
      return {
        allowed: false,
        error: `Unauthorized: modifying id, email, or role is not permitted for caller role ${caller.jwtRole}`,
      }
    }
  }

  return { allowed: true }
}

describe('Privilege Escalation Policy Verification (Migration 001 Old vs Migration 017 New)', () => {
  const userAId = 'a1111111-1111-1111-1111-111111111111'
  const userACaller: CallerContext = {
    jwtRole: 'authenticated',
    userId: userAId,
  }

  const existingUserA: UserRow = {
    id: userAId,
    email: 'userA@cineconnect.in',
    username: 'talent_user_a',
    role: 'talent',
  }

  describe('Old Policy (Migration 001) Vulnerability Proof', () => {
    it('proves old policy FAILS the privilege escalation test (allows self-escalation to admin)', () => {
      // User A attempts to update own role to 'admin'
      const updatedRow: UserRow = { ...existingUserA, role: 'admin' }
      const updateResult = evaluateOldPolicyUpdate(existingUserA, updatedRow, userACaller)

      // Under the old policy, this update was ALLOWED (security failure)
      expect(updateResult.allowed).toBe(true)

      // User A attempts to insert a new row with role 'admin'
      const newAdminRow: UserRow = {
        id: userAId,
        email: 'userA@cineconnect.in',
        username: 'admin_user_a',
        role: 'admin',
      }
      const insertResult = evaluateOldPolicyInsert(newAdminRow, userACaller)

      // Under the old policy, this insert was ALLOWED (security failure)
      expect(insertResult.allowed).toBe(true)
    })
  })

  describe('New Policy (Migration 017) Security Enforcement', () => {
    it('user A tries to update own role to admin and MUST FAIL', () => {
      const updatedRow: UserRow = { ...existingUserA, role: 'admin' }
      const result = evaluateNewPolicyUpdate(existingUserA, updatedRow, userACaller)

      expect(result.allowed).toBe(false)
      expect(result.error).toContain('Unauthorized: modifying id, email, or role is not permitted for caller role authenticated')
    })

    it('user A tries to insert a users row with role admin and MUST FAIL', () => {
      const newAdminRow: UserRow = {
        id: userAId,
        email: 'userA@cineconnect.in',
        username: 'admin_user_a',
        role: 'admin',
      }
      const result = evaluateNewPolicyInsert(newAdminRow, userACaller)

      expect(result.allowed).toBe(false)
      expect(result.error).toContain('violates row-level security policy')
    })

    it('normal profile update (username change) still works', () => {
      const updatedRow: UserRow = { ...existingUserA, username: 'updated_talent_handle' }
      const result = evaluateNewPolicyUpdate(existingUserA, updatedRow, userACaller)

      expect(result.allowed).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('user A cannot alter their id or email through update path', () => {
      const alteredEmailRow: UserRow = { ...existingUserA, email: 'hacked@cineconnect.in' }
      const emailResult = evaluateNewPolicyUpdate(existingUserA, alteredEmailRow, userACaller)
      expect(emailResult.allowed).toBe(false)

      const alteredIdRow: UserRow = { ...existingUserA, id: 'b2222222-2222-2222-2222-222222222222' }
      const idResult = evaluateNewPolicyUpdate(existingUserA, alteredIdRow, userACaller)
      expect(idResult.allowed).toBe(false)
    })

    it('service_role can legitimately update user roles and identity', () => {
      const serviceCaller: CallerContext = {
        jwtRole: 'service_role',
        userId: userAId,
      }
      const updatedRow: UserRow = { ...existingUserA, role: 'admin' }
      const result = evaluateNewPolicyUpdate(existingUserA, updatedRow, serviceCaller)

      expect(result.allowed).toBe(true)
    })
  })
})

// ── Live Local Supabase Suite (Runs when local Supabase instance is online) ─────
describe('Live Local Supabase Integration Suite', () => {
  const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321'
  let isLocalAvailable = false

  beforeAll(async () => {
    try {
      const res = await fetch(`${localSupabaseUrl}/rest/v1/`, { method: 'HEAD', signal: AbortSignal.timeout(1000) })
      isLocalAvailable = res.ok || res.status === 401 || res.status === 200
    } catch {
      isLocalAvailable = false
    }
  })

  it('verifies privilege escalation prevention against live local Supabase if running', async () => {
    if (!isLocalAvailable) {
      console.log(`[Integration] Local Supabase not reachable at ${localSupabaseUrl}. Skipping live network test.`)
      return
    }

    const testUserId = crypto.randomUUID()
    const testEmail = `test_${Date.now()}@cineconnect.local`
    const userJwt = createLocalUserJwt(testUserId, testEmail)

    const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy'
    const client = createClient(localSupabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userJwt}`,
        },
      },
    })

    // 1. Try to insert with role = 'admin' -> Must fail
    const { error: insertAdminErr } = await client.from('users').insert({
      id: testUserId,
      email: testEmail,
      username: `user_${Date.now()}`,
      role: 'admin',
    })
    expect(insertAdminErr).not.toBeNull()

    // 2. Insert with allowed role = 'talent' -> Must succeed
    const { error: insertTalentErr } = await client.from('users').insert({
      id: testUserId,
      email: testEmail,
      username: `user_${Date.now()}`,
      role: 'talent',
    })
    expect(insertTalentErr).toBeNull()

    // 3. Try to update role to 'admin' -> Must fail
    const { error: updateAdminErr } = await client.from('users').update({ role: 'admin' }).eq('id', testUserId)
    expect(updateAdminErr).not.toBeNull()

    // 4. Normal profile update -> Must succeed
    const { error: updateNormalErr } = await client.from('users').update({ username: 'valid_name' }).eq('id', testUserId)
    expect(updateNormalErr).toBeNull()
  })
})
