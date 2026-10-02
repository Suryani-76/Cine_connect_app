import { supabase } from '../db/supabase'
import { DbUser } from '../types'

export interface RegisterInput {
  email:    string
  password: string
  username: string
  role:     'talent' | 'production'
}

export interface VerifyOtpInput {
  email: string
  otp:   string
}

/**
 * Registers a new user:
 * 1. Pre-checks email + username availability (clean 409 on conflict).
 * 2. Calls supabase.auth.admin.createUser with username+role in metadata.
 * 3. The DB trigger handle_new_auth_user (migration 009) creates public.users automatically.
 */
export async function registerUser(input: RegisterInput): Promise<DbUser> {
  const { email, password, username, role } = input

  // ── Pre-flight uniqueness checks ──────────────────────────
  const { data: existingEmail } = await supabase
    .from('users').select('id').eq('email', email).maybeSingle()
  if (existingEmail) {
    throw Object.assign(new Error('An account with this email already exists'), { statusCode: 409 })
  }

  const { data: existingUsername } = await supabase
    .from('users').select('id').eq('username', username).maybeSingle()
  if (existingUsername) {
    throw Object.assign(new Error('This username is already taken'), { statusCode: 409 })
  }

  // ── Create auth.users row — trigger creates public.users ──
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,  // OTP verification flow
    user_metadata: { username, role },
  })

  if (authError || !authData.user) {
    // Map Supabase duplicate errors to clean 409s
    const msg = authError?.message ?? ''
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      throw Object.assign(new Error('An account with this email already exists'), { statusCode: 409 })
    }
    throw Object.assign(new Error(msg || 'Registration failed'), { statusCode: 400 })
  }

  // The trigger may take a moment; poll once with a short delay
  const userId = authData.user.id
  await new Promise(r => setTimeout(r, 150))

  const { data: userRow } = await supabase
    .from('users').select('*').eq('id', userId).single()

  if (!userRow) {
    // Trigger hasn't fired yet or failed — fall back to manual insert
    const { data: fallback, error: fbErr } = await supabase
      .from('users')
      .insert({ id: userId, email, username, role })
      .select().single()

    if (fbErr) {
      await supabase.auth.admin.deleteUser(userId)
      throw Object.assign(new Error('Could not create user record'), { statusCode: 500 })
    }
    return fallback as DbUser
  }

  return userRow as DbUser
}

/**
 * Verifies a Supabase email OTP and returns the session + user.
 */
export async function verifyOtp(input: VerifyOtpInput) {
  const { email, otp } = input

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type:  'email',
  })

  if (error || !data.session) {
    throw Object.assign(new Error(error?.message ?? 'Invalid or expired OTP'), { statusCode: 400 })
  }

  return { session: data.session, user: data.user }
}
