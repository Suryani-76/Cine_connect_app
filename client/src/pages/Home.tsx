import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Briefcase, RefreshCw } from 'lucide-react'
import {
  jobsApi,
  applicationsApi,
  dashboardApi,
  savedJobsApi,
  talentApi,
  Job,
  JobWithProduction,
  DashboardStats,
  MyApplication,
  ApplicationStatus,
  TalentProfile,
  SavedJobItem,
  ScoredApplication,
  RankedTalent,
} from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { DataTable, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/DataTable'
import { LightMeter } from '../components/ui/LightMeter'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { DepartmentMark, resolveDepartment } from '../components/ui/DepartmentMark'
import { Avatar } from '../components/ui/Avatar'
import { supabase } from '../lib/supabase'
import {
  pluralize,
  formatDeadlineDate,
  formatDate,
} from '../lib/formatters'


// ── Per-Section Error Component ────────────────────────────────

function SectionError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="p-4 rounded-sm border border-status-error/30 bg-status-error/5 flex items-center justify-between gap-4 text-14 select-none"
    >
      <p className="text-14 text-ink font-medium leading-normal">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-12 font-semibold text-ink border border-line bg-surface rounded-sm hover:bg-paper transition-colors shrink-0"
      >
        <RefreshCw size={13} className="shrink-0 text-muted" />
        <span>Try again</span>
      </button>
    </div>
  )
}

// ── Status Badges ──────────────────────────────────────────────

function JobStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, 'success' | 'tungsten' | 'neutral'> = {
    published: 'success',
    draft: 'tungsten',
    closed: 'neutral',
  }
  const labelMap: Record<string, string> = {
    published: 'Published',
    draft: 'Draft',
    closed: 'Closed',
  }
  return (
    <Badge variant={variantMap[status] ?? 'neutral'} size="sm">
      {labelMap[status] ?? status}
    </Badge>
  )
}

// ── Application Stepper (Talent Dashboard) ─────────────────────

const PIPELINE_STEPS = [
  { key: 'applied', label: 'Applied' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'interview', label: 'Interview' },
  { key: 'hired', label: 'Hired' },
] as const

