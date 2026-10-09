import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  RefreshCw,
  Film,
} from 'lucide-react'
import { productionApi, jobsApi, ProductionProfile, JobWithProduction } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { DepartmentMark, resolveDepartment } from '../components/ui/DepartmentMark'
import { formatLoadErrorMessage, formatJobType, formatPayRange, formatDate } from '../lib/formatters'

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

  const loadCompany = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await productionApi.getProfile(id, accessToken)
      const studio = res.profile
      setProfile(studio)

      // Fetch published jobs for this studio
      setJobsLoading(true)
      try {
        const jobsRes = await jobsApi.list(
          { production_id: studio.id, status: 'published' },
          accessToken
        )
        setJobs(jobsRes.jobs ?? [])
      } catch {
        // If jobs fail, don't crash the whole profile
        setJobs([])
      } finally {
        setJobsLoading(false)
      }
    } catch (err: unknown) {
      setError(formatLoadErrorMessage(err, "Couldn't load studio profile. Check your connection and try again."))
    } finally {
      setLoading(false)
    }
  }, [id, accessToken])

  useEffect(() => {
    loadCompany()
  }, [loadCompany])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-4 w-28 bg-paper rounded animate-pulse" />
        <div className="border border-line rounded-sm bg-surface p-6 sm:p-8 animate-pulse space-y-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-sm bg-paper shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="h-7 bg-paper rounded w-1/3" />
              <div className="h-4 bg-paper rounded w-1/4" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-4 bg-paper rounded" />
            <div className="h-4 bg-paper rounded w-5/6" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 py-16">
        <div className="border border-line rounded-sm p-8 max-w-md w-full text-center space-y-4 bg-surface shadow-subtle">
          <div className="w-12 h-12 rounded-full bg-status-error/10 text-status-error flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-20 font-bold text-ink">Studio not found</h2>
          <p className="text-14 text-muted">
            {error || 'The requested production company profile does not exist or has been removed.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={loadCompany}
              className="btn-primary text-13 inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Try again
            </button>
            <Link to="/jobs" className="btn-secondary text-13">
              Browse opportunities
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation */}
      <div>
        <Link
          to="/jobs"
          className="text-12 font-medium text-muted hover:text-ink transition-colors inline-flex items-center gap-1.5"
        >
          Back to all jobs
        </Link>
      </div>

      {/* Studio Header Card */}
      <div className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-6 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Logo / Monogram */}
          <div className="relative shrink-0">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt={profile.company_name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm object-cover border border-line bg-paper"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm bg-ink text-surface flex items-center justify-center text-28 font-bold select-none border border-line">
                {profile.company_name ? profile.company_name.charAt(0).toUpperCase() : 'P'}
              </div>
            )}
          </div>

          {/* Profile Overview */}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-24 sm:text-28 font-bold text-ink tracking-tight leading-tight">
                {profile.company_name}
              </h1>
              {profile.verified === true && <VerifiedBadge size={15} />}
            </div>

            {profile.users?.username && (
              <p className="text-13 text-muted">@{profile.users.username}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-12 text-muted pt-1">
              {profile.created_at && (
                <span className="inline-flex items-center gap-1.5 tnum">
                  <Calendar size={13} className="text-muted" />
                  Member since {new Date(profile.created_at).getFullYear()}
                </span>
              )}
              {profile.verified === true && (
                <span className="inline-flex items-center text-status-success bg-status-success/10 px-2 py-0.5 rounded-[2px] border border-status-success/20 font-medium">
                  Verified Production House
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio & Details */}
        {(profile.bio || profile.production_details) && (
          <div className="pt-6 border-t border-line space-y-5">
            {profile.bio && (
              <div>
                <h2 className="text-12 font-semibold text-muted mb-1.5">
                  About the studio
                </h2>
                <p className="reading-text prose-serif text-15 text-ink leading-relaxed whitespace-pre-line max-w-3xl">
                  {profile.bio}
                </p>
              </div>
            )}

            {profile.production_details && (
              <div>
                <h2 className="text-12 font-semibold text-muted mb-1.5">
                  Production details and portfolio
                </h2>
                <p className="text-13 text-muted leading-relaxed whitespace-pre-line max-w-3xl">
                  {profile.production_details}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Published Jobs Section */}
      <section aria-labelledby="studio-jobs-heading" className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div>
            <h2 id="studio-jobs-heading" className="text-18 font-bold text-ink">
              Open opportunities
            </h2>
            <p className="text-12 text-muted mt-0.5">
              Verified casting calls and crew postings from this production company
            </p>
          </div>
          <span className="text-12 font-semibold text-muted tnum">
            {jobs.length} published {jobs.length === 1 ? 'position' : 'positions'}
          </span>
        </div>

        {jobsLoading && (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="border border-line rounded-sm bg-surface p-5 animate-pulse space-y-3">
                <div className="h-5 bg-paper rounded w-1/3" />
                <div className="h-4 bg-paper rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!jobsLoading && jobs.length === 0 && (
          <div className="border border-dashed border-line rounded-sm p-12 text-center bg-surface space-y-3">
            <Film size={32} className="mx-auto text-muted opacity-60" />
            <h3 className="text-16 font-bold text-ink">No active job posts</h3>
            <p className="text-13 text-muted max-w-md mx-auto">
              {profile.company_name} does not have any open roles listed right now. Check back soon or browse other opportunities.
            </p>
            <div className="pt-2">
              <Link to="/jobs" className="btn-primary text-13">
                Browse all jobs
              </Link>
            </div>
          </div>
        )}

        {!jobsLoading && jobs.length > 0 && (
          <div className="border border-line rounded-sm bg-surface divide-y divide-line overflow-hidden shadow-subtle">
            {jobs.map((job) => {
              const primaryRole = job.job_requirements?.roles?.[0] || job.title
              const dept = resolveDepartment(primaryRole)

              return (
                <div
                  key={job.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-paper/30 transition-colors"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-16 font-bold text-ink hover:underline truncate"
                      >
                        {job.title}
                      </Link>
                      <DepartmentMark department={dept} size="sm" />
                      {job.job_type && (
                        <span className="px-2 py-0.5 rounded-[2px] text-11 font-medium bg-paper text-muted border border-line">
                          {formatJobType(job.job_type)}
                        </span>
                      )}
                    </div>

                    {job.description && (
                      <p className="text-13 text-muted line-clamp-2 leading-relaxed">
                        {job.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-12 text-muted pt-1">
                      {(job.pay_min !== null && job.pay_min !== undefined) && (
                        <span className="font-semibold text-ink tnum">
                          {formatPayRange({
                            pay_min: job.pay_min,
                            pay_max: job.pay_max,
                            pay_currency: job.pay_currency,
                            pay_period: job.pay_period,
                          })}
                        </span>
                      )}

                      {job.job_requirements?.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} className="text-muted shrink-0" />
                          <span>{job.job_requirements.location}</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 tnum">
                        <Clock size={12} className="text-muted shrink-0" />
                        <span>Posted {formatDate(job.created_at)}</span>
                      </span>
                    </div>

                    {job.job_requirements?.skills && job.job_requirements.skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {job.job_requirements.skills.slice(0, 5).map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-[2px] bg-paper text-muted border border-line/60 text-11"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.job_requirements.skills.length > 5 && (
                          <span className="text-11 text-muted">
                            +{job.job_requirements.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center md:self-center">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="btn-secondary text-13 px-4 py-1.5"
                    >
                      View role
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
