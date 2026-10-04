import { supabase } from '../db/supabase'
import { enqueueEmail } from '../services/email/emailQueueService'
import { DigestFrequency } from '../types'

export interface DigestRunResult {
  frequency: 'daily' | 'weekly'
  usersChecked: number
  digestsEnqueued: number
  skippedEmpty: number
}

/**
 * Compiles and enqueues daily or weekly digest emails for eligible users.
 */
export async function runDigestJob(frequency: 'daily' | 'weekly' = 'daily'): Promise<DigestRunResult> {
  const result: DigestRunResult = {
    frequency,
    usersChecked: 0,
    digestsEnqueued: 0,
    skippedEmpty: 0,
  }

  // 1. Fetch users opted into this digest frequency
  const { data: prefs, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('user_id, digest_frequency, unsubscribe_token')
    .eq('digest_frequency', frequency)

  if (prefsError || !prefs) {
    console.error('[DigestWorker] Error querying notification preferences:', prefsError)
    return result
  }

  result.usersChecked = prefs.length
  const windowDays = frequency === 'weekly' ? 7 : 1
  const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  for (const item of prefs) {
    // 2. Verify user is active & not suspended
    const { data: user } = await supabase
      .from('users')
      .select('id, email, username, role, suspended_at')
      .eq('id', item.user_id)
      .maybeSingle()

    if (!user || user.suspended_at) {
      continue
    }

    // 3. Count activities in the time window
    // a. Unread messages
    const { count: unreadMsgs } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)

    // b. New applications
    let newAppsCount = 0
    if (user.role === 'production') {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('production_id', user.id)

      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map((j) => j.id)
        const { count } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds)
          .gte('created_at', sinceIso)
        newAppsCount = count ?? 0
      }
    }

    // c. Published jobs for talent
    let matchingJobsCount = 0
    if (user.role === 'talent') {
      const { count } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('created_at', sinceIso)
      matchingJobsCount = count ?? 0
    }

    const totalActivity = (unreadMsgs ?? 0) + newAppsCount + matchingJobsCount
    if (totalActivity === 0) {
      result.skippedEmpty++
      continue
    }

    // 4. Enqueue digest email
    await enqueueEmail({
      recipient_email: user.email,
      user_id: user.id,
      template_name: 'digest',
      subject: `Your CineConnect ${frequency === 'weekly' ? 'Weekly' : 'Daily'} Digest`,
      payload: {
        frequency,
        recipient_username: user.username,
        new_applications_count: newAppsCount,
        unread_messages_count: unreadMsgs ?? 0,
        matching_jobs_count: matchingJobsCount,
      },
    })

    result.digestsEnqueued++
  }

  console.log(
    `[DigestWorker] Completed ${frequency} digest: checked ${result.usersChecked} users, ` +
    `enqueued ${result.digestsEnqueued} emails, skipped ${result.skippedEmpty} empty.`
  )

  return result
}

// CLI execution support
if (require.main === module) {
  const freqArg = process.argv.includes('--weekly') ? 'weekly' : 'daily'
  runDigestJob(freqArg)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DigestWorker] Fatal error:', err)
      process.exit(1)
    })
}
