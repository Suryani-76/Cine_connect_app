import { supabase } from '../db/supabase'
import { DbJob, DbJobRequirements, DbJobWithRequirements, JobStatus, ScoredApplication, JobForScoring, TalentForScoring } from '../types'
import { calculateMatchScore, matchingSkills } from './matchScore'

// ── Create ────────────────────────────────────────────────────

export interface CreateJobInput {
  production_id: string
  title: string
  description: string
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
    })
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbJob
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
}

export async function listJobs(
  filter: ListJobsFilter
): Promise<DbJobWithRequirements[]> {
  let query = supabase
    .from('jobs')
    .select('id, production_id, title, description, status, created_at, job_requirements(id, job_id, skills, roles, experience_level, language, location)')
    .order('created_at', { ascending: false })

  if (filter.production_id) {
    query = query.eq('production_id', filter.production_id)
  }

  if (filter.status) {
    query = query.eq('status', filter.status)
  }

  const { data, error } = await query

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return (data ?? []) as unknown as DbJobWithRequirements[]
}

// ── Applications for a job ────────────────────────────────────

export interface ScoredApplicationWithMeta extends ScoredApplication {
  matching_skills: string[]
  score_breakdown: ReturnType<typeof calculateMatchScore>['signals']
}

/**
 * Returns all applications for a job, each enriched with:
 *  - the applicant's talent profile
 *  - a computed match_score (0–100)
 *  - the overlapping skills list
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

    const { total, signals } = calculateMatchScore(jobForScoring, talentForScoring)
    const ms = matchingSkills(jobForScoring.skills, talentForScoring.skills)

    return {
      ...(app as unknown as ScoredApplication),
      match_score:      total,
      matching_skills:  ms,
      score_breakdown:  signals,
    }
  })

  // Sort highest score first
  scored.sort((a, b) => b.match_score - a.match_score)
  return scored
}

// ── Close job ─────────────────────────────────────────────────

export async function closeJob(jobId: string): Promise<DbJob> {
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('id, status')
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

  return data as DbJob
}

// ── Get single job ────────────────────────────────────────────

export interface DbJobWithProductionProfile extends DbJobWithRequirements {
  production_profiles: {
    id: string
    company_name: string
    bio: string | null
    logo_url: string | null
  }
}

export async function getJobById(jobId: string): Promise<DbJobWithProductionProfile> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, production_id, title, description, status, created_at,
      job_requirements(id, job_id, skills, roles, experience_level, language, location),
      production_profiles(id, company_name, bio, logo_url)
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
    supabase.from('applications').select('match_score').eq('job_id', jobId),
  ])

  const view_count = viewRes.count ?? 0
  const apps = appRes.data ?? []
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
