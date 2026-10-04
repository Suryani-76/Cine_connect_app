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
  invite_code?: string
  age_confirmed?: boolean
  consent?: {
    terms: boolean
    privacy: boolean
    version: string
    age_confirmed?: boolean
  }
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

  getConsentStatus: (token: string) =>
    request<{ consent: { terms: boolean; privacy: boolean; version: string; consented_at: string } | null; latest_version: string; prompt_required: boolean }>('/auth/consent-status', {}, token),

  recordConsent: (payload: { terms: boolean; privacy: boolean; version: string }, token: string) =>
    request<{ message: string; version: string }>('/auth/consent', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  me: (token: string) =>
    request<{
      user: {
        id: string
        email: string
        username: string
        role: 'production' | 'talent'
        is_admin: boolean
        is_suspended: boolean
        suspended_at: string | null
        profile_id: string | null
      }
    }>('/auth/me', {}, token),
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
  verified?: boolean
  verified_at?: string | null
  verified_by?: string | null
  created_at: string
}

export interface ProfileResponse {
  profile: ProductionProfile & {
    users?: { username: string; role?: string; email?: string }
  }
}

export interface UpdateProductionProfilePayload {
  company_name?: string
  bio?: string
  production_details?: string
  logo_url?: string | null
}

export const productionApi = {
  createProfile: (payload: CreateProfilePayload, token: string) =>
    request<ProfileResponse>('/production/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  getMyProfile: (token: string) =>
    request<ProfileResponse>('/production/profile', {}, token),

  getProfile: (id: string, token?: string) =>
    request<ProfileResponse>(`/production/profile/${id}`, {}, token),

  updateProfile: (payload: UpdateProductionProfilePayload, token: string) =>
    request<ProfileResponse>('/production/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token),
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
    verified?: boolean
  }
}

export interface JobDetailResponse { job: JobWithProduction }
export interface JobResponse { job: Job }

export interface ListJobsParams {
  production_id?: string
  status?: JobStatus
  q?: string
  job_type?: JobType
  location?: string
  experience_level?: string
  skills?: string[]
  pay_min?: number
  pay_max?: number
  sort?: 'newest' | 'best_match'
  page?: number
  limit?: number
  offset?: number
}

export interface JobsResponse {
  jobs: (JobWithProduction & { match_score?: number })[]
  total?: number
  page?: number
  limit?: number
}

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

  getById: (jobId: string, token?: string) =>
    request<JobDetailResponse>(`/jobs/${jobId}`, {}, token),

  list: (params: ListJobsParams = {}, token?: string) => {
    const qs = new URLSearchParams()
    if (params.production_id) qs.set('production_id', params.production_id)
    if (params.status) qs.set('status', params.status)
    if (params.q) qs.set('q', params.q)
    if (params.job_type) qs.set('job_type', params.job_type)
    if (params.location) qs.set('location', params.location)
    if (params.experience_level) qs.set('experience_level', params.experience_level)
    if (params.skills && params.skills.length > 0) qs.set('skills', params.skills.join(','))
    if (params.pay_min !== undefined && !isNaN(params.pay_min)) qs.set('pay_min', String(params.pay_min))
    if (params.pay_max !== undefined && !isNaN(params.pay_max)) qs.set('pay_max', String(params.pay_max))
    if (params.sort) qs.set('sort', params.sort)
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.limit !== undefined) qs.set('limit', String(params.limit))
    if (params.offset !== undefined) qs.set('offset', String(params.offset))
    return request<JobsResponse>(`/jobs?${qs.toString()}`, {}, token)
  },

  /** List published jobs for talent browse — no production_id filter */
  listPublished: () => request<JobsResponse>('/jobs?status=published'),

  /** Applicant preview match score before applying */
  myMatch: (jobId: string, token: string) =>
    request<MatchBreakdown>(`/jobs/${jobId}/my-match`, {}, token),
}

// ── Saved Jobs ────────────────────────────────────────────────

