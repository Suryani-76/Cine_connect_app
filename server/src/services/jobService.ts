import { supabase } from '../db/supabase'
import { DbJob, DbJobRequirements, DbJobWithRequirements, JobStatus, JobType, PayPeriod, ScoredApplication, JobForScoring, TalentForScoring, NotificationType } from '../types'
import { calculateMatchScore, matchingSkills } from './matchScore'
import { enqueueMatchRecompute } from './recomputeService'
import { getActiveMatchWeights } from './matchConfigService'

// ── Create ────────────────────────────────────────────────────

export interface CreateJobInput {
  production_id: string
  title: string
  description: string
  job_type?: JobType
  pay_min?: number | null
  pay_max?: number | null
  pay_currency?: string
  pay_period?: PayPeriod
  start_date?: string | null
  end_date?: string | null
  openings?: number
  deadline?: string | null
}

export async function createJob(input: CreateJobInput): Promise<DbJob> {
  // Guard: production profile must exist
  const { data: profile, error: profileError } = await supabase
    .from('production_profiles')
    .select('id')
    .eq('id', input.production_id)
    .single()

  if (profileError || !profile) {
    throw Object.assign(new Error('Production profile not found'), { statusCode: 404 })
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      production_id: input.production_id,
      title: input.title,
      description: input.description,
      job_type: input.job_type ?? 'freelance',
      pay_min: input.pay_min ?? null,
      pay_max: input.pay_max ?? null,
      pay_currency: input.pay_currency ?? 'INR',
      pay_period: input.pay_period ?? 'project',
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      openings: input.openings ?? 1,
      deadline: input.deadline ?? null,
    })
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbJob
}

// ── Update ────────────────────────────────────────────────────

export interface UpdateJobInput {
  title?: string
  description?: string
  job_type?: JobType
  pay_min?: number | null
  pay_max?: number | null
  pay_currency?: string
  pay_period?: PayPeriod
  start_date?: string | null
  end_date?: string | null
  openings?: number
  deadline?: string | null
}

export async function updateJob(jobId: string, input: UpdateJobInput): Promise<DbJob> {
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  if (job.status === 'closed') {
    throw Object.assign(new Error('Cannot edit a closed job'), { statusCode: 409 })
  }

  if (job.status === 'published') {
    if (input.title !== undefined && input.title !== job.title) {
      throw Object.assign(new Error('Cannot edit title of a published job'), { statusCode: 400 })
    }
    if (input.job_type !== undefined && input.job_type !== job.job_type) {
      throw Object.assign(new Error('Cannot edit job_type of a published job'), { statusCode: 400 })
    }
  }

  const updatePayload: Record<string, unknown> = {}
  if (input.title !== undefined) updatePayload.title = input.title
  if (input.description !== undefined) updatePayload.description = input.description
  if (input.job_type !== undefined) updatePayload.job_type = input.job_type
  if (input.pay_min !== undefined) updatePayload.pay_min = input.pay_min
  if (input.pay_max !== undefined) updatePayload.pay_max = input.pay_max
  if (input.pay_currency !== undefined) updatePayload.pay_currency = input.pay_currency
  if (input.pay_period !== undefined) updatePayload.pay_period = input.pay_period
  if (input.start_date !== undefined) updatePayload.start_date = input.start_date
  if (input.end_date !== undefined) updatePayload.end_date = input.end_date
  if (input.openings !== undefined) updatePayload.openings = input.openings
  if (input.deadline !== undefined) updatePayload.deadline = input.deadline

  const { data, error } = await supabase
    .from('jobs')
    .update(updatePayload)
    .eq('id', jobId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbJob
}

// ── Delete ────────────────────────────────────────────────────

export async function deleteJob(jobId: string): Promise<void> {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  if (job.status !== 'draft') {
    const { count, error: countErr } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)

    if (countErr) {
      throw Object.assign(new Error(countErr.message), { statusCode: 500 })
    }

    if (count && count > 0) {
      throw Object.assign(
        new Error('Cannot delete a job with applications. Please close the job instead.'),
        { statusCode: 409 }
      )
    }
  }

  const { error: delErr } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId)

  if (delErr) {
    throw Object.assign(new Error(delErr.message), { statusCode: 500 })
  }
}

