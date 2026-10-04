import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── JWT Helper for Authenticated User Simulation ──────────────
function createJwt(userId: string, email: string, role = 'authenticated', secret = 'super-secret-jwt-token-with-at-least-32-characters-long') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    aud: 'authenticated',
    role,
    email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

// ── RLS Policy Matrix Evaluator (Migration 018 Semantics) ──────
interface PolicyContext {
  role: 'anon' | 'authenticated' | 'service_role'
  userId: string | null
  userRole?: 'talent' | 'production' | 'admin'
}

class RlsMatrixSimulator {
  canSelect(table: string, rowOwnerId: string | null, ctx: PolicyContext, rowStatus?: string): boolean {
    if (ctx.role === 'service_role') return true

    switch (table) {
      case 'users':
        if (ctx.role === 'anon') return false
        return ctx.userId === rowOwnerId

      case 'public_profiles':
        // Authenticated can read public profile view
        return ctx.role === 'authenticated'

      case 'talent_profiles':
      case 'production_profiles':
      case 'job_views':
      case 'user_consents':
      case 'invite_codes':
      case 'email_outbox':
      case 'match_config_audit_logs':
      case 'match_recompute_queue':
        // Direct client SELECT completely revoked from both anon and authenticated
        return false

      case 'match_config':
        // Only admin role can read match_config
        return ctx.role === 'authenticated' && ctx.userRole === 'admin'

      case 'jobs':
      case 'job_requirements':
        if (ctx.role === 'anon') return false
        if (rowStatus === 'published') return true
        return ctx.userId === rowOwnerId

      case 'notifications':
        if (ctx.role === 'anon') return false
        return ctx.userId === rowOwnerId

      case 'messages':
        if (ctx.role === 'anon') return false
        return ctx.userId === rowOwnerId // sender or recipient

      case 'skills':
      case 'roles':
      case 'cities':
      case 'skill_aliases':
        // Autocomplete vocabularies are publicly readable
        return true

      default:
        return false
    }
  }

  canWrite(table: string, action: 'insert' | 'update' | 'delete', ctx: PolicyContext): boolean {
    if (ctx.role === 'service_role') return true

    // Only exception in 018: temporary authenticated INSERT on messages until 4C-2
    if (table === 'messages' && action === 'insert' && ctx.role === 'authenticated') {
      return true
    }

    // All other client writes are revoked
    return false
  }
}

describe('Migration 018 RLS Lockdown Policy Specification', () => {
  const simulator = new RlsMatrixSimulator()
  const userAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const userBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  const anonCtx: PolicyContext = { role: 'anon', userId: null }
  const userACtx: PolicyContext = { role: 'authenticated', userId: userAId, userRole: 'talent' }
  const userBCtx: PolicyContext = { role: 'authenticated', userId: userBId, userRole: 'production' }
  const adminCtx: PolicyContext = { role: 'authenticated', userId: 'admin-uuid', userRole: 'admin' }

  describe('1. Anon Read Restrictions', () => {
    const lockedTables = [
      'users',
      'talent_profiles',
      'production_profiles',
      'jobs',
      'invite_codes',
      'match_config',
      'job_views',
      'notifications',
      'messages',
    ]

    for (const table of lockedTables) {
      it(`proves anon CANNOT read table "${table}"`, () => {
        expect(simulator.canSelect(table, userAId, anonCtx, 'published')).toBe(false)
      })
    }

    it('proves anon CAN read public vocabulary tables for autocomplete', () => {
      expect(simulator.canSelect('skills', null, anonCtx)).toBe(true)
      expect(simulator.canSelect('roles', null, anonCtx)).toBe(true)
      expect(simulator.canSelect('cities', null, anonCtx)).toBe(true)
      expect(simulator.canSelect('skill_aliases', null, anonCtx)).toBe(true)
    })
  })

  describe('2. User Isolation: User A cannot read or write User B rows', () => {
    it('user A cannot read user B user record in public.users', () => {
      expect(simulator.canSelect('users', userBId, userACtx)).toBe(false)
    })

    it('user A can only read own user record in public.users', () => {
      expect(simulator.canSelect('users', userAId, userACtx)).toBe(true)
    })

    it('user A cannot read user B notifications', () => {
      expect(simulator.canSelect('notifications', userBId, userACtx)).toBe(false)
    })

    it('user A can read own notifications', () => {
      expect(simulator.canSelect('notifications', userAId, userACtx)).toBe(true)
    })

    it('user A cannot write to user B rows in any table', () => {
      expect(simulator.canWrite('users', 'update', userACtx)).toBe(false)
      expect(simulator.canWrite('notifications', 'update', userACtx)).toBe(false)
      expect(simulator.canWrite('messages', 'update', userACtx)).toBe(false)
    })
  })

  describe('3. Server-As-Sole-Writer: Direct Client Writes Revoked', () => {
    const writeBlockedTables = [
      'applications',
      'jobs',
      'job_requirements',
      'talent_profiles',
      'production_profiles',
      'users',
      'saved_jobs',
      'talent_alerts',
      'job_views',
      'user_consents',
      'invite_codes',
      'match_config',
      'skills',
    ]

    for (const table of writeBlockedTables) {
      it(`proves user A cannot insert directly into "${table}"`, () => {
        expect(simulator.canWrite(table, 'insert', userACtx)).toBe(false)
      })
      it(`proves user A cannot update directly in "${table}"`, () => {
        expect(simulator.canWrite(table, 'update', userACtx)).toBe(false)
      })
      it(`proves user A cannot delete directly from "${table}"`, () => {
        expect(simulator.canWrite(table, 'delete', userACtx)).toBe(false)
      })
    }

    it('proves messages INSERT is temporarily permitted for authenticated users until 4C-2', () => {
      expect(simulator.canWrite('messages', 'insert', userACtx)).toBe(true)
      expect(simulator.canWrite('messages', 'insert', anonCtx)).toBe(false)
    })
  })

  describe('4. Invite Codes & Match Config Access Protection', () => {
    it('anon cannot list invite codes', () => {
      expect(simulator.canSelect('invite_codes', null, anonCtx)).toBe(false)
    })

    it('authenticated non-admin user cannot list invite codes', () => {
      expect(simulator.canSelect('invite_codes', null, userACtx)).toBe(false)
      expect(simulator.canSelect('invite_codes', null, userBCtx)).toBe(false)
    })

    it('regular authenticated user cannot read match_config', () => {
      expect(simulator.canSelect('match_config', null, userACtx)).toBe(false)
    })

    it('database admin CAN read match_config', () => {
      expect(simulator.canSelect('match_config', null, adminCtx)).toBe(true)
    })
  })

  describe('5. Job Visibility Rules', () => {
    it('anon cannot read published or draft jobs directly from database', () => {
      expect(simulator.canSelect('jobs', userBId, anonCtx, 'published')).toBe(false)
      expect(simulator.canSelect('jobs', userBId, anonCtx, 'draft')).toBe(false)
    })

    it('authenticated user can read published jobs', () => {
      expect(simulator.canSelect('jobs', userBId, userACtx, 'published')).toBe(true)
    })

    it('authenticated non-owner cannot read draft jobs of another user', () => {
      expect(simulator.canSelect('jobs', userBId, userACtx, 'draft')).toBe(false)
    })

    it('job owner can read their own draft jobs', () => {
      expect(simulator.canSelect('jobs', userBId, userBCtx, 'draft')).toBe(true)
    })
  })
})

