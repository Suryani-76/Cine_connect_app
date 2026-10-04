import { JobForScoring, TalentForScoring, MatchWeights } from '../types'
import { normalizeString, areStringsEqualNormalized } from '../utils/normalize'
import { canonicalizeSkill } from './vocabService'
import { DEFAULT_WEIGHTS } from './matchConfigService'

// ── Default Weight Table (sums to 100) ────────────────────────
export const WEIGHTS = DEFAULT_WEIGHTS

// ── Experience level → year-range midpoints ───────────────────
const EXP_MIDPOINTS: Record<string, number> = {
  entry:  1,
  mid:    4,
  senior: 9,
  any:    4,   // treat 'any' as neutral midpoint
}

// ── Signal Helpers with Explanations ──────────────────────────

interface SignalResult {
  score: number
  reason: string
}

/** % of job skills that appear in talent's skill list (case/punctuation/alias normalized) */
function skillsMatchSignal(jobSkills: string[], talentSkills: string[]): SignalResult & { matching: string[]; missing: string[] } {
  if (!jobSkills.length) {
    return {
      score: 100,
      reason: 'No specific skills required (full score)',
      matching: [],
      missing: [],
    }
  }

  // Build canonical set of talent skills
  const talentCanonSet = new Set(
    talentSkills.map(s => normalizeString(canonicalizeSkill(s)))
  )

  const matching: string[] = []
  const missing: string[] = []

  for (const js of jobSkills) {
    const jsCanon = normalizeString(canonicalizeSkill(js))
    if (talentCanonSet.has(jsCanon)) {
      matching.push(js)
    } else {
      missing.push(js)
    }
  }

  const score = Math.round((matching.length / jobSkills.length) * 100)

  let reason = ''
  if (missing.length === 0) {
    reason = `Matches all ${jobSkills.length} required skills (${matching.join(', ')})`
  } else if (matching.length === 0) {
    reason = `Missing all ${jobSkills.length} required skills: ${missing.join(', ')}`
  } else {
    reason = `Missing ${missing.length} of ${jobSkills.length} required skills: ${missing.join(', ')}`
  }

  return { score, reason, matching, missing }
}

/**
 * 100 if talent's primary role OR any secondary role appears in job's role list,
 * else 0 (50 for neutral when no role specified).
 */
function roleMatchSignal(jobRoles: string[], talentRole: string | null, talentRoles?: string[]): SignalResult {
  if (!jobRoles.length) {
    return { score: 50, reason: 'No specific role required (neutral score)' }
  }

  const candidateRoles: string[] = []
  if (talentRole?.trim()) candidateRoles.push(talentRole.trim())
  if (Array.isArray(talentRoles)) {
    for (const r of talentRoles) {
      if (r?.trim() && !candidateRoles.some(cr => areStringsEqualNormalized(cr, r.trim()))) {
        candidateRoles.push(r.trim())
      }
    }
  }

  if (!candidateRoles.length) {
    return { score: 50, reason: 'Talent has no role specified (neutral score)' }
  }

  let matchedRole: string | null = null
  const isMatch = candidateRoles.some(cRole => {
    const cCanon = normalizeString(canonicalizeSkill(cRole))
    const found = jobRoles.some(r => {
      const rCanon = normalizeString(canonicalizeSkill(r))
      return rCanon === cCanon || rCanon.includes(cCanon) || cCanon.includes(rCanon)
    })
    if (found) {
      matchedRole = cRole
      return true
    }
    return false
  })

  if (isMatch && matchedRole) {
    const isPrimary = Boolean(talentRole && areStringsEqualNormalized(matchedRole, talentRole))
    return {
      score: 100,
      reason: isPrimary
        ? `Primary role matches requirement: ${matchedRole}`
        : `Secondary role matches requirement: ${matchedRole}`,
    }
  }
  return {
    score: 0,
    reason: `Roles (${candidateRoles.join(', ')}) do not match required roles: ${jobRoles.join(', ')}`,
  }
}

/**
 * Score based on how close talent's experience_years is to the midpoint of the job's level.
 * Uses Gaussian-like decay: score = 100 × e^(–0.15 × gap²)
 */
function experienceMatchSignal(jobLevel: string | null, talentYears: number): SignalResult {
  if (!jobLevel || jobLevel === 'any') {
    return { score: 75, reason: 'No specific experience level required (above neutral)' }
  }

  const normLevel = normalizeString(jobLevel)
  const mid = EXP_MIDPOINTS[normLevel] ?? 4
  const gap = Math.abs(talentYears - mid)
  const score = Math.round(100 * Math.exp(-0.15 * gap * gap))

  let reason = ''
  if (gap === 0) {
    reason = `Experience (${talentYears} yr${talentYears === 1 ? '' : 's'}) perfectly matches ${jobLevel} level (~${mid} yrs)`
  } else if (score >= 70) {
    reason = `Experience (${talentYears} yr${talentYears === 1 ? '' : 's'}) closely matches ${jobLevel} level (~${mid} yrs)`
  } else {
    reason = `Experience (${talentYears} yr${talentYears === 1 ? '' : 's'}) differs from ${jobLevel} level midpoint (~${mid} yrs)`
  }

  return { score, reason }
}

