import { describe, it, expect } from 'vitest'
import { calculateMatchScore, matchingSkills } from '../matchScore'
import { JobForScoring, TalentForScoring } from '../../types'
import { normalizeString, areStringsEqualNormalized } from '../../utils/normalize'
import { canonicalizeSkill } from '../vocabService'
import { validateWeights, DEFAULT_WEIGHTS, MatchWeights } from '../matchConfigService'

// ── Fixtures ──────────────────────────────────────────────────

const baseJob: JobForScoring = {
  skills:           ['Cinematography', 'Lighting', 'DaVinci Resolve'],
  roles:            ['Cinematographer', 'Director of Photography'],
  experience_level: 'mid',
  language:         'English',
  location:         'Mumbai',
}

const baseTalent: TalentForScoring = {
  skills:           ['Cinematography', 'Lighting', 'DaVinci Resolve'],
  role:             'Cinematographer',
  experience_years: 4,
  language:         'English',
  location:         'Mumbai',
  full_name:        'Priya Sharma',
  bio:              'Experienced cinematographer with 4 years in Bollywood.',
  avatar_url:       'https://example.com/avatar.jpg',
  portfolio_url:    'https://priyasharma.com',
  showreel_url:     'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  credits_count:    2,
  last_active_at:   new Date().toISOString(), // active today
}

// ── calculateMatchScore ───────────────────────────────────────

