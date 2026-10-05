import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Briefcase,
  MapPin,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { jobsApi, savedJobsApi, JobWithProduction, JobType } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { VerifiedBadge } from '../components/VerifiedBadge'

const JOB_TYPES: { label: string; value: JobType | '' }[] = [
  { label: 'All Types', value: '' },
  { label: 'Freelance', value: 'freelance' },
  { label: 'Contract', value: 'contract' },
  { label: 'Full Time', value: 'full_time' },
  { label: 'Part Time', value: 'part_time' },
]

const EXP_LEVELS = [
  { label: 'All Experience', value: '' },
  { label: 'Entry Level', value: 'entry' },
  { label: 'Mid Level', value: 'mid' },
  { label: 'Senior', value: 'senior' },
]

const BrowseJobs = () => {
  usePageTitle(
    'Browse Open Film & Production Jobs',
    'Explore verified job postings in Indian cinema across cinematography, direction, editing, sound, and screenwriting.'
  )
  const { user, token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Query parameter bindings
  const qParam = searchParams.get('q') || ''
  const typeParam = (searchParams.get('type') as JobType) || ''
  const locParam = searchParams.get('location') || ''
  const expParam = searchParams.get('experience') || ''
  const sortParam = (searchParams.get('sort') as 'newest' | 'best_match') || 'newest'
  const pageParam = parseInt(searchParams.get('page') || '1', 10)

  // Local state
  const [jobs, setJobs] = useState<(JobWithProduction & { match_score?: number })[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  // Form input state (debounced search text)
  const [searchTerm, setSearchTerm] = useState(qParam)

  const limit = 12

  // Update query params helper
  const updateFilter = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '' || (k === 'page' && v === '1')) {
        nextParams.delete(k)
      } else {
        nextParams.set(k, v)
      }
    })
    setSearchParams(nextParams)
  }

  // Load saved jobs if authenticated as talent
  useEffect(() => {
    if (!token || user?.role !== 'talent') return
    savedJobsApi
      .list(token)
      .then((res) => {
        const ids = new Set((res.saved || []).map((s) => s.job_id))
        setSavedJobIds(ids)
      })
      .catch(() => {})
  }, [token, user?.role])

  // Load jobs from API with server-side filters
  const fetchJobs = useCallback(() => {
    setLoading(true)
    setError(null)

    const offset = (pageParam - 1) * limit

    jobsApi
      .list(
        {
          q: qParam || undefined,
          job_type: typeParam ? (typeParam as JobType) : undefined,
          location: locParam || undefined,
          experience_level: expParam || undefined,
          sort: sortParam,
          limit,
          offset,
        },
        token ?? undefined
      )
      .then((res) => {
        setJobs(res.jobs)
        setTotal(res.total ?? res.jobs.length)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [qParam, typeParam, locParam, expParam, sortParam, pageParam, token])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter({ q: searchTerm.trim(), page: '1' })
  }

  const handleToggleSave = async (e: React.MouseEvent, jobId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!token) {
      toast.error('Please sign in to save jobs')
      return
    }
    if (user?.role !== 'talent') {
      toast.error('Only talent profiles can save jobs')
      return
    }

    setSavingId(jobId)
    const isSaved = savedJobIds.has(jobId)

    try {
      if (isSaved) {
        await savedJobsApi.unsave(jobId, token)
        setSavedJobIds((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
        toast.success('Job removed from saved listings')
      } else {
        await savedJobsApi.save(jobId, token)
        setSavedJobIds((prev) => {
          const next = new Set(prev)
          next.add(jobId)
          return next
        })
        toast.success('Job saved to your bookmarks')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update saved job')
    } finally {
      setSavingId(null)
    }
  }

  const clearAllFilters = () => {
    setSearchTerm('')
    setSearchParams(new URLSearchParams())
  }

  const totalPages = Math.ceil(total / limit)
  const hasActiveFilters = Boolean(qParam || typeParam || locParam || expParam || sortParam !== 'newest')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Explore Film Opportunities"
        description="Find verified postings from production houses and studios across India."
        action={
          user?.role === 'production' ? (
            <Link to="/jobs/create" className="btn-primary text-sm inline-flex items-center gap-2">
              <Briefcase size={16} /> Post a New Role
            </Link>
          ) : undefined
        }
      />

        {/* Search & Filter Controls */}
        <div className="card p-5 space-y-4 border-surface-border bg-white shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-tertiary" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by role, title, keywords (e.g. Cinematographer, DaVinci, Gaffer)..."
                className="input pl-10 pr-4 text-sm w-full"
              />
            </div>
            <button type="submit" className="btn-primary text-sm px-5">
              Search
            </button>
          </form>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-surface-border text-xs">
            {/* Job Type Selector */}
            <select
              value={typeParam}
              onChange={(e) => updateFilter({ type: e.target.value, page: '1' })}
              className="select py-1.5 px-3 text-xs rounded-lg border-surface-border bg-surface-section"
            >
              {JOB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Experience Level Selector */}
            <select
              value={expParam}
              onChange={(e) => updateFilter({ experience: e.target.value, page: '1' })}
              className="select py-1.5 px-3 text-xs rounded-lg border-surface-border bg-surface-section"
            >
              {EXP_LEVELS.map((exp) => (
                <option key={exp.value} value={exp.value}>
                  {exp.label}
                </option>
              ))}
            </select>

            {/* Location Input Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by city..."
                value={locParam}
                onChange={(e) => updateFilter({ location: e.target.value, page: '1' })}
                className="input py-1.5 pl-7 pr-3 text-xs rounded-lg w-36"
              />
              <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            </div>

            {/* Sort Selector */}
            <select
              value={sortParam}
              onChange={(e) => updateFilter({ sort: e.target.value, page: '1' })}
              className="select py-1.5 px-3 text-xs rounded-lg border-surface-border bg-surface-section ml-auto"
            >
              <option value="newest">Sort: Newest First</option>
              {user?.role === 'talent' && <option value="best_match">Sort: Best Match for Me</option>}
            </select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
              >
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between text-xs text-content-secondary px-1">
          <span>
            Showing {jobs.length > 0 ? (pageParam - 1) * limit + 1 : 0}–
            {Math.min(pageParam * limit, total)} of {total} listings
          </span>
          {loading && (
            <span className="flex items-center gap-1.5 text-brand">
              <RefreshCw size={13} className="animate-spin" /> Updating listings…
            </span>
          )}
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card p-5 space-y-3 bg-white">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-14 w-full" />
                <div className="skeleton h-4 w-full pt-3" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card p-8 text-center space-y-3 bg-white border-red-200">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
            <button onClick={fetchJobs} className="btn-secondary text-xs inline-flex items-center gap-2">
              <RefreshCw size={13} /> Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && jobs.length === 0 && (
          <div className="card p-12 text-center space-y-4 bg-white border-dashed border-surface-border">
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <Briefcase size={22} />
            </div>
            <h3 className="text-lg font-bold text-content-heading">No listings found</h3>
            <p className="text-sm text-content-secondary max-w-md mx-auto">
              We couldn&apos;t find any open positions matching your search criteria. Try removing some filters or search for another department.
            </p>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="btn-secondary text-sm">
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Job Listings Grid */}
        {!loading && !error && jobs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {jobs.map((job) => {
              const req = job.job_requirements
              const company = job.production_profiles
              const isSaved = savedJobIds.has(job.id)
              const skills = req?.skills?.slice(0, 3) ?? []

              return (
                <div
                  key={job.id}
                  className="card-hover p-5 bg-white border-surface-border flex flex-col justify-between group relative"
                >
                  <div className="space-y-2.5">
                    {/* Header: Company & Bookmark */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {company?.company_name?.[0]?.toUpperCase() ?? 'P'}
                        </div>
                        <div className="min-w-0 truncate">
                          {company?.id ? (
                            <Link
                              to={`/company/${company.id}`}
                              className="text-xs font-medium text-content-secondary hover:text-brand truncate block"
                            >
                              {company.company_name}
                            </Link>
                          ) : (
                            <span className="text-xs font-medium text-content-secondary truncate block">
                              {company?.company_name ?? 'Studio'}
                            </span>
                          )}
                        </div>
                        {company?.verified && <VerifiedBadge />}
                      </div>

                      {user?.role === 'talent' && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleSave(e, job.id)}
                          disabled={savingId === job.id}
                          className="text-content-tertiary hover:text-brand p-1 -mr-1 transition-colors"
                          title={isSaved ? 'Remove from saved' : 'Save job'}
                        >
                          {isSaved ? (
                            <BookmarkCheck size={18} className="text-brand fill-brand" />
                          ) : (
                            <Bookmark size={18} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Job Title */}
                    <Link to={`/jobs/${job.id}`} className="block">
                      <h3 className="text-base font-bold text-content-heading group-hover:text-brand transition-colors line-clamp-1">
                        {job.title}
                      </h3>
                    </Link>

                    {/* Description preview */}
                    <p className="text-xs text-content-secondary line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Skills pills */}
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {skills.map((s) => (
                          <span
                            key={s}
                            className="badge text-[11px] bg-surface-section border-surface-border text-content-secondary"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-4 mt-4 border-t border-surface-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-content-tertiary">
                      {req?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {req.location}
                        </span>
                      )}
                      <span className="capitalize">{job.job_type ?? 'Freelance'}</span>
                    </div>

                    {job.match_score != null && (
                      <span className="mono-text text-[11px] font-bold text-brand bg-blue-50 border border-brand/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <TrendingUp size={11} /> {Math.round(job.match_score)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              type="button"
              onClick={() => updateFilter({ page: String(Math.max(1, pageParam - 1)) })}
              disabled={pageParam <= 1 || loading}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span className="text-xs font-semibold text-content-secondary px-3">
              Page {pageParam} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => updateFilter({ page: String(Math.min(totalPages, pageParam + 1)) })}
              disabled={pageParam >= totalPages || loading}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
    </div>
  )
}

export default BrowseJobs
