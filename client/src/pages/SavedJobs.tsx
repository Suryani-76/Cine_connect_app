import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  Trash2,
  MapPin,
  Briefcase,
  RefreshCw,
  Building,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { savedJobsApi, SavedJobItem } from '../lib/api'
import { NotificationBell } from '../components/NotificationBell'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { PublicFooter } from '../components/PublicFooter'

const SavedJobs = () => {
  usePageTitle('Saved Jobs')
  const { user, token } = useAuth()
  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadSavedJobs = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    savedJobsApi
      .list(token)
      .then((res) => {
        setSavedJobs(res.saved || [])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load saved jobs')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  useEffect(() => {
    loadSavedJobs()
  }, [loadSavedJobs])

  const handleRemove = async (jobId: string) => {
    if (!token) return
    setRemovingId(jobId)
    try {
      await savedJobsApi.unsave(jobId, token)
      setSavedJobs((prev) => prev.filter((item) => item.job_id !== jobId))
      toast.success('Job removed from saved listings')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove job')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col justify-between">
      {/* App Header */}
      <header className="nav sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-surface-border">
        <div className="nav-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/home" className="brand-text text-xl font-bold text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/jobs" className="nav-link">
              Browse Jobs
            </Link>
            <Link to="/saved-jobs" className="nav-link text-brand font-semibold">
              Saved Jobs
            </Link>
            <Link to="/applications" className="nav-link">
              Applications
            </Link>
            <Link to="/profile" className="nav-link">
              Profile
            </Link>
            {user?.id && token && <NotificationBell userId={user.id} token={token} />}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-content-heading tracking-tight flex items-center gap-2.5">
              <Bookmark className="text-brand" size={26} />
              Saved Jobs
            </h1>
            <p className="text-sm text-content-secondary mt-1">
              Keep track of roles you want to prepare for and apply to.
            </p>
          </div>
          <Link to="/jobs" className="btn-secondary text-xs inline-flex items-center gap-1.5">
            Browse More <ArrowRight size={14} />
          </Link>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 space-y-3 bg-white border-surface-border">
                <div className="skeleton h-5 w-1/3" />
                <div className="skeleton h-4 w-1/4" />
                <div className="skeleton h-10 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card p-8 text-center space-y-3 bg-white border-red-200">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
            <button onClick={loadSavedJobs} className="btn-secondary text-xs inline-flex items-center gap-2">
              <RefreshCw size={13} /> Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && savedJobs.length === 0 && (
          <div className="card p-12 text-center space-y-4 bg-white border-dashed border-surface-border">
            <div className="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <Bookmark size={26} />
            </div>
            <h3 className="text-lg font-bold text-content-heading">No saved jobs yet</h3>
            <p className="text-sm text-content-secondary max-w-md mx-auto">
              You haven&apos;t bookmarked any jobs yet. When exploring listings, click the bookmark icon to save roles for quick review later.
            </p>
            <div className="pt-2">
              <Link to="/jobs" className="btn-primary text-sm inline-flex items-center gap-2">
                <Briefcase size={16} /> Explore Open Positions
              </Link>
            </div>
          </div>
        )}

        {/* Saved Jobs List */}
        {!loading && !error && savedJobs.length > 0 && (
          <div className="space-y-4">
            {savedJobs.map((item) => {
              const job = item.jobs
              if (!job) return null
              const req = job.job_requirements
              const company = job.production_profiles
              const skills = req?.skills?.slice(0, 4) ?? []

              return (
                <div
                  key={item.id || item.job_id}
                  className="card-hover p-5 bg-white border-surface-border flex flex-col sm:flex-row sm:items-start justify-between gap-4 group"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {company?.id ? (
                        <Link
                          to={`/company/${company.id}`}
                          className="text-xs font-semibold text-content-secondary hover:text-brand flex items-center gap-1"
                        >
                          <Building size={13} /> {company.company_name}
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold text-content-secondary flex items-center gap-1">
                          <Building size={13} /> {company?.company_name ?? 'Studio'}
                        </span>
                      )}
                      {company?.verified && <VerifiedBadge />}
                      <span className="text-content-muted text-xs">•</span>
                      <span className="text-xs text-content-tertiary capitalize">{job.job_type ?? 'Freelance'}</span>
                    </div>

                    <Link to={`/jobs/${job.id}`} className="block group-hover:text-brand transition-colors">
                      <h3 className="text-lg font-bold text-content-heading leading-snug">
                        {job.title}
                      </h3>
                    </Link>

                    <p className="text-xs text-content-secondary line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Metadata & Skills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-content-tertiary">
                      {req?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {req.location}
                        </span>
                      )}
                      {job.pay_min != null && job.pay_max != null && (
                        <span>
                          ₹{job.pay_min.toLocaleString()}–₹{job.pay_max.toLocaleString()} / {job.pay_period}
                        </span>
                      )}
                      {skills.map((s) => (
                        <span key={s} className="badge text-[11px] bg-surface-section border-surface-border">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-surface-border shrink-0">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1"
                    >
                      View Role <ExternalLink size={12} />
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleRemove(item.job_id)}
                      disabled={removingId === item.job_id}
                      className="text-xs text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      {removingId === item.job_id ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Removing…
                        </>
                      ) : (
                        <>
                          <Trash2 size={13} /> Remove
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  )
}

export default SavedJobs