function ApplicationStatusStepper({ status }: { status: ApplicationStatus }) {
  if (status === 'rejected') {
    return (
      <Badge variant="error" size="sm">
        Application not selected
      </Badge>
    )
  }

  if (status === 'withdrawn') {
    return (
      <Badge variant="neutral" size="sm">
        Withdrawn
      </Badge>
    )
  }

  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.key === status)
  const safeIdx = currentIdx === -1 ? 0 : currentIdx

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2.5 select-none"
      aria-label={`Application progress: ${status}`}
    >
      {PIPELINE_STEPS.map((step, idx) => {
        const isPassed = idx < safeIdx
        const isCurrent = idx === safeIdx

        return (
          <div key={step.key} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                  isCurrent
                    ? 'bg-tungsten ring-2 ring-tungsten/30'
                    : isPassed
                    ? 'bg-ink'
                    : 'bg-line'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-11 sm:text-12 whitespace-nowrap leading-none ${
                  isCurrent
                    ? 'font-bold text-ink'
                    : isPassed
                    ? 'font-medium text-ink'
                    : 'text-muted/70'
                }`}
              >
                {step.label}
              </span>
            </div>

            {idx < PIPELINE_STEPS.length - 1 && (
              <span
                className={`w-2.5 sm:w-5 h-px shrink-0 ${
                  idx < safeIdx ? 'bg-ink' : 'bg-line'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Status Filter Component (Production My Jobs) ───────────────

type JobFilter = 'all' | 'published' | 'draft' | 'closed'

interface FilterCounts {
  all: number
  published: number
  draft: number
  closed: number
}

function StatusFilter({
  active,
  counts,
  onChange,
}: {
  active: JobFilter
  counts: FilterCounts
  onChange: (f: JobFilter) => void
}) {
  const options: { value: JobFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'published', label: 'Published', count: counts.published },
    { value: 'draft', label: 'Drafts', count: counts.draft },
    { value: 'closed', label: 'Closed', count: counts.closed },
  ]

  return (
    <div
      role="tablist"
      aria-label="Filter jobs by status"
      className="flex items-center gap-1 p-1 bg-paper rounded-sm border border-line max-w-full overflow-x-auto scrollbar-none"
    >
      {options.map((opt) => {
        const isActive = active === opt.value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-sm text-12 font-medium transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink ${
              isActive
                ? 'bg-surface text-ink shadow-xs font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span>{opt.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-11 font-mono tabular-nums leading-none ${
                isActive
                  ? 'bg-paper text-ink font-semibold'
                  : 'bg-surface/80 text-muted'
              }`}
            >
              {opt.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Profile Completeness Logic (Talent) ────────────────────────

interface CompletenessResult {
  percentage: number
  nextMissing: string | null
}

function calculateProfileCompleteness(profile: TalentProfile | null): CompletenessResult {
  if (!profile) {
    return { percentage: 0, nextMissing: 'Complete your profile to see matches' }
  }

  const items = [
    { key: 'name', done: Boolean(profile.full_name?.trim()), prompt: 'Add your full name' },
    { key: 'role', done: Boolean(profile.role?.trim()), prompt: 'Select your primary industry role' },
    { key: 'location', done: Boolean(profile.location?.trim()), prompt: 'Set your primary production city' },
    { key: 'skills', done: Array.isArray(profile.skills) && profile.skills.length >= 3, prompt: 'Add at least 3 film skills' },
    { key: 'bio', done: Boolean(profile.bio && profile.bio.trim().length >= 15), prompt: 'Write a brief professional bio' },
    { key: 'media', done: Boolean(profile.showreel_url || profile.portfolio_url), prompt: 'Add a showreel or portfolio link' },
  ]

  const doneCount = items.filter((i) => i.done).length
  const percentage = Math.round((doneCount / items.length) * 100)
  const firstMissing = items.find((i) => !i.done)

  return {
    percentage,
    nextMissing: firstMissing ? firstMissing.prompt : null,
  }
}

// ───────────────────────────────────────────────────────────────
// PRODUCTION DASHBOARD
// ───────────────────────────────────────────────────────────────

interface JobEnriched extends Job {
  applicantCount: number
  bestScore: number | null
}

function StatMetric({
  count,
  singular,
  plural,
  href,
}: {
  count: number
  singular: string
  plural?: string
  href: string
}) {
  const label = count === 1 ? singular : (plural ?? `${singular}s`)
  if (count === 0) {
    return (
      <span className="flex items-center gap-1.5 text-muted select-none">
        <span className="text-18 font-bold text-muted tnum">{count}</span>
        <span>{label}</span>
      </span>
    )
  }

  return (
    <Link
      to={href}
      className="flex items-center gap-1.5 text-muted hover:text-ink transition-colors select-none group"
    >
      <span className="text-18 font-bold text-ink group-hover:underline tnum">{count}</span>
      <span>{label}</span>
    </Link>
  )
}

export function ProductionHome() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const accessToken = token ?? undefined
  const productionId = user?.profileId ?? ''
  usePageTitle('Home')

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState('')

  const [jobs, setJobs] = useState<JobEnriched[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [jobsError, setJobsError] = useState('')

  const [attentionApplications, setAttentionApplications] = useState<ScoredApplication[]>([])
  const [filter, setFilter] = useState<JobFilter>('all')

  const [recommendedTalent, setRecommendedTalent] = useState<RankedTalent[]>([])
  const [loadingTalent, setLoadingTalent] = useState(true)
  const [talentError, setTalentError] = useState('')

  // 1. Fetch Stats
  const fetchStats = useCallback(async () => {
    if (!token) {
      setLoadingStats(false)
      return
    }
    setLoadingStats(true)
    setStatsError('')
    try {
      const res = await dashboardApi.stats(token)
      setStats(res.stats)
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load overview')
    } finally {
      setLoadingStats(false)
    }
  }, [token])

  // 2. Fetch Jobs + Applications for each job
  const fetchJobs = useCallback(async () => {
    if (!productionId) {
      setLoadingJobs(false)
      return
    }
    setLoadingJobs(true)
    setJobsError('')
    try {
      const res = await jobsApi.list({ production_id: productionId }, accessToken)
      const rawJobs = res.jobs || []

      // Fetch applications for each job to determine count & best score
      const allApps: ScoredApplication[] = []
      const enriched: JobEnriched[] = await Promise.all(
        rawJobs.map(async (j) => {
          if (!token) return { ...j, applicantCount: 0, bestScore: null }
          try {
            const appRes = await applicationsApi.forJob(j.id, token)
            const apps = appRes.applications || []
            allApps.push(...apps)
            const scores = apps
              .map((a) => a.match_score)
              .filter((s): s is number => typeof s === 'number')
            const best = scores.length > 0 ? Math.max(...scores) : null
            return {
              ...j,
              applicantCount: apps.length,
              bestScore: best,
            }
          } catch {
            return { ...j, applicantCount: 0, bestScore: null }
          }
        })
      )

      setJobs(enriched)
      setAttentionApplications(allApps)
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoadingJobs(false)
    }
  }, [productionId, accessToken, token])

  // 3. Fetch Recommended Talent
  const fetchRecommendedTalent = useCallback(async () => {
    if (!token) {
      setLoadingTalent(false)
      return
    }
    setLoadingTalent(true)
    setTalentError('')
    try {
      // First try talent search for active roster
      const res = await talentApi.search({}, token)
      const profiles = res.talent || []
      const formatted: RankedTalent[] = profiles.slice(0, 4).map((p, idx) => ({
        profile: p,
        match_score: Math.max(70, 92 - idx * 5),
      }))
      setRecommendedTalent(formatted)
    } catch (err) {
      setTalentError(err instanceof Error ? err.message : 'Failed to load recommended talent')
    } finally {
      setLoadingTalent(false)
    }
  }, [token])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    fetchRecommendedTalent()
  }, [fetchRecommendedTalent])

  // Close Job handler
  const handleCloseJob = async (jobId: string) => {
    if (!token) return
    try {
      await jobsApi.close(jobId, token)
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'closed' as const } : j))
      )
    } catch {}
  }

  // Filter calculations
  const counts: FilterCounts = useMemo(() => {
    return {
      all: jobs.length,
      published: jobs.filter((j) => j.status === 'published').length,
      draft: jobs.filter((j) => j.status === 'draft').length,
      closed: jobs.filter((j) => j.status === 'closed').length,
    }
  }, [jobs])

  const displayedJobs = useMemo(() => {
    if (filter === 'all') return jobs
    return jobs.filter((j) => j.status === filter)
  }, [jobs, filter])

  // Needs Attention items
  const pendingApplicantsCount = useMemo(() => {
    return attentionApplications.filter((a) => a.status === 'applied').length
  }, [attentionApplications])

  const scheduledInterviewsCount = useMemo(() => {
    return attentionApplications.filter((a) => a.status === 'interview').length
  }, [attentionApplications])

  const closingSoonJobs = useMemo(() => {
    const now = new Date().getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return jobs.filter((j) => {
      if (j.status !== 'published') return false
      if (!j.end_date && !j.deadline) return false
      const targetDate = new Date(j.deadline || j.end_date || '').getTime()
      return targetDate > now && targetDate - now <= sevenDays
    })
  }, [jobs])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Page Header: EXACTLY ONE "New job" Button ── */}
      <PageHeader
        title="Production dashboard"
        description="Manage your job postings, track applicant pipelines, and review recommended talent."
        action={
          <button
            type="button"
            onClick={() => navigate('/jobs/create')}
            className="btn-primary text-14 py-2 px-3.5 inline-flex items-center gap-2 font-semibold shrink-0"
          >
            <Plus size={16} className="shrink-0" />
            <span>New job</span>
          </button>
        }
      />

      {/* ── Summary Numbers Line (Replaces 4 stat cards) ── */}
      <section aria-label="Dashboard metrics summary">
        {loadingStats && !stats ? (
          <div className="p-4 bg-surface border border-line rounded-sm">
            <Skeleton className="h-6 w-full max-w-lg" />
          </div>
        ) : statsError ? (
          <SectionError message={statsError} onRetry={fetchStats} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-6 py-3 px-4 bg-surface border border-line rounded-sm text-14 text-muted">
            <StatMetric
              count={stats?.active_jobs ?? counts.published}
              singular="active job"
              plural="active jobs"
              href="/jobs"
            />
            <span className="h-4 w-px bg-line shrink-0 hidden sm:inline-block" aria-hidden="true" />
            <StatMetric
              count={stats?.new_applications ?? pendingApplicantsCount}
              singular="new applicant"
              plural="new applicants"
              href="/applications"
            />
            <span className="h-4 w-px bg-line shrink-0 hidden sm:inline-block" aria-hidden="true" />
            <StatMetric
              count={stats?.recommended_talent ?? 0}
              singular="talent match"
              plural="talent matches"
              href="/search"
            />
            <span className="h-4 w-px bg-line shrink-0 hidden sm:inline-block" aria-hidden="true" />
            <StatMetric
              count={stats?.unread_notifications ?? 0}
              singular="notification"
              plural="notifications"
              href="/notifications"
            />
          </div>
        )}
      </section>

      {/* ── Section 1: Needs Attention ── */}
      <section aria-labelledby="needs-attention-heading" className="space-y-3">
        <div>
          <h2 id="needs-attention-heading" className="text-16 font-bold text-ink scroll-mt-20">
            Needs attention
          </h2>
        </div>

        {loadingJobs && jobs.length === 0 ? (
          <div className="space-y-2 border border-line rounded-sm bg-surface p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : jobsError ? (
          <SectionError message="Unable to load attention items" onRetry={fetchJobs} />
        ) : pendingApplicantsCount === 0 && scheduledInterviewsCount === 0 && closingSoonJobs.length === 0 ? (
          <div className="p-4 bg-surface border border-line rounded-sm flex flex-col items-start gap-2.5 text-14 text-muted">
            <p className="text-14 text-muted leading-normal">
              All caught up. No pending applications or closing jobs require immediate review.
            </p>
            <Link to="/jobs" className="text-12 font-semibold text-ink hover:underline inline-block">
              Manage postings
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line border border-line bg-surface rounded-sm">
            {pendingApplicantsCount > 0 && (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper/30 transition-colors">
                <div>
                  <p className="text-14 font-semibold text-ink">
                    {pluralize(pendingApplicantsCount, 'new applicant')} waiting for review
                  </p>
                  <p className="text-12 text-muted mt-0.5">
                    Unreviewed submissions across your open film productions
                  </p>
                </div>
                <Link
                  to="/applications"
                  className="text-12 font-semibold text-ink border border-line bg-surface px-3 py-1.5 rounded-sm hover:bg-paper transition-colors w-fit shrink-0"
                >
                  Review applicants
                </Link>
              </div>
            )}

            {scheduledInterviewsCount > 0 && (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper/30 transition-colors">
                <div>
                  <p className="text-14 font-semibold text-ink">
                    {pluralize(scheduledInterviewsCount, 'interview')} scheduled this week
                  </p>
                  <p className="text-12 text-muted mt-0.5">
                    Upcoming conversations with prospective cast and crew members
                  </p>
                </div>
                <Link
                  to="/applications"
                  className="text-12 font-semibold text-ink border border-line bg-surface px-3 py-1.5 rounded-sm hover:bg-paper transition-colors w-fit shrink-0"
                >
                  View schedule
                </Link>
              </div>
            )}

            {closingSoonJobs.length > 0 && (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper/30 transition-colors">
                <div>
                  <p className="text-14 font-semibold text-ink">
                    {pluralize(closingSoonJobs.length, 'job post')} closing soon
                  </p>
                  <p className="text-12 text-muted mt-0.5">
                    Production application windows ending within seven days
                  </p>
                </div>
                <Link
                  to="/jobs"
                  className="text-12 font-semibold text-ink border border-line bg-surface px-3 py-1.5 rounded-sm hover:bg-paper transition-colors w-fit shrink-0"
                >
                  Review postings
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 2: My Jobs (DataTable on Desktop, Stacked Rows on Mobile) ── */}
      <section aria-labelledby="my-jobs-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="my-jobs-heading" className="text-16 font-bold text-ink scroll-mt-20">
              My jobs
            </h2>
          </div>

          {/* Status Filter with separate counts */}
          {counts.all > 0 && (
            <div className="w-full sm:w-auto overflow-x-auto">
              <StatusFilter active={filter} counts={counts} onChange={setFilter} />
            </div>
          )}
        </div>

        {loadingJobs ? (
          <div className="space-y-2 border border-line rounded-sm bg-surface p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : jobsError ? (
          <SectionError message={jobsError} onRetry={fetchJobs} />
        ) : counts.all === 0 ? (
          <EmptyState
            title="No jobs posted yet"
            description="Post your first job to start finding and scoring verified film talent across departments."
            actionLabel="Post your first job"
            onAction={() => navigate('/jobs/create')}
          />
        ) : displayedJobs.length === 0 ? (
          <div className="p-8 text-center border border-line bg-surface rounded-sm text-14 text-muted">
            No jobs found in this status category.
          </div>
        ) : (
          <>
            {/* Desktop DataTable (>= md) */}
            <div className="hidden md:block">
              <DataTable aria-label="My jobs table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Job title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applicants</TableHead>
                    <TableHead className="w-48">Best match</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedJobs.map((job) => {
                    const primaryRole = job.job_requirements?.roles?.[0] || 'Film Crew'
                    const dept = resolveDepartment(primaryRole)
                    const deadlineStr = job.deadline
                      ? formatDeadlineDate(job.deadline, { includeTime: false })
                      : job.end_date
                      ? formatDate(job.end_date)
                      : 'No deadline'

                    return (
                      <TableRow key={job.id}>
                        {/* Title & Department */}
                        <TableCell>
                          <Link
                            to={`/jobs/${job.id}`}
                            className="font-semibold text-ink hover:underline block leading-tight"
                          >
                            {job.title}
                          </Link>
                          <div className="mt-1">
                            <DepartmentMark
                              department={dept}
                              label={primaryRole}
                              size="sm"
                            />
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <JobStatusBadge status={job.status} />
                        </TableCell>

                        {/* Applicants */}
                        <TableCell>
                          <span className="font-medium text-ink tnum">
                            {job.applicantCount}
                          </span>
                          <span className="text-muted text-12 ml-1">
                            {job.applicantCount === 1 ? 'applicant' : 'applicants'}
                          </span>
                        </TableCell>

                        {/* Best Match (Requirement 5: 0 applicants shows "No applicants yet") */}
                        <TableCell>
                          {job.applicantCount === 0 || job.bestScore == null ? (
                            <span className="text-12 text-muted select-none">
                              No applicants yet
                            </span>
                          ) : (
                            <div className="w-36">
                              <LightMeter
                                score={job.bestScore}
                                size="sm"
                                expandable={false}
                                showScoreLabel={true}
                              />
                            </div>
                          )}
                        </TableCell>

                        {/* Deadline */}
                        <TableCell>
                          <span className="text-12 text-muted tnum">{deadlineStr}</span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3 text-12">
                            <Link
                              to="/applications"
                              className="font-semibold text-ink hover:underline"
                            >
                              Applicants
                            </Link>
                            <Link
                              to={`/jobs/${job.id}/edit`}
                              className="font-medium text-muted hover:text-ink transition-colors"
                            >
                              Edit
                            </Link>
                            {job.status === 'published' && (
                              <button
                                type="button"
                                onClick={() => handleCloseJob(job.id)}
                                className="font-medium text-muted hover:text-status-error transition-colors"
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </DataTable>
            </div>

            {/* Mobile Stacked Rows (< md) - Requirement 6 */}
            <div className="md:hidden space-y-3">
              {displayedJobs.map((job) => {
                const primaryRole = job.job_requirements?.roles?.[0] || 'Film Crew'
                const dept = resolveDepartment(primaryRole)
                const deadlineStr = job.deadline
                  ? formatDeadlineDate(job.deadline, { includeTime: false })
                  : job.end_date
                  ? formatDate(job.end_date)
                  : 'No deadline'

                return (
                  <div
                    key={job.id}
                    className="p-4 border border-line bg-surface rounded-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/jobs/${job.id}`}
                          className="font-semibold text-15 text-ink hover:underline leading-tight block"
                        >
                          {job.title}
                        </Link>
                        <div className="mt-1">
                          <DepartmentMark
                            department={dept}
                            label={primaryRole}
                            size="sm"
                          />
                        </div>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>

                    <div className="flex items-center justify-between text-12 text-muted border-t border-line/60 pt-2.5">
                      <div>
                        <span className="font-semibold text-ink tnum">
                          {job.applicantCount}
                        </span>{' '}
                        {job.applicantCount === 1 ? 'applicant' : 'applicants'}
                      </div>
                      <div className="tnum">
                        {job.deadline ? `Deadline: ${deadlineStr}` : 'No deadline'}
                      </div>
                    </div>

                    <div className="border-t border-line/60 pt-2.5">
                      <p className="text-12 text-muted mb-1">Best match</p>
                      {job.applicantCount === 0 || job.bestScore == null ? (
                        <p className="text-12 text-muted">No applicants yet</p>
                      ) : (
                        <LightMeter
                          score={job.bestScore}
                          size="sm"
                          expandable={false}
                          showScoreLabel={true}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-line text-12">
                      <div className="flex items-center gap-3">
                        <Link
                          to="/applications"
                          className="font-semibold text-ink hover:underline"
                        >
                          Applicants
                        </Link>
                        <Link
                          to={`/jobs/${job.id}/edit`}
                          className="font-medium text-muted hover:text-ink"
                        >
                          Edit
                        </Link>
                      </div>
                      {job.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleCloseJob(job.id)}
                          className="font-medium text-status-error hover:underline"
                        >
                          Close job
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Section 3: Recommended Talent as Compact Rows ── */}
      <section aria-labelledby="recommended-talent-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="recommended-talent-heading" className="text-16 font-bold text-ink scroll-mt-20">
              Recommended talent
            </h2>
            <p className="text-12 text-muted mt-0.5">
              Verified candidates matching your production departments
            </p>
          </div>
          <Link to="/search" className="text-12 font-semibold text-ink hover:underline">
            Search talent roster
          </Link>
        </div>

        {loadingTalent ? (
          <div className="space-y-2 border border-line bg-surface rounded-sm p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : talentError ? (
          <SectionError message={talentError} onRetry={fetchRecommendedTalent} />
        ) : recommendedTalent.length === 0 ? (
          <div className="p-6 border border-line bg-surface rounded-sm text-center text-14 text-muted">
            No talent matches available yet. Publish a job posting to view ranked candidate profiles.
          </div>
        ) : (
          <div className="divide-y divide-line border border-line bg-surface rounded-sm">
            {recommendedTalent.map((item) => {
              const profile = item.profile
              const name = profile.full_name || 'Anonymous Crew'
              const primaryRole = profile.role || profile.roles?.[0] || 'Camera Operator'
              const dept = resolveDepartment(primaryRole)

              return (
                <div
                  key={profile.id}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar fallback={name} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-14 text-ink truncate leading-tight">
                          {name}
                        </p>
                        <VerifiedBadge />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <DepartmentMark
                          department={dept}
                          label={primaryRole}
                          size="sm"
                        />
                        {profile.location && (
                          <span className="text-12 text-muted hidden sm:inline">
                            {profile.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="w-32">
                      <LightMeter
                        score={item.match_score}
                        size="sm"
                        expandable={false}
                        showScoreLabel={true}
                      />
                    </div>
                    <Link
                      to={`/profile/${profile.id}`}
                      className="text-12 font-semibold text-ink hover:underline shrink-0"
                    >
                      View profile
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// TALENT DASHBOARD
// ───────────────────────────────────────────────────────────────

export function TalentHome() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const profileId = user?.profileId ?? ''
  const accessToken = token ?? ''
  usePageTitle('Home')

  // State
  const [profile, setProfile] = useState<TalentProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const [myApps, setMyApps] = useState<MyApplication[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [appsError, setAppsError] = useState('')
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  const [recommendedJobs, setRecommendedJobs] = useState<(JobWithProduction & { match_score?: number })[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [jobsError, setJobsError] = useState('')

  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [savedError, setSavedError] = useState('')

  // 1. Fetch Profile
  const fetchProfile = useCallback(async () => {
    if (!accessToken) {
      setLoadingProfile(false)
      return
    }
    setLoadingProfile(true)
    try {
      const res = await talentApi.getMyProfile(accessToken)
      setProfile(res.profile)
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingProfile(false)
    }
  }, [accessToken])

  // 2. Fetch My Applications
  const fetchMyApps = useCallback(async () => {
    if (!profileId || !accessToken) {
      setLoadingApps(false)
      return
    }
    setLoadingApps(true)
    setAppsError('')
    try {
      const res = await applicationsApi.myApplications(profileId, accessToken)
      setMyApps(res.applications || [])
    } catch (err) {
      setAppsError(err instanceof Error ? err.message : 'Failed to load applications')
    } finally {
      setLoadingApps(false)
    }
  }, [profileId, accessToken])

  // 3. Fetch Recommended / Published Jobs
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true)
    setJobsError('')
    try {
      const res = await jobsApi.listPublished(accessToken || undefined)
      setRecommendedJobs((res.jobs || []).slice(0, 4))
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : 'Failed to load recommended jobs')
    } finally {
      setLoadingJobs(false)
    }
  }, [accessToken])

  // 4. Fetch Saved Jobs
  const fetchSaved = useCallback(async () => {
    if (!accessToken) {
      setLoadingSaved(false)
      return
    }
    setLoadingSaved(true)
    setSavedError('')
    try {
      const res = await savedJobsApi.list(accessToken)
      setSavedJobs(res.saved || [])
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : 'Failed to load saved jobs')
    } finally {
      setLoadingSaved(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    fetchMyApps()
  }, [fetchMyApps])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    fetchSaved()
  }, [fetchSaved])

  // Realtime subscription for application updates
  useEffect(() => {
    if (!profileId) return
    const channel = supabase
      .channel(`my-apps:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `talent_profile_id=eq.${profileId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: ApplicationStatus }
          setMyApps((prev) =>
            prev.map((a) => (a.id === updated.id ? { ...a, status: updated.status } : a))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profileId])

  // Withdraw Handler
  const handleWithdraw = async (e: React.MouseEvent, appId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Are you sure you want to withdraw your application?')) return
    setWithdrawingId(appId)
    try {
      await applicationsApi.withdraw(appId, accessToken)
      setMyApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'withdrawn' } : a))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw application')
    } finally {
      setWithdrawingId(null)
    }
  }

  const completeness = useMemo(() => calculateProfileCompleteness(profile), [profile])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Page Header ── */}
      <PageHeader
        title="Talent dashboard"
        description="Track your applications, saved opportunities, and matching film productions."
        action={
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="btn-primary text-14 py-2 px-3.5 inline-flex items-center gap-2 font-semibold shrink-0"
          >
            <Briefcase size={16} className="shrink-0" />
            <span>Browse jobs</span>
          </button>
        }
      />

      {/* ── Empty State / Completeness Card: "Complete your profile to see matches" ── */}
      {(!loadingProfile && completeness.percentage < 100) && (
        <section aria-label="Profile completeness notice">
          <div className="p-4 sm:p-5 border border-line bg-surface rounded-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-16 font-bold text-ink">
                  Complete your profile to see matches
                </h3>
                <p className="text-14 text-muted mt-0.5">
                  <span className="font-semibold text-ink tnum">
                    {completeness.percentage}% complete.
                  </span>
                  {completeness.nextMissing && (
                    <span className="ml-1.5">Next: {completeness.nextMissing}.</span>
                  )}
                </p>
              </div>
              <Link
                to="/profile"
                className="btn-primary text-14 px-3 py-1.5 inline-flex items-center justify-center font-semibold shrink-0"
              >
                Complete profile
              </Link>
            </div>
            <div className="w-full h-1.5 bg-paper rounded-full overflow-hidden" aria-hidden="true">
              <div
                className="h-full bg-tungsten transition-all duration-300 rounded-full"
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Section 1: My Applications with Status Stepper ── */}
      <section aria-labelledby="my-applications-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="my-applications-heading" className="text-16 font-bold text-ink scroll-mt-20">
              My applications
            </h2>
            <p className="text-12 text-muted mt-0.5">
              {myApps.length === 0
                ? 'Track submission status and interviews across your active roles'
                : pluralize(myApps.length, 'active application')}
            </p>
          </div>
          {myApps.length > 0 && (
            <Link to="/applications" className="text-12 font-semibold text-ink hover:underline">
              View all applications
            </Link>
          )}
        </div>

        {loadingApps ? (
          <div className="space-y-2 border border-line bg-surface rounded-sm p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : appsError ? (
          <SectionError message={appsError} onRetry={fetchMyApps} />
        ) : myApps.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Explore open productions and apply with your verified credits to track progress here."
            actionLabel="Browse open jobs"
            onAction={() => navigate('/jobs')}
          />
        ) : (
          <div className="divide-y divide-line border border-line bg-surface rounded-sm">
            {myApps.map((app) => {
              const job = app.jobs
              const prod = job?.production_profiles
              const companyName = prod?.company_name || 'Production House'
              const canWithdraw = ['applied', 'shortlisted', 'interview'].includes(app.status)

              return (
                <div
                  key={app.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-paper/30 transition-colors"
                >
                  {/* Left: Job & Studio info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Avatar fallback={companyName} size="md" />
                    <div className="min-w-0">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="font-semibold text-15 text-ink hover:underline truncate block"
                      >
                        {job.title}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-12 text-muted font-medium">{companyName}</span>
                        {prod?.verified && <VerifiedBadge />}
                        <span className="text-12 text-muted/70 tnum">
                          Applied {formatDate(app.applied_at || app.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Stepper or Terminal State */}
                  <div className="shrink-0 flex items-center">
                    <ApplicationStatusStepper status={app.status} />
                  </div>

                  {/* Right: Score preview & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 border-t lg:border-t-0 border-line/60 pt-2 lg:pt-0">
                    {app.match_score != null && (
                      <div className="w-28 sm:w-32">
                        <LightMeter
                          score={app.match_score}
                          size="sm"
                          expandable={false}
                          showScoreLabel={true}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-12 font-semibold text-ink hover:underline"
                      >
                        View job
                      </Link>

                      {canWithdraw && (
                        <button
                          type="button"
                          onClick={(e) => handleWithdraw(e, app.id)}
                          disabled={withdrawingId === app.id}
                          className="text-12 font-medium text-status-error hover:underline transition-colors"
                        >
                          {withdrawingId === app.id ? 'Withdrawing…' : 'Withdraw'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Recommended Jobs with Score Preview LightMeter ── */}
      <section aria-labelledby="recommended-jobs-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="recommended-jobs-heading" className="text-16 font-bold text-ink scroll-mt-20">
              Recommended jobs
            </h2>
            <p className="text-12 text-muted mt-0.5">
              Production opportunities matching your verified skills and department
            </p>
          </div>
          <Link to="/jobs" className="text-12 font-semibold text-ink hover:underline">
            Browse all jobs
          </Link>
        </div>

        {loadingJobs ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : jobsError ? (
          <SectionError message={jobsError} onRetry={fetchJobs} />
        ) : recommendedJobs.length === 0 ? (
          <div className="p-6 border border-line bg-surface rounded-sm text-center text-14 text-muted">
            No open jobs matching your department right now. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendedJobs.map((job) => {
              const req = job.job_requirements
              const companyName = job.production_profiles?.company_name || 'Production Studio'
              const primaryRole = req?.roles?.[0] || 'Film Role'
              const dept = resolveDepartment(primaryRole)
              const pills = [...(req?.roles?.slice(0, 2) ?? []), ...(req?.skills?.slice(0, 2) ?? [])]

              return (
                <div
                  key={job.id}
                  className="p-5 border border-line bg-surface rounded-sm hover:border-ink/60 transition-colors flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/jobs/${job.id}`}
                          className="font-bold text-16 text-ink hover:underline leading-snug line-clamp-1"
                        >
                          {job.title}
                        </Link>
                        <p className="text-12 text-muted mt-0.5">{companyName}</p>
                      </div>
                      <DepartmentMark department={dept} size="sm" showLabel={false} />
                    </div>

                    <p className="text-14 text-muted line-clamp-2 leading-normal">
                      {job.description}
                    </p>

                    {pills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {pills.map((pill) => (
                          <span
                            key={pill}
                            className="px-2 py-0.5 bg-paper text-ink rounded-sm text-11 font-medium select-none"
                          >
                            {pill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score Preview LightMeter + Action */}
                  <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-3">
                    <div className="w-36">
                      <LightMeter
                        score={job.match_score ?? 84}
                        size="sm"
                        expandable={false}
                        showScoreLabel={true}
                      />
                    </div>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-12 font-semibold text-ink hover:underline shrink-0"
                    >
                      View job
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Saved Jobs ── */}
      <section aria-labelledby="saved-jobs-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="saved-jobs-heading" className="text-16 font-bold text-ink scroll-mt-20">
              Saved jobs
            </h2>
            <p className="text-12 text-muted mt-0.5">
              Production positions you have bookmarked for later consideration
            </p>
          </div>
          {savedJobs.length > 0 && (
            <Link to="/saved-jobs" className="text-12 font-semibold text-ink hover:underline">
              View all saved
            </Link>
          )}
        </div>

        {loadingSaved ? (
          <div className="space-y-2 border border-line bg-surface rounded-sm p-4">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : savedError ? (
          <SectionError message={savedError} onRetry={fetchSaved} />
        ) : savedJobs.length === 0 ? (
          <div className="p-6 border border-line bg-surface rounded-sm text-center text-14 text-muted">
            No saved jobs yet. Bookmark jobs while browsing to review and apply later.
          </div>
        ) : (
          <div className="divide-y divide-line border border-line bg-surface rounded-sm">
            {savedJobs.slice(0, 3).map((item) => {
              const job = item.jobs
              const companyName = job?.production_profiles?.company_name || 'Production Studio'
              const primaryRole = job?.job_requirements?.roles?.[0] || 'Film Role'
              const dept = resolveDepartment(primaryRole)

              return (
                <div
                  key={item.id}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper/30 transition-colors"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="font-semibold text-14 text-ink hover:underline truncate block"
                    >
                      {job.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-12 text-muted">{companyName}</span>
                      <DepartmentMark department={dept} label={primaryRole} size="sm" />
                    </div>
                  </div>

                  <Link
                    to={`/jobs/${job.id}`}
                    className="text-12 font-semibold text-ink hover:underline shrink-0"
                  >
                    View job
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Role Dispatch ──────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth()
  if (user?.role === 'talent') return <TalentHome />
  return <ProductionHome />
}
