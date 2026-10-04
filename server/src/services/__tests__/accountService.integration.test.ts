import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { exportUserData, deleteUserAccount } from '../accountService'
import fs from 'fs'
import path from 'path'

describe('Account Service Integration Suite (Export & Deletion)', () => {
  const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321'
  const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_KEY || 'dummy-service-role-key'
  let isLocalAvailable = false

  beforeAll(async () => {
    try {
      const res = await fetch(`${localSupabaseUrl}/rest/v1/`, { method: 'HEAD', signal: AbortSignal.timeout(1000) })
      isLocalAvailable = res.ok || res.status === 401 || res.status === 200
    } catch {
      isLocalAvailable = false
    }
  })

  it('proves accountService queries talent_credits and has NO references to phantom credits table', () => {
    const servicePath = path.resolve(__dirname, '../accountService.ts')
    const content = fs.readFileSync(servicePath, 'utf8')

    // Must not query unmigrated phantom table .from("credits") or .from('credits')
    const creditsQueryRegex = /\.from\(\s*['"]credits['"]\s*\)/g
    expect(creditsQueryRegex.test(content)).toBe(false)

    // Must query migrated talent_credits table
    const talentCreditsRegex = /\.from\(\s*['"]talent_credits['"]\s*\)/g
    expect(talentCreditsRegex.test(content)).toBe(true)
  })

  it('runs account export and account deletion against local Supabase if running', async () => {
    if (!isLocalAvailable) {
      console.log(`[Integration] Local Supabase not reachable at ${localSupabaseUrl}. Skipping live network test.`)
      return
    }

    const adminClient = createClient(localSupabaseUrl, serviceRoleKey)
    const testUserId = crypto.randomUUID()
    const testEmail = `test_account_${Date.now()}@cineconnect.local`

    // Seed test user
    const { error: seedUserErr } = await adminClient.from('users').insert({
      id: testUserId,
      email: testEmail,
      username: `user_${Date.now()}`,
      role: 'talent',
    })
    expect(seedUserErr).toBeNull()

    // Seed talent profile
    const { data: tp, error: seedProfileErr } = await adminClient.from('talent_profiles').insert({
      user_id: testUserId,
      full_name: 'Integration Test User',
      skills: ['Directing'],
      experience_level: 'mid',
    }).select().single()
    expect(seedProfileErr).toBeNull()

    // Seed talent credit
    const { data: credit, error: seedCreditErr } = await adminClient.from('talent_credits').insert({
      talent_profile_id: tp.id,
      project_title: 'Indie Short Film',
      role: 'Director',
      year: 2024,
    }).select().single()
    expect(seedCreditErr).toBeNull()

    // 1. Run exportUserData
    const exportResult = await exportUserData(testUserId)
    expect(exportResult).toBeDefined()
    expect(exportResult.export_metadata.user_id).toBe(testUserId)
    expect(exportResult.user?.id).toBe(testUserId)
    expect(exportResult.profile?.id).toBe(tp.id)
    // Verify credits returns seeded talent credit
    expect(exportResult.credits).toHaveLength(1)
    expect(exportResult.credits?.[0]?.project_title).toBe('Indie Short Film')

    // 2. Run deleteUserAccount
    await deleteUserAccount(testUserId)

    // 3. Verify user is removed from public.users
    const { data: deletedUser } = await adminClient
      .from('users')
      .select('id')
      .eq('id', testUserId)
      .maybeSingle()

    expect(deletedUser).toBeNull()

    // 4. Verify talent_credits are cascaded/removed
    const { data: deletedCredits } = await adminClient
      .from('talent_credits')
      .select('id')
      .eq('id', credit.id)
      .maybeSingle()

    expect(deletedCredits).toBeNull()
  })
})