describe('calculateMatchScore', () => {
  it('returns 100 total for a perfect match', () => {
    const { total } = calculateMatchScore(baseJob, baseTalent)
    expect(total).toBe(100)
  })

  it('total is always between 0 and 100', () => {
    const worstTalent: TalentForScoring = {
      skills: [], role: null, experience_years: 0,
      language: null, location: null, full_name: null, bio: null,
      avatar_url: null, portfolio_url: null,
      last_active_at: new Date(0).toISOString(), // epoch = very old
    }
    const { total } = calculateMatchScore(baseJob, worstTalent)
    expect(total).toBeGreaterThanOrEqual(0)
    expect(total).toBeLessThanOrEqual(100)
  })

  // ── skills_match (30%) ──────────────────────────────────────

  it('skills_match = 100 when all job skills are present in talent', () => {
    const { signals } = calculateMatchScore(baseJob, baseTalent)
    expect(signals.skills_match).toBe(100)
  })

  it('skills_match = 0 when no overlap', () => {
    const talent = { ...baseTalent, skills: ['Cooking', 'Photography'] }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.skills_match).toBe(0)
  })

  it('skills_match = 67 for 2/3 overlap', () => {
    const talent = { ...baseTalent, skills: ['Cinematography', 'Lighting'] }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.skills_match).toBe(67)
  })

  it('skills_match = 100 when job has no skills requirement', () => {
    const job = { ...baseJob, skills: [] }
    const { signals } = calculateMatchScore(job, baseTalent)
    expect(signals.skills_match).toBe(100)
  })

  it('skills_match is case-insensitive', () => {
    const talent = { ...baseTalent, skills: ['cinematography', 'LIGHTING', 'davinci resolve'] }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.skills_match).toBe(100)
  })

  // ── role_match (20%) ────────────────────────────────────────

  it('role_match = 100 when talent role is in job roles list', () => {
    const { signals } = calculateMatchScore(baseJob, baseTalent)
    expect(signals.role_match).toBe(100)
  })

  it('role_match = 100 when talent primary role does not match but secondary role matches', () => {
    const talent = {
      ...baseTalent,
      role: 'Actor', // does not match job
      roles: ['Actor', 'Cinematographer', 'Editor'], // contains Cinematographer!
    }
    const { signals, reasons } = calculateMatchScore(baseJob, talent)
    expect(signals.role_match).toBe(100)
    expect(reasons.role_match).toContain('Secondary role matches requirement: Cinematographer')
  })

  it('role_match = 0 when neither primary nor secondary roles match', () => {
    const talent = {
      ...baseTalent,
      role: 'Sound Engineer',
      roles: ['Sound Engineer', 'Boom Operator'],
    }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.role_match).toBe(0)
  })

  it('role_match = 50 when job has no roles (neutral)', () => {
    const job = { ...baseJob, roles: [] }
    const { signals } = calculateMatchScore(job, baseTalent)
    expect(signals.role_match).toBe(50)
  })

  it('role_match = 50 when talent has no role (neutral)', () => {
    const talent = { ...baseTalent, role: null, roles: [] }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.role_match).toBe(50)
  })

  // ── experience_match (15%) ──────────────────────────────────

  it('experience_match = 100 when years exactly match mid-level midpoint', () => {
    const talent = { ...baseTalent, experience_years: 4 } // mid midpoint = 4
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.experience_match).toBe(100)
  })

  it('experience_match decreases as gap grows', () => {
    const closeTalent = { ...baseTalent, experience_years: 5 }
    const farTalent   = { ...baseTalent, experience_years: 12 }
    const { signals: s1 } = calculateMatchScore(baseJob, closeTalent)
    const { signals: s2 } = calculateMatchScore(baseJob, farTalent)
    expect(s1.experience_match).toBeGreaterThan(s2.experience_match)
  })

  it('experience_match = 75 when job level is null or "any"', () => {
    const job = { ...baseJob, experience_level: null }
    const { signals } = calculateMatchScore(job, baseTalent)
    expect(signals.experience_match).toBe(75)
  })

  it('experience_match is correct for entry level (midpoint 1)', () => {
    const job    = { ...baseJob, experience_level: 'entry' }
    const talent = { ...baseTalent, experience_years: 1 }
    const { signals } = calculateMatchScore(job, talent)
    expect(signals.experience_match).toBe(100)
  })

  it('experience_match is correct for senior level (midpoint 9)', () => {
    const job    = { ...baseJob, experience_level: 'senior' }
    const talent = { ...baseTalent, experience_years: 9 }
    const { signals } = calculateMatchScore(job, talent)
    expect(signals.experience_match).toBe(100)
  })

  // ── language_match (10%) ────────────────────────────────────

  it('language_match = 100 when languages match exactly', () => {
    const { signals } = calculateMatchScore(baseJob, baseTalent)
    expect(signals.language_match).toBe(100)
  })

  it('language_match = 0 when languages differ', () => {
    const talent = { ...baseTalent, language: 'Hindi' }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.language_match).toBe(0)
  })

  it('language_match = 50 when either side is null', () => {
    const job    = { ...baseJob, language: null }
    const { signals } = calculateMatchScore(job, baseTalent)
    expect(signals.language_match).toBe(50)
  })

  it('language_match is case-insensitive', () => {
    const talent = { ...baseTalent, language: 'ENGLISH' }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.language_match).toBe(100)
  })

  // ── location_proximity (10%) ────────────────────────────────

  it('location_proximity = 100 for exact city match', () => {
    const { signals } = calculateMatchScore(baseJob, baseTalent)
    expect(signals.location_proximity).toBe(100)
  })

  it('location_proximity = 90 when remote is in either location', () => {
    const job = { ...baseJob, location: 'Remote' }
    const { signals } = calculateMatchScore(job, baseTalent)
    expect(signals.location_proximity).toBe(90)
  })

  it('location_proximity = 0 when cities differ', () => {
    const talent = { ...baseTalent, location: 'Delhi' }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.location_proximity).toBe(0)
  })

  it('location_proximity = 50 when either is null', () => {
    const job = { ...baseJob, location: null }
    const { signals } = calculateMatchScore(job, baseTalent)
    expect(signals.location_proximity).toBe(50)
  })

  // ── profile_completeness (10%) ──────────────────────────────

  it('profile_completeness = 100 for fully filled profile (all 10 fields)', () => {
    const { signals } = calculateMatchScore(baseJob, baseTalent)
    expect(signals.profile_completeness).toBe(100)
  })

  it('profile_completeness = 0 for empty profile', () => {
    const empty: TalentForScoring = {
      skills: [], role: null, experience_years: 0,
      language: null, location: null, full_name: null,
      bio: null, avatar_url: null, portfolio_url: null,
      showreel_url: null, credits_count: 0,
      last_active_at: new Date().toISOString(),
    }
    const { signals } = calculateMatchScore(baseJob, empty)
    expect(signals.profile_completeness).toBe(0)
  })

  it('profile_completeness = 30 for 3/10 profile fields filled (10% each)', () => {
    const partial: TalentForScoring = {
      skills: ['Cinematography'], role: 'Cinematographer',
      experience_years: 4, language: 'English',
      location: null, full_name: null, bio: null,
      avatar_url: null, portfolio_url: null,
      showreel_url: null, credits_count: 0,
      last_active_at: new Date().toISOString(),
    }
    const { signals } = calculateMatchScore(baseJob, partial)
    // skills(✓) role(✓) language(✓) — 3 of 10 fields = 30%
    expect(signals.profile_completeness).toBe(30)
  })

  it('profile_completeness gains 10% for showreel and 10% for credits', () => {
    const withoutMedia: TalentForScoring = {
      skills: ['Cinematography'], role: 'Cinematographer',
      experience_years: 4, language: 'English',
      location: 'Mumbai', full_name: 'Priya', bio: 'Bio',
      avatar_url: 'https://example.com/a.jpg', portfolio_url: 'https://example.com',
      showreel_url: null, credits_count: 0,
      last_active_at: new Date().toISOString(),
    }
    // 8 fields filled: 80%
    expect(calculateMatchScore(baseJob, withoutMedia).signals.profile_completeness).toBe(80)

    // With showreel: 9 fields = 90%
    const withShowreel = { ...withoutMedia, showreel_url: 'https://vimeo.com/123456789' }
    expect(calculateMatchScore(baseJob, withShowreel).signals.profile_completeness).toBe(90)

    // With showreel and at least 1 credit: 10 fields = 100%
    const withCredit = { ...withShowreel, credits_count: 1 }
    expect(calculateMatchScore(baseJob, withCredit).signals.profile_completeness).toBe(100)
  })

  // ── activity_recency (5%) ───────────────────────────────────

  it('activity_recency = 100 for talent active today', () => {
    const { signals } = calculateMatchScore(baseJob, baseTalent)
    expect(signals.activity_recency).toBe(100)
  })

  it('activity_recency = 60 for talent active 10 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    const talent = { ...baseTalent, last_active_at: d.toISOString() }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.activity_recency).toBe(60)
  })

  it('activity_recency = 30 for talent active 45 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 45)
    const talent = { ...baseTalent, last_active_at: d.toISOString() }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.activity_recency).toBe(30)
  })

  it('activity_recency = 0 for talent inactive over 90 days', () => {
    const d = new Date()
    d.setDate(d.getDate() - 120)
    const talent = { ...baseTalent, last_active_at: d.toISOString() }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.activity_recency).toBe(0)
  })

  // ── weights sum check ───────────────────────────────────────

  it('weighted signals sum equals total score for perfect match', () => {
    const { total, signals } = calculateMatchScore(baseJob, baseTalent)
    const WEIGHTS = {
      skills_match: 0.30, role_match: 0.20, experience_match: 0.15,
      language_match: 0.10, location_proximity: 0.10,
      profile_completeness: 0.10, activity_recency: 0.05,
    }
    const recomputed = Math.round(
      Object.entries(signals).reduce(
        (sum, [key, val]) => sum + val * WEIGHTS[key as keyof typeof WEIGHTS],
        0
      )
    )
    expect(recomputed).toBe(total)
  })
})

