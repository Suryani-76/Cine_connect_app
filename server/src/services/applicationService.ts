import { supabase } from '../db/supabase'
import {
  ApplicationStatus,
  APPLICATION_STATUSES,
  DbApplication,
  DbTalentProfile,
  JobForScoring,
  MatchBreakdownResponse,
  TalentForScoring,
} from '../types'
import { calculateMatchScore, matchingSkills } from './matchScore'
import { getActiveMatchWeights } from './matchConfigService'

// ── Create application (with match_score persisted) ───────────

export interface CreateApplicationInput {
  job_id: string
  talent_profile_id: string
  cover_note?: string
}

export async function createApplication(
  input: CreateApplicationInput
): Promise<DbApplication> {
  const { job_id, talent_profile_id, cover_note } = input

  // Guard: job must be published and deadline not passed
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, status, deadline, job_requirements(*)')
    .eq('id', job_id)
    .single()

  if (jobErr || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }
  if ((job as { status: string }).status !== 'published') {
    throw Object.assign(new Error('Can only apply to published jobs'), { statusCode: 409 })
  }
  if ((job as { deadline?: string | null }).deadline) {
    const deadlineDate = new Date((job as { deadline: string }).deadline)
    if (deadlineDate.getTime() < Date.now()) {
      throw Object.assign(new Error('Application deadline has passed'), { statusCode: 409 })
    }
  }

  // Guard: talent profile must exist
  const { data: talent, error: talentErr } = await supabase
    .from('talent_profiles')
    .select('skills,role,experience_years,language,location,full_name,bio,avatar_url,portfolio_url,last_active_at')
    .eq('id', talent_profile_id)
    .single()

  if (talentErr || !talent) {
    throw Object.assign(new Error('Talent profile not found'), { statusCode: 404 })
  }

  // Guard: no duplicate applications
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', job_id)
    .eq('talent_profile_id', talent_profile_id)
    .maybeSingle()

  if (existing) {
    throw Object.assign(new Error('You have already applied to this job'), { statusCode: 409 })
  }

  // Compute match score so trigger + dashboard counts work immediately
  const req = (job as unknown as { job_requirements: JobForScoring | null }).job_requirements
  const jobForScoring: JobForScoring = {
    skills:           req?.skills           ?? [],
    roles:            req?.roles            ?? [],
    experience_level: req?.experience_level ?? null,
    language:         req?.language         ?? null,
    location:         req?.location         ?? null,
  }
  const t = talent as unknown as DbTalentProfile
  const talentForScoring: TalentForScoring = {
    skills:           t.skills          ?? [],
    role:             t.role            ?? null,
    experience_years: t.experience_years ?? 0,
    language:         t.language        ?? null,
    location:         t.location        ?? null,
    full_name:        t.full_name       ?? null,
    bio:              t.bio             ?? null,
    avatar_url:       t.avatar_url      ?? null,
    portfolio_url:    t.portfolio_url   ?? null,
    last_active_at:   t.last_active_at  ?? new Date(0).toISOString(),
  }

  const activeWeights = await getActiveMatchWeights()
  const { total: match_score } = calculateMatchScore(jobForScoring, talentForScoring, activeWeights)

  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id,
      talent_profile_id,
      cover_note:  cover_note ?? null,
      status:      'applied',
      match_score,
      applied_at:  new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw Object.assign(new Error('You have already applied to this job'), { statusCode: 409 })
    }
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbApplication
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  interview_at?: string | null
): Promise<DbApplication> {
  if (!APPLICATION_STATUSES.includes(status)) {
    throw Object.assign(
      new Error(`status must be one of: ${APPLICATION_STATUSES.join(', ')}`),
      { statusCode: 400 }
    )
  }

  const updateFields: { status: ApplicationStatus; interview_at?: string | null } = { status }
  if (status === 'interview') {
    updateFields.interview_at = interview_at ?? null
  }

  const { data, error } = await supabase
    .from('applications')
    .update(updateFields)
    .eq('id', applicationId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  if (!data) {
    throw Object.assign(new Error('Application not found'), { statusCode: 404 })
  }

  // If status is 'hired', check if hired count >= openings, then auto-close job
  if (status === 'hired') {
    try {
      const { data: appWithJob } = await supabase
        .from('applications')
        .select('job_id, jobs(id, openings, status)')
        .eq('id', applicationId)
        .single()

      if (appWithJob?.job_id && appWithJob.jobs) {
        const job = appWithJob.jobs as unknown as { id: string; openings: number; status: string }
        if (job.status !== 'closed') {
          const { count: hiredCount } = await supabase
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .eq('job_id', appWithJob.job_id)
            .eq('status', 'hired')

          if (hiredCount && hiredCount >= (job.openings ?? 1)) {
            const { closeJob } = await import('./jobService')
            await closeJob(appWithJob.job_id)
          }
        }
      }
    } catch (hiredErr) {
      console.error('Failed to auto-close job after hiring:', hiredErr)
    }
  }

  return data as DbApplication
}

export async function withdrawApplication(
  applicationId: string,
  talentProfileId: string
): Promise<DbApplication> {
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single()

  if (appErr || !app) {
    throw Object.assign(new Error('Application not found'), { statusCode: 404 })
  }

  if (app.talent_profile_id !== talentProfileId) {
    throw Object.assign(new Error('Unauthorized to withdraw this application'), { statusCode: 403 })
  }

  const withdrawableStatuses: ApplicationStatus[] = ['applied', 'shortlisted', 'interview']
  if (!withdrawableStatuses.includes(app.status)) {
    throw Object.assign(
      new Error(`Cannot withdraw an application that is already '${app.status}'`),
      { statusCode: 409 }
    )
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ status: 'withdrawn' as ApplicationStatus })
    .eq('id', applicationId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbApplication
}

// ── Full match breakdown ───────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  skills_match:           0.30,
  role_match:             0.20,
  experience_match:       0.15,
  language_match:         0.10,
  location_proximity:     0.10,
  profile_completeness:   0.10,
  activity_recency:       0.05,
}