/** 100 if languages match under normalization, 50 if either side missing, else 0 */
function languageMatchSignal(jobLanguage: string | null, talentLanguage: string | null): SignalResult {
  if (!jobLanguage || !talentLanguage) {
    return { score: 50, reason: 'Language requirement not specified' }
  }

  const normJ = normalizeString(jobLanguage)
  const normT = normalizeString(talentLanguage)

  if (normJ === normT) {
    return { score: 100, reason: `Language matches (${jobLanguage})` }
  }
  return { score: 0, reason: `Language (${talentLanguage}) differs from job language (${jobLanguage})` }
}

/**
 * Location proximity:
 * - exact city match (normalized) → 100
 * - remote in either side         → 90
 * - same region/country prefix   → 50
 * - either missing               → 50
 * - no overlap                   → 0
 */
function locationProximitySignal(jobLocation: string | null, talentLocation: string | null): SignalResult {
  if (!jobLocation || !talentLocation) {
    return { score: 50, reason: 'Location not specified' }
  }

  const jl = normalizeString(jobLocation)
  const tl = normalizeString(talentLocation)

  if (jl === tl) {
    return { score: 100, reason: `Located in the same city (${talentLocation})` }
  }

  if (jl.includes('remote') || tl.includes('remote')) {
    return { score: 90, reason: 'Remote work supported' }
  }

  const jFirst = jl.split(' ')[0]
  const tFirst = tl.split(' ')[0]
  if (jFirst && tFirst && jFirst === tFirst) {
    return { score: 50, reason: `Same region/state (${jFirst})` }
  }

  return { score: 0, reason: `Location (${talentLocation}) differs from job location (${jobLocation})` }
}

/**
 * Profile completeness (10 fields, 10% each = 100% total):
 * 1. full_name        (10%)
 * 2. bio              (10%)
 * 3. role             (10%)
 * 4. skills           (10%)
 * 5. language         (10%)
 * 6. location         (10%)
 * 7. avatar_url       (10%)
 * 8. portfolio_url    (10%)
 * 9. showreel_url     (10%)
 * 10. credits (>= 1)  (10%)
 */
function profileCompletenessSignal(talent: TalentForScoring): SignalResult {
  const fields = [
    { name: 'full_name', filled: Boolean(talent.full_name?.trim()) },
    { name: 'bio', filled: Boolean(talent.bio?.trim()) },
    { name: 'role', filled: Boolean(talent.role?.trim()) },
    { name: 'skills', filled: Array.isArray(talent.skills) && talent.skills.length > 0 },
    { name: 'language', filled: Boolean(talent.language?.trim()) },
    { name: 'location', filled: Boolean(talent.location?.trim()) },
    { name: 'avatar_url', filled: Boolean(talent.avatar_url?.trim()) },
    { name: 'portfolio_url', filled: Boolean(talent.portfolio_url?.trim()) },
    { name: 'showreel_url', filled: Boolean(talent.showreel_url?.trim()) },
    { name: 'credits', filled: typeof talent.credits_count === 'number' ? talent.credits_count > 0 : false },
  ]

  const filledCount = fields.filter(f => f.filled).length
  const missing = fields.filter(f => !f.filled).map(f => f.name)
  const score = filledCount * 10 // each field is exactly 10%

  let reason = `Profile is ${score}% complete (${filledCount}/10 fields filled)`
  if (missing.length > 0 && missing.length <= 3) {
    reason += ` (missing: ${missing.join(', ')})`
  }

  return { score, reason }
}

/** Activity recency: 7d → 100, 30d → 60, 90d → 30, older → 0 */
function activityRecencySignal(lastActiveAt: string): SignalResult {
  const now = Date.now()
  const last = new Date(lastActiveAt).getTime()
  const daysAgo = Math.max(0, Math.floor((now - last) / (1000 * 60 * 60 * 24)))

  if (daysAgo <= 7) {
    return { score: 100, reason: daysAgo === 0 ? 'Active today' : `Active ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago` }
  }
  if (daysAgo <= 30) {
    return { score: 60, reason: `Active ${daysAgo} days ago (within 30 days)` }
  }
  if (daysAgo <= 90) {
    return { score: 30, reason: `Active ${daysAgo} days ago (within 90 days)` }
  }
  return { score: 0, reason: 'Inactive for more than 90 days' }
}

