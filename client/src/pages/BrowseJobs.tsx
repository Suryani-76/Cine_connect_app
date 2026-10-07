import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Briefcase,
  MapPin,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { jobsApi, savedJobsApi, JobWithProduction, JobType } from '../lib/api'
import {
  formatJobType,
  formatExperienceLevel,
  formatPayRange,
  formatDeadlineDate,
  pluralize,
} from '../lib/formatters'
import { PageHeader } from '../components/PageHeader'
import { VerifiedBadge } from '../components/VerifiedBadge'
import {
  DataTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/DataTable'
import { LightMeter } from '../components/ui/LightMeter'
import { DepartmentMark, resolveDepartment, DepartmentKey } from '../components/ui/DepartmentMark'
import { Sheet, SheetTrigger, SheetContent } from '../components/ui/Sheet'

const JOB_TYPES: { label: string; value: JobType | '' }[] = [
  { label: 'All types', value: '' },
  { label: 'Freelance', value: 'freelance' },
  { label: 'Contract', value: 'contract' },
  { label: 'Full time', value: 'full_time' },
  { label: 'Part time', value: 'part_time' },
]

const EXP_LEVELS = [
  { label: 'All experience', value: '' },
  { label: 'Entry level', value: 'entry' },
  { label: 'Mid level', value: 'mid' },
  { label: 'Senior', value: 'senior' },
]

const DEPARTMENTS: { label: string; value: DepartmentKey | '' }[] = [
  { label: 'All departments', value: '' },
  { label: 'Camera', value: 'camera' },
  { label: 'Sound', value: 'sound' },
  { label: 'Editing', value: 'editing' },
  { label: 'Art & costume', value: 'art and costume' },
  { label: 'Cast', value: 'cast' },
  { label: 'Production', value: 'production' },
]

const PAY_OPTIONS = [
  { label: 'Any pay', value: '' },
  { label: '₹10,000+', value: '10000' },
  { label: '₹25,000+', value: '25000' },
  { label: '₹50,000+', value: '50000' },
  { label: '₹1,00,000+', value: '100000' },
]

function formatPay(job: JobWithProduction): string {
  return formatPayRange(job)
}

function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return 'No deadline'
  const d = new Date(deadline)
  if (isNaN(d.getTime())) return 'No deadline'
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'Deadline passed'
  if (diffDays === 0) return 'Deadline today'
  return formatDeadlineDate(deadline, { includeTime: false })
}

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
  const locParam = searchParams.get('location') || searchParams.get('city') || ''
  const expParam = searchParams.get('experience') || ''
  const deptParam = (searchParams.get('department') as DepartmentKey) || ''
  const payParam = searchParams.get('pay') || searchParams.get('pay_min') || ''
  const sortParam = (searchParams.get('sort') as 'newest' | 'best_match') || 'newest'
  const pageParam = parseInt(searchParams.get('page') || '1', 10)

  // Local state
  const [jobs, setJobs] = useState<(JobWithProduction & { match_score?: number })[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Form input state (search text)
  const [searchTerm, setSearchTerm] = useState(qParam)

  const limit = 12

  // Keep local search term in sync with query param
  useEffect(() => {
    setSearchTerm(qParam)
  }, [qParam])

  // Update query params helper
  const updateFilter = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '' || (k === 'page' && v === '1')) {
        nextParams.delete(k)
        if (k === 'location') nextParams.delete('city')
        if (k === 'pay') nextParams.delete('pay_min')
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
    const minPayNum = payParam ? parseFloat(payParam) : undefined

    jobsApi
      .list(
        {
          q: qParam || undefined,
          job_type: typeParam ? (typeParam as JobType) : undefined,
          location: locParam || undefined,
          experience_level: expParam || undefined,
          pay_min: !isNaN(minPayNum!) ? minPayNum : undefined,
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
  }, [qParam, typeParam, locParam, expParam, payParam, sortParam, pageParam, token])

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
    setMobileFilterOpen(false)
  }

  // Client-side department filter on top of fetched batch
  const displayedJobs = useMemo(() => {
    if (!deptParam) return jobs
    return jobs.filter((j) => {
      const primaryRole = j.job_requirements?.roles?.[0] || j.title
      const resolved = resolveDepartment(primaryRole)
      return resolved === deptParam
    })
  }, [jobs, deptParam])

  const totalPages = Math.ceil(total / limit)
  const hasActiveFilters = Boolean(
    qParam || typeParam || locParam || expParam || deptParam || payParam || sortParam !== 'newest'
  )

  const activeFilterCount = [
    Boolean(qParam),
    Boolean(typeParam),
    Boolean(locParam),
    Boolean(expParam),
    Boolean(deptParam),
    Boolean(payParam),
    sortParam !== 'newest',
  ].filter(Boolean).length

  const formatFilterValue = (val: string) => {
    return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const deptLabel = useMemo(() => {
    if (!deptParam) return ''
    const match = DEPARTMENTS.find((d) => d.value.toLowerCase() === deptParam.toLowerCase())
    return match?.label && match.label !== 'All departments' ? match.label : formatFilterValue(deptParam)
  }, [deptParam])

  const typeLabel = useMemo(() => {
    if (!typeParam) return ''
    const match = JOB_TYPES.find((t) => t.value.toLowerCase() === typeParam.toLowerCase())
    return match?.label && match.label !== 'All types' ? match.label : formatFilterValue(typeParam)
  }, [typeParam])

  const expLabel = useMemo(() => {
    if (!expParam) return ''
    const match = EXP_LEVELS.find((e) => e.value.toLowerCase() === expParam.toLowerCase())
    return match?.label && match.label !== 'All experience' ? match.label : formatExperienceLevel(expParam)
  }, [expParam])

  const payLabel = useMemo(() => {
    if (!payParam) return ''
    const match = PAY_OPTIONS.find((p) => p.value === payParam)
    if (match?.label && match.label !== 'Any pay') return match.label
    const num = Number(payParam)
    return !isNaN(num) ? `₹${num.toLocaleString()}+` : payParam
  }, [payParam])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Explore film opportunities"
        description="Find verified postings from production houses and studios across India."
        action={
          user?.role === 'production' ? (
            <Link to="/jobs/create" className="btn-primary text-13 inline-flex items-center gap-2">
              <Briefcase size={15} /> Post a job
            </Link>
          ) : undefined
        }
      />

      {/* Filter Bar Card */}
      <div className="border border-line rounded-sm bg-surface p-4 sm:p-5 space-y-4 shadow-subtle">
        {/* Unified Filter Bar: single row on desktop (>= lg), split with drawer on mobile */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          {/* Search Bar + Mobile Drawer Trigger */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by role, title, keywords (e.g. Cinematographer, DaVinci, Gaffer)..."
                className="input pl-9 pr-3 py-1.5 text-13 lg:text-12 w-full border-line"
              />
            </form>

            <button
              type="button"
              onClick={handleSearchSubmit}
              className="btn-primary text-13 px-4 py-1.5 shrink-0 hidden sm:inline-flex lg:hidden"
            >
              Search
            </button>

            {/* Mobile Filter Sheet Trigger (< lg) */}
            <div className="lg:hidden shrink-0">
              <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="btn-secondary text-13 px-3 py-1.5 inline-flex items-center gap-1.5 relative"
                    aria-label="Open filter sheet"
                  >
                    <SlidersHorizontal size={15} />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-ink text-surface text-11 font-bold inline-flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  title="Filter opportunities"
                  description="Refine open film postings by department, type, location, and pay."
                  className="space-y-4"
                >
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-12 font-semibold text-muted block mb-1.5">Department</label>
                      <select
                        value={deptParam}
                        onChange={(e) => updateFilter({ department: e.target.value, page: '1' })}
                        className="select w-full text-13"
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-12 font-semibold text-muted block mb-1.5">Job type</label>
                      <select
                        value={typeParam}
                        onChange={(e) => updateFilter({ type: e.target.value, page: '1' })}
                        className="select w-full text-13"
                      >
                        {JOB_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-12 font-semibold text-muted block mb-1.5">Experience</label>
                      <select
                        value={expParam}
                        onChange={(e) => updateFilter({ experience: e.target.value, page: '1' })}
                        className="select w-full text-13"
                      >
                        {EXP_LEVELS.map((exp) => (
                          <option key={exp.value} value={exp.value}>
                            {exp.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-12 font-semibold text-muted block mb-1.5">City</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Filter by city..."
                          value={locParam}
                          onChange={(e) => updateFilter({ location: e.target.value, page: '1' })}
                          className="input pl-8 text-13 w-full"
                        />
                        <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                      </div>
                    </div>

                    <div>
                      <label className="text-12 font-semibold text-muted block mb-1.5">Minimum pay</label>
                      <select
                        value={payParam}
                        onChange={(e) => updateFilter({ pay: e.target.value, page: '1' })}
                        className="select w-full text-13"
                      >
                        {PAY_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-12 font-semibold text-muted block mb-1.5">Sort order</label>
                      <select
                        value={sortParam}
                        onChange={(e) => updateFilter({ sort: e.target.value, page: '1' })}
                        className="select w-full text-13"
                      >
                        <option value="newest">Sort: Newest first</option>
                        {user?.role === 'talent' && <option value="best_match">Sort: Best match for me</option>}
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-line">
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="btn-ghost text-13 flex-1"
                        >
                          Clear all
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setMobileFilterOpen(false)}
                        className="btn-primary text-13 flex-1"
                      >
                        Show results
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Desktop Single-Row Filter Bar (>= lg) */}
          <div className="hidden lg:flex items-center gap-2 text-12 shrink-0">

          {/* Department Selector */}
          <select
            value={deptParam}
            onChange={(e) => updateFilter({ department: e.target.value, page: '1' })}
            className="select py-1.5 px-2.5 text-12 rounded-sm border-line bg-paper/50 shrink-0"
            aria-label="Department filter"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          {/* Job Type Selector */}
          <select
            value={typeParam}
            onChange={(e) => updateFilter({ type: e.target.value, page: '1' })}
            className="select py-1.5 px-2.5 text-12 rounded-sm border-line bg-paper/50 shrink-0"
            aria-label="Job type filter"
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
            className="select py-1.5 px-2.5 text-12 rounded-sm border-line bg-paper/50 shrink-0"
            aria-label="Experience level filter"
          >
            {EXP_LEVELS.map((exp) => (
              <option key={exp.value} value={exp.value}>
                {exp.label}
              </option>
            ))}
          </select>

          {/* City / Location Input */}
          <div className="relative shrink-0 w-32">
            <input
              type="text"
              placeholder="City..."
              value={locParam}
              onChange={(e) => updateFilter({ location: e.target.value, page: '1' })}
              className="input py-1.5 pl-7 pr-2 text-12 rounded-sm w-full border-line"
            />
            <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </div>

          {/* Pay Selector */}
          <select
            value={payParam}
            onChange={(e) => updateFilter({ pay: e.target.value, page: '1' })}
            className="select py-1.5 px-2.5 text-12 rounded-sm border-line bg-paper/50 shrink-0"
            aria-label="Pay filter"
          >
            {PAY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Sort Selector */}
          <select
            value={sortParam}
            onChange={(e) => updateFilter({ sort: e.target.value, page: '1' })}
            className="select py-1.5 px-2.5 text-12 rounded-sm border-line bg-paper/50 shrink-0"
            aria-label="Sort order"
          >
            <option value="newest">Sort: Newest</option>
            {user?.role === 'talent' && <option value="best_match">Sort: Best match</option>}
          </select>
        </div>
      </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/60">
            <span className="text-11 font-semibold text-muted select-none">Active filters:</span>

            {qParam && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-paper text-ink text-11 border border-line">
                <span>Query: &ldquo;{qParam}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ q: null, page: '1' })}
                  className="hover:text-status-error ml-0.5"
                  aria-label="Remove query filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {deptParam && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-paper text-ink text-11 border border-line">
                <span>Dept: {deptLabel}</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ department: null, page: '1' })}
                  className="hover:text-status-error ml-0.5"
                  aria-label="Remove department filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {typeParam && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-paper text-ink text-11 border border-line">
                <span>Type: {typeLabel}</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ type: null, page: '1' })}
                  className="hover:text-status-error ml-0.5"
                  aria-label="Remove type filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {expParam && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-paper text-ink text-11 border border-line">
                <span>Exp: {expLabel}</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ experience: null, page: '1' })}
                  className="hover:text-status-error ml-0.5"
                  aria-label="Remove experience filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {locParam && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-paper text-ink text-11 border border-line">
                <span>City: {locParam}</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ location: null, page: '1' })}
                  className="hover:text-status-error ml-0.5"
                  aria-label="Remove location filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {payParam && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-paper text-ink text-11 border border-line">
                <span>Pay: {payLabel}</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ pay: null, page: '1' })}
                  className="hover:text-status-error ml-0.5"
                  aria-label="Remove pay filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {sortParam === 'best_match' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-paper text-ink text-11 border border-line">
                <span>Sort: Best match</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ sort: 'newest', page: '1' })}
                  className="hover:text-status-error ml-0.5"
                  aria-label="Remove sort filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-11 text-status-error hover:underline font-medium ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results Count Header */}
      <div className="flex items-center justify-between text-12 text-muted px-1">
        <span>
          {total === 1
            ? 'Showing 1 listing'
            : total === 0
            ? '0 listings'
            : `Showing ${displayedJobs.length > 0 ? (pageParam - 1) * limit + 1 : 0}–${Math.min(pageParam * limit, total)} of ${pluralize(total, 'listing')}`}
        </span>
        {loading && (
          <span className="flex items-center gap-1.5 text-ink font-medium">
            <RefreshCw size={13} className="animate-spin" /> Updating listings…
          </span>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="border border-line rounded-sm bg-surface p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-line last:border-b-0 animate-pulse">
              <div className="h-5 bg-paper rounded w-1/4" />
              <div className="h-4 bg-paper rounded w-1/6" />
              <div className="h-4 bg-paper rounded w-1/6" />
              <div className="h-4 bg-paper rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="border border-status-error/30 rounded-sm p-8 text-center space-y-3 bg-surface">
          <p className="text-14 text-status-error font-semibold">{error}</p>
          <button onClick={fetchJobs} className="btn-secondary text-12 inline-flex items-center gap-2">
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayedJobs.length === 0 && (
        <div className="border border-dashed border-line rounded-sm p-12 text-center space-y-3 bg-surface">
          <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center mx-auto text-muted">
            <Briefcase size={22} />
          </div>
          <h3 className="text-16 font-bold text-ink">No listings found</h3>
          <p className="text-14 text-muted max-w-md mx-auto">
            We couldn&apos;t find any open positions matching your search criteria. Try removing some filters or search for another department.
          </p>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="btn-secondary text-13">
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Responsive Dense Rows (Desktop Table + Mobile Stacked Cards in single DOM tree) */}
      {!loading && !error && displayedJobs.length > 0 && (
        <div className="w-full">
          <DataTable className="block md:table border-0 md:border border-line">
            <TableHeader className="hidden md:table-header-group">
              <TableRow>
                <TableHead className="w-2/5">Role & department</TableHead>
                <TableHead>Studio</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pay</TableHead>
                <TableHead>Deadline</TableHead>
                {user?.role === 'talent' && <TableHead className="w-32">Match</TableHead>}
                <TableHead className="text-right w-12" />
              </TableRow>
            </TableHeader>
            <TableBody className="block md:table-row-group space-y-3 md:space-y-0">
              {displayedJobs.map((job) => {
                const primaryRole = job.job_requirements?.roles?.[0] || job.title
                const dept = resolveDepartment(primaryRole)
                const deptLabel = dept.charAt(0).toUpperCase() + dept.slice(1)
                const company = job.production_profiles
                const isSaved = savedJobIds.has(job.id)
                const skills = job.job_requirements?.skills?.slice(0, 2) ?? []
                const deadlineStr = formatDeadline(job.deadline)

                return (
                  <TableRow
                    key={job.id}
                    className="block md:table-row p-4 md:py-2.5 md:px-3 border md:border-0 border-line rounded-sm md:rounded-none bg-surface hover:bg-paper/30 space-y-2 md:space-y-0 transition-colors"
                  >
                    {/* Role & Title */}
                    <TableCell className="block md:table-cell p-0 md:py-2.5 md:px-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/jobs/${job.id}`}
                            className="font-semibold text-ink hover:underline block leading-tight text-14 sm:text-15"
                          >
                            {job.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <DepartmentMark department={dept} label={deptLabel} size="sm" />
                            {skills.length > 0 && (
                              <span className="text-11 text-muted">
                                {skills.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mobile bookmark icon */}
                        {user?.role === 'talent' && (
                          <div className="md:hidden shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleToggleSave(e, job.id)}
                              disabled={savingId === job.id}
                              className="text-muted hover:text-ink p-1"
                              title={isSaved ? 'Remove from saved' : 'Save job'}
                              aria-label={isSaved ? 'Remove from saved' : 'Save job'}
                            >
                              {isSaved ? (
                                <BookmarkCheck size={16} className="text-ink fill-ink" />
                              ) : (
                                <Bookmark size={16} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Studio */}
                    <TableCell className="block md:table-cell p-0 md:py-2.5 md:px-3 text-12 md:text-13">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-muted md:hidden">Studio:</span>
                        {company?.id ? (
                          <Link
                            to={`/company/${company.id}`}
                            className="font-medium text-ink hover:underline truncate"
                          >
                            {company.company_name}
                          </Link>
                        ) : (
                          <span className="font-medium text-ink truncate">
                            {company?.company_name ?? 'Studio'}
                          </span>
                        )}
                        {company?.verified && <VerifiedBadge />}
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell className="block md:table-cell p-0 md:py-2.5 md:px-3 text-12 md:text-13 text-muted">
                      <div className="flex items-center justify-between md:justify-start">
                        <span className="text-muted md:hidden">Location:</span>
                        <span>{job.job_requirements?.location || 'Flexible'}</span>
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="block md:table-cell p-0 md:py-2.5 md:px-3 text-12 text-muted">
                      <div className="flex items-center justify-between md:justify-start">
                        <span className="text-muted md:hidden">Type:</span>
                        <span>{formatJobType(job.job_type)}</span>
                      </div>
                    </TableCell>

                    {/* Pay */}
                    <TableCell className="block md:table-cell p-0 md:py-2.5 md:px-3 text-12 md:text-13 font-medium text-ink">
                      <div className="flex items-center justify-between md:justify-start">
                        <span className="text-muted md:hidden font-normal">Pay:</span>
                        <span>{formatPay(job)}</span>
                      </div>
                    </TableCell>

                    {/* Deadline (Rule 1: never "Deadline: No deadline") */}
                    <TableCell className="block md:table-cell p-0 md:py-2.5 md:px-3 text-12 text-muted tnum">
                      <div className="flex items-center justify-between md:justify-start border-t md:border-t-0 border-line/60 pt-2 md:pt-0">
                        <span className="text-muted md:hidden">Deadline:</span>
                        <span>{deadlineStr}</span>
                      </div>
                    </TableCell>

                    {/* Talent Match Meter */}
                    {user?.role === 'talent' && (
                      <TableCell className="block md:table-cell p-0 md:py-2.5 md:px-3">
                        <div className="flex items-center justify-between md:justify-start gap-2 pt-1 md:pt-0">
                          <span className="text-12 text-muted md:hidden">Match score:</span>
                          <div className="w-28 md:w-32">
                            <LightMeter
                              score={job.match_score ?? 0}
                              size="sm"
                              expandable={false}
                              showScoreLabel={true}
                            />
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {/* Desktop Bookmark action */}
                    <TableCell className="hidden md:table-cell p-0 md:py-2.5 md:px-3 text-right">
                      {user?.role === 'talent' && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleSave(e, job.id)}
                          disabled={savingId === job.id}
                          className="text-muted hover:text-ink p-1 rounded transition-colors inline-flex items-center justify-center"
                          title={isSaved ? 'Remove from saved' : 'Save job'}
                          aria-label={isSaved ? 'Remove from saved' : 'Save job'}
                        >
                          {isSaved ? (
                            <BookmarkCheck size={16} className="text-ink fill-ink" />
                          ) : (
                            <Bookmark size={16} />
                          )}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </DataTable>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && displayedJobs.length > 0 && totalPages > 1 && (
        <div className="pt-4 border-t border-line flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => updateFilter({ page: String(Math.max(1, pageParam - 1)) })}
            disabled={pageParam <= 1 || loading}
            className="btn-secondary text-12 py-1.5 px-3 disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-12 font-medium text-ink px-2">
            Page {pageParam} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => updateFilter({ page: String(Math.min(totalPages, pageParam + 1)) })}
            disabled={pageParam >= totalPages || loading}
            className="btn-secondary text-12 py-1.5 px-3 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default BrowseJobs
