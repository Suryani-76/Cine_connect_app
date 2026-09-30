import { supabase } from '../db/supabase'
import { DbUser } from '../types'

export interface RegisterInput {
  email: string
  password: string
  username: string
  role: 'talent' | 'production'
}

export interface VerifyOtpInput {
  email: string
  otp: string
}

/**
 * 1. Creates the Supabase Auth user (sends OTP verification email).
 * 2. Inserts a row in public.users.
 *
 * The service-role key bypasses RLS so we can write the public.users row
 * immediately after signup without waiting for the user to verify.
 */
export async function registerUser(input: RegisterInput): Promise<DbUser> {
  const { email, password, username, role } = input

  // Step 1 – create auth user; Supabase will send a 6-digit OTP email
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // force OTP verification flow
    user_metadata: { username, role },
  })

  if (authError || !authData.user) {
    throw Object.assign(new Error(authError?.message ?? 'Registration failed'), {
      statusCode: 400,
    })
  }

  const userId = authData.user.id

  // Step 2 – insert public.users profile row
  const { data: userRow, error: dbError } = await supabase
    .from('users')
    .insert({ id: userId, email, username, role })
    .select()
    .single()

  if (dbError) {
    // Clean up the auth user so the email isn't locked
    await supabase.auth.admin.deleteUser(userId)
    throw Object.assign(new Error(dbError.message ?? 'Could not create user record'), {
      statusCode: 500,
    })
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
    type: 'email',
  })

  if (error || !data.session) {
    throw Object.assign(new Error(error?.message ?? 'Invalid or expired OTP'), {
      statusCode: 400,
    })
  }

  return {
    session: data.session,
    user: data.user,
  }
}