// ── Public API ────────────────────────────────────────────────

export interface SignalDetail {
  score: number
  weight: number
  weighted: number
  reason: string
}

export interface ScoreBreakdown {
  total: number
  weight_table: Record<string, number>
  signals: {
    skills_match: number
    role_match: number
    experience_match: number
    language_match: number
    location_proximity: number
    profile_completeness: number
    activity_recency: number
  }
  reasons: {
    skills_match: string
    role_match: string
    experience_match: string
    language_match: string
    location_proximity: string
    profile_completeness: string
    activity_recency: string
  }
  matching_skills: string[]
  missing_skills: string[]
  summary_reasons: string[]
}

/**
 * Calculates a 0–100 match score between a job's requirements and
 * a talent profile, along with a per-signal breakdown, human-readable reasons,
 * and support for custom or configurable weights.
 */
export function calculateMatchScore(
  job: JobForScoring,
  talent: TalentForScoring,
  customWeights?: Partial<MatchWeights>
): ScoreBreakdown {
  const activeWeights: MatchWeights = {
    skills_match:         customWeights?.skills_match         ?? WEIGHTS.skills_match,
    role_match:           customWeights?.role_match           ?? WEIGHTS.role_match,
    experience_match:     customWeights?.experience_match     ?? WEIGHTS.experience_match,
    language_match:       customWeights?.language_match       ?? WEIGHTS.language_match,
    location_proximity:   customWeights?.location_proximity   ?? WEIGHTS.location_proximity,
    profile_completeness: customWeights?.profile_completeness ?? WEIGHTS.profile_completeness,
    activity_recency:     customWeights?.activity_recency     ?? WEIGHTS.activity_recency,
  }

  // Calculate each individual signal
  const skillsRes     = skillsMatchSignal(job.skills, talent.skills)
  const roleRes       = roleMatchSignal(job.roles, talent.role, talent.roles)
  const expRes        = experienceMatchSignal(job.experience_level, talent.experience_years)
  const langRes       = languageMatchSignal(job.language, talent.language)
  const locRes        = locationProximitySignal(job.location, talent.location)
  const compRes       = profileCompletenessSignal(talent)
  const recencyRes    = activityRecencySignal(talent.last_active_at)

  const signals = {
    skills_match:         skillsRes.score,
    role_match:           roleRes.score,
    experience_match:     expRes.score,
    language_match:       langRes.score,
    location_proximity:   locRes.score,
    profile_completeness: compRes.score,
    activity_recency:     recencyRes.score,
  }

  const reasons = {
    skills_match:         skillsRes.reason,
    role_match:           roleRes.reason,
    experience_match:     expRes.reason,
    language_match:       langRes.reason,
    location_proximity:   locRes.reason,
    profile_completeness: compRes.reason,
    activity_recency:     recencyRes.reason,
  }

  // Weight scale: weights in activeWeights sum to 100, so divide by 100
  const total = Math.round(
    (signals.skills_match         * activeWeights.skills_match +
     signals.role_match           * activeWeights.role_match +
     signals.experience_match     * activeWeights.experience_match +
     signals.language_match       * activeWeights.language_match +
     signals.location_proximity   * activeWeights.location_proximity +
     signals.profile_completeness * activeWeights.profile_completeness +
     signals.activity_recency     * activeWeights.activity_recency) / 100
  )

  // Top human-readable summary reasons
  const summary_reasons: string[] = []
  if (skillsRes.missing.length > 0) {
    summary_reasons.push(skillsRes.reason)
  }
  if (signals.role_match === 100) {
    summary_reasons.push(roleRes.reason)
  } else if (signals.role_match === 0) {
    summary_reasons.push(roleRes.reason)
  }
  if (signals.location_proximity === 100) {
    summary_reasons.push(locRes.reason)
  }
  if (summary_reasons.length === 0) {
    summary_reasons.push(skillsRes.reason)
  }

  return {
    total,
    weight_table: activeWeights as unknown as Record<string, number>,
    signals,
    reasons,
    matching_skills: skillsRes.matching,
    missing_skills: skillsRes.missing,
    summary_reasons,
  }
}

/** Returns matching skill names between job requirements and a talent's skills */
export function matchingSkills(jobSkills: string[], talentSkills: string[]): string[] {
  const talentCanonSet = new Set(
    talentSkills.map(s => normalizeString(canonicalizeSkill(s)))
  )
  return jobSkills.filter(s => {
    const sCanon = normalizeString(canonicalizeSkill(s))
    return talentCanonSet.has(sCanon)
  })
}
