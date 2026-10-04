import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Globe, Briefcase, Clock, Building2, ExternalLink, X, Bookmark, BookmarkCheck } from 'lucide-react'
import { jobsApi, applicationsApi, savedJobsApi, jobAnalyticsApi, JobWithProduction, MatchBreakdown } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { VerifiedBadge } from '../components/VerifiedBadge'

// ── Apply modal ───────────────────────────────────────────────

function ApplyModal({
  jobId,
  token,
  onClose,
  onSuccess,
}: {
  jobId:   string
  token:   string
  onClose: () => void
  onSuccess:        () => void
}) {
  const [coverNote, setCoverNote] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [matchPreview, setMatchPreview] = useState<MatchBreakdown | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const remaining = 1000 - coverNote.length

  useEffect(() => {
    if (!token || !jobId) return
    setMatchLoading(true)
    jobsApi.myMatch(jobId, token)
      .then(res => setMatchPreview(res))
      .catch(() => setMatchPreview(null))
      .finally(() => setMatchLoading(false))
  }, [jobId, token])

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await applicationsApi.apply(
        { job_id: jobId, cover_note: coverNote.trim() || undefined },
        token
      )
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setLoading(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(11,37,69,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="text-lg font-bold text-content-heading">Apply for this job</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-content-tertiary hover:text-content-primary hover:bg-surface-section transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Match Score Preview & Explainability */}
          {matchLoading ? (
            <div className="p-3 bg-surface-section rounded-xl border border-surface-border animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          ) : matchPreview ? (
            <div className="p-4 bg-blue-50/70 border border-brand/20 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="mono-text text-xl font-bold text-brand">{matchPreview.total}%</span>
                  <span className="text-xs font-semibold text-content-heading uppercase tracking-wide">Match Preview</span>
                </div>
                <span className="text-[11px] text-content-muted">Based on your talent profile</span>
              </div>

              {matchPreview.summary_reasons && matchPreview.summary_reasons.length > 0 && (
                <ul className="text-xs text-content-secondary space-y-1">
                  {matchPreview.summary_reasons.slice(0, 3).map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-brand shrink-0">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}

              {matchPreview.missing_skills && matchPreview.missing_skills.length > 0 && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                  Missing required skills: <span className="font-semibold">{matchPreview.missing_skills.join(', ')}</span>
                </p>
              )}
            </div>
          ) : null}

          <div>
            <div className="flex justify-between mb-1.5">
              <label className="label mb-0">Cover note <span className="text-content-muted font-normal">(optional)</span></label>
              <span className={`text-xs ${remaining < 100 ? 'text-amber-600' : 'text-content-muted'}`}>
                {remaining} left
              </span>
            </div>
            <textarea
              rows={5}
              value={coverNote}
              onChange={e => setCoverNote(e.target.value)}
              placeholder="Briefly introduce yourself and why you're a great fit for this role…"
              className="input resize-none"
              autoFocus
            />
          </div>

          {error && (
            <div className="error-banner">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-surface-border">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Success banner ────────────────────────────────────────────

function SuccessBanner({ onViewApplications }: { onViewApplications: () => void }) {
  return (
    <div className="success-banner flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-emerald-600 text-lg">✓</span>
        <p className="text-sm font-semibold text-emerald-700">Application submitted!</p>
      </div>
      <button onClick={onViewApplications}
        className="text-xs text-emerald-700 font-semibold hover:text-emerald-800 underline transition-colors">
        View my applications →
      </button>
    </div>
  )
}

// ── Skill / requirement pill ──────────────────────────────────

function Pill({ label }: { label: string }) {
  return (
    <span className="badge bg-blue-50 border-brand/25 text-brand text-xs font-medium">{label}</span>
  )
}

// ── Page ──────────────────────────────────────────────────────

const JobDetail = () => {
  const { id }        = useParams<{ id: string }>()
  const navigate      = useNavigate()
  const { user, token } = useAuth()

  const isTalent      = user?.role === 'talent'
  const talentProfileId = user?.profileId ?? ''

  const [job, setJob]           = useState<JobWithProduction | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [showModal, setModal]   = useState(false)
  const [applied, setApplied]   = useState(false)
  const [saved, setSaved]       = useState(false)

  usePageTitle(job?.title ?? 'Job')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    jobsApi.getById(id)
      .then(r => { setJob(r.job); jobAnalyticsApi.recordView(id).catch(() => {}) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load job'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="page">
        <header className="nav">
          <div className="nav-inner">
            <Link to="/home" className="brand-text text-xl text-brand-navy">Cine<span className="text-brand">Connect</span></Link>
          </div>
        </header>
        <main className="page-content max-w-3xl">
          <div className="card p-8 space-y-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-5 rounded w-full" />)}
          </div>
        </main>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="font-bold text-content-heading mb-1">Job not found</p>
          <p className="text-sm text-content-tertiary mb-5">{error || 'This job may have been removed.'}</p>
          <button onClick={() => navigate(-1)} className="btn-ghost">← Go back</button>
        </div>
      </div>
    )
  }

function getDeadlineStatus(deadline: string | null | undefined): { text: string; isPassed: boolean; isUrgent: boolean } | null {
  if (!deadline) return null
  const d = new Date(deadline)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs <= 0) {
    return { text: 'Deadline passed', isPassed: true, isUrgent: false }
  }
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays > 0) {
    const text = `${diffDays} day${diffDays > 1 ? 's' : ''} left (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
    return { text, isPassed: false, isUrgent: diffDays <= 3 }
  }
  return {
    text: `${diffHours} hour${diffHours !== 1 ? 's' : ''} left`,
    isPassed: false,
    isUrgent: true,
  }
}

  const req  = job.job_requirements
  const prod = job.production_profiles
  const isClosed    = job.status === 'closed'
  const isPublished = job.status === 'published'
  const deadlineInfo = getDeadlineStatus(job.deadline)
  const isDeadlinePassed = deadlineInfo?.isPassed ?? false
  const canApply = isTalent && isPublished && !isClosed && !isDeadlinePassed && !applied

  const STATUS_STYLES: Record<string, string> = {
    draft:     'bg-amber-50  text-amber-700  border-amber-200',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed:    'bg-slate-100  text-slate-500  border-slate-200',
  }

  const formatPay = () => {
    if (!job.pay_min && !job.pay_max) return null
    const curr = job.pay_currency === 'INR' ? '₹' : (job.pay_currency ?? '₹')
    const period = job.pay_period ? ` / ${job.pay_period}` : ''
    if (job.pay_min && job.pay_max) {
      return `${curr}${Number(job.pay_min).toLocaleString()} – ${curr}${Number(job.pay_max).toLocaleString()}${period}`
    }
    if (job.pay_min) return `From ${curr}${Number(job.pay_min).toLocaleString()}${period}`
    return `Up to ${curr}${Number(job.pay_max).toLocaleString()}${period}`
  }

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

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Back */}
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-content-secondary hover:text-brand transition-colors mb-6">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Applied success banner */}
        {applied && (
          <div className="mb-6">
            <SuccessBanner onViewApplications={() => navigate('/home')} />
          </div>
        )}

        {/* Job header card */}
        <div className="card p-7 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold text-content-heading">{job.title}</h1>
                <span className={`badge ${STATUS_STYLES[job.status]}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
                {job.job_type && (
                  <span className="badge bg-purple-50 text-purple-700 border-purple-200 capitalize">
                    {job.job_type.replace('_', ' ')}
                  </span>
                )}
                {job.openings && job.openings > 1 && (
                  <span className="badge bg-slate-50 text-slate-700 border-slate-200">
                    {job.openings} openings
                  </span>
                )}
              </div>

              {/* Production house */}
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-content-tertiary shrink-0" />
                <span className="text-sm font-semibold text-brand">{prod.company_name}</span>
                {prod.verified && <VerifiedBadge />}
              </div>

              {/* Meta pills */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-content-secondary">
                {formatPay() && (
                  <span className="flex items-center gap-1.5 font-medium text-content-primary">
                    💰 {formatPay()}
                  </span>
                )}
                {req?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-content-tertiary" /> {req.location}
                  </span>
                )}
                {req?.language && (
                  <span className="flex items-center gap-1.5">
                    <Globe size={14} className="text-content-tertiary" /> {req.language}
                  </span>
                )}
                {req?.experience_level && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase size={14} className="text-content-tertiary" />
                    {req.experience_level.charAt(0).toUpperCase() + req.experience_level.slice(1)} level
                  </span>
                )}
                {(job.start_date || job.end_date) && (
                  <span className="flex items-center gap-1.5">
                    🗓️ {job.start_date ? new Date(job.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                    {' – '}
                    {job.end_date ? new Date(job.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                  </span>
                )}
                {deadlineInfo && (
                  <span className={`flex items-center gap-1.5 font-medium ${
                    deadlineInfo.isPassed ? 'text-red-600' : deadlineInfo.isUrgent ? 'text-amber-600' : 'text-content-secondary'
                  }`}>
                    ⏳ {deadlineInfo.text}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-content-tertiary" />
                  Posted {new Date(job.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Apply + bookmark buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {isTalent && (
                <button
                  onClick={async () => {
                    if (!talentProfileId || !token) return
                    if (saved) {
                      await savedJobsApi.unsave(job.id, token).catch(() => {})
                      setSaved(false)
                    } else {
                      await savedJobsApi.save(job.id, token).catch(() => {})
                      setSaved(true)
                    }
                  }}
                  title={saved ? 'Remove bookmark' : 'Save job'}
                  className={`p-2.5 rounded-lg border transition-colors
                    ${saved ? 'border-brand bg-brand/5 text-brand' : 'border-surface-border text-content-tertiary hover:border-brand hover:text-brand'}`}>
                  {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                </button>
              )}

              {canApply && (
                <button
                  onClick={() => { if (!talentProfileId) { navigate('/create-profile'); return } setModal(true) }}
                  className="btn-primary text-base px-6 py-3">
                  Apply now
                </button>
              )}
              {isTalent && isClosed && (
                <span className="badge bg-slate-100 text-slate-600 border-slate-200 text-sm px-3 py-1.5">
                  Applications closed
                </span>
              )}
              {isTalent && isPublished && !isClosed && isDeadlinePassed && (
                <span className="badge bg-red-50 text-red-600 border-red-200 text-sm px-3 py-1.5">
                  Deadline passed
                </span>
              )}
              {applied && (
                <span className="badge bg-emerald-50 border-emerald-200 text-emerald-700 text-sm px-3 py-1.5">
                  ✓ Applied
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="card p-7 mb-5">
          <h2 className="text-base font-bold text-content-heading mb-4">About the role</h2>
          <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-wrap">{job.description}</p>
        </div>

        {/* Requirements */}
        {req && (req.skills.length > 0 || req.roles.length > 0) && (
          <div className="card p-7 mb-5">
            <h2 className="text-base font-bold text-content-heading mb-4">Requirements</h2>
            <div className="space-y-4">
              {req.roles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-2">Roles</p>
                  <div className="flex flex-wrap gap-2">{req.roles.map(r => <Pill key={r} label={r} />)}</div>
                </div>
              )}
              {req.skills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">{req.skills.map(s => <Pill key={s} label={s} />)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Production house */}
        <div className="card p-7">
          <h2 className="text-base font-bold text-content-heading mb-3">About the production house</h2>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white font-bold text-sm shrink-0">
              {prod.company_name[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-content-heading">{prod.company_name}</p>
                {prod.verified && <VerifiedBadge />}
              </div>
            </div>
          </div>
          {prod.bio && <p className="text-sm text-content-secondary leading-relaxed">{prod.bio}</p>}
          <Link to={`/profile/${prod.id}`}
            className="inline-flex items-center gap-1 mt-3 text-xs text-brand font-semibold hover:text-brand-dark transition-colors">
            View full profile <ExternalLink size={11} />
          </Link>
        </div>

        {/* Floating apply CTA for mobile */}
        {isTalent && isPublished && !applied && (
          <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-surface-border z-10">
            <button
              onClick={() => {
                if (!talentProfileId) { navigate('/create-profile'); return }
                setModal(true)
              }}
              className="btn-primary w-full py-3 text-base">
              Apply now
            </button>
          </div>
        )}
      </main>

      {/* Apply modal */}
      {showModal && token && (
        <ApplyModal
          jobId={job.id}
          token={token}
          onClose={() => setModal(false)}
          onSuccess={() => { setModal(false); setApplied(true) }}
        />
      )}
    </div>
  )
}

export default JobDetail