export interface SavedJobItem {
  id: string
  job_id: string
  created_at: string
  jobs: JobWithProduction
}

export const savedJobsApi = {
  list: (token: string) =>
    request<{ saved: SavedJobItem[] }>('/saved-jobs', {}, token),

  save: (jobId: string, token: string) =>
    request<{ ok: boolean }>('/saved-jobs', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId }),
    }, token),

  unsave: (jobId: string, token: string) =>
    request<{ ok: boolean }>(`/saved-jobs/${jobId}`, {
      method: 'DELETE',
    }, token),
}

// ── Talent Alerts (Production) ────────────────────────────────

export interface TalentAlert {
  id: string
  user_id: string
  label: string
  skills: string[]
  role: string | null
  location: string | null
  language: string | null
  active: boolean
  created_at: string
}

export const talentAlertsApi = {
  list: (token: string) =>
    request<{ alerts: TalentAlert[] }>('/talent-alerts', {}, token),

  create: (
    payload: {
      label: string
      skills?: string[]
      role?: string
      location?: string
      language?: string
    },
    token: string
  ) =>
    request<{ alert: TalentAlert }>('/talent-alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  update: (id: string, payload: { active?: boolean; label?: string }, token: string) =>
    request<{ alert: TalentAlert }>(`/talent-alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token),

  delete: (id: string, token: string) =>
    request<{ ok: boolean }>(`/talent-alerts/${id}`, {
      method: 'DELETE',
    }, token),
}

// ── Talent ────────────────────────────────────────────────────

export type TalentAvailability = 'open' | 'busy' | 'unavailable'

export interface TalentCredit {
  id: string
  talent_profile_id: string
  project_title: string
  role: string
  year?: number | null
  production_company?: string | null
  description?: string | null
  link?: string | null
  created_at: string
}

export interface TalentProfile {
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
  has_resume?: boolean
  credits?: TalentCredit[]
  last_active_at: string
  created_at: string
}

/** user_id no longer sent — server derives from JWT */
export interface CreateTalentProfilePayload {
  full_name?: string
  bio?: string
  role?: string
  roles?: string[]
  skills?: string[]
  experience_years?: number
  language?: string
  location?: string
  avatar_url?: string
  portfolio_url?: string
  showreel_url?: string | null
  availability?: TalentAvailability
}

export interface TalentProfileResponse {
  profile: TalentProfile & {
    users?: { username: string; role: string }
  }
}
export interface TalentSearchResponse  { talent: TalentProfile[] }

export const talentApi = {
  createProfile: (payload: CreateTalentProfilePayload, token: string) =>
    request<TalentProfileResponse>('/talent/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  getMyProfile: (token: string) =>
    request<TalentProfileResponse>('/talent/profile', {}, token),

  getProfile: (id: string, token: string) =>
    request<TalentProfileResponse>(`/talent/profile/${id}`, {}, token),

  updateProfile: (payload: Partial<CreateTalentProfilePayload>, token: string) =>
    request<TalentProfileResponse>('/talent/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token),

  updateAvailability: (availability: TalentAvailability, token: string) =>
    request<{ availability: TalentAvailability }>('/talent/availability', {
      method: 'PUT',
      body: JSON.stringify({ availability }),
    }, token),

  uploadAvatar: async (file: File, token: string): Promise<{ avatar_url: string }> => {
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await fetch(`${BASE_URL}/talent/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Avatar upload failed')
    return json
  },

  uploadResume: async (file: File, token: string): Promise<{ resume_path: string; message: string }> => {
    const formData = new FormData()
    formData.append('resume', file)
    const res = await fetch(`${BASE_URL}/talent/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Resume upload failed')
    return json
  },

  deleteResume: (token: string) =>
    request<{ message: string }>('/talent/resume', { method: 'DELETE' }, token),

  getResumeSignedUrl: (profileId: string, token: string) =>
    request<{ signed_url: string; expires_in: number }>(`/talent/${profileId}/resume-url`, {}, token),

  getCredits: (token: string) =>
    request<{ credits: TalentCredit[] }>('/talent/credits', {}, token),

  createCredit: (payload: {
    project_title: string
    role: string
    year?: number | null
    production_company?: string | null
    description?: string | null
    link?: string | null
  }, token: string) =>
    request<{ credit: TalentCredit }>('/talent/credits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  updateCredit: (creditId: string, payload: Partial<{
    project_title: string
    role: string
    year?: number | null
    production_company?: string | null
    description?: string | null
    link?: string | null
  }>, token: string) =>
    request<{ credit: TalentCredit }>(`/talent/credits/${creditId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token),

  deleteCredit: (creditId: string, token: string) =>
    request<{ message: string }>(`/talent/credits/${creditId}`, {
      method: 'DELETE',
    }, token),

  search: (params: {
    skills?: string[]
    role?: string
    location?: string
    language?: string
    availability?: string
  }, token?: string) => {
    const qs = new URLSearchParams()
    if (params.skills?.length)  qs.set('skills',       params.skills.join(','))
    if (params.role)            qs.set('role',         params.role)
    if (params.location)        qs.set('location',     params.location)
    if (params.language)        qs.set('language',     params.language)
    if (params.availability)    qs.set('availability', params.availability)
    return request<TalentSearchResponse>(`/talent/search?${qs.toString()}`, {}, token)
  },
}

export const usersApi = {
  getPublicProfile: (id: string, token: string) =>
    request<{ user: { id: string; username: string; role: string } }>(`/users/${id}/public`, {}, token),
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
  reason?:  string
}

export interface MatchBreakdown {
  application_id?: string
  job_id?:         string
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
  reasons?: Record<string, string>
  matching_skills: string[]
  missing_skills?: string[]
  summary_reasons?: string[]
}

export interface ScoredApplication {
  id:                string
  job_id:            string
  talent_profile_id: string
  cover_note:        string | null
  status:            ApplicationStatus
  match_score:       number
  matching_skills:   string[]
  missing_skills?:   string[]
  reasons?:          Record<string, string>
  summary_reasons?:  string[]
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
      verified?:    boolean
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

  myMatch: (jobId: string, token: string) =>
    request<MatchBreakdown>(`/jobs/${jobId}/my-match`, {}, token),
}

// ── Talent search ranked by match score ───────────────────────

export interface RankedTalent {
  profile:     TalentProfile
  match_score: number
}

export interface RankedTalentResponse { talent: RankedTalent[] }


// ── Controlled Vocabulary ─────────────────────────────────────

export interface VocabItem {
  id?: string
  name: string
  category?: string
  department?: string
  state?: string | null
  country?: string
  is_verified?: boolean
}

export const vocabApi = {
  skills: (q?: string) =>
    request<{ skills: VocabItem[] }>(`/vocab/skills${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  roles: (q?: string) =>
    request<{ roles: VocabItem[] }>(`/vocab/roles${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  cities: (q?: string) =>
    request<{ cities: VocabItem[] }>(`/vocab/cities${q ? `?q=${encodeURIComponent(q)}` : ''}`),
}

// ── Match Engine Admin ────────────────────────────────────────

export interface MatchWeights {
  skills_match: number
  role_match: number
  experience_match: number
  language_match: number
  location_proximity: number
  profile_completeness: number
  activity_recency: number
}

export interface AdminUserItem {
  id: string
  email: string
  username: string
  role: 'production' | 'talent'
  suspended_at: string | null
  created_at: string
}

export interface AdminProductionItem {
  id: string
  user_id: string
  company_name: string
  bio: string | null
  verified: boolean
  verified_at: string | null
  verified_by: string | null
  created_at: string
}

export interface AdminAuditLogItem {
  id: string
  actor_id: string | null
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown>
  created_at: string
}

export const adminApi = {
  getMatchConfig: (token: string) =>
    request<{ weights: MatchWeights }>('/admin/match-config', {}, token),

  updateMatchConfig: (weights: MatchWeights, token: string, reason?: string) =>
    request<{ success: boolean; weights: MatchWeights }>('/admin/match-config', {
      method: 'PUT',
      body: JSON.stringify({ ...weights, reason }),
    }, token),

  triggerRecompute: (token: string, batchSize?: number) =>
    request<{ processedQueueItems: number; updatedApplicationsCount: number }>(
      `/admin/recompute/process${batchSize ? `?batch_size=${batchSize}` : ''}`,
      { method: 'POST' },
      token
    ),

  listUsers: (token: string, params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return request<{ users: AdminUserItem[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/users?${qs.toString()}`,
      {},
      token
    )
  },

  suspendUser: (userId: string, token: string, reason?: string) =>
    request<{ success: boolean; message: string; user_id: string; suspended_at: string }>(
      `/admin/users/${userId}/suspend`,
      { method: 'PUT', body: JSON.stringify({ reason }) },
      token
    ),

  unsuspendUser: (userId: string, token: string) =>
    request<{ success: boolean; message: string; user_id: string }>(
      `/admin/users/${userId}/unsuspend`,
      { method: 'PUT' },
      token
    ),

  listProductions: (token: string, params?: { status?: 'all' | 'verified' | 'unverified'; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status && params.status !== 'all') qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return request<{ productions: AdminProductionItem[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/production?${qs.toString()}`,
      {},
      token
    )
  },

  verifyProduction: (productionId: string, token: string) =>
    request<{ success: boolean; message: string; production_id: string; verified_at: string }>(
      `/admin/production/${productionId}/verify`,
      { method: 'PUT' },
      token
    ),

  unverifyProduction: (productionId: string, token: string) =>
    request<{ success: boolean; message: string; production_id: string }>(
      `/admin/production/${productionId}/unverify`,
      { method: 'PUT' },
      token
    ),

  getAuditLogs: (token: string, params?: { page?: number; limit?: number; target_type?: string; action?: string }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.target_type) qs.set('target_type', params.target_type)
    if (params?.action) qs.set('action', params.action)
    return request<{ items: AdminAuditLogItem[]; total: number; page: number; limit: number; totalPages: number }>(
      `/admin/audit-log?${qs.toString()}`,
      {},
      token
    )
  },

  listReports: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return request<AdminReportsResponse>(
      `/admin/reports?${qs.toString()}`,
      {},
      token
    )
  },

  updateReport: (
    token: string,
    reportId: string,
    payload: { status: ChatReportStatus; resolution_notes?: string }
  ) =>
    request<{ report: ChatReportItem }>(
      `/admin/reports/${reportId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      token
    ),
}


// ── Account Data Rights (DPDP Act 2023 / GDPR) ────────────────

export interface ExportUserDataResponse {
  exported_at: string
  jurisdiction_notice: string
  user: {
    id: string
    email: string
    username: string
    role: string
    created_at: string
  }
  consents: Array<{
    version: string
    terms_accepted: boolean
    privacy_accepted: boolean
    consented_at: string
  }>
  profile: unknown
  applications: unknown[]
  jobs: unknown[]
  alerts: unknown[]
  saved_jobs: unknown[]
  messages: unknown[]
  notifications: unknown[]
}

export const accountApi = {
  exportData: async (token: string): Promise<Blob> => {
    const res = await fetch(`${BASE_URL}/account/export`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Export failed" }))
      throw new Error((err as { error?: string }).error || "Failed to export account data")
    }
    return res.blob()
  },

  deleteAccount: (token: string) =>
    request<{ message: string }>("/account", {
      method: "DELETE",
    }, token),
}

// ── Chat & Safety ─────────────────────────────────────────────

export interface ChatMessage {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read: boolean
  created_at: string
}

export interface ConversationItem {
  peer_id: string
  peer_username: string
  peer_role: string
  last_message: ChatMessage | null
  unread_count: number
  is_blocked: boolean
  blocked_by_you: boolean
  can_message: boolean
  permission_reason?: string
}

export interface ConversationsResponse {
  conversations: ConversationItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface MessagesThreadResponse {
  messages: ChatMessage[]
  next_cursor: string | null
  can_message: boolean
  permission_reason?: string
  is_blocked: boolean
  blocked_by_you: boolean
}

export interface BlockedUserItem {
  blocked_id: string
  username: string
  created_at: string
}

export type ChatReportReason = 'spam' | 'harassment' | 'scam' | 'inappropriate' | 'other'
export type ChatReportStatus = 'open' | 'reviewed' | 'actioned'

export interface ChatReportItem {
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
  reporter_username?: string
  reporter_email?: string
  target_username?: string
  target_email?: string
  message_body?: string | null
}

export interface AdminReportsResponse {
  reports: ChatReportItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const chatApi = {
  getConversations: (token: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return request<ConversationsResponse>(`/conversations?${qs.toString()}`, {}, token)
  },

  getMessages: (
    token: string,
    otherUserId: string,
    params?: { cursor?: string; limit?: number }
  ) => {
    const qs = new URLSearchParams()
    if (params?.cursor) qs.set('cursor', params.cursor)
    if (params?.limit) qs.set('limit', String(params.limit))
    return request<MessagesThreadResponse>(`/messages/${otherUserId}?${qs.toString()}`, {}, token)
  },

  sendMessage: (token: string, payload: { recipient_id: string; body: string }) =>
    request<{ message: ChatMessage }>('/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  markRead: (token: string, otherUserId: string) =>
    request<{ success: boolean; count: number }>('/messages/read', {
      method: 'PUT',
      body: JSON.stringify({ other_user_id: otherUserId }),
    }, token),
}

export const blocksApi = {
  list: (token: string) =>
    request<{ blocks: BlockedUserItem[] }>('/blocks', {}, token),

  block: (token: string, blockedId: string) =>
    request<{ success: boolean; blocker_id: string; blocked_id: string; created_at: string }>(
      '/blocks',
      {
        method: 'POST',
        body: JSON.stringify({ blocked_id: blockedId }),
      },
      token
    ),

  unblock: (token: string, userId: string) =>
    request<{ success: boolean }>(`/blocks/${userId}`, { method: 'DELETE' }, token),
}

export const reportsApi = {
  create: (
    token: string,
    payload: {
      target_user_id: string
      message_id?: string
      reason: ChatReportReason
      details?: string
    }
  ) =>
    request<{ report: ChatReportItem }>('/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),
}

// ── Notification Preferences & Unsubscribe ────────────────────

export interface NotificationPreferences {
  user_id: string
  new_application: boolean
  status_change: boolean
  new_message: boolean
  job_closed: boolean
  talent_alert_match: boolean
  digest_frequency: 'off' | 'daily' | 'weekly'
  unsubscribe_token: string
  created_at: string
  updated_at: string
}

export const settingsApi = {
  getNotificationPreferences: (token: string) =>
    request<NotificationPreferences>('/settings/notifications', {}, token),

  updateNotificationPreferences: (
    token: string,
    payload: Partial<Omit<NotificationPreferences, 'user_id' | 'unsubscribe_token' | 'created_at' | 'updated_at'>>
  ) =>
    request<NotificationPreferences>(
      '/settings/notifications',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      token
    ),
}

export const unsubscribeApi = {
  getInfo: (token: string) =>
    request<{
      valid: boolean
      preferences: {
        new_application: boolean
        status_change: boolean
        new_message: boolean
        job_closed: boolean
        talent_alert_match: boolean
        digest_frequency: 'off' | 'daily' | 'weekly'
      }
    }>(`/unsubscribe/${token}`),

  execute: (token: string, payload?: { digestOnly?: boolean; disableAll?: boolean }) =>
    request<{ success: boolean; message: string }>(`/unsubscribe/${token}`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),
}


