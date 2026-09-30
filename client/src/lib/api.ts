const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ── Generic fetch wrapper ─────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const json = await res.json()

  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? 'Request failed')
  }

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

export interface CreateProfilePayload {
  user_id: string
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

export interface Job {
  id: string
  production_id: string
  title: string
  description: string
  status: JobStatus
  created_at: string
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

export interface CreateJobPayload {
  production_id: string
  title: string
  description: string
}

export interface SetRequirementsPayload {
  skills?: string[]
  roles?: string[]
  experience_level?: 'entry' | 'mid' | 'senior' | 'any'
  language?: string
  location?: string
}

export interface JobResponse { job: Job }
export interface JobsResponse { jobs: Job[] }
export interface RequirementsResponse { requirements: JobRequirements }

export const jobsApi = {
  create: (payload: CreateJobPayload, token: string) =>
    request<JobResponse>('/jobs', { method: 'POST', body: JSON.stringify(payload) }, token),

  setRequirements: (jobId: string, payload: SetRequirementsPayload, token: string) =>
    request<RequirementsResponse>(`/jobs/${jobId}/requirements`, { method: 'PUT', body: JSON.stringify(payload) }, token),

  publish: (jobId: string, token: string) =>
    request<JobResponse>(`/jobs/${jobId}/publish`, { method: 'POST' }, token),

  close: (jobId: string, token: string) =>
    request<JobResponse>(`/jobs/${jobId}/close`, { method: 'POST' }, token),

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

export interface CreateTalentProfilePayload {
  user_id: string
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

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'applied', 'shortlisted', 'interview', 'hired', 'rejected',
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
  created_at:        string
  talent_profiles:   TalentProfile
}

export interface ApplicationsResponse   { applications: ScoredApplication[] }
export interface ApplicationResponse    { application: ScoredApplication }

export const applicationsApi = {
  apply: (payload: { job_id: string; talent_profile_id: string; cover_note?: string }, token: string) =>
    request<{ application: ScoredApplication }>('/applications', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }, token),

  forJob: (jobId: string, token: string) =>
    request<ApplicationsResponse>(`/jobs/${jobId}/applications`, {}, token),

  updateStatus: (appId: string, status: ApplicationStatus, token: string) =>
    request<ApplicationResponse>(`/applications/${appId}/status`, {
      method: 'PUT',
      body:   JSON.stringify({ status }),
    }, token),

  matchBreakdown: (appId: string, token: string) =>
    request<MatchBreakdown>(`/applications/${appId}/match-breakdown`, {}, token),
}

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
  list: (userId: string, token: string, unreadOnly = false) =>
    request<NotificationsResponse>(
      `/notifications?user_id=${userId}&unread_only=${unreadOnly}`,
      {},
      token
    ),

  unreadCount: (userId: string, token: string) =>
    request<UnreadCountResponse>(
      `/notifications/unread-count?user_id=${userId}`,
      {},
      token
    ),

  markRead: (notificationId: string, token: string) =>
    request<{ notification: AppNotification }>(
      `/notifications/${notificationId}/read`,
      { method: 'PUT' },
      token
    ),

  markAllRead: (userId: string, token: string) =>
    request<{ message: string }>(
      `/notifications/read-all?user_id=${userId}`,
      { method: 'PUT' },
      token
    ),
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
  stats: (productionId: string, userId: string, token: string) =>
    request<DashboardStatsResponse>(
      `/dashboard/stats?production_id=${productionId}&user_id=${userId}`,
      {},
      token
    ),
}
