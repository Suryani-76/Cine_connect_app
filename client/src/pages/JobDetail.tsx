import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Globe, Briefcase, Clock, Building2, ExternalLink, X, Bookmark, BookmarkCheck } from 'lucide-react'
import { jobsApi, applicationsApi, savedJobsApi, jobAnalyticsApi, JobWithProduction } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

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
  const remaining = 1000 - coverNote.length

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

  const req  = job.job_requirements
  const prod = job.production_profiles
  const isClosed    = job.status === 'closed'
  const isPublished = job.status === 'published'

  const STATUS_STYLES: Record<string, string> = {
    draft:     'bg-amber-50  text-amber-700  border-amber-200',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed:    'bg-slate-100  text-slate-500  border-slate-200',
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
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold text-content-heading">{job.title}</h1>
                <span className={`badge ${STATUS_STYLES[job.status]}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
              </div>

              {/* Production house */}
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-content-tertiary shrink-0" />
                <span className="text-sm font-semibold text-brand">{prod.company_name}</span>
              </div>

              {/* Meta pills */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-content-secondary">
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
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-content-tertiary" />
                  Posted {new Date(job.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Apply + bookmark buttons */}
            {isTalent && isPublished && !applied && (
              <div className="flex items-center gap-2 shrink-0">
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
                <button
                  onClick={() => { if (!talentProfileId) { navigate('/create-profile'); return } setModal(true) }}
                  className="btn-primary text-base px-6 py-3">
                  Apply now
                </button>
              </div>
            )}
            {isTalent && isClosed && (
              <span className="text-sm text-content-tertiary italic">Applications closed</span>
            )}
            {applied && (
              <span className="badge bg-emerald-50 border-emerald-200 text-emerald-700 text-sm px-3 py-1.5">
                ✓ Applied
              </span>
            )}
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
              <p className="font-semibold text-content-heading">{prod.company_name}</p>
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
