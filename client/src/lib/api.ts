import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ── Generic fetch wrapper with 401-retry ──────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const doFetch = async (t: string | undefined) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }
    if (t) headers['Authorization'] = `Bearer ${t}`
    return fetch(`${BASE_URL}${path}`, { ...options, headers })
  }

  let res = await doFetch(token)

  // On 401 try refreshing the session once, then retry
  if (res.status === 401 && token) {
    const { data } = await supabase.auth.refreshSession()
    if (data.session) {
      res = await doFetch(data.session.access_token)
    }
  }

  const json = await res.json()
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Request failed')
  return json as T
}

// ── Auth ──────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string
  password: string
  username: string
  role: 'production' | 'talent'
}

export interface RegisterResponse {
  message: string
  user: { id: string; email: string; username: string; role: string }
}

export interface VerifyPayload {
  email: string
  otp: string
}

export interface VerifyResponse {
  message: string
  access_token: string
  refresh_token: string
  user: { id: string; email: string; role: string }
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verify: (payload: VerifyPayload) =>
    request<VerifyResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
// ── Production profile ────────────────────────────────────────

/** user_id no longer sent — server derives from JWT */
export interface CreateProfilePayload {
  company_name: string
  bio?: string
  production_details?: string
}

export interface ProductionProfile {
  id: string
  user_id: string
  company_name: string
  bio: string | null
  production_details: string | null
  logo_url: string | null
  created_at: string
}

export interface ProfileResponse {
  profile: ProductionProfile & {
    users?: { username: string; email: string }
  }
}

export const productionApi = {
  createProfile: (payload: CreateProfilePayload, token: string) =>
    request<ProfileResponse>('/production/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  getProfile: (id: string) =>
    request<ProfileResponse>(`/production/profile/${id}`),
}

// ── Jobs ──────────────────────────────────────────────────────

export type JobStatus = 'draft' | 'published' | 'closed'
export type JobType = 'freelance' | 'contract' | 'full_time' | 'part_time'
export type PayPeriod = 'hour' | 'day' | 'week' | 'month' | 'project'

export interface Job {
  id: string
  production_id: string
  title: string
  description: string
  status: JobStatus
  job_type?: JobType
  pay_min?: number | null
  pay_max?: number | null
  pay_currency?: string
  pay_period?: PayPeriod
  start_date?: string | null
  end_date?: string | null
  openings?: number
  deadline?: string | null
  created_at: string
  updated_at?: string
  job_requirements?: JobRequirements | null
}

export interface JobRequirements {
  id: string
  job_id: string
  skills: string[]
  roles: string[]
  experience_level: string | null
  language: string | null
  location: string | null
}

/** production_id no longer sent — server derives from JWT */
export interface CreateJobPayload {
  title: string
  description: string
  job_type?: JobType
  pay_min?: number | null
  pay_max?: number | null
  pay_currency?: string
  pay_period?: PayPeriod
  start_date?: string | null
  end_date?: string | null
  openings?: number
  deadline?: string | null
}

export interface UpdateJobPayload {
  title?: string
  description?: string
  job_type?: JobType
  pay_min?: number | null
  pay_max?: number | null
  pay_currency?: string
  pay_period?: PayPeriod
  start_date?: string | null
  end_date?: string | null
  openings?: number
  deadline?: string | null
}

export interface SetRequirementsPayload {
  skills?: string[]
  roles?: string[]
  experience_level?: 'entry' | 'mid' | 'senior' | 'any'
  language?: string
  location?: string
}

export interface JobWithProduction extends Job {
  production_profiles: {
    id: string
    company_name: string
    bio: string | null
    logo_url: string | null
  }
}

export interface JobDetailResponse { job: JobWithProduction }
export interface JobResponse { job: Job }
export interface JobsResponse { jobs: Job[] }
export interface RequirementsResponse { requirements: JobRequirements }

export const jobsApi = {
  create: (payload: CreateJobPayload, token: string) =>
    request<JobResponse>('/jobs', { method: 'POST', body: JSON.stringify(payload) }, token),

  update: (jobId: string, payload: UpdateJobPayload, token: string) =>
    request<JobResponse>(`/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify(payload) }, token),

  delete: (jobId: string, token: string) =>
    request<{ message: string }>(`/jobs/${jobId}`, { method: 'DELETE' }, token),

  setRequirements: (jobId: string, payload: SetRequirementsPayload, token: string) =>
    request<RequirementsResponse>(`/jobs/${jobId}/requirements`, { method: 'PUT', body: JSON.stringify(payload) }, token),

  publish: (jobId: string, token: string) =>
    request<JobResponse>(`/jobs/${jobId}/publish`, { method: 'POST' }, token),

  close: (jobId: string, token: string) =>
    request<JobResponse>(`/jobs/${jobId}/close`, { method: 'POST' }, token),

  getById: (jobId: string) =>
    request<JobDetailResponse>(`/jobs/${jobId}`),

  list: (params: { production_id?: string; status?: JobStatus }, token?: string) => {
    const qs = new URLSearchParams()
    if (params.production_id) qs.set('production_id', params.production_id)
    if (params.status) qs.set('status', params.status)
    return request<JobsResponse>(`/jobs?${qs.toString()}`, {}, token)
  },

  /** List published jobs for talent browse — no production_id filter */
  listPublished: () => request<JobsResponse>('/jobs?status=published'),
}

// ── Talent ────────────────────────────────────────────────────

export interface TalentProfile {
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

/** user_id no longer sent — server derives from JWT */
export interface CreateTalentProfilePayload {
  full_name?: string
  bio?: string
  role?: string
  skills?: string[]
  experience_years?: number
  language?: string
  location?: string
  avatar_url?: string
  portfolio_url?: string
}

export interface TalentProfileResponse { profile: TalentProfile }
export interface TalentSearchResponse  { talent: TalentProfile[] }

export const talentApi = {
  createProfile: (payload: CreateTalentProfilePayload, token: string) =>
    request<TalentProfileResponse>('/talent/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  search: (params: {
    skills?: string[]
    role?: string
    location?: string
    language?: string
  }) => {
    const qs = new URLSearchParams()
    if (params.skills?.length)  qs.set('skills',   params.skills.join(','))
    if (params.role)            qs.set('role',      params.role)
    if (params.location)        qs.set('location',  params.location)
    if (params.language)        qs.set('language',  params.language)
    return request<TalentSearchResponse>(`/talent/search?${qs.toString()}`)
  },
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

export interface ScoreBreakdown {
  skills_match:         number
  role_match:           number
  experience_match:     number
  language_match:       number
  location_proximity:   number
  profile_completeness: number
  activity_recency:     number
}

export interface SignalDetail {
  score:    number
  weight:   number
  weighted: number
}

export interface MatchBreakdown {
  application_id: string
  total:          number
  weight_table:   Record<string, number>
  signals: {
    skills_match:         SignalDetail
    role_match:           SignalDetail
    experience_match:     SignalDetail
    language_match:       SignalDetail
    location_proximity:   SignalDetail
    profile_completeness: SignalDetail
    activity_recency:     SignalDetail
  }
  matching_skills: string[]
}

export interface ScoredApplication {
  id:                string
  job_id:            string
  talent_profile_id: string
  cover_note:        string | null
  status:            ApplicationStatus
  match_score:       number
  matching_skills:   string[]
  score_breakdown:   ScoreBreakdown
  applied_at:        string
  interview_at?:     string | null
  created_at:        string
  talent_profiles:   TalentProfile
}

export interface ApplicationsResponse   { applications: ScoredApplication[] }
export interface ApplicationResponse    { application: ScoredApplication }

export const applicationsApi = {
  /** talent_profile_id NOT sent — server derives from JWT */
  apply: (payload: { job_id: string; cover_note?: string }, token: string) =>
    request<{ application: ScoredApplication }>('/applications', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }, token),

  forJob: (jobId: string, token: string) =>
    request<ApplicationsResponse>(`/jobs/${jobId}/applications`, {}, token),

  updateStatus: (appId: string, status: ApplicationStatus, token: string, interview_at?: string) =>
    request<ApplicationResponse>(`/applications/${appId}/status`, {
      method: 'PUT',
      body:   JSON.stringify({ status, interview_at: interview_at || undefined }),
    }, token),

  withdraw: (appId: string, token: string) =>
    request<ApplicationResponse>(`/applications/${appId}/withdraw`, {
      method: 'POST',
    }, token),

  matchBreakdown: (appId: string, token: string) =>
    request<MatchBreakdown>(`/applications/${appId}/match-breakdown`, {}, token),

  myApplications: (talentProfileId: string, token: string) =>
    request<MyApplicationsResponse>(
      `/applications/my?talent_profile_id=${talentProfileId}`, {}, token
    ),
}

// ── My applications (talent view) types ──────────────────────

export interface MyApplication {
  id:                string
  job_id:            string
  talent_profile_id: string
  cover_note:        string | null
  status:            ApplicationStatus
  match_score:       number | null
  applied_at:        string
  interview_at?:     string | null
  created_at:        string
  jobs: {
    id:          string
    title:       string
    description: string
    status:      string
    job_type?:   JobType
    pay_min?:    number | null
    pay_max?:    number | null
    pay_currency?: string
    pay_period?: PayPeriod
    start_date?: string | null
    end_date?:   string | null
    openings?:   number
    deadline?:   string | null
    created_at:  string
    production_profiles: {
      id:           string
      company_name: string
      logo_url:     string | null
    }
    job_requirements: {
      skills:           string[]
      roles:            string[]
      experience_level: string | null
      language:         string | null
      location:         string | null
    } | null
  }
}

export interface MyApplicationsResponse { applications: MyApplication[] }

// ── Notifications ─────────────────────────────────────────────

export type NotificationType =
  | 'new_application'
  | 'new_message'
  | 'high_match_talent'

export interface AppNotification {
  id:         string
  user_id:    string
  type:       NotificationType
  payload:    Record<string, unknown>
  read:       boolean
  created_at: string
}

export interface NotificationsResponse {
  notifications: AppNotification[]
  unread_count:  number
}

export interface UnreadCountResponse { count: number }

export const notificationsApi = {
  list: (token: string, unreadOnly = false, limit = 50) =>
    request<NotificationsResponse>(
      `/notifications?unread_only=${unreadOnly}&limit=${limit}`,
      {}, token
    ),

  unreadCount: (token: string) =>
    request<UnreadCountResponse>('/notifications/unread-count', {}, token),

  markRead: (notificationId: string, token: string) =>
    request<{ notification: AppNotification }>(
      `/notifications/${notificationId}/read`, { method: 'PUT' }, token
    ),

  markAllRead: (token: string) =>
    request<{ message: string }>('/notifications/read-all', { method: 'PUT' }, token),
}

// ── Dashboard ─────────────────────────────────────────────────

export interface DashboardStats {
  active_jobs:          number
  new_applications:     number
  recommended_talent:   number
  unread_notifications: number
}

export interface DashboardStatsResponse { stats: DashboardStats }

export const dashboardApi = {
  stats: (token: string) =>
    request<DashboardStatsResponse>('/dashboard/stats', {}, token),
}

// ── Saved Jobs ────────────────────────────────────────────────

export interface SavedJobsResponse { saved: { job_id: string }[] }

export const savedJobsApi = {
  list: (token: string) =>
    request<SavedJobsResponse>('/saved-jobs', {}, token),

  save: (jobId: string, token: string) =>
    request<{ ok: boolean }>('/saved-jobs', {
      method: 'POST', body: JSON.stringify({ job_id: jobId }),
    }, token),

  unsave: (jobId: string, token: string) =>
    request<{ ok: boolean }>('/saved-jobs', {
      method: 'DELETE', body: JSON.stringify({ job_id: jobId }),
    }, token),
}

// ── Job analytics ─────────────────────────────────────────────

export interface JobAnalytics {
  job_id:          string
  view_count:      number
  applicant_count: number
  avg_match_score: number | null
}

export interface JobAnalyticsResponse { analytics: JobAnalytics }

export const jobAnalyticsApi = {
  get: (jobId: string, token: string) =>
    request<JobAnalyticsResponse>(`/jobs/${jobId}/analytics`, {}, token),

  recordView: (jobId: string) =>
    request<{ ok: boolean }>(`/jobs/${jobId}/view`, { method: 'POST' }),

  talentMatches: (jobId: string, token: string) =>
    request<RankedTalentResponse>(`/jobs/${jobId}/talent-matches`, {}, token),
}

// ── Talent search ranked by match score ───────────────────────

export interface RankedTalent {
  profile:     TalentProfile
  match_score: number
}

export interface RankedTalentResponse { talent: RankedTalent[] }

// ── Talent alerts ─────────────────────────────────────────────

export interface TalentAlert {
  id:       string
  user_id:  string
  label:    string
  skills:   string[]
  role:     string | null
  location: string | null
  language: string | null
  active:   boolean
  created_at: string
}

export interface TalentAlertsResponse { alerts: TalentAlert[] }

export const talentAlertsApi = {
  list: (token: string) =>
    request<TalentAlertsResponse>('/talent-alerts', {}, token),

  create: (payload: { label: string; skills?: string[]; role?: string; location?: string; language?: string }, token: string) =>
    request<{ alert: TalentAlert }>('/talent-alerts', { method: 'POST', body: JSON.stringify(payload) }, token),

  delete: (alertId: string, token: string) =>
    request<{ ok: boolean }>(`/talent-alerts/${alertId}`, { method: 'DELETE' }, token),
}
