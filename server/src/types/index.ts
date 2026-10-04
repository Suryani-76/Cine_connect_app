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
  suspended_at?: string | null
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
  verified: boolean
  verified_at: string | null
  verified_by: string | null
  created_at: string
}

// ── Admin & Audit ─────────────────────────────────────────────

export interface DbAdmin {
  user_id: string
  created_at: string
  created_by: string | null
}

export interface DbAuditLog {
  id: string
  actor_id: string | null
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown>
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
  production_profiles?: {
    id?: string
    company_name?: string
    logo_url?: string | null
    verified?: boolean
  } | null
  match_score?: number
}

// ── Talent ────────────────────────────────────────────────────

export type TalentAvailability = 'open' | 'busy' | 'unavailable'

export interface DbTalentProfile {
  id: string
  user_id: string
  full_name: string | null
  bio: string | null
  role: string | null
  roles: string[]
  skills: string[]
  experience_years: number
  language: string | null
  location: string | null
  avatar_url: string | null
  portfolio_url: string | null
  showreel_url: string | null
  availability: TalentAvailability
  resume_path: string | null
  last_active_at: string
  created_at: string
}

export interface DbTalentCredit {
  id: string
  talent_profile_id: string
  project_title: string
  role: string
  year: number | null
  production_company: string | null
  description: string | null
  link: string | null
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
  roles?: string[]
  experience_years: number
  language: string | null
  location: string | null
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  portfolio_url: string | null
  showreel_url?: string | null
  credits_count?: number
  last_active_at: string
}

// ── Chat & Safety ─────────────────────────────────────────────

export interface DbMessage {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read: boolean
  created_at: string
}

export interface DbUserBlock {
  blocker_id: string
  blocked_id: string
  created_at: string
}

export type ChatReportReason = 'spam' | 'harassment' | 'scam' | 'inappropriate' | 'other'
export type ChatReportStatus = 'open' | 'reviewed' | 'actioned'

export interface DbChatReport {
  id: string
  reporter_id: string
  target_user_id: string
  message_id: string | null
  reason: ChatReportReason
  details: string | null
  status: ChatReportStatus
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
}

export interface ConversationItem {
  peer_id: string
  peer_username: string
  peer_role: string
  last_message: DbMessage | null
  unread_count: number
  is_blocked: boolean
  blocked_by_you: boolean
  can_message: boolean
  permission_reason?: string
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

// ── Email & Notification Preferences ─────────────────────────

export type DigestFrequency = 'off' | 'daily' | 'weekly'

export interface DbNotificationPreferences {
  user_id: string
  new_application: boolean
  status_change: boolean
  new_message: boolean
  job_closed: boolean
  talent_alert_match: boolean
  digest_frequency: DigestFrequency
  unsubscribe_token: string
  created_at: string
  updated_at: string
}

export type EmailOutboxStatus = 'pending' | 'sent' | 'failed' | 'dead'

export interface DbEmailOutbox {
  id: string
  user_id?: string | null
  recipient_email: string
  subject: string
  template_name: string
  payload: Record<string, unknown>
  status: EmailOutboxStatus
  attempts: number
  max_attempts: number
  next_attempt_at: string
  last_error?: string | null
  sent_at?: string | null
  created_at: string
  updated_at: string
}

