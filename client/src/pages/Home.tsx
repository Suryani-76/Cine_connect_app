import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Film, Users, Star, Bell, ChevronRight, Briefcase } from 'lucide-react'
import { jobsApi, applicationsApi, dashboardApi, Job, DashboardStats, MyApplication, ApplicationStatus } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { supabase } from '../lib/supabase'

// ── Stat card ─────────────────────────────────────────────────

function StatCard({ label, value, icon, sublabel, accent, to, loading }: {
  label: string; value: number | string; icon: React.ReactNode
  sublabel: string; accent: string; to?: string; loading: boolean
}) {
  const inner = (
    <div className={`card p-5 relative overflow-hidden group transition-all duration-150
      ${to ? 'hover:shadow-card-hover hover:-translate-y-px cursor-pointer' : ''}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${accent} rounded-t-xl`} />
      <div className="flex items-start justify-between gap-3 mt-1">
        <div>
          <p className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-1">{label}</p>
          {loading
            ? <div className="skeleton h-8 w-14 mt-1" />
            : <p className="mono-text text-3xl font-bold text-content-heading tabular-nums">{value}</p>
          }
          <p className="text-xs text-content-tertiary mt-1">{sublabel}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-surface-section flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      {to && !loading && (
        <p className="mt-3 text-xs text-brand font-semibold group-hover:text-brand-dark transition-colors">
          View all →
        </p>
      )}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ── Status badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft:     'bg-amber-50  text-amber-700  border-amber-200',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed:    'bg-slate-100  text-slate-500  border-slate-200',
  }
  return (
    <span className={`badge ${styles[status] ?? styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Job card ──────────────────────────────────────────────────

function JobCard({ job, onClose }: { job: Job; onClose?: (id: string) => void }) {
  const req   = job.job_requirements
  const pills = [...(req?.roles?.slice(0, 2) ?? []), ...(req?.skills?.slice(0, 2) ?? [])]
  const meta  = [req?.location, req?.experience_level, req?.language].filter(Boolean) as string[]

  return (
    <div className="card-hover p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-content-heading leading-snug">{job.title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={job.status} />
          {onClose && job.status !== 'closed' && (
            <button onClick={() => onClose(job.id)}
              className="text-xs text-content-tertiary hover:text-red-500 transition-colors
                px-2 py-0.5 rounded border border-surface-border hover:border-red-200">
              Close
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-content-secondary line-clamp-2 mb-4">{job.description}</p>
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {pills.map(p => (
            <span key={p} className="badge bg-surface-section border-surface-border text-content-secondary">
              {p}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-surface-border">
        <div className="flex items-center gap-3 text-xs text-content-tertiary">
          {meta.map(m => <span key={m} className="flex items-center gap-1">· {m}</span>)}
        </div>
        <span className="mono-text text-xs text-content-muted">
          {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

// ── Filter tabs ───────────────────────────────────────────────

type Filter = 'all' | 'draft' | 'published' | 'closed'

function FilterTabs({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  const tabs: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Drafts' },
    { value: 'closed', label: 'Closed' },
  ]
  return (
    <div className="flex gap-1 bg-surface-section border border-surface-border p-1 rounded-lg w-fit">
      {tabs.map(t => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${active === t.value
              ? 'bg-white text-brand shadow-sm border border-surface-border'
              : 'text-content-secondary hover:text-content-primary'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────

function EmptyJobs({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-surface-section rounded-xl border border-dashed border-surface-subtle">
      <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
        <Film size={24} className="text-brand" />
      </div>
      <p className="font-bold text-content-heading mb-1">No job posts yet</p>
      <p className="text-sm text-content-tertiary mb-6 max-w-xs">Post your first job to start finding the right talent for your production.</p>
      <button onClick={onCreateClick} className="btn-primary">Create your first job</button>
    </div>
  )
}

// ── Production dashboard ──────────────────────────────────────

const ProductionHome = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const accessToken  = token ?? undefined
  const productionId = user?.profileId ?? ''
  const userId       = user?.id ?? ''
  usePageTitle('Home')

  const [jobs, setJobs]                   = useState<Job[]>([])
  const [stats, setStats]                 = useState<DashboardStats | null>(null)
  const [filter, setFilter]               = useState<Filter>('all')
  const [loadingJobs, setLoadingJobs]     = useState(true)
  const [loadingStats, setLoadingStats]   = useState(true)
  const [jobsError, setJobsError]         = useState('')

  const handleClose = async (jobId: string) => {
    if (!token) return
    try {
      await jobsApi.close(jobId, token)
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'closed' as const } : j))
    } catch {}
  }

  useEffect(() => {
    if (!productionId) { setLoadingJobs(false); return }
    jobsApi.list({ production_id: productionId }, accessToken)
      .then(r => setJobs(r.jobs))
      .catch(e => setJobsError(e instanceof Error ? e.message : 'Failed to load jobs'))
      .finally(() => setLoadingJobs(false))
  }, [productionId, token])

  useEffect(() => {
    if (!token) { setLoadingStats(false); return }
    dashboardApi.stats(token)
      .then(r => setStats(r.stats))
      .catch(() => {})
      .finally(() => setLoadingStats(false))
  }, [productionId, userId, token])

  const displayed = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)
  const counts = {
    all: jobs.length,
    published: jobs.filter(j => j.status === 'published').length,
    draft: jobs.filter(j => j.status === 'draft').length,
    closed: jobs.filter(j => j.status === 'closed').length,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Production dashboard"
        description="Manage your job postings, track applicant pipelines, and review recommended talent."
        action={
          <button onClick={() => navigate('/jobs/create')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New job
          </button>
        }
      />

      <div className="space-y-8">
        {/* Overview */}
        <section>
          <h2 className="section-title mb-4">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Active Jobs"          value={stats?.active_jobs ?? counts.published}
              icon={<Film size={18} className="text-emerald-600" />}
              sublabel="Published & open"    accent="bg-emerald-500" to="/home"         loading={loadingStats && !stats} />
            <StatCard label="New Applications"     value={stats?.new_applications ?? 0}
              icon={<Users size={18} className="text-brand" />}
              sublabel="Last 7 days"          accent="bg-brand"      to="/applications" loading={loadingStats && !stats} />
            <StatCard label="Recommended Talent"   value={stats?.recommended_talent ?? 0}
              icon={<Star size={18} className="text-amber-500" />}
              sublabel="Match score ≥ 75%"    accent="bg-amber-400"  to="/applications" loading={loadingStats && !stats} />
            <StatCard label="Notifications"        value={stats?.unread_notifications ?? 0}
              icon={<Bell size={18} className="text-purple-500" />}
              sublabel="Unread"               accent="bg-purple-500"                   loading={loadingStats && !stats} />
          </div>
        </section>

        {/* My Jobs */}
        <section>
          <div className="mb-5">
            <h2 className="section-title">My Jobs</h2>
            <p className="text-sm text-content-tertiary mt-0.5">
              {counts.all === 0 ? 'No posts yet' : `${counts.all} total · ${counts.published} published · ${counts.draft} draft`}
            </p>
          </div>

          {counts.all > 0 && <div className="mb-5"><FilterTabs active={filter} onChange={setFilter} /></div>}

          {loadingJobs && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-5/6" />
                </div>
              ))}
            </div>
          )}

          {!loadingJobs && jobsError && (
            <div className="error-banner"><p className="text-sm text-red-600">{jobsError}</p></div>
          )}
          {!loadingJobs && !jobsError && counts.all === 0 && (
            <EmptyJobs onCreateClick={() => navigate('/jobs/create')} />
          )}
          {!loadingJobs && !jobsError && counts.all > 0 && displayed.length === 0 && (
            <p className="text-content-tertiary text-sm text-center py-10">No jobs in this category.</p>
          )}
          {!loadingJobs && !jobsError && displayed.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayed.map(job => <JobCard key={job.id} job={job} onClose={handleClose} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Application status badge ──────────────────────────────────

const APP_STATUS: Record<string, string> = {
  applied:     'bg-slate-100  text-slate-600   border-slate-200',
  shortlisted: 'bg-blue-50    text-blue-700    border-blue-200',
  interview:   'bg-amber-50   text-amber-700   border-amber-200',
  hired:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:    'bg-red-50     text-red-600     border-red-200',
  withdrawn:   'bg-zinc-100   text-zinc-500    border-zinc-200',
}

// ── Talent home ───────────────────────────────────────────────

function TalentHome() {
  const { user, token } = useAuth()
  const profileId       = user?.profileId ?? ''
  const accessToken     = token           ?? ''

  const [browseJobs, setBrowseJobs]   = useState<Job[]>([])
  const [myApps, setMyApps]           = useState<MyApplication[]>([])
  const [loadingBrowse, setLBrowse]   = useState(true)
  const [loadingApps, setLApps]       = useState(true)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  usePageTitle('Home')

  const handleWithdraw = async (e: React.MouseEvent, appId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Are you sure you want to withdraw your application?')) return
    setWithdrawingId(appId)
    try {
      await applicationsApi.withdraw(appId, accessToken)
      setMyApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'withdrawn' } : a))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw application')
    } finally {
      setWithdrawingId(null)
    }
  }

  // Load published jobs
  useEffect(() => {
    jobsApi.listPublished(accessToken || undefined)
      .then(r => setBrowseJobs(r.jobs))
      .catch(() => {})
      .finally(() => setLBrowse(false))
  }, [accessToken])

  // Load my applications
  useEffect(() => {
    if (!profileId || !accessToken) { setLApps(false); return }
    applicationsApi.myApplications(profileId, accessToken)
      .then(r => setMyApps(r.applications))
      .catch(() => {})
      .finally(() => setLApps(false))
  }, [profileId, accessToken])

  // Realtime: update application status live when production house changes it
  useEffect(() => {
    if (!profileId) return
    const channel = supabase
      .channel(`my-apps:${profileId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'applications',
        filter: `talent_profile_id=eq.${profileId}`,
      }, (payload) => {
        const updated = payload.new as { id: string; status: ApplicationStatus }
        setMyApps(prev => prev.map(a => a.id === updated.id ? { ...a, status: updated.status } : a))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Talent dashboard"
        description="Track your applications, saved opportunities, and matching film productions."
        action={
          <Link to="/jobs" className="btn-primary flex items-center gap-2">
            <Briefcase size={16} /> Browse jobs
          </Link>
        }
      />

      <div className="space-y-10">
        {/* ── My Applications ─────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">My Applications</h2>
              <p className="text-sm text-content-tertiary mt-0.5">
                {myApps.length === 0 ? 'Apply to jobs to track your progress' : `${myApps.length} application${myApps.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {loadingApps && (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="card p-4 space-y-2"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-1/3" /></div>)}
            </div>
          )}

          {!loadingApps && myApps.length === 0 && (
            <div className="card p-8 text-center border-dashed">
              <p className="text-2xl mb-2">📋</p>
              <p className="font-semibold text-content-heading mb-1">No applications yet</p>
              <p className="text-sm text-content-tertiary">Browse open jobs below and apply to get started.</p>
            </div>
          )}

          {!loadingApps && myApps.length > 0 && (
            <div className="space-y-3">
              {myApps.map(app => {
                const job  = app.jobs
                const prod = job.production_profiles
                const canWithdraw = ['applied', 'shortlisted', 'interview'].includes(app.status)
                return (
                  <Link key={app.id} to={`/jobs/${job.id}`}
                    className="card-hover p-4 flex items-center gap-4 group">
                    {/* Company initial */}
                    <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {prod.company_name[0]?.toUpperCase()}
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-content-heading truncate">{job.title}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-content-tertiary">{prod.company_name}</p>
                        {prod.verified && <VerifiedBadge />}
                      </div>
                    </div>

                    {/* Status + score + withdraw */}
                    <div className="flex items-center gap-3 shrink-0">
                      {app.match_score != null && (
                        <span className="mono-text text-xs font-bold text-brand bg-blue-50 border border-brand/20 px-2 py-0.5 rounded-full">
                          {Math.round(app.match_score)}%
                        </span>
                      )}
                      <span className={`badge text-xs ${APP_STATUS[app.status] ?? APP_STATUS.applied}`}>
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </span>
                      {canWithdraw && (
                        <button
                          type="button"
                          onClick={e => handleWithdraw(e, app.id)}
                          disabled={withdrawingId === app.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">
                          {withdrawingId === app.id ? '…' : 'Withdraw'}
                        </button>
                      )}
                      <ChevronRight size={14} className="text-content-muted group-hover:text-brand transition-colors" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Open Jobs (Featured Preview) ─────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Featured Opportunities</h2>
              <p className="text-xs text-content-tertiary mt-0.5">Top open roles across film productions</p>
            </div>
            <Link to="/jobs" className="text-sm font-semibold text-brand hover:underline flex items-center gap-1">
              Browse all jobs &rarr;
            </Link>
          </div>

          {loadingBrowse && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-full" />
                </div>
              ))}
            </div>
          )}

          {!loadingBrowse && browseJobs.length === 0 && (
            <p className="text-content-tertiary text-sm">No open jobs right now. Check back soon.</p>
          )}

          {!loadingBrowse && browseJobs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {browseJobs.slice(0, 4).map(job => {
                const req   = job.job_requirements
                const pills = [...(req?.roles?.slice(0,2) ?? []), ...(req?.skills?.slice(0,2) ?? [])]
                const meta  = [req?.location, req?.language].filter(Boolean) as string[]
                return (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="card-hover p-5 flex flex-col gap-3 group">
                    <div>
                      <h3 className="font-semibold text-content-heading leading-snug group-hover:text-brand transition-colors">
                        {job.title}
                      </h3>
                      <p className="text-sm text-content-secondary line-clamp-2 mt-1">{job.description}</p>
                    </div>

                    {pills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pills.map(p => (
                          <span key={p} className="badge bg-surface-section border-surface-border text-content-secondary">{p}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex gap-3 text-xs text-content-tertiary">
                        {meta.map(m => <span key={m}>· {m}</span>)}
                      </div>
                      <span className="text-xs text-brand font-semibold group-hover:text-brand-dark transition-colors flex items-center gap-0.5">
                        View & Apply <ChevronRight size={12} />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Role dispatch ─────────────────────────────────────────────

const Home = () => {
  const { user } = useAuth()
  if (user?.role === 'talent') return <TalentHome />
  return <ProductionHome />
}

export default Home