// ── Requirements ──────────────────────────────────────────────

export interface SetRequirementsInput {
  job_id: string
  skills?: string[]
  roles?: string[]
  experience_level?: string
  language?: string
  location?: string
}

/**
 * Upserts the job_requirements row for a given job.
 * Uses onConflict on job_id (unique constraint) so it acts as create-or-update.
 */
export async function setRequirements(
  input: SetRequirementsInput
): Promise<DbJobRequirements> {
  // Guard: job must exist
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', input.job_id)
    .single()

  if (jobError || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  if ((job as DbJob).status === 'closed') {
    throw Object.assign(new Error('Cannot update requirements for a closed job'), {
      statusCode: 409,
    })
  }

  const { data, error } = await supabase
    .from('job_requirements')
    .upsert(
      {
        job_id: input.job_id,
        skills: input.skills ?? [],
        roles: input.roles ?? [],
        experience_level: input.experience_level ?? null,
        language: input.language ?? null,
        location: input.location ?? null,
      },
      { onConflict: 'job_id' }
    )
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  // Enqueue background match recompute for active applications to this job
  try {
    await enqueueMatchRecompute({
      jobId: input.job_id,
      reason: 'Job requirements updated',
    })
  } catch (recomputeErr) {
    console.warn('[JobService] Failed to enqueue match recompute:', recomputeErr)
  }

  return data as DbJobRequirements
}

// ── Publish ───────────────────────────────────────────────────

export async function publishJob(jobId: string): Promise<DbJob> {
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  if ((job as DbJob).status === 'published') {
    throw Object.assign(new Error('Job is already published'), { statusCode: 409 })
  }

  if ((job as DbJob).status === 'closed') {
    throw Object.assign(new Error('Cannot publish a closed job'), { statusCode: 409 })
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({ status: 'published' as JobStatus })
    .eq('id', jobId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbJob
}

// ── List ──────────────────────────────────────────────────────

export interface ListJobsFilter {
  production_id?: string
  status?: JobStatus
  q?: string
  job_type?: JobType
  location?: string
  experience_level?: string
  skills?: string[]
  pay_min?: number
  pay_max?: number
  sort?: 'newest' | 'best_match'
  talentProfileId?: string
  limit?: number
  offset?: number
}

export interface ListJobsResult {
  jobs: DbJobWithRequirements[]
  total: number
  page: number
  limit: number
}

export async function listJobs(
  filter: ListJobsFilter = {}
): Promise<ListJobsResult> {
  let query = supabase
    .from('jobs')
    .select('id, production_id, title, description, status, job_type, pay_min, pay_max, pay_currency, pay_period, start_date, end_date, openings, deadline, created_at, updated_at, job_requirements(id, job_id, skills, roles, experience_level, language, location), production_profiles(id, company_name, logo_url, verified)')
    .order('created_at', { ascending: false })

  if (filter.production_id) {
    query = query.eq('production_id', filter.production_id)
  }

  if (filter.status) {
    query = query.eq('status', filter.status)
  }

  if (filter.job_type) {
    query = query.eq('job_type', filter.job_type)
  }

  if (filter.pay_min !== undefined && !isNaN(filter.pay_min)) {
    query = query.gte('pay_max', filter.pay_min)
  }

  if (filter.pay_max !== undefined && !isNaN(filter.pay_max)) {
    query = query.lte('pay_min', filter.pay_max)
  }

  if (filter.q) {
    const qClean = filter.q.trim()
    if (qClean) {
      query = query.or(`title.ilike.%${qClean}%,description.ilike.%${qClean}%`)
    }
  }

  const { data, error } = await query

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  let jobs = (data ?? []) as unknown as DbJobWithRequirements[]

  // In-memory filter on joined requirements (location, experience_level, skills)
  if (filter.location) {
    const locLower = filter.location.toLowerCase()
    jobs = jobs.filter((j) =>
      j.job_requirements?.location?.toLowerCase().includes(locLower)
    )
  }

  if (filter.experience_level) {
    const expLower = filter.experience_level.toLowerCase()
    jobs = jobs.filter((j) =>
      j.job_requirements?.experience_level?.toLowerCase() === expLower
    )
  }

  if (filter.skills && filter.skills.length > 0) {
    const reqSkillsLower = filter.skills.map((s) => s.toLowerCase())
    jobs = jobs.filter((j) => {
      const jSkills = (j.job_requirements?.skills ?? []).map((s) => s.toLowerCase())
      return reqSkillsLower.some((reqS) => jSkills.includes(reqS))
    })
  }

  // Best match scoring for talent (computed whenever talent profile is available)
  if (filter.talentProfileId) {
    try {
      const { data: talent } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('id', filter.talentProfileId)
        .maybeSingle()

      if (talent) {
        const weights = await getActiveMatchWeights()
        for (const job of jobs) {
          const req = job.job_requirements
          const jobForScoring: JobForScoring = {
            skills: req?.skills ?? [],
            roles: req?.roles ?? [],
            experience_level: req?.experience_level ?? null,
            language: req?.language ?? null,
            location: req?.location ?? null,
          }
          const breakdown = calculateMatchScore(jobForScoring, talent as any, weights)
          job.match_score = breakdown.total
        }
        if (filter.sort === 'best_match') {
          jobs.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
        }
      }
    } catch {
      // Graceful fallback to default sorting
    }
  }

  const total = jobs.length
  const limit = Math.max(1, filter.limit ?? 20)
  const offset = Math.max(0, filter.offset ?? 0)
  const page = Math.floor(offset / limit) + 1
  const paginated = jobs.slice(offset, offset + limit)

  return {
    jobs: paginated,
    total,
    page,
    limit,
  }
}

// ── Applications for a job ────────────────────────────────────

export interface ScoredApplicationWithMeta extends ScoredApplication {
  matching_skills: string[]
  missing_skills?: string[]
  score_breakdown: ReturnType<typeof calculateMatchScore>['signals']
  reasons?: ReturnType<typeof calculateMatchScore>['reasons']
  summary_reasons?: string[]
}

/**
 * Returns all applications for a job, each enriched with:
 *  - the applicant's talent profile
 *  - a computed match_score (0–100)
 *  - the overlapping skills list
 *  - per-signal reasons and summary reasons
 * Sorted by match_score descending.
 */
export async function getApplicationsForJob(
  jobId: string
): Promise<ScoredApplicationWithMeta[]> {
  // Fetch job + requirements in one shot
  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .select('id, production_id, title, description, status, created_at, job_requirements(id, job_id, skills, roles, experience_level, language, location)')
    .eq('id', jobId)
    .single()

  if (jobError || !jobRow) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  // Fetch all applications with talent profile joined
  const { data: apps, error: appsError } = await supabase
    .from('applications')
    .select('id, job_id, talent_profile_id, cover_note, status, match_score, applied_at, created_at, talent_profiles(id, user_id, full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at)')
    .eq('job_id', jobId)

  if (appsError) {
    throw Object.assign(new Error(appsError.message), { statusCode: 500 })
  }

  const req = (jobRow as unknown as DbJobWithRequirements).job_requirements

  const jobForScoring: JobForScoring = {
    skills:           req?.skills           ?? [],
    roles:            req?.roles            ?? [],
    experience_level: req?.experience_level ?? null,
    language:         req?.language         ?? null,
    location:         req?.location         ?? null,
  }

  const activeWeights = await getActiveMatchWeights()

  const scored: ScoredApplicationWithMeta[] = (apps ?? []).map((app: Record<string, unknown>) => {
    const talent = app['talent_profiles'] as TalentForScoring & { skills: string[] }

    const talentForScoring: TalentForScoring = {
      skills:           talent?.skills          ?? [],
      role:             talent?.role            ?? null,
      experience_years: (talent?.experience_years as number) ?? 0,
      language:         talent?.language        ?? null,
      location:         talent?.location        ?? null,
      full_name:        talent?.full_name       ?? null,
      bio:              talent?.bio             ?? null,
      avatar_url:       talent?.avatar_url      ?? null,
      portfolio_url:    talent?.portfolio_url   ?? null,
      last_active_at:   (talent?.last_active_at as string) ?? new Date(0).toISOString(),
    }

    const breakdown = calculateMatchScore(jobForScoring, talentForScoring, activeWeights)
    const ms = matchingSkills(jobForScoring.skills, talentForScoring.skills)

    return {
      ...(app as unknown as ScoredApplication),
      match_score:      breakdown.total,
      matching_skills:  ms,
      missing_skills:   breakdown.missing_skills,
      score_breakdown:  breakdown.signals,
      reasons:          breakdown.reasons,
      summary_reasons:  breakdown.summary_reasons,
    }
  })

  // Sort highest score first
  scored.sort((a, b) => b.match_score - a.match_score)
  return scored
}

/**
 * Returns explainable match score preview for an applicant viewing a published job.
 */
export async function getMyJobMatch(jobId: string, talentProfileId: string) {
  // Fetch job requirements and verify job exists and is published
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title, status, job_requirements(skills, roles, experience_level, language, location)')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  if (job.status !== 'published') {
    throw Object.assign(new Error('Job is not published'), { statusCode: 404 })
  }

  // Fetch talent profile
  const { data: talent, error: talentError } = await supabase
    .from('talent_profiles')
    .select('id, user_id, full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at')
    .eq('id', talentProfileId)
    .single()

  if (talentError || !talent) {
    throw Object.assign(new Error('Talent profile not found'), { statusCode: 404 })
  }

  const req = (job as unknown as { job_requirements: DbJobRequirements | null }).job_requirements

  const jobForScoring: JobForScoring = {
    skills:           req?.skills           ?? [],
    roles:            req?.roles            ?? [],
    experience_level: req?.experience_level ?? null,
    language:         req?.language         ?? null,
    location:         req?.location         ?? null,
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

  const activeWeights = await getActiveMatchWeights()
  const breakdown = calculateMatchScore(jobForScoring, talentForScoring, activeWeights)
  const ms = matchingSkills(jobForScoring.skills, talentForScoring.skills)

  type SignalKey = keyof typeof breakdown.signals
  const enriched = {} as Record<SignalKey, { score: number; weight: number; weighted: number; reason: string }>
  for (const key of Object.keys(breakdown.signals) as SignalKey[]) {
    const score   = breakdown.signals[key]
    const weight  = activeWeights[key] ?? 0
    enriched[key] = {
      score,
      weight,
      weighted: Math.round((score * weight) / 10) / 10,
      reason: breakdown.reasons[key],
    }
  }

  return {
    job_id:          jobId,
    total:           breakdown.total,
    weight_table:    activeWeights,
    signals:         enriched,
    reasons:         breakdown.reasons,
    matching_skills: ms,
    missing_skills:  breakdown.missing_skills,
    summary_reasons: breakdown.summary_reasons,
  }
}

// ── Close job ─────────────────────────────────────────────────

export async function closeJob(jobId: string): Promise<DbJob> {
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('id, title, status')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  if ((job as DbJob).status === 'closed') {
    throw Object.assign(new Error('Job is already closed'), { statusCode: 409 })
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({ status: 'closed' as JobStatus })
    .eq('id', jobId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  // Notify all non-final applicants (applied, shortlisted, interview)
  try {
    const { data: nonFinalApps } = await supabase
      .from('applications')
      .select('id, status, talent_profiles(user_id)')
      .eq('job_id', jobId)
      .in('status', ['applied', 'shortlisted', 'interview'])

    if (nonFinalApps && nonFinalApps.length > 0) {
      const notifs: { user_id: string; type: NotificationType; payload: Record<string, unknown> }[] = []
      for (const app of nonFinalApps) {
        const tp = (app as Record<string, unknown>).talent_profiles as { user_id?: string } | null
        if (tp?.user_id) {
          notifs.push({
            user_id: tp.user_id,
            type: 'job_closed',
            payload: {
              job_id: jobId,
              job_title: job.title,
              message: `The job "${job.title}" has been closed.`,
            },
          })
        }
      }

      if (notifs.length > 0) {
        await supabase.from('notifications').insert(notifs)
      }
    }
  } catch (notifyErr) {
    console.error('Failed to notify applicants of job closure:', notifyErr)
  }

  return data as DbJob
}

// ── Get single job ────────────────────────────────────────────

export interface DbJobWithProductionProfile extends DbJobWithRequirements {
  production_profiles: {
    id: string
    company_name: string
    bio: string | null
    logo_url: string | null
    verified?: boolean
  }
}

export async function getJobById(jobId: string): Promise<DbJobWithProductionProfile> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, production_id, title, description, status, job_type, pay_min, pay_max, pay_currency, pay_period, start_date, end_date, openings, deadline, created_at, updated_at,
      job_requirements(id, job_id, skills, roles, experience_level, language, location),
      production_profiles(id, company_name, bio, logo_url, verified)
    `)
    .eq('id', jobId)
    .single()

  if (error || !data) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }

  // Only return non-draft jobs to unauthenticated callers — service layer
  // leaves the auth check to the controller so owners can preview drafts.
  return data as unknown as DbJobWithProductionProfile
}

// ── Job analytics ─────────────────────────────────────────────

export interface JobAnalytics {
  job_id:        string
  view_count:    number
  applicant_count: number
  avg_match_score: number | null
}

export async function getJobAnalytics(jobId: string): Promise<JobAnalytics> {
  const [viewRes, appRes] = await Promise.all([
    supabase.from('job_views').select('id', { count: 'exact', head: true }).eq('job_id', jobId),
    supabase.from('applications').select('match_score, status').eq('job_id', jobId),
  ])

  const view_count = viewRes.count ?? 0
  const allApps = (appRes.data ?? []) as { match_score: number | null; status?: string }[]
  const apps = allApps.filter(a => a.status !== 'withdrawn')
  const applicant_count = apps.length
  const scores = apps.map((a: { match_score: number | null }) => a.match_score).filter((s): s is number => s !== null)
  const avg_match_score = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null

  return { job_id: jobId, view_count, applicant_count, avg_match_score }
}

export async function recordJobView(jobId: string, viewerId: string | null): Promise<void> {
  // Upsert — one unique view per job+viewer pair
  await supabase.from('job_views').upsert(
    { job_id: jobId, viewer_id: viewerId },
    { onConflict: 'job_id,viewer_id', ignoreDuplicates: true }
  )
}

// ── Rank talent by match score for a job ─────────────────────

export interface RankedTalent {
  profile:     import('../types').DbTalentProfile
  match_score: number
}

export async function rankTalentForJob(jobId: string): Promise<RankedTalent[]> {
  // Fetch job requirements
  const { data: jobRow, error: jobErr } = await supabase
    .from('jobs')
    .select('job_requirements(skills, roles, experience_level, language, location)')
    .eq('id', jobId)
    .single()

  if (jobErr || !jobRow) throw Object.assign(new Error('Job not found'), { statusCode: 404 })

  const req = (jobRow as unknown as { job_requirements: JobForScoring | null }).job_requirements
  const jobForScoring: JobForScoring = {
    skills: req?.skills ?? [], roles: req?.roles ?? [],
    experience_level: req?.experience_level ?? null,
    language: req?.language ?? null, location: req?.location ?? null,
  }

  // Fetch all talent profiles
  const { data: talents, error: tErr } = await supabase
    .from('talent_profiles')
    .select('id, user_id, full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at, created_at')
    .order('last_active_at', { ascending: false })

  if (tErr) throw Object.assign(new Error(tErr.message), { statusCode: 500 })

  return ((talents ?? []) as TalentForScoring[])
    .map(t => ({
      profile: t as unknown as import('../types').DbTalentProfile,
      match_score: calculateMatchScore(jobForScoring, t).total,
    }))
    .sort((a, b) => b.match_score - a.match_score)
}
