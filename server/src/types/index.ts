import { Request } from 'express'
import { User } from '@supabase/supabase-js'

/** Express Request with an authenticated Supabase user attached by requireAuth */
export interface AuthedRequest extends Request {
  user: User
}

// ── Users ─────────────────────────────────────────────────────

export interface DbUser {
  id: string
  email: string
  username: string
  role: 'talent' | 'production' | 'admin'
  created_at: string
}

// ── Production ────────────────────────────────────────────────

export interface DbProductionProfile {
  id: string
  user_id: string
  company_name: string
  bio: string | null
  production_details: string | null
  logo_url: string | null
  created_at: string
}

// ── Jobs ──────────────────────────────────────────────────────

export type JobStatus = 'draft' | 'published' | 'closed'
export type JobType = 'freelance' | 'contract' | 'full_time' | 'part_time'
export type PayPeriod = 'hour' | 'day' | 'week' | 'month' | 'project'

export interface DbJob {
  id: string
  production_id: string
  title: string
  description: string
  status: JobStatus
  job_type: JobType
  pay_min: number | null
  pay_max: number | null
  pay_currency: string
  pay_period: PayPeriod
  start_date: string | null
  end_date: string | null
  openings: number
  deadline: string | null
  created_at: string
  updated_at?: string
}

export interface DbJobRequirements {
  id: string
  job_id: string
  skills: string[]
  roles: string[]
  experience_level: string | null
  language: string | null
  location: string | null
}

export interface DbJobWithRequirements extends DbJob {
  job_requirements: DbJobRequirements | null
}

// ── Talent ────────────────────────────────────────────────────

export interface DbTalentProfile {
  id: string
  user_id: string
  full_name: string | null
  bio: string | null
  role: string | null
  skills: string[]
  experience_years: number
  language: string | null
  location: string | null
  avatar_url: string | null
  portfolio_url: string | null
  last_active_at: string
  created_at: string
}

// ── Applications ──────────────────────────────────────────────

export type ApplicationStatus =
  | 'applied'
  | 'shortlisted'
  | 'interview'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'applied', 'shortlisted', 'interview', 'hired', 'rejected', 'withdrawn',
]

export interface DbApplication {
  id: string
  job_id: string
  talent_profile_id: string
  cover_note: string | null
  status: ApplicationStatus
  match_score: number | null
  applied_at: string
  interview_at: string | null
  created_at: string
}

export interface ScoredApplication extends DbApplication {
  match_score: number
  talent_profiles: DbTalentProfile
}

export interface SignalBreakdownItem {
  score: number
  weight: number
  weighted: number
  reason?: string
}

export interface MatchBreakdownResponse {
  application_id?: string
  job_id?: string
  total: number
  weight_table: Record<string, number>
  signals: {
    skills_match:         SignalBreakdownItem
    role_match:           SignalBreakdownItem
    experience_match:     SignalBreakdownItem
    language_match:       SignalBreakdownItem
    location_proximity:   SignalBreakdownItem
    profile_completeness: SignalBreakdownItem
    activity_recency:     SignalBreakdownItem
  }
  reasons?: Record<string, string>
  matching_skills: string[]
  missing_skills?: string[]
  summary_reasons?: string[]
}

// ── Match scoring input shapes ────────────────────────────────

export interface JobForScoring {
  skills: string[]
  roles: string[]
  experience_level: string | null
  language: string | null
  location: string | null
}

export interface TalentForScoring {
  skills: string[]
  role: string | null
  experience_years: number
  language: string | null
  location: string | null
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  portfolio_url: string | null
  last_active_at: string
}

// ── Notifications ─────────────────────────────────────────────

export type NotificationType =
  | 'new_application'
  | 'new_message'
  | 'high_match_talent'
  | 'job_closed'

export interface DbNotification {
  id:         string
  user_id:    string
  type:       NotificationType
  payload:    Record<string, unknown>
  read:       boolean
  created_at: string
}

// ── Dashboard stats ───────────────────────────────────────────

export interface DashboardStats {
  active_jobs:          number
  new_applications:     number
  recommended_talent:   number
  unread_notifications: number
}

// ── Vocabulary & Controlled Terms ─────────────────────────────

export interface DbSkill {
  id: string
  name: string
  category: string
  is_verified: boolean
  created_at: string
}

export interface DbRole {
  id: string
  name: string
  department: string
  is_verified: boolean
  created_at: string
}

export interface DbCity {
  id: string
  name: string
  state: string | null
  country: string
  is_verified: boolean
  created_at: string
}

export interface DbSkillAlias {
  id: string
  alias: string
  canonical_name: string
  created_at: string
}

// ── Match Engine Config ───────────────────────────────────────

export interface MatchWeights {
  skills_match: number
  role_match: number
  experience_match: number
  language_match: number
  location_proximity: number
  profile_completeness: number
  activity_recency: number
}

export interface DbMatchConfig extends MatchWeights {
  id: string
  is_active: boolean
  updated_by: string | null
  updated_at: string
  created_at: string
}

export interface DbMatchConfigAuditLog {
  id: string
  user_id: string | null
  previous_weights: MatchWeights
  new_weights: MatchWeights
  reason: string | null
  created_at: string
}

// ── Match Recompute Queue ─────────────────────────────────────

export type RecomputeQueueStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DbMatchRecomputeQueueItem {
  id: string
  job_id: string | null
  talent_profile_id: string | null
  reason: string
  status: RecomputeQueueStatus
  attempts: number
  created_at: string
  processed_at: string | null
}

// ── Extended Explainability ───────────────────────────────────

export interface SignalExplanationDetail {
  score: number
  weight: number
  weighted: number
  reason: string
}

export interface ExtendedMatchBreakdownResponse {
  application_id?: string
  job_id?: string
  talent_profile_id?: string
  total: number
  weight_table: Record<string, number>
  signals: {
    skills_match: SignalExplanationDetail
    role_match: SignalExplanationDetail
    experience_match: SignalExplanationDetail
    language_match: SignalExplanationDetail
    location_proximity: SignalExplanationDetail
    profile_completeness: SignalExplanationDetail
    activity_recency: SignalExplanationDetail
  }
  matching_skills: string[]
  missing_skills: string[]
  summary_reasons: string[]
}