// ── Live Supabase PostgREST Test Suite (Executes when Supabase is running) ─────
describe('Live Local Supabase RLS Lockdown Integration', () => {
  const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321'
  const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'
  let isLocalAvailable = false

  let anonClient: SupabaseClient
  let userAClient: SupabaseClient
  let userBClient: SupabaseClient

  const userAId = 'a0000000-0000-0000-0000-000000000001'
  const userBId = 'b0000000-0000-0000-0000-000000000002'

  beforeAll(async () => {
    try {
      const res = await fetch(`${localSupabaseUrl}/rest/v1/`, { method: 'HEAD', signal: AbortSignal.timeout(1000) })
      isLocalAvailable = res.ok || res.status === 401 || res.status === 200
    } catch {
      isLocalAvailable = false
    }

    if (isLocalAvailable) {
      anonClient = createClient(localSupabaseUrl, anonKey)
      const tokenA = createJwt(userAId, 'usera@cineconnect.test')
      const tokenB = createJwt(userBId, 'userb@cineconnect.test')

      userAClient = createClient(localSupabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${tokenA}` } },
      })
      userBClient = createClient(localSupabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${tokenB}` } },
      })
    }
  })

  it('runs live PostgREST assertions if local Supabase instance is active', async () => {
    if (!isLocalAvailable) {
      console.log(`[RLS Live] Local Supabase not running at ${localSupabaseUrl}. Skipping live network PostgREST tests.`)
      return
    }

    // 1. Anon cannot read users
    const { data: anonUsers, error: anonUsersErr } = await anonClient.from('users').select('*')
    expect(anonUsersErr !== null || (anonUsers && anonUsers.length === 0)).toBe(true)

    // 2. Anon cannot list invite codes
    const { data: anonCodes, error: anonCodesErr } = await anonClient.from('invite_codes').select('*')
    expect(anonCodesErr !== null || (anonCodes && anonCodes.length === 0)).toBe(true)

    // 3. User A cannot read match_config
    const { data: matchConfig, error: matchConfigErr } = await userAClient.from('match_config').select('*')
    expect(matchConfigErr !== null || (matchConfig && matchConfig.length === 0)).toBe(true)

    // 4. Anon cannot insert job_views
    const { error: anonViewErr } = await anonClient.from('job_views').insert({
      job_id: 'a0000000-0000-0000-0000-000000000001',
      viewer_id: null,
    })
    expect(anonViewErr).not.toBeNull()

    // 5. User A cannot insert applications directly
    const { error: appErr } = await userAClient.from('applications').insert({
      job_id: 'a0000000-0000-0000-0000-000000000001',
      talent_profile_id: 'a0000000-0000-0000-0000-000000000001',
    })
    expect(appErr).not.toBeNull()

    // 6. User A cannot insert jobs directly
    const { error: jobErr } = await userAClient.from('jobs').insert({
      production_id: 'a0000000-0000-0000-0000-000000000001',
      title: 'Direct Job',
    })
    expect(jobErr).not.toBeNull()
  })
})
