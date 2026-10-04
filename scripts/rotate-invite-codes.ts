#!/usr/bin/env tsx
/**
 * scripts/rotate-invite-codes.ts
 *
 * Emergency & operational tool to:
 * 1. Immediately invalidate/deactivate all existing invite codes.
 * 2. Generate and insert a new set of secure invite codes.
 * 3. Print the new codes to the console ONCE (never logged in CI runners).
 */

import 'dotenv/config'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to rotate invite codes.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export interface NewCodeOptions {
  count?: number
  role?: 'talent' | 'production' | 'any'
  maxUses?: number
}

export async function rotateInviteCodes(options: NewCodeOptions = {}) {
  const count = options.count ?? 5
  const role = options.role ?? 'any'
  const maxUses = options.maxUses ?? 1

  console.log('[RotateInviteCodes] 1. Deactivating all existing active invite codes...')

  // Invalidate all existing codes by setting expires_at to current timestamp
  const { error: deactivateError } = await supabase
    .from('invite_codes')
    .update({ expires_at: new Date().toISOString() })
    .or('expires_at.is.null,expires_at.gt.now()')

  if (deactivateError) {
    console.error('[RotateInviteCodes] Failed to deactivate existing codes:', deactivateError.message)
    throw deactivateError
  }

  console.log('[RotateInviteCodes] 2. Generating new secure invite codes...')
  const newCodes = Array.from({ length: count }, () => ({
    code: `CC-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    role,
    max_uses: maxUses,
    uses_count: 0,
    expires_at: null,
  }))

  const { error: insertError } = await supabase
    .from('invite_codes')
    .insert(newCodes)

  if (insertError) {
    console.error('[RotateInviteCodes] Failed to insert new codes:', insertError.message)
    throw insertError
  }

  const isCI = process.env.CI === 'true' || !!process.env.GITHUB_ACTIONS

  console.log(`[RotateInviteCodes] Successfully provisioned ${count} new invite codes.`)

  if (isCI) {
    console.log('[RotateInviteCodes] Security Notice: Invite code contents suppressed in CI execution log.')
  } else {
    console.log('\n================ NEW INVITE CODES (SAVE THESE) ================')
    for (const c of newCodes) {
      console.log(`  CODE: ${c.code}  | Role: ${c.role}  | Max uses: ${c.max_uses}`)
    }
    console.log('=================================================================\n')
  }

  return newCodes
}

if (require.main === module || process.argv[1] === __filename) {
  rotateInviteCodes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
