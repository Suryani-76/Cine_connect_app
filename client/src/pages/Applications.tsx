import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import {
  applicationsApi, jobsApi,
  ScoredApplication, MatchBreakdown, Job,
  ApplicationStatus,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

// ── Pipeline config ───────────────────────────────────────────

const PIPELINE: { status: ApplicationStatus; label: string; dot: string; bar: string }[] = [
  { status: 'applied',     label: 'Applied',     dot: 'bg-slate-400',   bar: 'bg-slate-400' },
  { status: 'shortlisted', label: 'Shortlisted', dot: 'bg-brand',       bar: 'bg-brand' },
  { status: 'interview',   label: 'Interview',   dot: 'bg-amber-500',   bar: 'bg-amber-500' },
  { status: 'hired',       label: 'Hired',       dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  { status: 'rejected',    label: 'Rejected',    dot: 'bg-red-500',     bar: 'bg-red-500' },
]

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  applied:     'bg-slate-100   text-slate-600   border-slate-200',
  shortlisted: 'bg-blue-50     text-blue-700    border-blue-200',
  interview:   'bg-amber-50    text-amber-700   border-amber-200',
  hired:       'bg-emerald-50  text-emerald-700 border-emerald-200',
  rejected:    'bg-red-50      text-red-600     border-red-200',
}

const ACTION_BTNS: {
  status: ApplicationStatus; label: string; cls: string; hide?: ApplicationStatus[]
}[] = [
  { status: 'shortlisted', label: 'Shortlist',          cls: 'border-brand/40    text-brand     hover:bg-brand/5',    hide: ['shortlisted','hired'] },
  { status: 'interview',   label: 'Move to Interview',  cls: 'border-amber-400/50 text-amber-700 hover:bg-amber-50',  hide: ['interview','hired'] },
  { status: 'hired',       label: 'Mark Hired',         cls: 'border-emerald-400/50 text-emerald-700 hover:bg-emerald-50', hide: ['hired'] },
  { status: 'rejected',    label: 'Reject',             cls: 'border-red-300     text-red-500   hover:bg-red-50',     hide: ['rejected'] },
]

// ── Pipeline indicator ────────────────────────────────────────

function PipelineIndicator({ current }: { current: ApplicationStatus }) {
  const stages   = PIPELINE.filter(p => p.status !== 'rejected')
  const rejected = current === 'rejected'
  const idx      = stages.findIndex(s => s.status === current)

  return (
    <div className="flex items-center mt-3">
      {stages.map((s, i) => {
        const done   = !rejected && i <= idx
        const active = !rejected && i === idx
        return (
          <div key={s.status} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all
                ${done ? `${s.dot} border-transparent` : 'bg-white border-surface-subtle'}
                ${active ? 'ring-2 ring-offset-1 ring-offset-white ring-brand' : ''}`} />
              <span className={`text-[9px] font-medium leading-none
                ${done ? 'text-content-secondary' : 'text-content-muted'}`}>
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={`flex-1 h-px mb-3 mx-0.5 transition-colors
                ${!rejected && i < idx ? s.bar : 'bg-surface-border'}`} />
            )}
          </div>
        )
      })}
      {rejected && (
        <span className="ml-3 badge bg-red-50 text-red-600 border-red-200 text-[10px]">Rejected</span>
      )}
    </div>
  )
}

// ── Score badge ───────────────────────────────────────────────

function ScoreBadge({ score, onClick, active }: { score: number; onClick: () => void; active: boolean }) {
  const cls =
    score >= 75 ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
    score >= 50 ? 'border-brand/40    text-brand       bg-blue-50'    :
                  'border-surface-subtle text-content-secondary bg-surface-section'
  return (
    <button onClick={onClick} title="Click to see match breakdown"
      className={`mono-text inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold
        border transition-all cursor-pointer hover:shadow-btn-glow ${cls}
        ${active ? 'ring-2 ring-brand/30 ring-offset-1' : ''}`}>
      {score}<span className="text-xs font-normal opacity-60">%</span>
    </button>
  )
}

// ── Breakdown panel ───────────────────────────────────────────

function BreakdownPanel({ appId, token, inlineData }: {
  appId: string; token: string; inlineData: ScoredApplication['score_breakdown']
}) {
  const [full, setFull]       = useState<MatchBreakdown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    applicationsApi.matchBreakdown(appId, token)
      .then(setFull).catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [appId, token])

  const LABELS: Record<string, string> = {
    skills_match: 'Skills match', role_match: 'Role match', experience_match: 'Experience',
    language_match: 'Language', location_proximity: 'Location',
    profile_completeness: 'Profile completeness', activity_recency: 'Activity recency',
  }
  const WEIGHTS: Record<string, string> = {
    skills_match: '30%', role_match: '20%', experience_match: '15%',
    language_match: '10%', location_proximity: '10%', profile_completeness: '10%', activity_recency: '5%',
  }

  return (
    <div className="mt-4 pt-4 border-t border-surface-border space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">Match breakdown</p>
        {full && <p className="text-xs text-content-tertiary">Total: <span className="font-bold text-content-heading">{full.total}%</span></p>}
      </div>

      {loading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-5" />)}</div>}
      {error   && <p className="text-xs text-red-500">{error}</p>}

      {(Object.keys(inlineData) as (keyof typeof inlineData)[]).map(key => {
        const score   = full?.signals[key]?.score ?? inlineData[key]
        const contrib = full?.signals[key] ? `+${full.signals[key].weighted}` : ''
        const barCls  = score >= 75 ? 'bg-emerald-500' : score >= 40 ? 'bg-brand' : 'bg-surface-subtle'
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-content-secondary">{LABELS[key]} <span className="text-content-muted">({WEIGHTS[key]})</span></span>
              <span className="font-semibold text-content-heading">
                {score}{contrib && <span className="text-content-tertiary ml-1 font-normal">{contrib} pts</span>}
              </span>
            </div>
            <div className="h-1.5 bg-surface-section rounded-full">
              <div className={`${barCls} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
            </div>
          </div>
        )
      })}

      {full?.matching_skills && full.matching_skills.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-content-tertiary mb-1.5">Matching skills</p>
          <div className="flex flex-wrap gap-1.5">
            {full.matching_skills.map(s => (
              <span key={s} className="badge bg-blue-50 border-brand/30 text-brand text-xs">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Action buttons ────────────────────────────────────────────

function ActionButtons({ appId, current, token, onUpdated }: {
  appId: string; current: ApplicationStatus; token: string
  onUpdated: (id: string, status: ApplicationStatus) => void
}) {
  const [loading, setLoading] = useState<ApplicationStatus | null>(null)
  const [error, setError]     = useState('')

  const handle = async (status: ApplicationStatus) => {
    setError(''); setLoading(status)
    try { await applicationsApi.updateStatus(appId, status, token); onUpdated(appId, status) }
    catch (e) { setError(e instanceof Error ? e.message : 'Update failed') }
    finally { setLoading(null) }
  }

  const visible = ACTION_BTNS.filter(a => !a.hide?.includes(current))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {visible.map(a => (
          <button key={a.status} onClick={() => handle(a.status)} disabled={loading !== null}
            className={`text-xs px-3 py-1.5 rounded-btn border font-semibold transition-all
              disabled:opacity-40 disabled:cursor-not-allowed ${a.cls}`}>
            {loading === a.status ? '…' : a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Applicant card ────────────────────────────────────────────

function ApplicantCard({ app: init, rank, token, onStatusUpdated }: {
  app: ScoredApplication; rank: number; token: string
  onStatusUpdated: (id: string, status: ApplicationStatus) => void
}) {
  const [app, setApp]           = useState(init)
  const [showBreakdown, setBreakdown] = useState(false)
  useEffect(() => setApp(init), [init])

  const handleUpdated = useCallback((id: string, status: ApplicationStatus) => {
    setApp(prev => ({ ...prev, status })); onStatusUpdated(id, status)
  }, [onStatusUpdated])

  const talent   = app.talent_profiles
  const initials = (talent.full_name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const nonMatch = talent.skills.filter(s => !app.matching_skills.map(m => m.toLowerCase()).includes(s.toLowerCase()))

  return (
    <div className="card overflow-hidden hover:shadow-card-hover transition-all duration-150">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="shrink-0 w-6 h-6 rounded-full bg-surface-section border border-surface-border
            flex items-center justify-center text-[11px] font-bold text-content-tertiary mt-0.5">
            {rank}
          </div>

          {/* Avatar */}
          <div className="shrink-0">
            {talent.avatar_url
              ? <img src={talent.avatar_url} alt={talent.full_name ?? 'Talent avatar'}
                  loading="lazy" width={44} height={44}
                  className="w-11 h-11 rounded-full object-cover" />
              : <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-navy to-brand
                  flex items-center justify-center text-white font-bold text-sm">{initials}</div>
            }
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-content-heading leading-tight">
                {talent.full_name ?? 'Anonymous Talent'}
              </h3>
              <span className={`badge text-[11px] ${STATUS_BADGE[app.status]}`}>
                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
              </span>
            </div>
            {talent.role && <p className="text-sm text-brand mt-0.5">{talent.role}</p>}
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-content-tertiary">
              {talent.location        && <span>📍 {talent.location}</span>}
              {talent.experience_years > 0 && <span>{talent.experience_years}y exp</span>}
              {talent.language        && <span>🗣 {talent.language}</span>}
            </div>
            <PipelineIndicator current={app.status} />
          </div>

          {/* Score */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <ScoreBadge score={app.match_score} onClick={() => setBreakdown(v => !v)} active={showBreakdown} />
            <span className="text-[10px] text-content-muted">match</span>
          </div>
        </div>

        {/* Matching skills */}
        {app.matching_skills.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-content-tertiary mb-2">Matching skills</p>
            <div className="flex flex-wrap gap-1.5">
              {app.matching_skills.map(s => (
                <span key={s} className="badge bg-blue-50 border-brand/30 text-brand text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Other skills */}
        {nonMatch.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nonMatch.slice(0, 6).map(s => (
              <span key={s} className="badge bg-surface-section border-surface-border text-content-tertiary">{s}</span>
            ))}
            {nonMatch.length > 6 && <span className="text-xs text-content-muted self-center">+{nonMatch.length - 6}</span>}
          </div>
        )}

        {/* Bio */}
        {talent.bio && <p className="mt-3 text-sm text-content-secondary line-clamp-2">{talent.bio}</p>}

        {/* Cover note */}
        {app.cover_note && (
          <div className="mt-3 bg-surface-section rounded-lg px-3 py-2 border border-surface-border">
            <p className="text-xs text-content-tertiary mb-1">Cover note</p>
            <p className="text-sm text-content-primary line-clamp-2">{app.cover_note}</p>
          </div>
        )}

        {/* Breakdown toggle */}
        <button onClick={() => setBreakdown(v => !v)}
          className="mt-4 flex items-center gap-1 text-xs text-brand font-semibold hover:text-brand-dark transition-colors">
          {showBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Score breakdown
        </button>

        {showBreakdown && <BreakdownPanel appId={app.id} token={token} inlineData={app.score_breakdown} />}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-surface-border">
          <ActionButtons appId={app.id} current={app.status} token={token} onUpdated={handleUpdated} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex border-t border-surface-border bg-surface-section">
        {talent.portfolio_url && (
          <a href={talent.portfolio_url} target="_blank" rel="noopener noreferrer"
            className="flex-1 py-2.5 text-xs text-center text-brand hover:text-brand-dark
              flex items-center justify-center gap-1 transition-colors">
            Portfolio <ExternalLink size={10} />
          </a>
        )}
        <div className="flex-1 py-2.5 text-xs text-center text-content-muted">
          Applied {new Date(app.applied_at ?? app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

// ── Pipeline summary ──────────────────────────────────────────

function PipelineSummary({ applications }: { applications: ScoredApplication[] }) {
  const counts = PIPELINE.reduce((acc, p) => {
    acc[p.status] = applications.filter(a => a.status === p.status).length
    return acc
  }, {} as Record<ApplicationStatus, number>)

  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {PIPELINE.map(p => (
        <div key={p.status} className="card p-3 text-center">
          <p className="mono-text text-xl font-bold text-content-heading">{counts[p.status] ?? 0}</p>
          <p className="text-xs text-content-tertiary mt-0.5">{p.label}</p>
          <div className={`h-1 rounded-full mt-2 ${p.bar}`} />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

type FilterStatus = 'all' | ApplicationStatus

const Applications = () => {
  const [searchParams]  = useSearchParams()
  const jobId           = searchParams.get('job_id') ?? ''
  const { user, token } = useAuth()
  const accessToken     = token ?? ''
  const productionId    = user?.profileId ?? ''
  usePageTitle('Applications')

  const [jobs, setJobs]                   = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState(jobId)
  const [applications, setApplications]   = useState<ScoredApplication[]>([])
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>('all')
  const [loadingJobs, setLoadingJobs]     = useState(true)
  const [loadingApps, setLoadingApps]     = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    if (!productionId) { setLoadingJobs(false); return }
    jobsApi.list({ production_id: productionId, status: 'published' }, accessToken)
      .then(res => {
        setJobs(res.jobs)
        if (!selectedJobId && res.jobs.length > 0) setSelectedJobId(res.jobs[0].id)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load jobs'))
      .finally(() => setLoadingJobs(false))
  }, [productionId, token])

  useEffect(() => {
    if (!selectedJobId || !accessToken) return
    setLoadingApps(true); setError('')
    applicationsApi.forJob(selectedJobId, accessToken)
      .then(res => setApplications(res.applications))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load applications'))
      .finally(() => setLoadingApps(false))
  }, [selectedJobId, token])

  const handleStatusUpdated = useCallback((id: string, status: ApplicationStatus) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }, [])

  const displayed = filterStatus === 'all' ? applications : applications.filter(a => a.status === filterStatus)

  return (
    <div className="page">
      {/* Nav */}
      <header className="nav">
        <div className="nav-inner">
          <Link to="/home" className="brand-text text-xl text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/home"   className="nav-link">Home</Link>
            <Link to="/search" className="nav-link">Find Talent</Link>
          </nav>
        </div>
      </header>

      <main className="page-content">
        <div className="mb-8">
          <h1 className="section-title">Applications</h1>
          <p className="text-sm text-content-tertiary mt-1">
            Ranked by match score · click a score badge to see the full breakdown
          </p>
        </div>

        {/* Job selector */}
        {!loadingJobs && jobs.length > 0 && (
          <div className="mb-6">
            <label htmlFor="job-select" className="label">Select job</label>
            <select id="job-select" value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              className="input w-full max-w-sm">
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
        )}

        {/* Pipeline summary */}
        {applications.length > 0 && <PipelineSummary applications={applications} />}

        {/* Stats bar */}
        {applications.length > 0 && (
          <div className="flex items-center gap-6 mb-6 card px-5 py-4">
            <div>
              <p className="text-xs text-content-tertiary font-medium">Total applicants</p>
              <p className="mono-text text-2xl font-bold text-content-heading">{applications.length}</p>
            </div>
            <div className="h-8 w-px bg-surface-border" />
            <div>
              <p className="text-xs text-content-tertiary font-medium">Avg match score</p>
              <p className="mono-text text-2xl font-bold text-brand">
                {Math.round(applications.reduce((s, a) => s + a.match_score, 0) / applications.length)}%
              </p>
            </div>
            <div className="h-8 w-px bg-surface-border" />
            <div>
              <p className="text-xs text-content-tertiary font-medium">Top score</p>
              <p className="mono-text text-2xl font-bold text-emerald-600">{applications[0]?.match_score ?? 0}%</p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {applications.length > 0 && (
          <div className="flex gap-1 bg-surface-section border border-surface-border p-1 rounded-lg w-fit mb-6">
            {(['all', ...PIPELINE.map(p => p.status)] as FilterStatus[]).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${filterStatus === s
                    ? 'bg-white text-brand shadow-sm border border-surface-border'
                    : 'text-content-secondary hover:text-content-primary'}`}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && <div className="error-banner mb-6"><p className="text-sm text-red-600">{error}</p></div>}

        {/* Skeleton */}
        {(loadingJobs || loadingApps) && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="card p-5">
                <div className="flex gap-4">
                  <div className="skeleton w-11 h-11 rounded-full" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-3 w-1/4" />
                    <div className="skeleton h-2 w-2/3 mt-3" />
                  </div>
                  <div className="skeleton w-14 h-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty: no jobs */}
        {!loadingJobs && !loadingApps && !error && jobs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📋</p>
            <p className="font-bold text-content-heading mb-2">No published jobs yet</p>
            <p className="text-sm text-content-tertiary mb-6">Publish a job to start receiving applications.</p>
            <Link to="/jobs/create" className="btn-primary">Create a job</Link>
          </div>
        )}

        {/* Empty: no applications */}
        {!loadingApps && !error && selectedJobId && applications.length === 0 && !loadingJobs && jobs.length > 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🎬</p>
            <p className="font-bold text-content-heading mb-1">No applications yet</p>
            <p className="text-sm text-content-tertiary">Talent will appear here once they apply.</p>
          </div>
        )}

        {/* Empty filtered */}
        {!loadingApps && applications.length > 0 && displayed.length === 0 && (
          <p className="text-center text-content-tertiary text-sm py-10">No applicants in this stage.</p>
        )}

        {/* List */}
        {!loadingApps && displayed.length > 0 && (
          <div className="space-y-4">
            {displayed.map((app, i) => (
              <ApplicantCard key={app.id} app={app} rank={i + 1}
                token={accessToken} onStatusUpdated={handleStatusUpdated} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Applications