export async function getMatchBreakdown(
  applicationId: string
): Promise<MatchBreakdownResponse> {
  // Fetch the application — check if we have a stored match_score first
  const { data: appCheck } = await supabase
    .from('applications')
    .select('id, match_score, job_id, talent_profile_id')
    .eq('id', applicationId)
    .single()

  // If no stored score, always recompute. If score is stored, still compute for breakdown details
  // but this confirms the app exists before the expensive join query
  if (!appCheck) throw Object.assign(new Error('Application not found'), { statusCode: 404 })
  // Fetch the application with talent profile and job requirements in one shot
  const { data: app, error: appError } = await supabase
    .from('applications')
    .select(`
      id,
      job_id,
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

  if (appError || !app) {
    throw Object.assign(new Error('Application not found'), { statusCode: 404 })
  }

  const talent = app.talent_profiles as unknown as DbTalentProfile
  const jobReq = (app.jobs as unknown as { job_requirements: JobForScoring | null })
    .job_requirements

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

  const activeWeights = await getActiveMatchWeights()
  const breakdown = calculateMatchScore(jobForScoring, talentForScoring, activeWeights)
  const ms = matchingSkills(jobForScoring.skills, talentForScoring.skills)

  // Enrich each signal with its weight and weighted contribution and human-readable reason
  type SignalKey = keyof typeof breakdown.signals
  const enriched = {} as MatchBreakdownResponse['signals']
  for (const key of Object.keys(breakdown.signals) as SignalKey[]) {
    const score   = breakdown.signals[key]
    const weight  = activeWeights[key] ?? 0
    enriched[key] = {
      score,
      weight,
      weighted: Math.round(score * weight * 10) / 10,
      reason:   breakdown.reasons[key],
    }
  }

  return {
    application_id:  applicationId,
    total:           breakdown.total,
    weight_table:    activeWeights as unknown as Record<string, number>,
    signals:         enriched,
    reasons:         breakdown.reasons,
    matching_skills: ms,
    missing_skills:  breakdown.missing_skills,
    summary_reasons: breakdown.summary_reasons,
  }
}

// ── My applications (talent view) ────────────────────────────

export interface MyApplication {
  id: string
  job_id: string
  talent_profile_id: string
  cover_note: string | null
  status: ApplicationStatus
  match_score: number | null
  applied_at: string
  created_at: string
  jobs: {
    id: string
    title: string
    description: string
    status: string
    created_at: string
    production_profiles: {
      id: string
      company_name: string
      logo_url: string | null
    }
    job_requirements: {
      skills: string[]
      roles: string[]
      experience_level: string | null
      language: string | null
      location: string | null
    } | null
  }
}

/**
 * Returns all applications submitted by a talent profile,
 * with the job + production house info joined in.
 * Sorted by applied_at descending (most recent first).
 */
export async function getMyApplications(
  talentProfileId: string
): Promise<MyApplication[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, job_id, talent_profile_id, cover_note, status, match_score, applied_at, created_at,
      jobs (
        id, title, description, status, created_at,
        production_profiles ( id, company_name, logo_url ),
        job_requirements ( skills, roles, experience_level, language, location )
      )
    `)
    .eq('talent_profile_id', talentProfileId)
    .order('applied_at', { ascending: false })

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return (data ?? []) as unknown as MyApplication[]
}
