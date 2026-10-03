import { supabase } from "../db/supabase"

export interface ExportedData {
  export_metadata: {
    data_fiduciary: string
    generated_at: string
    user_id: string
    compliance_frameworks: string[]
  }
  user: Record<string, unknown> | null
  profile: Record<string, unknown> | null
  credits?: Record<string, unknown>[]
  applications: Record<string, unknown>[]
  messages_sent: Record<string, unknown>[]
  messages_received: Record<string, unknown>[]
  saved_jobs?: Record<string, unknown>[]
  alerts?: Record<string, unknown>[]
  notifications: Record<string, unknown>[]
  consents: Record<string, unknown>[]
}

/**
 * Compiles a comprehensive, portable JSON export of all personal data
 * belonging to the authenticated user under DPDP Act 2023 and GDPR.
 */
export async function exportUserData(userId: string): Promise<ExportedData> {
  // 1. User account
  const { data: userRow } = await supabase
    .from("users")
    .select("id, email, username, role, created_at")
    .eq("id", userId)
    .single()

  const role = userRow?.role as "talent" | "production" | undefined

  // 2. Profile
  let profile: Record<string, unknown> | null = null
  let credits: Record<string, unknown>[] = []
  let applications: Record<string, unknown>[] = []
  let savedJobs: Record<string, unknown>[] = []
  let alerts: Record<string, unknown>[] = []

  if (role === "talent") {
    const { data: tp } = await supabase
      .from("talent_profiles")
      .select("*")
      .eq("user_id", userId)
      .single()
    profile = tp ?? null

    if (tp?.id) {
      // Credits / work history
      const { data: c } = await supabase
        .from("credits")
        .select("*")
        .eq("talent_profile_id", tp.id)
      credits = c ?? []

      // Applications submitted by this talent
      const { data: apps } = await supabase
        .from("applications")
        .select("id, job_id, cover_note, status, created_at, interview_at, jobs(title, role, location, pay_min, pay_max, pay_currency, production_id, production_profiles(company_name))")
        .eq("talent_profile_id", tp.id)
      applications = (apps as unknown as Record<string, unknown>[]) ?? []

      // Saved jobs
      const { data: saved } = await supabase
        .from("saved_jobs")
        .select("job_id, created_at, jobs(title, role, location)")
        .eq("talent_profile_id", tp.id)
      savedJobs = (saved as unknown as Record<string, unknown>[]) ?? []

      // Alerts
      const { data: alt } = await supabase
        .from("talent_alerts")
        .select("*")
        .eq("user_id", userId)
      alerts = alt ?? []
    }
  } else if (role === "production") {
    const { data: pp } = await supabase
      .from("production_profiles")
      .select("*")
      .eq("user_id", userId)
      .single()
    profile = pp ?? null

    if (pp?.id) {
      // Applications received for jobs owned by this production house
      const { data: apps } = await supabase
        .from("applications")
        .select("id, job_id, cover_note, status, created_at, interview_at, jobs!inner(production_id, title)")
        .eq("jobs.production_id", pp.id)
      applications = (apps as unknown as Record<string, unknown>[]) ?? []
    }
  }

  // 3. Messages (Sent and Received)
  const { data: sentMessages } = await supabase
    .from("messages")
    .select("id, recipient_id, body, read, created_at")
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })

  const { data: receivedMessages } = await supabase
    .from("messages")
    .select("id, sender_id, body, read, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })

  // 4. Notifications
  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, type, payload, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  // 5. Consents
  const { data: consentsList } = await supabase
    .from("user_consents")
    .select("id, terms_version, privacy_version, cookie_consent, ip_address, user_agent, consented_at")
    .eq("user_id", userId)
    .order("consented_at", { ascending: false })

  return {
    export_metadata: {
      data_fiduciary: "CineConnect Media Technologies Private Limited",
      generated_at: new Date().toISOString(),
      user_id: userId,
      compliance_frameworks: [
        "Digital Personal Data Protection Act, 2023 (DPDP Act, India)",
        "General Data Protection Regulation (GDPR, EU 2016/679)",
      ],
    },
    user: userRow ?? null,
    profile,
    ...(role === "talent" ? { credits, saved_jobs: savedJobs, alerts } : {}),
    applications,
    messages_sent: sentMessages ?? [],
    messages_received: receivedMessages ?? [],
    notifications: notifs ?? [],
    consents: consentsList ?? [],
  }
}

/**
 * Permanently deletes a user account and purges all storage and DB artifacts.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  // 1. Clean up storage files in avatars bucket
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId)
    if (files && files.length > 0) {
      const paths = files.map(f => `${userId}/${f.name}`)
      await supabase.storage.from("avatars").remove(paths)
    }
  } catch (err) {
    console.warn(`[deleteUserAccount] Storage avatar cleanup warning for user ${userId}:`, err)
  }

  // 2. Clean up storage files in resumes bucket
  try {
    const { data: resumeFiles } = await supabase.storage.from("resumes").list(userId)
    if (resumeFiles && resumeFiles.length > 0) {
      const paths = resumeFiles.map(f => `${userId}/${f.name}`)
      await supabase.storage.from("resumes").remove(paths)
    }
  } catch (err) {
    console.warn(`[deleteUserAccount] Storage resume cleanup warning for user ${userId}:`, err)
  }

  // 3. Delete from public.users (Cascades to profiles, applications, credits, notifications, consents)
  const { error: dbError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)

  if (dbError) {
    throw Object.assign(new Error(`Database deletion failed: ${dbError.message}`), { statusCode: 500 })
  }

  // 4. Delete auth user from Supabase auth
  const { error: authError } = await supabase.auth.admin.deleteUser(userId)
  if (authError) {
    console.error(`[deleteUserAccount] Failed to delete auth user ${userId}:`, authError)
  }
}
