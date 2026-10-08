import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  MessageCircle,
  ExternalLink,
  ChevronDown,
  LayoutGrid,
  List,
  Calendar,
  CheckCircle2,
  UserCheck,
  UserX,
  FileText,
  Video,
  Film,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import {
  applicationsApi,
  jobsApi,
  talentApi,
  ScoredApplication,
  MatchBreakdown,
  Job,
  ApplicationStatus,
  TalentCredit,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { PageHeader } from '../components/PageHeader'
import { LightMeter, Signal } from '../components/ui/LightMeter'
import { DepartmentMark } from '../components/ui/DepartmentMark'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Sheet, SheetContent } from '../components/ui/Sheet'
import { Modal, ModalContent } from '../components/ui/Modal'
import { pluralize, formatLoadErrorMessage } from '../lib/formatters'

// ── Pipeline definitions ───────────────────────────────────────

export type PipelineStage = 'applied' | 'shortlisted' | 'interview' | 'hired'
export type ClosedStage = 'rejected' | 'withdrawn'
export type ActiveOrClosedTab = PipelineStage | 'closed'

const ACTIVE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'applied', label: 'Applied' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interview' },
  { id: 'hired', label: 'Hired' },
]

const STAGE_BADGE_VARIANTS: Record<
  ApplicationStatus,
  { label: string; variant: 'neutral' | 'tungsten' | 'warning' | 'success' | 'error' }
