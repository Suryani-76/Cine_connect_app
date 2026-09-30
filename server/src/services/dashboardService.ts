import { supabase } from '../db/supabase'
import { DashboardStats } from '../types'

const SEVEN_DAYS_AGO = () => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

/**
 * Returns dashboard stats for a production house.
 * All queries are COUNT-only — no row data transferred.
 */
export async function getDashboardStats(
  productionId: string,
  userId: string
): Promise<DashboardStats> {
  // 1. Active (published) jobs for this production
  const { count: activeJobs, error: e1 } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('production_id', productionId)
    .eq('status', 'published')

  if (e1) throw Object.assign(new Error(e1.message), { statusCode: 500 })

  // 2. Job IDs owned by this production (needed for sub-queries)
  const { data: jobRows, error: e2 } = await supabase
    .from('jobs')
    .select('id')
    .eq('production_id', productionId)

  if (e2) throw Object.assign(new Error(e2.message), { statusCode: 500 })

  const jobIds = (jobRows ?? []).map((r: { id: string }) => r.id)

  let newApplications = 0
  let recommendedTalent = 0

  if (jobIds.length > 0) {
    // 3. Applications in the last 7 days for this production's jobs
    const { count: appCount, error: e3 } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .in('job_id', jobIds)
      .gte('created_at', SEVEN_DAYS_AGO())

    if (e3) throw Object.assign(new Error(e3.message), { statusCode: 500 })
    newApplications = appCount ?? 0

    // 4. High-match applications (score >= 75) across published jobs
    const { count: highMatch, error: e4 } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .in('job_id', jobIds)
      .gte('match_score', 75)

    if (e4) throw Object.assign(new Error(e4.message), { statusCode: 500 })
    recommendedTalent = highMatch ?? 0
  }

  // 5. Unread notification count for the user
  const { count: unreadCount, error: e5 } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (e5) throw Object.assign(new Error(e5.message), { statusCode: 500 })

  return {
    active_jobs:          activeJobs          ?? 0,
    new_applications:     newApplications,
    recommended_talent:   recommendedTalent,
    unread_notifications: unreadCount         ?? 0,
  }
}