// ── matchingSkills ────────────────────────────────────────────

describe('matchingSkills', () => {
  it('returns skills present in both arrays', () => {
    const result = matchingSkills(
      ['Cinematography', 'Lighting', 'DaVinci Resolve'],
      ['Cinematography', 'Lighting', 'Acting']
    )
    expect(result).toEqual(['Cinematography', 'Lighting'])
  })

  it('is case-insensitive', () => {
    const result = matchingSkills(
      ['Cinematography'],
      ['cinematography']
    )
    expect(result).toEqual(['Cinematography'])
  })

  it('returns empty array when no overlap', () => {
    const result = matchingSkills(['Lighting'], ['Acting'])
    expect(result).toEqual([])
  })

  it('returns empty array when either input is empty', () => {
    expect(matchingSkills([], ['Acting'])).toEqual([])
    expect(matchingSkills(['Acting'], [])).toEqual([])
  })
})

// ── Normalization utils ───────────────────────────────────────

describe('String normalization', () => {
  it('handles unicode NFKD decomposition and strips diacritics', () => {
    expect(normalizeString('Crème Brûlée')).toBe('creme brulee')
    expect(normalizeString('München')).toBe('munchen')
  })

  it('strips punctuation and collapses whitespace', () => {
    expect(normalizeString('DaVinci-Resolve!')).toBe('davinci resolve')
    expect(normalizeString('   Sound    Mixing...  ')).toBe('sound mixing')
    expect(normalizeString('1st A.D. (Continuity)')).toBe('1st a d continuity')
  })

  it('areStringsEqualNormalized matches equivalent variants', () => {
    expect(areStringsEqualNormalized('Colourist', 'colourist')).toBe(true)
    expect(areStringsEqualNormalized('Sound-Mixing!', 'Sound Mixing')).toBe(true)
    expect(areStringsEqualNormalized('Mumbai, Maharashtra', 'mumbai maharashtra')).toBe(true)
  })

  it('normalizes skill and language comparisons in matchScore', () => {
    const job: JobForScoring = { ...baseJob, language: 'Hindi / English', skills: ['DaVinci-Resolve!'] }
    const talent: TalentForScoring = { ...baseTalent, language: 'hindi english', skills: ['davinci resolve'] }
    const { signals } = calculateMatchScore(job, talent)
    expect(signals.skills_match).toBe(100)
    expect(signals.language_match).toBe(100)
  })
})

// ── Skill and role aliases ────────────────────────────────────

