/**
 * recomputeService.ts
 * ───────────────────
 * Manages match score recomputation queue and background batch worker.
 *
 * Rules:
 *  1. Enqueues job_id or talent_profile_id with reason on requirements or profile changes.
 *  2. Batch worker processes pending items.
 *  3. ONLY non-final applications ('applied', 'shortlisted', 'interview') are updated.
 *  4. NEVER updates final statuses ('hired', 'rejected', 'withdrawn').
 *  5. Fully idempotent.
 *  6. Logs counts for observability.
 */

import { supabase } from '../db/supabase'
import { calculateMatchScore } from './matchScore'
import { getActiveMatchWeights } from './matchConfigService'
import { DbTalentProfile, JobForScoring, TalentForScoring } from '../types'

export interface EnqueueOptions {
  jobId?: string
  talentProfileId?: string
  reason: string
}

export interface RecomputeResult {
  processedQueueItems: number
  updatedApplicationsCount: number
}

/**
 * Adds an item to the match_recompute_queue.
 */
export async function enqueueMatchRecompute(options: EnqueueOptions): Promise<void> {
  const { jobId, talentProfileId, reason } = options

  if (!jobId && !talentProfileId) {
    throw new Error('Either jobId or talentProfileId must be provided to enqueue match recompute')
  }

  try {
    const { error } = await supabase
      .from('match_recompute_queue')
      .insert({
        job_id: jobId ?? null,
        talent_profile_id: talentProfileId ?? null,
        reason,
        status: 'pending',
      })

    if (error) {
      console.warn('[RecomputeQueue] DB insert failed:', error.message)
    } else {
      console.log(`[RecomputeQueue] Enqueued recompute for ${jobId ? 'job ' + jobId : 'talent ' + talentProfileId} (${reason})`)
    }
  } catch (err) {
    console.warn('[RecomputeQueue] Exception enqueuing:', err)
  }
}

/**
 * Recomputes and updates the match score for a single active application.
 * Returns true if updated, false if skipped (final status) or not found.
 */
export async function recomputeSingleApplication(
  applicationId: string,
  weights?: ReturnType<typeof getActiveMatchWeights> extends Promise<infer W> ? W : never
): Promise<boolean> {
  const activeWeights = weights ?? await getActiveMatchWeights()

  const { data: app, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      match_score,
      talent_profiles (
        id, user_id, full_name, bio, role, skills, experience_years,
        language, location, avatar_url, portfolio_url, last_active_at
      ),
      jobs (
        job_requirements ( skills, roles, experience_level, language, location )
      )
    `)
    .eq('id', applicationId)
    .single()

  if (error || !app) return false

  // NEVER change the score of hired, rejected, or withdrawn applications
  if (['hired', 'rejected', 'withdrawn'].includes(app.status)) {
    return false
  }

  const talent = app.talent_profiles as unknown as DbTalentProfile
  const jobReq = (app.jobs as unknown as { job_requirements: JobForScoring | null })?.job_requirements

  const jobForScoring: JobForScoring = {
    skills:           jobReq?.skills           ?? [],
    roles:            jobReq?.roles            ?? [],
    experience_level: jobReq?.experience_level ?? null,
    language:         jobReq?.language         ?? null,
    location:         jobReq?.location         ?? null,
  }

  const talentForScoring: TalentForScoring = {
    skills:           talent.skills          ?? [],
    role:             talent.role            ?? null,
    experience_years: talent.experience_years ?? 0,
    language:         talent.language        ?? null,
    location:         talent.location        ?? null,
    full_name:        talent.full_name       ?? null,
    bio:              talent.bio             ?? null,
    avatar_url:       talent.avatar_url      ?? null,
    portfolio_url:    talent.portfolio_url   ?? null,
    last_active_at:   talent.last_active_at  ?? new Date(0).toISOString(),
  }

  const { total } = calculateMatchScore(jobForScoring, talentForScoring, activeWeights)

  await supabase
    .from('applications')
    .update({ match_score: total })
    .eq('id', applicationId)

  return true
}

/**
 * Background worker to process pending queue items.
 */
export async function processMatchRecomputeQueue(batchSize = 25): Promise<RecomputeResult> {
  let processedItems = 0
  let updatedApps = 0

  const { data: items, error } = await supabase
    .from('match_recompute_queue')
    .select('id, job_id, talent_profile_id, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error || !items || items.length === 0) {
    return { processedQueueItems: 0, updatedApplicationsCount: 0 }
  }

  const weights = await getActiveMatchWeights()

  for (const item of items) {
    try {
      // Mark as processing
      await supabase
        .from('match_recompute_queue')
        .update({ status: 'processing', attempts: (item.attempts ?? 0) + 1 })
        .eq('id', item.id)

      let query = supabase
        .from('applications')
        .select('id, status')
        .not('status', 'in', '("hired","rejected","withdrawn")')

      if (item.job_id) {
        query = query.eq('job_id', item.job_id)
      } else if (item.talent_profile_id) {
        query = query.eq('talent_profile_id', item.talent_profile_id)
      }

      const { data: appsToUpdate } = await query

      let itemUpdatedCount = 0
      if (appsToUpdate && appsToUpdate.length > 0) {
        for (const app of appsToUpdate) {
          const ok = await recomputeSingleApplication(app.id, weights)
          if (ok) itemUpdatedCount++
        }
      }

      // Mark completed
      await supabase
        .from('match_recompute_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      processedItems++
      updatedApps += itemUpdatedCount

      console.log(
        `[RecomputeWorker] Completed queue item ${item.id} for ${item.job_id ? 'job ' + item.job_id : 'talent ' + item.talent_profile_id}: updated ${itemUpdatedCount} applications.`
      )
    } catch (itemErr) {
      console.error(`[RecomputeWorker] Failed item ${item.id}:`, itemErr)
      await supabase
        .from('match_recompute_queue')
        .update({
          status: (item.attempts ?? 0) + 1 >= 3 ? 'failed' : 'pending',
        })
        .eq('id', item.id)
    }
  }

  return {
    processedQueueItems: processedItems,
    updatedApplicationsCount: updatedApps,
  }
}
