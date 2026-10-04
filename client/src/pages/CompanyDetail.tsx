import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Building2, MapPin, Calendar, Clock, DollarSign,
  Briefcase, ArrowLeft, AlertCircle, ExternalLink, Sparkles
} from 'lucide-react'
import { productionApi, jobsApi, ProductionProfile, JobWithProduction } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { VerifiedBadge } from '../components/VerifiedBadge'

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const accessToken = token ?? undefined

  const [profile, setProfile] = useState<(ProductionProfile & { users?: { username: string; role?: string } }) | null>(null)
  const [jobs, setJobs] = useState<JobWithProduction[]>([])
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  usePageTitle(
    profile ? `${profile.company_name} | Studio Profile` : 'Studio Profile',
    profile?.bio || 'Explore production details and open job listings on CineConnect.'
  )

  useEffect(() => {
    if (!id) return
    let isMounted = true

    const loadCompany = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await productionApi.getProfile(id, accessToken)
        if (!isMounted) return
        const studio = res.profile
        setProfile(studio)

        // Fetch published jobs for this studio
        setJobsLoading(true)
        try {
          const jobsRes = await jobsApi.list(
            { production_id: studio.id, status: 'published' },
            accessToken
          )
          if (isMounted) {
            setJobs(jobsRes.jobs ?? [])
          }
        } catch {
          // If jobs fail, don't crash whole profile
          if (isMounted) setJobs([])
        } finally {
          if (isMounted) setJobsLoading(false)
        }
      } catch (err: unknown) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Studio not found')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadCompany()
    return () => {
      isMounted = false
    }
  }, [id, accessToken])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-section py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
          <div className="card p-8 border border-surface-border animate-pulse space-y-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-slate-200 shrink-0" />
              <div className="space-y-3 flex-1">
                <div className="h-6 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-100 rounded w-1/4" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-4 bg-slate-100 rounded" />
              <div className="h-4 bg-slate-100 rounded w-5/6" />
            </div>
          </div>
          <div className="space-y-4 pt-4">
            <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="card p-6 border border-surface-border animate-pulse h-32" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-surface-section px-4 py-16 flex items-center justify-center">
        <div className="card max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold text-content-heading">Studio Not Found</h2>
          <p className="text-sm text-content-secondary">
            {error || 'The requested production company profile does not exist or has been removed.'}
          </p>
          <div className="pt-2">
            <Link to="/jobs" className="btn-primary inline-flex items-center gap-2">
              <ArrowLeft size={16} /> Browse Opportunities
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-section py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation */}
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} /> Back to all jobs
        </Link>

        {/* Studio Header Card */}
        <div className="card p-6 sm:p-8 border border-surface-border">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Logo / Monogram */}
            <div className="relative shrink-0">
              {profile.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={profile.company_name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-surface-border shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-brand to-slate-900 text-white flex items-center justify-center text-3xl font-black shadow-sm">
                  {profile.company_name ? profile.company_name.charAt(0).toUpperCase() : 'C'}
                </div>
              )}
            </div>

            {/* Profile Overview */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-content-heading tracking-tight">
                  {profile.company_name}
                </h1>
                {profile.verified && <VerifiedBadge size={18} />}
              </div>

              {profile.users?.username && (
                <p className="text-sm text-content-muted">@{profile.users.username}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-content-secondary pt-1">
                {profile.created_at && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-content-muted" />
                    Member since {new Date(profile.created_at).getFullYear()}
                  </span>
                )}
                {profile.verified && (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                    Verified Production House
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bio & Details */}
          {(profile.bio || profile.production_details) && (
            <div className="mt-6 pt-6 border-t border-surface-border space-y-4">
              {profile.bio && (
                <div>
                  <h2 className="text-xs font-bold text-content-tertiary uppercase tracking-wider mb-1.5">
                    About the Studio
                  </h2>
                  <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-line">
                    {profile.bio}
                  </p>
                </div>
              )}

              {profile.production_details && (
                <div>
                  <h2 className="text-xs font-bold text-content-tertiary uppercase tracking-wider mb-1.5">
                    Production Details & Portfolio
                  </h2>
                  <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-line">
                    {profile.production_details}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Published Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={20} className="text-brand" />
              <h2 className="text-xl font-bold text-content-heading">Open Opportunities</h2>
            </div>
            <span className="text-xs font-medium text-content-secondary">
              {jobs.length} published {jobs.length === 1 ? 'position' : 'positions'}
            </span>
          </div>

          {jobsLoading && (
            <div className="space-y-4">
              {[1, 2].map(n => (
                <div key={n} className="card p-6 border border-surface-border animate-pulse space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/3" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!jobsLoading && jobs.length === 0 && (
            <div className="card p-10 text-center border-dashed border-2 border-surface-border space-y-2">
              <Building2 size={32} className="mx-auto text-content-muted opacity-50" />
              <h3 className="text-base font-bold text-content-heading">No active job posts</h3>
              <p className="text-xs text-content-secondary max-w-sm mx-auto">
                {profile.company_name} does not have any open roles listed right now. Check back soon or browse other opportunities.
              </p>
              <div className="pt-2">
                <Link to="/jobs" className="btn-primary text-xs inline-flex items-center gap-1.5">
                  Browse All Jobs
                </Link>
              </div>
            </div>
          )}

          {!jobsLoading && jobs.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {jobs.map(job => (
                <div
                  key={job.id}
                  className="card p-5 border border-surface-border hover:border-brand/30 hover:shadow-card-md transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="text-base font-bold text-content-heading hover:text-brand transition-colors"
                        >
                          {job.title}
                        </Link>
                        {job.job_type && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-brand border border-brand/20 capitalize">
                            {job.job_type.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-content-secondary line-clamp-2 leading-relaxed">
                        {job.description}
                      </p>

                      {/* Metadata tags */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-content-muted">
                        {(job.pay_min || job.pay_max) && (
                          <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            <DollarSign size={12} />
                            {job.pay_currency} {job.pay_min || '0'}
                            {job.pay_max ? ` – ${job.pay_max}` : ''} / {job.pay_period}
                          </span>
                        )}

                        {job.job_requirements?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {job.job_requirements.location}
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Posted {new Date(job.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </span>
                      </div>

                      {/* Required skills */}
                      {job.job_requirements?.skills && job.job_requirements.skills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                          {job.job_requirements.skills.slice(0, 4).map((skill, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]"
                            >
                              <Sparkles size={10} className="text-brand" /> {skill}
                            </span>
                          ))}
                          {job.job_requirements.skills.length > 4 && (
                            <span className="text-[10px] text-content-muted self-center">
                              +{job.job_requirements.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/jobs/${job.id}`}
                      className="btn-primary text-xs self-start sm:self-center shrink-0 flex items-center gap-1.5"
                    >
                      View Role <ExternalLink size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