describe('Controlled vocabulary aliases', () => {
  it('canonicalizes common film aliases', () => {
    expect(canonicalizeSkill('DoP')).toBe('Cinematographer')
    expect(canonicalizeSkill('DOP')).toBe('Cinematographer')
    expect(canonicalizeSkill('Director of Photography')).toBe('Cinematographer')
    expect(canonicalizeSkill('Colourist')).toBe('Colorist')
    expect(canonicalizeSkill('DIT')).toBe('Digital Imaging Technician (DIT)')
    expect(canonicalizeSkill('DaVinci')).toBe('DaVinci Resolve')
    expect(canonicalizeSkill('ProTools')).toBe('Pro Tools')
  })

  it('matches skills when job or talent uses an alias', () => {
    const job: JobForScoring = { ...baseJob, skills: ['DaVinci Resolve'] }
    const talent: TalentForScoring = { ...baseTalent, skills: ['DaVinci'] }
    const { signals } = calculateMatchScore(job, talent)
    expect(signals.skills_match).toBe(100)
  })

  it('matches roles when talent role is an alias of required role', () => {
    const job: JobForScoring = { ...baseJob, roles: ['Cinematographer'] }
    const talent: TalentForScoring = { ...baseTalent, role: 'DoP' }
    const { signals } = calculateMatchScore(job, talent)
    expect(signals.role_match).toBe(100)
  })
})

// ── Explainability & Human-Readable Reasons ───────────────────

describe('Explainability & reasons', () => {
  it('returns human-readable reasons for every signal', () => {
    const breakdown = calculateMatchScore(baseJob, baseTalent)
    expect(breakdown.reasons).toBeDefined()
    expect(breakdown.reasons.skills_match).toContain('Matches all 3 required skills')
    expect(breakdown.reasons.role_match).toContain('Primary role matches requirement')
    expect(breakdown.reasons.experience_match).toContain('Experience (4 yrs) perfectly matches')
    expect(breakdown.reasons.language_match).toContain('Language matches')
    expect(breakdown.reasons.location_proximity).toContain('Located in the same city')
    expect(breakdown.reasons.profile_completeness).toContain('Profile is 100% complete')
    expect(breakdown.reasons.activity_recency).toContain('Active')
  })

  it('returns explicit missing skills reason when partial overlap', () => {
    const talent: TalentForScoring = {
      ...baseTalent,
      skills: ['Cinematography'], // missing Lighting and DaVinci Resolve
    }
    const breakdown = calculateMatchScore(baseJob, talent)
    expect(breakdown.reasons.skills_match).toContain('Missing 2 of 3 required skills: Lighting, DaVinci Resolve')
    expect(breakdown.missing_skills).toEqual(['Lighting', 'DaVinci Resolve'])
  })

  it('returns summary reasons for top matches and gaps', () => {
    const breakdown = calculateMatchScore(baseJob, baseTalent)
    expect(breakdown.summary_reasons.length).toBeGreaterThan(0)
  })
})

// ── Configurable Weights & Validation ─────────────────────────

describe('Configurable match weights', () => {
  it('default weights sum to 100', () => {
    const check = validateWeights(DEFAULT_WEIGHTS)
    expect(check.valid).toBe(true)
    expect(check.sum).toBe(100)
  })

  it('validateWeights rejects weights that do not sum to 100', () => {
    const invalidUnder = { ...DEFAULT_WEIGHTS, skills_match: 20 }
    expect(validateWeights(invalidUnder).valid).toBe(false)

    const invalidOver = { ...DEFAULT_WEIGHTS, skills_match: 40 }
    expect(validateWeights(invalidOver).valid).toBe(false)
  })

  it('validateWeights rejects negative or NaN weights', () => {
    const negative = { ...DEFAULT_WEIGHTS, skills_match: -10, role_match: 60 }
    expect(validateWeights(negative).valid).toBe(false)

    const nanVal = { ...DEFAULT_WEIGHTS, skills_match: NaN }
    expect(validateWeights(nanVal).valid).toBe(false)
  })

  it('calculateMatchScore applies custom active weights correctly', () => {
    // Custom: skills 50%, role 50%, everything else 0%
    const customWeights: MatchWeights = {
      skills_match: 50,
      role_match: 50,
      experience_match: 0,
      language_match: 0,
      location_proximity: 0,
      profile_completeness: 0,
      activity_recency: 0,
    }
    const talent: TalentForScoring = {
      ...baseTalent,
      skills: ['Cinematography', 'Lighting', 'DaVinci Resolve'], // 100
      role: 'Actor', // 0
    }
    const breakdown = calculateMatchScore(baseJob, talent, customWeights)
    // 100 * 0.5 + 0 * 0.5 = 50
    expect(breakdown.total).toBe(50)
  })
})

