import { describe, it, expect } from 'vitest'
import { calculateMatchScore, matchingSkills } from '../matchScore'
import { JobForScoring, TalentForScoring } from '../../types'

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

  it('role_match = 0 when talent role does not match', () => {
    const talent = { ...baseTalent, role: 'Sound Engineer' }
    const { signals } = calculateMatchScore(baseJob, talent)
    expect(signals.role_match).toBe(0)
  })

  it('role_match = 50 when job has no roles (neutral)', () => {
    const job = { ...baseJob, roles: [] }
    const { signals } = calculateMatchScore(job, baseTalent)
    expect(signals.role_match).toBe(50)
  })

  it('role_match = 50 when talent has no role (neutral)', () => {
    const talent = { ...baseTalent, role: null }
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

  it('profile_completeness = 100 for fully filled profile', () => {
    const { signals } = calculateMatchScore(baseJob, baseTalent)
    expect(signals.profile_completeness).toBe(100)
  })

  it('profile_completeness = 0 for empty profile', () => {
    const empty: TalentForScoring = {
      skills: [], role: null, experience_years: 0,
      language: null, location: null, full_name: null,
      bio: null, avatar_url: null, portfolio_url: null,
      last_active_at: new Date().toISOString(),
    }
    const { signals } = calculateMatchScore(baseJob, empty)
    expect(signals.profile_completeness).toBe(0)
  })

  it('profile_completeness = 38 for 3/8 profile fields filled', () => {
    const partial: TalentForScoring = {
      skills: ['Cinematography'], role: 'Cinematographer',
      experience_years: 4, language: 'English',
      location: null, full_name: null, bio: null,
      avatar_url: null, portfolio_url: null,
      last_active_at: new Date().toISOString(),
    }
    const { signals } = calculateMatchScore(baseJob, partial)
    // skills(✓) role(✓) language(✓) — 3 of 8 fields = 37.5 → rounds to 38
    expect(signals.profile_completeness).toBe(38)
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
