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

  // Guard: job must be published
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, status, job_requirements(*)')
    .eq('id', job_id)
    .single()

  if (jobErr || !job) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 })
  }
  if ((job as { status: string }).status !== 'published') {
    throw Object.assign(new Error('Can only apply to published jobs'), { statusCode: 409 })
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

  const { total: match_score } = calculateMatchScore(jobForScoring, talentForScoring)

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
  status: ApplicationStatus
): Promise<DbApplication> {
  if (!APPLICATION_STATUSES.includes(status)) {
    throw Object.assign(
      new Error(`status must be one of: ${APPLICATION_STATUSES.join(', ')}`),
      { statusCode: 400 }
    )
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  if (!data) {
    throw Object.assign(new Error('Application not found'), { statusCode: 404 })
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

  const { total, signals } = calculateMatchScore(jobForScoring, talentForScoring)
  const ms = matchingSkills(jobForScoring.skills, talentForScoring.skills)

  // Enrich each signal with its weight and weighted contribution
  type SignalKey = keyof typeof signals
  const enriched = {} as MatchBreakdownResponse['signals']
  for (const key of Object.keys(signals) as SignalKey[]) {
    const score   = signals[key]
    const weight  = WEIGHTS[key] ?? 0
    enriched[key] = {
      score,
      weight,
      weighted: Math.round(score * weight * 10) / 10,
    }
  }

  return {
    application_id:  applicationId,
    total,
    weight_table:    WEIGHTS,
    signals:         enriched,
    matching_skills: ms,
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
