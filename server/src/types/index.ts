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
  role: 'talent' | 'production'
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

export interface DbJob {
  id: string
  production_id: string
  title: string
  description: string
  status: JobStatus
  created_at: string
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

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'applied', 'shortlisted', 'interview', 'hired', 'rejected',
]

export interface DbApplication {
  id: string
  job_id: string
  talent_profile_id: string
  cover_note: string | null
  status: ApplicationStatus
  match_score: number | null
  applied_at: string
  created_at: string
}

export interface ScoredApplication extends DbApplication {
  match_score: number
  talent_profiles: DbTalentProfile
}

export interface MatchBreakdownResponse {
  application_id: string
  total: number
  weight_table: Record<string, number>
  signals: {
    skills_match:         { score: number; weight: number; weighted: number }
    role_match:           { score: number; weight: number; weighted: number }
    experience_match:     { score: number; weight: number; weighted: number }
    language_match:       { score: number; weight: number; weighted: number }
    location_proximity:   { score: number; weight: number; weighted: number }
    profile_completeness: { score: number; weight: number; weighted: number }
    activity_recency:     { score: number; weight: number; weighted: number }
  }
  matching_skills: string[]
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