> = {
  applied: { label: 'Applied', variant: 'neutral' },
  shortlisted: { label: 'Shortlisted', variant: 'tungsten' },
  interview: { label: 'Interview', variant: 'warning' },
  hired: { label: 'Hired', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  withdrawn: { label: 'Withdrawn', variant: 'neutral' },
}

const AVAILABILITY_LABELS: Record<string, string> = {
  immediately: 'Available now',
  open: 'Available now',
  within_2_weeks: 'Within 2 weeks',
  within_month: 'Within 1 month',
  busy: 'Busy on project',
  unavailable: 'Unavailable',
  not_available: 'Unavailable',
}

const SIGNALS_META = [
  { key: 'skills_match', label: 'Skills', weight: 30 },
  { key: 'role_match', label: 'Role fit', weight: 20 },
  { key: 'experience_match', label: 'Experience', weight: 15 },
  { key: 'language_match', label: 'Language', weight: 10 },
  { key: 'location_proximity', label: 'Location', weight: 10 },
  { key: 'profile_completeness', label: 'Profile', weight: 10 },
  { key: 'activity_recency', label: 'Recent activity', weight: 5 },
] as const

// ── Helper to convert breakdown to LightMeter signals ─────────

function toLightMeterSignals(
  scoreBreakdown?: ScoredApplication['score_breakdown'],
  reasons?: Record<string, string>
): Signal[] {
  if (!scoreBreakdown) return []
  return SIGNALS_META.map((meta) => {
    const raw = scoreBreakdown[meta.key as keyof typeof scoreBreakdown] ?? 0
    const earned = raw > meta.weight ? Math.round((raw * meta.weight) / 100) : raw
    return {
      name: meta.label,
      score: earned,
      maxScore: meta.weight,
      weight: meta.weight,
      reason: reasons?.[meta.key],
    }
  })
}

// ── Main Applications Component ────────────────────────────────

export const Applications = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlJobId = searchParams.get('job_id') ?? ''
  const { user, token } = useAuth()
  const accessToken = token ?? ''
  const productionId = user?.profileId ?? ''
  const navigate = useNavigate()

  usePageTitle('Applicants')

  // View state (board vs table) saved in localStorage
  const [viewMode, setViewMode] = useState<'board' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('cc_applications_view')
      return saved === 'table' ? 'table' : 'board'
    } catch {
      return 'board'
    }
  })

  const handleSetViewMode = (mode: 'board' | 'table') => {
    setViewMode(mode)
    try {
      localStorage.setItem('cc_applications_view', mode)
    } catch {
      // ignore
    }
  }

  // Jobs & Selection
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState(urlJobId)
  const [loadingJobs, setLoadingJobs] = useState(true)

  // Applications
  const [applications, setApplications] = useState<ScoredApplication[]>([])
  const [loadingApps, setLoadingApps] = useState(false)
  const [error, setError] = useState('')

  // UI state
  const [mobileTab, setMobileTab] = useState<ActiveOrClosedTab>('applied')
  const [isClosedExpanded, setIsClosedExpanded] = useState(false)
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null)

  // Drawer / Modals
  const [drawerAppId, setDrawerAppId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [showCompare, setShowCompare] = useState(false)

  // Action Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: 'hire' | 'reject' | 'bulk_shortlist' | 'bulk_reject'
    app?: ScoredApplication
    targetIds?: string[]
  } | null>(null)

  // Interview Date Picker dialog
  const [interviewModalApp, setInterviewModalApp] = useState<ScoredApplication | null>(null)
  const [interviewDate, setInterviewDate] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // 1. Fetch published jobs
  const fetchJobs = useCallback(() => {
    if (!productionId) {
      setLoadingJobs(false)
      return
    }
    setLoadingJobs(true)
    setError('')
    jobsApi
      .list({ production_id: productionId, status: 'published' }, accessToken)
      .then((res) => {
        setJobs(res.jobs)
        if (res.jobs.length > 0) {
          if (!selectedJobId || !res.jobs.some((j) => j.id === selectedJobId)) {
            setSelectedJobId(res.jobs[0].id)
            setSearchParams({ job_id: res.jobs[0].id }, { replace: true })
          }
        }
      })
      .catch((e) =>
        setError(formatLoadErrorMessage(e, "Couldn't load jobs. Check your connection and try again."))
      )
      .finally(() => setLoadingJobs(false))
  }, [productionId, accessToken, selectedJobId, setSearchParams])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // 2. Fetch applications for chosen job
  const fetchApplications = useCallback((jobId: string) => {
    if (!jobId || !accessToken) return
    setLoadingApps(true)
    setError('')
    applicationsApi
      .forJob(jobId, accessToken)
      .then((res) => {
        const sorted = (res.applications ?? []).slice().sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
        setApplications(sorted)
        setCompareIds(new Set())
      })
      .catch((e) =>
        setError(formatLoadErrorMessage(e, "Couldn't load applicants. Check your connection and try again."))
      )
      .finally(() => setLoadingApps(false))
  }, [accessToken])

  useEffect(() => {
    if (selectedJobId) {
      fetchApplications(selectedJobId)
    }
  }, [selectedJobId, fetchApplications])

  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedJobId), [jobs, selectedJobId])

  // Realtime in-place status update with visual highlight
  const updateStatusInPlace = useCallback(
    (appId: string, nextStatus: ApplicationStatus, interviewAt?: string) => {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === appId
            ? {
                ...app,
                status: nextStatus,
                ...(interviewAt !== undefined ? { interview_at: interviewAt } : {}),
              }
            : app
        )
      )
      setRecentlyUpdatedId(appId)
      setTimeout(() => setRecentlyUpdatedId(null), 1400)
    },
    []
  )

  // Direct status action handler
  const handlePerformStatusChange = async (
    app: ScoredApplication,
    nextStatus: ApplicationStatus,
    interviewAt?: string
  ) => {
    setActionLoading(true)
    try {
      await applicationsApi.updateStatus(app.id, nextStatus, accessToken, interviewAt)
      updateStatusInPlace(app.id, nextStatus, interviewAt)
      setConfirmAction(null)
      setInterviewModalApp(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setActionLoading(false)
    }
  }

  // Bulk actions handler
  const handlePerformBulk = async (type: 'shortlist' | 'reject', ids: string[]) => {
    setActionLoading(true)
    const targetStatus: ApplicationStatus = type === 'shortlist' ? 'shortlisted' : 'rejected'
    try {
      await Promise.all(
        ids.map((id) => applicationsApi.updateStatus(id, targetStatus, accessToken))
      )
      ids.forEach((id) => updateStatusInPlace(id, targetStatus))
      setCompareIds(new Set())
      setConfirmAction(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete bulk status update')
    } finally {
      setActionLoading(false)
    }
  }

  // Selection toggle
  const toggleSelect = (appId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(appId)) {
        next.delete(appId)
      } else {
        if (next.size < 4) {
          next.add(appId)
        }
      }
      return next
    })
  }

  // Applications grouped by stage
  const groupedApps = useMemo(() => {
    const map: Record<PipelineStage | 'closed', ScoredApplication[]> = {
      applied: [],
      shortlisted: [],
      interview: [],
      hired: [],
      closed: [],
    }
    applications.forEach((app) => {
      if (app.status === 'rejected' || app.status === 'withdrawn') {
        map.closed.push(app)
      } else if (app.status in map) {
        map[app.status as PipelineStage].push(app)
      }
    })
    return map
  }, [applications])

  const totalClosed = groupedApps.closed.length
  const activeApplicantCount = applications.length - totalClosed

  // Selected applicant for drawer
  const drawerApp = useMemo(
    () => applications.find((a) => a.id === drawerAppId) ?? null,
    [applications, drawerAppId]
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Applicants"
        description="Review, compare, and move candidates through the hiring pipeline"
        action={
          jobs.length > 0 ? (
            <div className="flex items-center gap-3">
              <label htmlFor="job-selector" className="text-12 font-medium text-muted shrink-0">
                Job:
              </label>
              <select
                id="job-selector"
                value={selectedJobId}
                onChange={(e) => {
                  const newId = e.target.value
                  setSelectedJobId(newId)
                  setSearchParams({ job_id: newId })
                }}
                className="select py-1.5 px-3 text-13 font-semibold rounded-sm border-line bg-surface max-w-xs"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} {j.openings ? `(${pluralize(j.openings, 'opening')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      {/* Top summary single-line */}
      {!loadingJobs && jobs.length > 0 && selectedJob && (
        <div className="flex flex-wrap items-center justify-between gap-4 py-2 px-3 bg-surface border border-line rounded-sm text-12 text-muted tnum">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-ink font-semibold">
              {applications.length} {applications.length === 1 ? 'applicant' : 'applicants'}
            </span>
            <span>{activeApplicantCount} in active pipeline</span>
            <span>{groupedApps.hired.length} hired</span>
            {selectedJob.openings && (
              <span>{pluralize(selectedJob.openings, 'opening')}</span>
            )}
            {applications.length > 0 && (
              <span>
                Avg match:{' '}
                <strong className="text-ink">
                  {Math.round(
                    applications.reduce((acc, a) => acc + (a.match_score ?? 0), 0) /
                      applications.length
                  )}
                </strong>
              </span>
            )}
          </div>

          {/* Desktop Board / Table view switcher */}
          <div className="hidden md:flex items-center gap-1 border border-line rounded-sm p-0.5 bg-paper">
            <button
              type="button"
              onClick={() => handleSetViewMode('board')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-12 font-medium transition-colors ${
                viewMode === 'board'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
              aria-label="Board view"
            >
              <LayoutGrid size={13} />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-12 font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
              aria-label="Table view"
            >
              <List size={13} />
              <span>Table</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-sm flex items-center justify-between gap-3 text-status-error text-13">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (selectedJobId) {
                fetchApplications(selectedJobId)
              } else {
                fetchJobs()
              }
            }}
            className="btn-secondary text-12 py-1 px-2.5 inline-flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw size={12} />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {(loadingJobs || loadingApps) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 space-y-3 bg-surface">
              <div className="skeleton h-5 w-24" />
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State: No published jobs */}
      {!loadingJobs && !loadingApps && jobs.length === 0 && (
        <div className="card p-12 text-center bg-surface space-y-3">
          <Film className="mx-auto text-muted" size={36} />
          <h2 className="text-18 font-bold text-ink">No published jobs yet</h2>
          <p className="text-14 text-muted max-w-md mx-auto">
            Publish a role to start receiving matched talent applications.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/jobs/create')}
              className="btn-primary text-13"
            >
              Post a job
            </button>
          </div>
        </div>
      )}

      {/* Empty State: No applicants for current job */}
      {!loadingJobs && !loadingApps && jobs.length > 0 && applications.length === 0 && (
        <div className="card p-12 text-center bg-surface space-y-3">
          <Sparkles className="mx-auto text-muted" size={36} />
          <h2 className="text-18 font-bold text-ink">No applicants yet for this job</h2>
          <p className="text-14 text-muted max-w-md mx-auto">
            Candidates who apply to this role will appear here ranked by their match score.
          </p>
        </div>
      )}

      {/* Mobile Stage Tabs (< md) */}
      {!loadingApps && applications.length > 0 && (
        <div className="md:hidden relative">
          <div className="flex overflow-x-auto gap-1.5 border-b border-line pb-1.5 scrollbar-none pr-8">
            {ACTIVE_STAGES.map((stg) => {
              const count = groupedApps[stg.id].length
              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => setMobileTab(stg.id)}
                  className={`px-3 py-1.5 rounded-sm text-12 font-medium whitespace-nowrap transition-colors shrink-0 ${
                    mobileTab === stg.id
                      ? 'bg-ink text-surface font-semibold'
                      : 'bg-paper text-muted hover:text-ink'
                  }`}
                >
                  {stg.label} ({count})
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setMobileTab('closed')}
              className={`px-3 py-1.5 rounded-sm text-12 font-medium whitespace-nowrap transition-colors shrink-0 ${
                mobileTab === 'closed'
                  ? 'bg-ink text-surface font-semibold'
                  : 'bg-paper text-muted hover:text-ink'
              }`}
            >
              Closed ({totalClosed})
            </button>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-surface to-transparent" />
        </div>
      )}

      {/* Desktop Board View (md+) */}
      {!loadingApps && applications.length > 0 && viewMode === 'board' && (
        <div className="hidden md:block space-y-4">
          <div className="grid grid-cols-4 gap-3.5 items-start">
            {ACTIVE_STAGES.map((stage) => {
              const stageList = groupedApps[stage.id]
              return (
                <div
                  key={stage.id}
                  className="bg-paper/70 border border-line rounded-sm p-2.5 flex flex-col gap-2 min-h-[380px]"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
                    <span className="text-13 font-bold text-ink tracking-tight">
                      {stage.label}
                    </span>
                    <span className="text-11 font-semibold text-muted bg-surface px-2 py-0.5 rounded-[2px] border border-line/80 tnum">
                      {stageList.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {stageList.map((app, idx) => (
                      <ApplicantCard
                        key={app.id}
                        app={app}
                        rank={idx + 1}
                        isSelected={compareIds.has(app.id)}
                        isHighlighted={recentlyUpdatedId === app.id}
                        onToggleSelect={() => toggleSelect(app.id)}
                        onOpenDrawer={() => setDrawerAppId(app.id)}
                        onStatusAction={(targetStatus) => {
                          if (targetStatus === 'interview') {
                            setInterviewModalApp(app)
                          } else if (targetStatus === 'hired') {
                            setConfirmAction({ type: 'hire', app })
                          } else if (targetStatus === 'rejected') {
                            setConfirmAction({ type: 'reject', app })
                          } else {
                            handlePerformStatusChange(app, targetStatus)
                          }
                        }}
                      />
                    ))}

                    {stageList.length === 0 && (
                      <div className="p-6 text-center text-12 text-muted italic">
                        No candidates in this stage
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Collapsible Closed Group */}
          <div className="border border-line rounded-sm bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => setIsClosedExpanded(!isClosedExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-13 font-semibold text-ink bg-paper/50 hover:bg-paper transition-colors"
              aria-expanded={isClosedExpanded}
            >
              <div className="flex items-center gap-2">
                <span>Closed ({totalClosed})</span>
                <span className="text-12 text-muted font-normal">
                  Rejected and withdrawn candidates
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-muted transition-transform duration-200 ${
                  isClosedExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isClosedExpanded && (
              <div className="p-3 border-t border-line grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedApps.closed.map((app, idx) => (
                  <ApplicantCard
                    key={app.id}
                    app={app}
                    rank={idx + 1}
                    isSelected={compareIds.has(app.id)}
                    isHighlighted={recentlyUpdatedId === app.id}
                    onToggleSelect={() => toggleSelect(app.id)}
                    onOpenDrawer={() => setDrawerAppId(app.id)}
                    onStatusAction={(targetStatus) => {
                      if (targetStatus === 'interview') {
                        setInterviewModalApp(app)
                      } else if (targetStatus === 'hired') {
                        setConfirmAction({ type: 'hire', app })
                      } else if (targetStatus === 'rejected') {
                        setConfirmAction({ type: 'reject', app })
                      } else {
                        handlePerformStatusChange(app, targetStatus)
                      }
                    }}
                  />
                ))}
                {totalClosed === 0 && (
                  <p className="col-span-full text-center text-12 text-muted py-4">
                    No closed candidates
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Table View (md+) */}
      {!loadingApps && applications.length > 0 && viewMode === 'table' && (
        <div className="hidden md:block space-y-4">
          <div className="border border-line rounded-sm bg-surface overflow-hidden shadow-subtle">
            <table className="w-full text-left text-13">
              <thead className="bg-paper border-b border-line text-12 font-semibold text-muted select-none">
                <tr>
                  <th className="py-2.5 pl-3 pr-2 w-8">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-2.5 px-3">Applicant</th>
                  <th className="py-2.5 px-3">Role & Experience</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3 w-40">Match score</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {applications.map((app) => {
                  const talent = app.talent_profiles || ({} as any)
                  const isHighlighted = recentlyUpdatedId === app.id
                  return (
                    <tr
                      key={app.id}
                      onClick={(e) => {
                        // avoid triggering drawer if clicking checkbox or action button
                        if ((e.target as HTMLElement).closest('button, input, select, a')) return
                        setDrawerAppId(app.id)
                      }}
                      className={`hover:bg-paper/40 cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-tungsten/15 ring-1 ring-tungsten' : ''
                      }`}
                    >
                      <td className="py-3 pl-3 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={compareIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          aria-label={`Select ${talent.full_name || 'applicant'}`}
                          className="w-4 h-4 rounded-sm accent-ink cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={talent.avatar_url}
                            fallback={talent.full_name || 'Talent'}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-14 text-ink truncate">
                              {talent.full_name || 'Anonymous Talent'}
                            </p>
                            {app.cover_note && (
                              <p className="text-11 text-muted truncate max-w-xs">
                                &ldquo;{app.cover_note}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <DepartmentMark department={talent.role || 'Production'} size="sm" />
                          <div className="flex items-center gap-1.5 text-11 text-muted tnum">
                            <span>{talent.experience_years ? `${talent.experience_years}y exp` : 'Entry level'}</span>
                            {talent.availability && (
                              <span className="text-muted/80">
                                ({AVAILABILITY_LABELS[talent.availability] || talent.availability})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-12 text-muted">{talent.location || '—'}</td>

                      <td className="py-3 px-3">
                        <div className="w-36">
                          <LightMeter
                            score={app.match_score ?? 0}
                            size="sm"
                            expandable={false}
                            showScoreLabel={true}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <Badge
                          variant={STAGE_BADGE_VARIANTS[app.status]?.variant || 'neutral'}
                          size="sm"
                        >
                          {STAGE_BADGE_VARIANTS[app.status]?.label || app.status}
                        </Badge>
                      </td>

                      <td className="py-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <ApplicantActionMenu
                          currentStatus={app.status}
                          onAction={(targetStatus) => {
                            if (targetStatus === 'interview') {
                              setInterviewModalApp(app)
                            } else if (targetStatus === 'hired') {
                              setConfirmAction({ type: 'hire', app })
                            } else if (targetStatus === 'rejected') {
                              setConfirmAction({ type: 'reject', app })
                            } else {
                              handlePerformStatusChange(app, targetStatus)
                            }
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile Tabbed View (< md) */}
      {!loadingApps && applications.length > 0 && (
        <div className="md:hidden space-y-3">
          {groupedApps[mobileTab].map((app, idx) => (
            <ApplicantCard
              key={app.id}
              app={app}
              rank={idx + 1}
              isSelected={compareIds.has(app.id)}
              isHighlighted={recentlyUpdatedId === app.id}
              onToggleSelect={() => toggleSelect(app.id)}
              onOpenDrawer={() => setDrawerAppId(app.id)}
              onStatusAction={(targetStatus) => {
                if (targetStatus === 'interview') {
                  setInterviewModalApp(app)
                } else if (targetStatus === 'hired') {
                  setConfirmAction({ type: 'hire', app })
                } else if (targetStatus === 'rejected') {
                  setConfirmAction({ type: 'reject', app })
                } else {
                  handlePerformStatusChange(app, targetStatus)
                }
              }}
            />
          ))}
          {groupedApps[mobileTab].length === 0 && (
            <div className="card p-8 text-center text-12 text-muted italic bg-surface">
              No candidates in this stage
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk & Compare Action Bar */}
      {compareIds.size > 0 && (
        <div
          data-testid="selection-bar"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 bg-ink text-paper rounded-sm shadow-floating px-4 py-2.5 flex items-center gap-3 border border-line/30 animate-in fade-in-50 duration-150"
        >
          <span className="text-12 font-semibold">
            {compareIds.size} {compareIds.size === 1 ? 'applicant' : 'applicants'} selected
          </span>

          {compareIds.size >= 2 && compareIds.size <= 4 && (
            <button
              type="button"
              onClick={() => setShowCompare(true)}
              className="btn-primary text-12 py-1 px-3"
            >
              Compare candidates
            </button>
          )}

          <div className="h-4 w-px bg-line/30 mx-0.5" />

          {/* Bulk actions */}
          <button
            type="button"
            onClick={() =>
              setConfirmAction({
                type: 'bulk_shortlist',
                targetIds: Array.from(compareIds),
              })
            }
            className="text-12 text-paper hover:text-tungsten font-medium transition-colors"
          >
            Shortlist
          </button>

          <button
            type="button"
            onClick={() =>
              setConfirmAction({
                type: 'bulk_reject',
                targetIds: Array.from(compareIds),
              })
            }
            className="text-12 text-status-error hover:underline font-medium transition-colors"
          >
            Reject
          </button>

          <button
            type="button"
            onClick={() => setCompareIds(new Set())}
            className="text-12 text-muted hover:text-paper ml-1 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Candidate Comparison Sheet */}
      {showCompare && compareIds.size >= 2 && (
        <CandidateComparisonSheet
          apps={applications.filter((a) => compareIds.has(a.id))}
          isOpen={showCompare}
          onClose={() => setShowCompare(false)}
          onStatusAction={(app, targetStatus) => {
            if (targetStatus === 'interview') {
              setInterviewModalApp(app)
            } else if (targetStatus === 'hired') {
              setConfirmAction({ type: 'hire', app })
            } else if (targetStatus === 'rejected') {
              setConfirmAction({ type: 'reject', app })
            } else {
              handlePerformStatusChange(app, targetStatus)
            }
          }}
        />
      )}

      {/* Applicant Detail Drawer */}
      {drawerApp && (
        <ApplicantDetailDrawer
          app={drawerApp}
          token={accessToken}
          isOpen={Boolean(drawerApp)}
          onClose={() => setDrawerAppId(null)}
          onStatusAction={(targetStatus) => {
            if (targetStatus === 'interview') {
              setInterviewModalApp(drawerApp)
            } else if (targetStatus === 'hired') {
              setConfirmAction({ type: 'hire', app: drawerApp })
            } else if (targetStatus === 'rejected') {
              setConfirmAction({ type: 'reject', app: drawerApp })
            } else {
              handlePerformStatusChange(drawerApp, targetStatus)
            }
          }}
        />
      )}

      {/* Confirm Action Modal (Hire, Reject, Bulk) */}
      {confirmAction && (
        <Modal
          open={Boolean(confirmAction)}
          onOpenChange={(open) => !open && setConfirmAction(null)}
        >
          <ModalContent
            title={
              confirmAction.type === 'hire'
                ? 'Confirm hire'
                : confirmAction.type === 'reject'
                ? 'Reject applicant'
                : confirmAction.type === 'bulk_shortlist'
                ? 'Shortlist selected applicants'
                : 'Reject selected applicants'
            }
            description={
              confirmAction.type === 'hire'
                ? `Are you sure you want to hire ${
                    confirmAction.app?.talent_profiles?.full_name || 'this applicant'
                  }? Others will be told the role is filled when all openings are hired.`
                : confirmAction.type === 'reject'
                ? `Are you sure you want to reject ${
                    confirmAction.app?.talent_profiles?.full_name || 'this applicant'
                  }? They will be moved to the closed pipeline.`
                : confirmAction.type === 'bulk_shortlist'
                ? `Move ${confirmAction.targetIds?.length} selected candidates to shortlisted?`
                : `Move ${confirmAction.targetIds?.length} selected candidates to rejected? They will be placed in the closed pipeline.`
            }
          >
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="btn-secondary text-13"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction.type === 'hire' && confirmAction.app) {
                    handlePerformStatusChange(confirmAction.app, 'hired')
                  } else if (confirmAction.type === 'reject' && confirmAction.app) {
                    handlePerformStatusChange(confirmAction.app, 'rejected')
                  } else if (confirmAction.type === 'bulk_shortlist' && confirmAction.targetIds) {
                    handlePerformBulk('shortlist', confirmAction.targetIds)
                  } else if (confirmAction.type === 'bulk_reject' && confirmAction.targetIds) {
                    handlePerformBulk('reject', confirmAction.targetIds)
                  }
                }}
                disabled={actionLoading}
                className={
                  confirmAction.type === 'hire' || confirmAction.type === 'bulk_shortlist'
                    ? 'btn-primary text-13'
                    : 'btn-secondary text-status-error border-status-error/40 text-13 hover:bg-status-error/10'
                }
              >
                {actionLoading
                  ? 'Updating...'
                  : confirmAction.type === 'hire'
                  ? 'Confirm hire'
                  : confirmAction.type === 'reject'
                  ? 'Reject applicant'
                  : 'Confirm update'}
              </button>
            </div>
          </ModalContent>
        </Modal>
      )}

      {/* Schedule Interview Modal */}
      {interviewModalApp && (
        <Modal
          open={Boolean(interviewModalApp)}
          onOpenChange={(open) => !open && setInterviewModalApp(null)}
        >
          <ModalContent
            title="Schedule interview"
            description={`Select interview date and time for ${
              interviewModalApp.talent_profiles?.full_name || 'the candidate'
            }.`}
          >
            <div className="space-y-4 pt-1">
              <div>
                <label
                  htmlFor="interview-datetime"
                  className="text-12 font-medium text-muted block mb-1.5"
                >
                  Interview date & time (optional)
                </label>
                <input
                  id="interview-datetime"
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="input text-13"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setInterviewModalApp(null)}
                  className="btn-secondary text-13"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePerformStatusChange(
                      interviewModalApp,
                      'interview',
                      interviewDate ? new Date(interviewDate).toISOString() : undefined
                    )
                  }
                  disabled={actionLoading}
                  className="btn-primary text-13"
                >
                  {actionLoading ? 'Saving...' : 'Move to interview'}
                </button>
              </div>
            </div>
          </ModalContent>
        </Modal>
      )}
    </div>
  )
}

// ── Applicant Card (Board / Mobile item) ───────────────────────

interface ApplicantCardProps {
  app: ScoredApplication
  rank: number
  isSelected: boolean
  isHighlighted: boolean
  onToggleSelect: () => void
  onOpenDrawer: () => void
  onStatusAction: (status: ApplicationStatus) => void
}

function ApplicantCard({
  app,
  rank,
  isSelected,
  isHighlighted,
  onToggleSelect,
  onOpenDrawer,
  onStatusAction,
}: ApplicantCardProps) {
  const talent = app.talent_profiles || ({} as any)
  const topReasons = (app.summary_reasons && app.summary_reasons.length > 0)
    ? app.summary_reasons.slice(0, 2)
    : []

  return (
    <div
      onClick={onOpenDrawer}
      className={`card p-3.5 bg-surface hover:border-ink cursor-pointer transition-all duration-150 flex flex-col gap-2.5 relative ${
        isHighlighted ? 'bg-tungsten/15 ring-2 ring-tungsten' : ''
      }`}
    >
      {/* Header Row: Checkbox, Rank, Avatar, Name & Role */}
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select ${talent.full_name || 'applicant'}`}
            className="w-3.5 h-3.5 rounded-sm accent-ink cursor-pointer"
          />
        </div>

        <span className="text-11 font-bold text-muted tnum shrink-0 pt-0.5">#{rank}</span>

        <Avatar src={talent.avatar_url} fallback={talent.full_name || 'Talent'} size="md" />

        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-15 text-ink leading-tight">
            {talent.full_name || 'Anonymous Talent'}
          </h3>

          <div className="mt-1 flex items-center justify-between gap-1">
            <DepartmentMark department={talent.role || 'Production'} size="sm" />
            <Badge
              variant={STAGE_BADGE_VARIANTS[app.status]?.variant || 'neutral'}
              size="sm"
              className="shrink-0"
            >
              {STAGE_BADGE_VARIANTS[app.status]?.label || app.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Meta tags: level and city as separate muted elements (no bullets) */}
      <div className="flex flex-wrap items-center gap-1.5 text-11 text-muted tnum">
        <span className="bg-paper px-1.5 py-0.5 rounded-[2px] border border-line/60">
          {talent.experience_years ? `${talent.experience_years}y exp` : 'Entry level'}
        </span>
        {talent.location && (
          <span className="bg-paper px-1.5 py-0.5 rounded-[2px] border border-line/60">
            {talent.location}
          </span>
        )}
        {talent.availability && (
          <span className="bg-paper px-1.5 py-0.5 rounded-[2px] border border-line/60">
            {AVAILABILITY_LABELS[talent.availability] || talent.availability}
          </span>
        )}
      </div>

      {/* LightMeter Preview */}
      <div className="pt-1 border-t border-line/60">
        <LightMeter
          score={app.match_score ?? 0}
          size="sm"
          expandable={false}
          showScoreLabel={true}
        />
      </div>

      {/* Top reasons: wrap up to two lines without truncation ellipsis, tooltip with full text */}
      {topReasons.length > 0 && (
        <ul className="text-11 text-muted space-y-1 leading-snug">
          {topReasons.map((reason, i) => (
            <li key={i} title={reason} className="line-clamp-2 break-words">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {/* Cover note one-line preview */}
      {app.cover_note && (
        <p className="text-11 text-muted italic line-clamp-1 bg-paper/60 px-2 py-1 rounded-[2px] border border-line/50">
          &ldquo;{app.cover_note}&rdquo;
        </p>
      )}

      {/* Interview scheduled callout if set */}
      {app.interview_at && (
        <div className="flex items-center gap-1.5 text-11 text-status-warning bg-status-warning/10 border border-status-warning/20 px-2 py-1 rounded-[2px]">
          <Calendar size={12} />
          <span>
            {new Date(app.interview_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      {/* Action Footer */}
      <div
        className="pt-2 border-t border-line/60 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-11 text-muted tnum">
          {new Date(app.applied_at || app.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>

        <ApplicantActionMenu currentStatus={app.status} onAction={onStatusAction} />
      </div>
    </div>
  )
}

// ── Applicant Action Menu ──────────────────────────────────────

interface ActionMenuProps {
  currentStatus: ApplicationStatus
  onAction: (status: ApplicationStatus) => void
}

function ApplicantActionMenu({ currentStatus, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('keydown', handleKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (currentStatus === 'withdrawn') {
    return <span className="text-11 text-muted italic">Withdrawn</span>
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-secondary text-12 py-1 px-2.5 inline-flex items-center gap-1"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span>Actions</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full sm:bottom-auto sm:top-full mt-1 mb-1 z-30 w-44 rounded-sm bg-surface border border-line shadow-floating py-1 text-12 focus:outline-none"
        >
          {currentStatus !== 'shortlisted' && currentStatus !== 'hired' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onAction('shortlisted')
              }}
              className="w-full text-left px-3 py-1.5 text-ink hover:bg-paper transition-colors flex items-center gap-2"
            >
              <CheckCircle2 size={13} className="text-tungsten" />
              <span>Shortlist</span>
            </button>
          )}

          {currentStatus !== 'interview' && currentStatus !== 'hired' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onAction('interview')
              }}
              className="w-full text-left px-3 py-1.5 text-ink hover:bg-paper transition-colors flex items-center gap-2"
            >
              <Calendar size={13} className="text-status-warning" />
              <span>Move to interview</span>
            </button>
          )}

          {currentStatus !== 'hired' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onAction('hired')
              }}
              className="w-full text-left px-3 py-1.5 text-ink hover:bg-paper transition-colors flex items-center gap-2"
            >
              <UserCheck size={13} className="text-status-success" />
              <span>Hire</span>
            </button>
          )}

          {currentStatus !== 'rejected' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onAction('rejected')
              }}
              className="w-full text-left px-3 py-1.5 text-status-error hover:bg-paper transition-colors flex items-center gap-2"
            >
              <UserX size={13} />
              <span>Reject</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Applicant Detail Drawer ────────────────────────────────────

interface DrawerProps {
  app: ScoredApplication
  token: string
  isOpen: boolean
  onClose: () => void
  onStatusAction: (status: ApplicationStatus) => void
}

function ApplicantDetailDrawer({ app, token, isOpen, onClose, onStatusAction }: DrawerProps) {
  const navigate = useNavigate()
  const talent = app.talent_profiles || ({} as any)
  const [breakdown, setBreakdown] = useState<MatchBreakdown | null>(null)
  const [_loadingBreakdown, setLoadingBreakdown] = useState(false)

  // Full talent details for credits & resume
  const [credits, setCredits] = useState<TalentCredit[]>([])
  const [resumeSignedUrl, setResumeSignedUrl] = useState<string | null>(null)
  const [loadingResume, setLoadingResume] = useState(false)

  useEffect(() => {
    if (!app.id || !token) return
    setLoadingBreakdown(true)
    applicationsApi
      .matchBreakdown(app.id, token)
      .then(setBreakdown)
      .catch(() => {})
      .finally(() => setLoadingBreakdown(false))

    // Fetch talent profile to load credits and showreel
    if (talent.id) {
      talentApi
        .getProfile(talent.id, token)
        .then((res) => {
          if (res?.profile?.credits) setCredits(res.profile.credits)
        })
        .catch(() => {})

      // Try signed resume url
      setLoadingResume(true)
      talentApi
        .getResumeSignedUrl(talent.id, token)
        .then((res) => setResumeSignedUrl(res.signed_url))
        .catch(() => setResumeSignedUrl(null))
        .finally(() => setLoadingResume(false))
    }
  }, [app.id, talent.id, token])

  // Stepper steps
  const stepperIdx = ACTIVE_STAGES.findIndex((s) => s.id === app.status)
  const isEndState = app.status === 'rejected' || app.status === 'withdrawn'

  const signals = useMemo(() => {
    return toLightMeterSignals(app.score_breakdown, breakdown?.reasons || app.reasons)
  }, [app.score_breakdown, breakdown?.reasons, app.reasons])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto space-y-6"
        title="Applicant details"
      >
        {/* Header: Candidate Info */}
        <div className="flex items-start gap-4 pb-4 border-b border-line">
          <Avatar src={talent.avatar_url} fallback={talent.full_name || 'Talent'} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-18 font-bold text-ink leading-tight">
                {talent.full_name || 'Anonymous Talent'}
              </h2>
              <Badge variant={STAGE_BADGE_VARIANTS[app.status]?.variant || 'neutral'} size="sm">
                {STAGE_BADGE_VARIANTS[app.status]?.label || app.status}
              </Badge>
            </div>

            <div className="mt-1 flex items-center gap-3">
              <DepartmentMark department={talent.role || 'Production'} size="sm" />
              <span className="text-12 text-muted tnum">
                {talent.experience_years ? `${talent.experience_years} years experience` : 'Entry level'}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-12 text-muted">
              {talent.location && <span>{talent.location}</span>}
              {talent.availability && (
                <span>{AVAILABILITY_LABELS[talent.availability] || talent.availability}</span>
              )}
            </div>
          </div>
        </div>

        {/* Stepper (Drawer only; only active pipeline stages) */}
        {!isEndState ? (
          <div className="p-3 bg-paper rounded-sm border border-line">
            <span className="text-11 font-semibold text-muted block mb-2">Hiring pipeline</span>
            <div className="flex items-center justify-between">
              {ACTIVE_STAGES.map((stg, i) => {
                const isPassed = stepperIdx >= i
                const isCurrent = stepperIdx === i
                return (
                  <div key={stg.id} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-11 font-bold transition-colors ${
                          isCurrent
                            ? 'bg-tungsten text-ink ring-2 ring-tungsten/40'
                            : isPassed
                            ? 'bg-ink text-surface'
                            : 'bg-surface border border-line text-muted'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <span
                        className={`text-11 mt-1 font-medium ${
                          isCurrent ? 'text-ink font-semibold' : 'text-muted'
                        }`}
                      >
                        {stg.label}
                      </span>
                    </div>
                    {i < ACTIVE_STAGES.length - 1 && (
                      <div
                        className={`h-0.5 w-full -mt-4 transition-colors ${
                          stepperIdx > i ? 'bg-ink' : 'bg-line'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-paper rounded-sm border border-line text-12 text-muted">
            Status: <strong className="text-ink">{STAGE_BADGE_VARIANTS[app.status]?.label}</strong>
          </div>
        )}

        {/* Action Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-3 border-b border-line">
          <button
            type="button"
            onClick={() => navigate(`/chat?peer=${talent.user_id}`)}
            className="btn-primary text-13 inline-flex items-center gap-1.5"
          >
            <MessageCircle size={14} />
            <span>Send message</span>
          </button>

          {resumeSignedUrl ? (
            <a
              href={resumeSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-13 inline-flex items-center gap-1.5"
            >
              <FileText size={14} />
              <span>View resume</span>
              <ExternalLink size={12} />
            </a>
          ) : loadingResume ? (
            <span className="text-12 text-muted">Checking resume...</span>
          ) : (
            <span className="text-12 text-muted italic">No resume attached</span>
          )}

          {talent.showreel_url && (
            <a
              href={talent.showreel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-13 inline-flex items-center gap-1.5"
            >
              <Video size={14} />
              <span>Showreel</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Full Match Breakdown with LightMeter */}
        <div className="space-y-3">
          <h3 className="text-14 font-bold text-ink">Match evaluation</h3>
          <div className="p-4 border border-line rounded-sm bg-surface space-y-4">
            <LightMeter
              score={app.match_score ?? 0}
              breakdown={signals}
              size="md"
              expandable={true}
              defaultExpanded={true}
              showScoreLabel={true}
            />

            {/* Skills evaluation */}
            <div className="pt-2 border-t border-line space-y-2">
              <span className="text-12 font-semibold text-ink block">Skills breakdown</span>
              <div className="space-y-1.5">
                <div>
                  <span className="text-11 text-muted block mb-1">Matching skills:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(app.matching_skills || []).map((s) => (
                      <Badge key={s} variant="tungsten" size="sm">
                        {s}
                      </Badge>
                    ))}
                    {(!app.matching_skills || app.matching_skills.length === 0) && (
                      <span className="text-11 text-muted italic">None</span>
                    )}
                  </div>
                </div>

                {app.missing_skills && app.missing_skills.length > 0 && (
                  <div className="pt-1">
                    <span className="text-11 text-status-error block mb-1">Missing required skills:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {app.missing_skills.map((s) => (
                        <Badge key={s} variant="error" size="sm">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Score summary reasons */}
                {app.summary_reasons && app.summary_reasons.length > 0 && (
                  <div className="pt-2 border-t border-line space-y-1.5">
                    <span className="text-12 font-semibold text-ink block">Score summary</span>
                    <ul className="text-12 text-muted space-y-1">
                      {app.summary_reasons.map((reason, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cover Note (shown once, in full) */}
        {app.cover_note && (
          <div className="space-y-2">
            <h3 className="text-14 font-bold text-ink">Cover note</h3>
            <div className="p-3.5 bg-paper rounded-sm border border-line text-13 text-ink leading-relaxed whitespace-pre-wrap">
              {app.cover_note}
            </div>
          </div>
        )}

        {/* Credits History */}
        {credits.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-14 font-bold text-ink">Credits & past productions</h3>
            <div className="border border-line rounded-sm divide-y divide-line overflow-hidden bg-surface">
              {credits.map((cr, idx) => (
                <div key={idx} className="p-3 text-12 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{cr.project_title}</span>
                    {cr.year && <span className="text-muted tnum">{cr.year}</span>}
                  </div>
                  <p className="text-muted">{cr.role}</p>
                  {cr.production_company && (
                    <p className="text-11 text-muted italic">{cr.production_company}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Action Buttons at bottom of drawer */}
        <div className="pt-4 border-t border-line flex flex-wrap gap-2">
          {app.status !== 'shortlisted' && app.status !== 'hired' && (
            <button
              type="button"
              onClick={() => onStatusAction('shortlisted')}
              className="btn-secondary text-13"
            >
              Shortlist
            </button>
          )}

          {app.status !== 'interview' && app.status !== 'hired' && (
            <button
              type="button"
              onClick={() => onStatusAction('interview')}
              className="btn-secondary text-13"
            >
              Move to interview
            </button>
          )}

          {app.status !== 'hired' && (
            <button
              type="button"
              onClick={() => onStatusAction('hired')}
              className="btn-primary text-13"
            >
              Hire
            </button>
          )}

          {app.status !== 'rejected' && (
            <button
              type="button"
              onClick={() => onStatusAction('rejected')}
              className="btn-ghost text-status-error text-13 ml-auto hover:bg-status-error/10"
            >
              Reject
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Candidate Comparison Sheet ─────────────────────────────────

interface CompareSheetProps {
  apps: ScoredApplication[]
  isOpen: boolean
  onClose: () => void
  onStatusAction: (app: ScoredApplication, status: ApplicationStatus) => void
}

function CandidateComparisonSheet({ apps, isOpen, onClose, onStatusAction }: CompareSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl md:max-w-4xl overflow-y-auto space-y-5"
        title="Candidate comparison"
        description="Side-by-side evaluation on the same exposure scale"
      >
        <div className="overflow-x-auto pb-4">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="py-3 px-3 text-12 font-semibold text-muted w-36">Candidate</th>
                {apps.map((a) => {
                  const talent = a.talent_profiles || ({} as any)
                  return (
                    <th key={a.id} className="py-3 px-3 min-w-[170px] text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <Avatar
                          src={talent.avatar_url}
                          fallback={talent.full_name || 'Talent'}
                          size="lg"
                        />
                        <span className="font-semibold text-13 text-ink truncate max-w-[140px]">
                          {talent.full_name || 'Talent'}
                        </span>
                        <DepartmentMark department={talent.role || 'Production'} size="sm" />
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-line text-12">
              {/* Overall Match score on identical scale */}
              <tr className="bg-paper/40">
                <td className="py-3 px-3 font-semibold text-ink">Match score</td>
                {apps.map((a) => (
                  <td key={a.id} className="py-3 px-3">
                    <LightMeter
                      score={a.match_score ?? 0}
                      size="sm"
                      expandable={false}
                      showScoreLabel={true}
                    />
                  </td>
                ))}
              </tr>

              {/* Signals breakdown rows */}
              {SIGNALS_META.map((meta) => (
                <tr key={meta.key} className="hover:bg-paper/30">
                  <td className="py-2.5 px-3 font-medium text-muted">
                    {meta.label}{' '}
                    <span className="text-11 opacity-80 tnum">({meta.weight} pts)</span>
                  </td>
                  {apps.map((a) => {
                    const raw =
                      a.score_breakdown?.[meta.key as keyof typeof a.score_breakdown] ?? 0
                    const earned =
                      raw > meta.weight ? Math.round((raw * meta.weight) / 100) : raw
                    const percent = meta.weight > 0 ? Math.round((earned / meta.weight) * 100) : 0
                    return (
                      <td key={a.id} className="py-2.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-ink tnum">
                            {earned} / {meta.weight}
                          </span>
                          <div className="w-24 h-1.5 bg-paper rounded-[1px] border border-line/60 overflow-hidden">
                            <div
                              className="h-full bg-tungsten"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Matching Skills */}
              <tr className="hover:bg-paper/30">
                <td className="py-2.5 px-3 font-medium text-muted">Matching skills</td>
                {apps.map((a) => (
                  <td key={a.id} className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {(a.matching_skills || []).map((s) => (
                        <Badge key={s} variant="tungsten" size="sm">
                          {s}
                        </Badge>
                      ))}
                      {(!a.matching_skills || a.matching_skills.length === 0) && (
                        <span className="text-muted italic">None</span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Missing Skills */}
              <tr className="hover:bg-paper/30">
                <td className="py-2.5 px-3 font-medium text-status-error">Missing skills</td>
                {apps.map((a) => (
                  <td key={a.id} className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {(a.missing_skills || []).map((s) => (
                        <Badge key={s} variant="error" size="sm">
                          {s}
                        </Badge>
                      ))}
                      {(!a.missing_skills || a.missing_skills.length === 0) && (
                        <span className="text-status-success text-11">None missing</span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Experience & Availability */}
              <tr className="hover:bg-paper/30">
                <td className="py-2.5 px-3 font-medium text-muted">Experience & availability</td>
                {apps.map((a) => {
                  const talent = a.talent_profiles || ({} as any)
                  return (
                    <td key={a.id} className="py-2.5 px-3 text-center tnum">
                      <p className="font-semibold text-ink">
                        {talent.experience_years ? `${talent.experience_years} years` : 'Entry'}
                      </p>
                      <p className="text-11 text-muted">
                        {AVAILABILITY_LABELS[talent.availability] || talent.availability || 'Available'}
                      </p>
                    </td>
                  )
                })}
              </tr>

              {/* Portfolio & Showreel */}
              <tr className="hover:bg-paper/30">
                <td className="py-2.5 px-3 font-medium text-muted">Media links</td>
                {apps.map((a) => {
                  const talent = a.talent_profiles || ({} as any)
                  return (
                    <td key={a.id} className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-1 text-11">
                        {talent.showreel_url ? (
                          <a
                            href={talent.showreel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tungsten hover:underline font-medium"
                          >
                            Showreel video
                          </a>
                        ) : (
                          <span className="text-muted">No showreel</span>
                        )}
                        {talent.portfolio_url ? (
                          <a
                            href={talent.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted hover:text-ink hover:underline"
                          >
                            Portfolio site
                          </a>
                        ) : null}
                      </div>
                    </td>
                  )
                })}
              </tr>

              {/* Actions row */}
              <tr className="border-t-2 border-line bg-paper/50">
                <td className="py-3 px-3 font-semibold text-ink">Actions</td>
                {apps.map((a) => (
                  <td key={a.id} className="py-3 px-3 text-center">
                    <ApplicantActionMenu
                      currentStatus={a.status}
                      onAction={(status) => onStatusAction(a, status)}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default Applications
