#!/usr/bin/env tsx
/**
 * scripts/add-admin.ts
 *
 * Operational tool to migrate or grant administrator status to a user.
 * Inserts the user ID into the public.admins table and records an audit log entry.
 *
 * Usage:
 *   npx tsx scripts/add-admin.ts <email> --confirm
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function addAdmin(emailArg: string, isConfirmed: boolean) {
  const email = emailArg.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    console.error('Error: Please provide a valid user email address.')
    process.exit(1)
  }

  if (!isConfirmed) {
    console.error('=================================================================')
    console.error('⚠️  SAFETY GUARD: Administrator Privilege Grant')
    console.error(`Target user: ${email}`)
    console.error('')
    console.error('Granting administrator status confers full platform management rights.')
    console.error('To proceed, rerun the command with the explicit --confirm flag:')
    console.error(`  npx tsx scripts/add-admin.ts ${email} --confirm`)
    console.error('=================================================================')
    process.exit(1)
  }

  console.log(`[add-admin] Locating user with email: ${email}...`)

  // 1. Find user in public.users
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, email, username, role')
    .eq('email', email)
    .maybeSingle()

  if (findError) {
    console.error(`[add-admin] Database lookup failed: ${findError.message}`)
    process.exit(1)
  }

  if (!user) {
    console.error(`[add-admin] User with email "${email}" not found in database.`)
    process.exit(1)
  }

  // 2. Check if user is already an admin
  const { data: existingAdmin, error: checkError } = await supabase
    .from('admins')
    .select('user_id, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (checkError) {
    console.error(`[add-admin] Failed to check admins table: ${checkError.message}`)
    process.exit(1)
  }

  if (existingAdmin) {
    console.log(`[add-admin] User ${email} (ID: ${user.id}) is already an administrator (since ${existingAdmin.created_at}).`)
    return user
  }

  // 3. Insert into public.admins
  const { error: insertError } = await supabase
    .from('admins')
    .insert({
      user_id: user.id,
      created_at: new Date().toISOString(),
      created_by: null,
    })

  if (insertError) {
    console.error(`[add-admin] Failed to insert into admins table: ${insertError.message}`)
    process.exit(1)
  }

  // 4. Record audit log
  await supabase
    .from('audit_log')
    .insert({
      actor_id: null,
      action: 'grant_admin',
      target_type: 'admin',
      target_id: user.id,
      details: {
        email: user.email,
        username: user.username,
        source: 'scripts/add-admin.ts',
      },
    })

  console.log('=================================================================')
  console.log(`✅ Administrator privileges successfully granted to:`)
  console.log(`   Email:    ${user.email}`)
  console.log(`   User ID:  ${user.id}`)
  console.log(`   Username: ${user.username}`)
  console.log('=================================================================')

  return user
}

if (require.main === module || process.argv[1] === __filename) {
  const args = process.argv.slice(2)
  const emailArg = args.find(a => !a.startsWith('-'))
  const isConfirmed = args.includes('--confirm') || args.includes('-y')

  if (!emailArg) {
    console.log('Usage: npx tsx scripts/add-admin.ts <email> --confirm')
    process.exit(1)
  }

  addAdmin(emailArg, isConfirmed)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[add-admin] Unexpected error:', err)
      process.exit(1)
    })
}
