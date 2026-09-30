import { JobForScoring, TalentForScoring } from '../types'

// ── Weight table (must sum to 1.0) ────────────────────────────
const WEIGHTS = {
  skills_match:           0.30,
  role_match:             0.20,
  experience_match:       0.15,
  language_match:         0.10,
  location_proximity:     0.10,
  profile_completeness:   0.10,
  activity_recency:       0.05,
} as const

// ── Experience level → year-range midpoints ───────────────────
const EXP_MIDPOINTS: Record<string, number> = {
  entry:  1,
  mid:    4,
  senior: 9,
  any:    4,   // treat 'any' as neutral midpoint
}

// ── Individual signal functions (each returns 0–100) ──────────

/** % of job skills that appear in talent's skill list (case-insensitive) */
function skillsMatch(jobSkills: string[], talentSkills: string[]): number {
  if (!jobSkills.length) return 100  // no requirement → full score

  const talentSet = new Set(talentSkills.map(s => s.toLowerCase()))
  const matches = jobSkills.filter(s => talentSet.has(s.toLowerCase())).length
  return Math.round((matches / jobSkills.length) * 100)
}

/** 100 if talent's primary role appears in job's role list, else 0 */
function roleMatch(jobRoles: string[], talentRole: string | null): number {
  if (!jobRoles.length || !talentRole) return 50   // no requirement / no data → neutral
  const lower = talentRole.toLowerCase()
  return jobRoles.some(r => r.toLowerCase() === lower) ? 100 : 0
}

/**
 * Score based on how close talent's experience_years is to the
 * midpoint of the job's required level.
 * Uses a Gaussian-like decay: score = 100 × e^(–0.15 × gap²)
 * so nearby years score near 100, far away years approach 0.
 */
function experienceMatch(
  jobLevel: string | null,
  talentYears: number
): number {
  if (!jobLevel || jobLevel === 'any') return 75   // no preference → above neutral

  const mid = EXP_MIDPOINTS[jobLevel] ?? 4
  const gap = Math.abs(talentYears - mid)
  return Math.round(100 * Math.exp(-0.15 * gap * gap))
}

/** 100 if both languages match (case-insensitive), 50 if either side is missing */
function languageMatch(
  jobLanguage: string | null,
  talentLanguage: string | null
): number {
  if (!jobLanguage || !talentLanguage) return 50
  return jobLanguage.toLowerCase() === talentLanguage.toLowerCase() ? 100 : 0
}

/**
 * Simple location proximity:
 * - exact city match (case-insensitive)  → 100
 * - same country/region (first word)     → 50
 * - either side missing                  → 50 (neutral)
 * - no overlap                           → 0
 */
function locationProximity(
  jobLocation: string | null,
  talentLocation: string | null
): number {
  if (!jobLocation || !talentLocation) return 50

  const jl = jobLocation.toLowerCase().trim()
  const tl = talentLocation.toLowerCase().trim()

  if (jl === tl) return 100

  // Check for "remote" anywhere – accept everyone
  if (jl.includes('remote') || tl.includes('remote')) return 90

  // Same first word (city/country prefix)
  const jFirst = jl.split(/[\s,]+/)[0]
  const tFirst = tl.split(/[\s,]+/)[0]
  if (jFirst && tFirst && jFirst === tFirst) return 50

  return 0
}

/**
 * How complete the talent's profile is.
 * Scored fields: full_name, bio, role, skills (>0), language, location,
 *               avatar_url, portfolio_url   (8 fields)
 */
function profileCompleteness(talent: TalentForScoring): number {
  const checks = [
    Boolean(talent.full_name?.trim()),
    Boolean(talent.bio?.trim()),
    Boolean(talent.role?.trim()),
    talent.skills.length > 0,
    Boolean(talent.language?.trim()),
    Boolean(talent.location?.trim()),
    Boolean(talent.avatar_url?.trim()),
    Boolean(talent.portfolio_url?.trim()),
  ]
  const filled = checks.filter(Boolean).length
  return Math.round((filled / checks.length) * 100)
}

/**
 * How recently the talent was active:
 * - within  7 days  → 100
 * - within 30 days  →  60
 * - within 90 days  →  30
 * - older           →   0
 */
function activityRecency(lastActiveAt: string): number {
  const now = Date.now()
  const last = new Date(lastActiveAt).getTime()
  const daysAgo = (now - last) / (1000 * 60 * 60 * 24)

  if (daysAgo <=  7) return 100
  if (daysAgo <= 30) return  60
  if (daysAgo <= 90) return  30
  return 0
}

// ── Public API ────────────────────────────────────────────────

export interface ScoreBreakdown {
  total: number
  signals: {
    skills_match: number
    role_match: number
    experience_match: number
    language_match: number
    location_proximity: number
    profile_completeness: number
    activity_recency: number
  }
}

/**
 * Calculates a 0–100 match score between a job's requirements and
 * a talent profile, along with a per-signal breakdown.
 */
export function calculateMatchScore(
  job: JobForScoring,
  talent: TalentForScoring
): ScoreBreakdown {
  const signals = {
    skills_match:         skillsMatch(job.skills, talent.skills),
    role_match:           roleMatch(job.roles, talent.role),
    experience_match:     experienceMatch(job.experience_level, talent.experience_years),
    language_match:       languageMatch(job.language, talent.language),
    location_proximity:   locationProximity(job.location, talent.location),
    profile_completeness: profileCompleteness(talent),
    activity_recency:     activityRecency(talent.last_active_at),
  }

  const total = Math.round(
    signals.skills_match         * WEIGHTS.skills_match         +
    signals.role_match           * WEIGHTS.role_match           +
    signals.experience_match     * WEIGHTS.experience_match     +
    signals.language_match       * WEIGHTS.language_match       +
    signals.location_proximity   * WEIGHTS.location_proximity   +
    signals.profile_completeness * WEIGHTS.profile_completeness +
    signals.activity_recency     * WEIGHTS.activity_recency
  )

  return { total, signals }
}

/** Returns matching skill names between job requirements and a talent's skills */
export function matchingSkills(jobSkills: string[], talentSkills: string[]): string[] {
  const talentSet = new Set(talentSkills.map(s => s.toLowerCase()))
  return jobSkills.filter(s => talentSet.has(s.toLowerCase()))
}
