import { supabase } from "../db/supabase"
import { DbUser } from "../types"

export const CURRENT_TERMS_VERSION = "v1.0"
export const CURRENT_PRIVACY_VERSION = "v1.0"

export interface ConsentInput {
  terms: boolean
  terms_version?: string
  privacy_version?: string
  cookie_consent?: boolean
  ip_address?: string
  user_agent?: string
}

export interface RegisterInput {
  email:        string
  password:     string
  username:     string
  role:         "talent" | "production"
  consent?:     ConsentInput
  invite_code?: string
  ip_address?:  string
  user_agent?:  string
}

export interface VerifyOtpInput {
  email: string
  otp:   string
}

/**
 * Registers a new user:
 * 1. Checks invite code if INVITE_ONLY mode is active.
 * 2. Pre-checks email + username availability (clean 409 on conflict).
 * 3. Calls supabase.auth.admin.createUser with username+role in metadata.
 * 4. The DB trigger handle_new_auth_user creates public.users automatically.
 * 5. Records consent timestamp and version in user_consents.
 */
export async function registerUser(input: RegisterInput): Promise<DbUser> {
  const { email, password, username, role, consent, invite_code, ip_address, user_agent } = input

  // ── 1. Invite-Only Validation (Step 3.6) ───────────────────
  let codeRecord: { id: string; uses_count: number } | null = null
  if (process.env.INVITE_ONLY === "true") {
    if (!invite_code) {
      throw Object.assign(new Error("Registration is currently invite-only. A valid invite code is required."), { statusCode: 403 })
    }
    const { data: codeRow, error: codeErr } = await supabase
      .from("invite_codes")
      .select("*")
      .eq("code", invite_code.trim())
      .single()

    if (codeErr || !codeRow) {
      throw Object.assign(new Error("Invalid invite code."), { statusCode: 400 })
    }
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      throw Object.assign(new Error("This invite code has expired."), { statusCode: 400 })
    }
    if (codeRow.uses_count >= codeRow.max_uses) {
      throw Object.assign(new Error("This invite code has already reached its maximum usage."), { statusCode: 400 })
    }
    if (codeRow.role !== "any" && codeRow.role !== role) {
      throw Object.assign(new Error(`This invite code is only valid for ${codeRow.role} accounts.`), { statusCode: 400 })
    }
    codeRecord = codeRow
  }

  // ── 2. Pre-flight uniqueness checks ────────────────────────
  const { data: existingEmail } = await supabase
    .from("users").select("id").eq("email", email).maybeSingle()
  if (existingEmail) {
    throw Object.assign(new Error("An account with this email already exists"), { statusCode: 409 })
  }

  const { data: existingUsername } = await supabase
    .from("users").select("id").eq("username", username).maybeSingle()
  if (existingUsername) {
    throw Object.assign(new Error("This username is already taken"), { statusCode: 409 })
  }

  // ── 3. Create auth.users row — trigger creates public.users 
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,  // OTP verification flow
    user_metadata: { username, role },
  })

  if (authError || !authData.user) {
    const msg = authError?.message ?? ""
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      throw Object.assign(new Error("An account with this email already exists"), { statusCode: 409 })
    }
    throw Object.assign(new Error(msg || "Registration failed"), { statusCode: 400 })
  }

  const userId = authData.user.id
  await new Promise(r => setTimeout(r, 150))

  const { data: userRow } = await supabase
    .from("users").select("*").eq("id", userId).single()

  let finalUser: DbUser

  if (!userRow) {
    // Trigger hasn't fired yet or failed — fall back to manual insert
    const { data: fallback, error: fbErr } = await supabase
      .from("users")
      .insert({ id: userId, email, username, role })
      .select().single()

    if (fbErr) {
      await supabase.auth.admin.deleteUser(userId)
      throw Object.assign(new Error("Could not create user record"), { statusCode: 500 })
    }
    finalUser = fallback as DbUser
  } else {
    finalUser = userRow as DbUser
  }

  // ── 4. Record consent in user_consents table ───────────────
  try {
    await supabase.from("user_consents").insert({
      user_id: finalUser.id,
      terms_version: consent?.terms_version ?? CURRENT_TERMS_VERSION,
      privacy_version: consent?.privacy_version ?? CURRENT_PRIVACY_VERSION,
      cookie_consent: consent?.cookie_consent ?? false,
      ip_address: ip_address ?? consent?.ip_address ?? null,
      user_agent: user_agent ?? consent?.user_agent ?? null,
    })
  } catch (consentErr) {
    console.warn("[registerUser] Warning: Failed to insert user consent:", consentErr)
  }

  // ── 5. Increment invite code usage if applicable ──────────
  if (codeRecord && invite_code) {
    try {
      await supabase
        .from("invite_codes")
        .update({ uses_count: codeRecord.uses_count + 1 })
        .eq("id", codeRecord.id)
    } catch (inviteErr) {
      console.warn("[registerUser] Warning: Failed to update invite code uses:", inviteErr)
    }
  }

  return finalUser
}

/**
 * Verifies a Supabase email OTP and returns the session + user.
 */
export async function verifyOtp(input: VerifyOtpInput) {
  const { email, otp } = input

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type:  "email",
  })

  if (error || !data.session) {
    throw Object.assign(new Error(error?.message ?? "Invalid or expired OTP"), { statusCode: 400 })
  }

  return { session: data.session, user: data.user }
}

/**
 * Checks whether user has consented to the current active policy versions.
 */
export async function getUserConsentStatus(userId: string) {
  const { data: latestConsent } = await supabase
    .from("user_consents")
    .select("terms_version, privacy_version, consented_at")
    .eq("user_id", userId)
    .order("consented_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const userTermsVersion = latestConsent?.terms_version ?? null
  const userPrivacyVersion = latestConsent?.privacy_version ?? null

  const requiresReconsent =
    !latestConsent ||
    userTermsVersion !== CURRENT_TERMS_VERSION ||
    userPrivacyVersion !== CURRENT_PRIVACY_VERSION

  return {
    has_consented: !requiresReconsent,
    requires_reconsent: requiresReconsent,
    current_terms_version: CURRENT_TERMS_VERSION,
    current_privacy_version: CURRENT_PRIVACY_VERSION,
    user_terms_version: userTermsVersion,
    user_privacy_version: userPrivacyVersion,
    consented_at: latestConsent?.consented_at ?? null,
  }
}

/**
 * Records an updated consent entry for an existing authenticated user.
 */
export async function recordUserConsent(
  userId: string,
  data: {
    terms_version?: string
    privacy_version?: string
    cookie_consent?: boolean
    ip_address?: string
    user_agent?: string
  }
) {
  const { error } = await supabase.from("user_consents").insert({
    user_id: userId,
    terms_version: data.terms_version ?? CURRENT_TERMS_VERSION,
    privacy_version: data.privacy_version ?? CURRENT_PRIVACY_VERSION,
    cookie_consent: data.cookie_consent ?? false,
    ip_address: data.ip_address ?? null,
    user_agent: data.user_agent ?? null,
  })

  if (error) {
    throw Object.assign(new Error(`Failed to record consent: ${error.message}`), { statusCode: 500 })
  }

  return { success: true, consented_at: new Date().toISOString() }
}
