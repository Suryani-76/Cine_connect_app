import { useState, FormEvent, useEffect, useCallback } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  X,
  RefreshCw,
  SlidersHorizontal,
  Bell,
  Users,
  MapPin,
  Languages,
} from 'lucide-react'
import { talentApi, TalentProfile } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { supabase } from '../lib/supabase'
import { formatLoadErrorMessage, pluralize } from '../lib/formatters'
import { DepartmentMark, resolveDepartment } from '../components/ui/DepartmentMark'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/Sheet'
import { AutocompleteTagInput } from '../components/AutocompleteTagInput'
import { Pagination } from '../components/ui/Pagination'

export interface TalentSearchFilters {
  skills: string[]
  role: string
  location: string
  language: string
  availability: string
}

const ITEMS_PER_PAGE = 10

export default function Search() {
  usePageTitle('Find Talent | CineConnect')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { token, isAuthenticated, loading: authLoading } = useAuth()

  // Initialize filters from URL parameters
  const [filters, setFilters] = useState<TalentSearchFilters>(() => {
    const rawSkills = searchParams.get('skills')
    return {
      skills: rawSkills ? rawSkills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      role: searchParams.get('role') || searchParams.get('q') || '',
      location: searchParams.get('location') || '',
      language: searchParams.get('language') || '',
      availability: searchParams.get('availability') || '',
    }
  })

  const [currentPage, setCurrentPage] = useState<number>(() => {
    const p = parseInt(searchParams.get('page') || '1', 10)
    return isNaN(p) || p < 1 ? 1 : p
  })

  const [results, setResults] = useState<TalentProfile[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Resolve session token from useAuth or fallback to active Supabase session / localStorage
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (token) return token
    try {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.access_token) return data.session.access_token
    } catch {
      // ignore
    }
    return (
      localStorage.getItem('cc_access_token') ??
      sessionStorage.getItem('cc_access_token') ??
      null
    )
  }, [token])

  const runSearch = useCallback(
    async (f: TalentSearchFilters) => {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        navigate('/login', { replace: true })
        return
      }

      setLoading(true)
      setError('')
      try {
        const res = await talentApi.search(
          {
            skills: f.skills.length > 0 ? f.skills : undefined,
            role: f.role.trim() || undefined,
            location: f.location.trim() || undefined,
            language: f.language.trim() || undefined,
            availability: f.availability && f.availability !== 'all' ? f.availability.trim() : undefined,
          },
          accessToken
        )
        setResults(res.talent || [])
        setSearched(true)
      } catch (err: unknown) {
        setError(
          formatLoadErrorMessage(
            err,
            "Couldn't load talent results. Check your connection and try again."
          )
        )
      } finally {
        setLoading(false)
      }
    },
    [getAccessToken, navigate]
  )

  // Sync state to URL params
  const updateUrlParams = useCallback(
    (f: TalentSearchFilters, pageNum: number) => {
      const params = new URLSearchParams()
      if (f.skills.length > 0) params.set('skills', f.skills.join(','))
      if (f.role.trim()) params.set('role', f.role.trim())
      if (f.location.trim()) params.set('location', f.location.trim())
      if (f.language.trim()) params.set('language', f.language.trim())
      if (f.availability.trim()) params.set('availability', f.availability.trim())
      if (pageNum > 1) params.set('page', String(pageNum))

      setSearchParams(params, { replace: true })
    },
    [setSearchParams]
  )

  // Initial fetch on mount
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated && !token) return

    runSearch(filters)
  }, [authLoading, isAuthenticated, token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle URL change from browser back/forward buttons
  useEffect(() => {
    const rawSkills = searchParams.get('skills')
    const urlFilters: TalentSearchFilters = {
      skills: rawSkills ? rawSkills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      role: searchParams.get('role') || searchParams.get('q') || '',
      location: searchParams.get('location') || '',
      language: searchParams.get('language') || '',
      availability: searchParams.get('availability') || '',
    }
    const page = parseInt(searchParams.get('page') || '1', 10) || 1

    setFilters(urlFilters)
    setCurrentPage(page)
  }, [searchParams])

  if (!authLoading && !isAuthenticated && !token) {
    return <Navigate to="/login" replace />
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-line border-t-tungsten rounded-full animate-spin" />
      </div>
    )
  }

  const handleApplyFilters = (e?: FormEvent) => {
    if (e) e.preventDefault()
    setCurrentPage(1)
    updateUrlParams(filters, 1)
    runSearch(filters)
    setMobileFilterOpen(false)
  }

  const handleClearFilters = () => {
    const empty: TalentSearchFilters = {
      skills: [],
      role: '',
      location: '',
      language: '',
      availability: '',
    }
    setFilters(empty)
    setCurrentPage(1)
    updateUrlParams(empty, 1)
    runSearch(empty)
    setMobileFilterOpen(false)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    updateUrlParams(filters, newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasActiveFilters =
    filters.skills.length > 0 ||
    Boolean(filters.role.trim()) ||
    Boolean(filters.location.trim()) ||
    Boolean(filters.language.trim()) ||
    Boolean(filters.availability.trim())

  // Set of lowercase skills for quick highlight matching
  const searchSkillsSet = new Set(filters.skills.map((s) => s.toLowerCase().trim()))

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(results.length / ITEMS_PER_PAGE))
  const displayedTalent = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Filter Panel Form
  const filterFormContent = (
    <form onSubmit={handleApplyFilters} className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <h2 className="text-14 font-bold text-ink">Search filters</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-12 font-medium text-muted hover:text-ink transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Role */}
      <div>
        <label htmlFor="talent-filter-role" className="block text-12 font-semibold text-muted mb-1">
          Role
        </label>
        <input
          id="talent-filter-role"
          type="text"
          value={filters.role}
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
          placeholder="e.g. Cinematographer, Editor"
          className="input text-13"
        />
      </div>

      {/* Skills (tag picker using AutocompleteTagInput) */}
      <div>
        <AutocompleteTagInput
          label="Skills"
          placeholder="Add required skill"
          tags={filters.skills}
          onChange={(tags) => setFilters((f) => ({ ...f, skills: tags }))}
          type="skills"
          helpText="Match talent proficient in specific equipment, software, or techniques"
        />
      </div>

      {/* Availability */}
      <div>
        <label htmlFor="talent-filter-availability" className="block text-12 font-semibold text-muted mb-1">
          Availability
        </label>
        <select
          id="talent-filter-availability"
          value={filters.availability}
          onChange={(e) => setFilters((f) => ({ ...f, availability: e.target.value }))}
          className="select text-13"
        >
          <option value="">All availability statuses</option>
          <option value="open">Available to work</option>
          <option value="busy">Busy on project</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="talent-filter-location" className="block text-12 font-semibold text-muted mb-1">
          Location
        </label>
        <input
          id="talent-filter-location"
          type="text"
          value={filters.location}
          onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
          placeholder="e.g. Mumbai, Hyderabad, Bengaluru"
          className="input text-13"
        />
      </div>

      {/* Language */}
      <div>
        <label htmlFor="talent-filter-language" className="block text-12 font-semibold text-muted mb-1">
          Language
        </label>
        <input
          id="talent-filter-language"
          type="text"
          value={filters.language}
          onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}
          placeholder="e.g. Hindi, Telugu, English"
          className="input text-13"
        />
      </div>

      <div className="pt-2 flex items-center gap-2">
        <button type="submit" disabled={loading} className="btn-primary w-full text-13">
          {loading ? 'Searching...' : 'Apply filters'}
        </button>
      </div>
    </form>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="space-y-1 pb-4 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-28 font-bold text-ink tracking-tight leading-tight">
            Find talent
          </h1>
          <p className="text-14 text-muted max-w-2xl">
            {searched
              ? `${pluralize(results.length, 'verified candidate')}${
                  hasActiveFilters ? ' matching your filters' : ''
                }`
              : 'Explore verified crew and creative talent across all film departments'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Saved Search Alert Link */}
          {hasActiveFilters && (
            <Link
              to={`/alerts?role=${encodeURIComponent(filters.role)}&location=${encodeURIComponent(
                filters.location
              )}`}
              className="btn-secondary text-12 inline-flex items-center gap-1.5"
            >
              <Bell size={13} />
              <span>Create alert from search</span>
            </Link>
          )}

          {/* Mobile Filter Sheet Trigger */}
          <div className="lg:hidden">
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="btn-secondary text-13 inline-flex items-center gap-1.5"
                >
                  <SlidersHorizontal size={14} />
                  <span>Filters {hasActiveFilters ? `(${filters.skills.length + (filters.role ? 1 : 0) + (filters.location ? 1 : 0) + (filters.language ? 1 : 0) + (filters.availability ? 1 : 0)})` : ''}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" title="Filters" description="Refine candidates by role, skills, and location">
                <div className="pt-2">{filterFormContent}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Layout: Sidebar + Dense Result Rows */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Desktop Sidebar (lg+) */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="border border-line rounded-sm bg-surface p-5 sticky top-20 shadow-subtle">
            {filterFormContent}
          </div>
        </aside>

        {/* Results Column */}
        <main className="flex-1 min-w-0 w-full space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="p-4 border border-status-error/30 bg-status-error/10 text-status-error text-13 rounded-sm flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => runSearch(filters)}
                className="btn-secondary text-12 px-2.5 py-1 inline-flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw size={12} />
                <span>Try again</span>
              </button>
            </div>
          )}

          {/* Active Filter Chips bar */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2 text-12">
              <span className="text-muted font-medium">Active filters:</span>
              {filters.role && (
                <span className="inline-flex items-center gap-1 bg-paper px-2 py-0.5 rounded-[2px] border border-line text-ink">
                  Role: {filters.role}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...filters, role: '' }
                      setFilters(updated)
                      updateUrlParams(updated, 1)
                      runSearch(updated)
                    }}
                    className="text-muted hover:text-ink ml-0.5"
                    aria-label="Remove role filter"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
              {filters.skills.map((sk) => (
                <span
                  key={sk}
                  className="inline-flex items-center gap-1 bg-paper px-2 py-0.5 rounded-[2px] border border-line text-ink"
                >
                  Skill: {sk}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...filters,
                        skills: filters.skills.filter((s) => s !== sk),
                      }
                      setFilters(updated)
                      updateUrlParams(updated, 1)
                      runSearch(updated)
                    }}
                    className="text-muted hover:text-ink ml-0.5"
                    aria-label={`Remove skill ${sk}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {filters.location && (
                <span className="inline-flex items-center gap-1 bg-paper px-2 py-0.5 rounded-[2px] border border-line text-ink">
                  Location: {filters.location}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...filters, location: '' }
                      setFilters(updated)
                      updateUrlParams(updated, 1)
                      runSearch(updated)
                    }}
                    className="text-muted hover:text-ink ml-0.5"
                    aria-label="Remove location filter"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
              {filters.availability && (
                <span className="inline-flex items-center gap-1 bg-paper px-2 py-0.5 rounded-[2px] border border-line text-ink">
                  Status: {filters.availability}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...filters, availability: '' }
                      setFilters(updated)
                      updateUrlParams(updated, 1)
                      runSearch(updated)
                    }}
                    className="text-muted hover:text-ink ml-0.5"
                    aria-label="Remove availability filter"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="border border-line rounded-sm bg-surface divide-y divide-line">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 sm:p-5 flex items-start gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-sm bg-paper shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-paper rounded w-1/3" />
                    <div className="h-3 bg-paper rounded w-1/4" />
                    <div className="h-3 bg-paper rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State with Lucide Icon (no emoji) */}
          {!loading && results.length === 0 && (
            <div className="border border-dashed border-line rounded-sm p-12 text-center bg-surface space-y-3">
              <Users size={36} className="mx-auto text-muted opacity-60" />
              <h2 className="text-16 font-bold text-ink">No talent found</h2>
              <p className="text-13 text-muted max-w-md mx-auto">
                Try adjusting your search terms, removing required skills, or clearing filters to discover more candidates.
              </p>
              {hasActiveFilters && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="btn-secondary text-13"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Result Rows (film-set row layout) */}
          {!loading && results.length > 0 && (
            <div className="border border-line rounded-sm bg-surface divide-y divide-line overflow-hidden shadow-subtle">
              {displayedTalent.map((t) => {
                const name = t.full_name || 'Anonymous Talent'
                const primaryRole = t.role || t.roles?.[0] || 'Film Crew'
                const dept = resolveDepartment(primaryRole)

                const availabilityConfig = {
                  open: { label: 'Available', variant: 'success' as const },
                  busy: { label: 'Busy', variant: 'warning' as const },
                  unavailable: { label: 'Unavailable', variant: 'neutral' as const },
                }[t.availability || 'open'] || { label: 'Available', variant: 'neutral' as const }

                return (
                  <div
                    key={t.id}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-paper/30 transition-colors"
                  >
                    {/* Candidate Info */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <Avatar
                        src={t.avatar_url}
                        fallback={name}
                        size="md"
                        className="rounded-sm shrink-0 mt-0.5"
                      />

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/profile/${t.id}`}
                            className="font-bold text-15 text-ink hover:underline truncate leading-tight"
                          >
                            {name}
                          </Link>
                          <DepartmentMark department={dept} label={primaryRole} size="sm" />
                          <Badge variant={availabilityConfig.variant} size="sm">
                            {availabilityConfig.label}
                          </Badge>
                        </div>

                        {/* Secondary roles */}
                        {t.roles && t.roles.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1 text-11 text-muted">
                            <span className="font-medium">Also:</span>
                            {t.roles
                              .filter((r) => r !== primaryRole)
                              .slice(0, 3)
                              .map((r) => (
                                <span
                                  key={r}
                                  className="bg-paper px-1.5 py-0.5 rounded-[2px] border border-line/60"
                                >
                                  {r}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Meta items: separate muted elements without middle dots */}
                        <div className="flex flex-wrap items-center gap-1.5 text-12 text-muted">
                          {t.location && (
                            <span className="inline-flex items-center gap-1 bg-paper px-1.5 py-0.5 rounded-[2px] border border-line/60">
                              <MapPin size={11} className="shrink-0" />
                              <span>{t.location}</span>
                            </span>
                          )}
                          <span className="bg-paper px-1.5 py-0.5 rounded-[2px] border border-line/60 tnum">
                            {t.experience_years
                              ? `${t.experience_years}y exp`
                              : 'Entry level'}
                          </span>
                          {t.language && (
                            <span className="inline-flex items-center gap-1 bg-paper px-1.5 py-0.5 rounded-[2px] border border-line/60">
                              <Languages size={11} className="shrink-0" />
                              <span>{t.language}</span>
                            </span>
                          )}
                        </div>

                        {/* Bio snippet */}
                        {t.bio && (
                          <p className="reading-text prose-serif text-13 text-muted line-clamp-1 max-w-2xl">
                            {t.bio}
                          </p>
                        )}

                        {/* Skills with highlighted matches */}
                        {t.skills && t.skills.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            {t.skills.slice(0, 7).map((skill) => {
                              const isMatch = searchSkillsSet.has(skill.toLowerCase().trim())
                              return (
                                <span
                                  key={skill}
                                  className={`text-11 px-1.5 py-0.5 rounded-[2px] border transition-colors ${
                                    isMatch
                                      ? 'bg-tungsten/15 text-ink border-tungsten/60 font-semibold'
                                      : 'bg-paper text-muted border-line/60'
                                  }`}
                                >
                                  {skill}
                                </span>
                              )
                            })}
                            {t.skills.length > 7 && (
                              <span className="text-11 text-muted">
                                +{t.skills.length - 7} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="shrink-0 md:self-center pt-2 md:pt-0">
                      <Link
                        to={`/profile/${t.id}`}
                        className="btn-secondary text-13 px-4 py-1.5"
                      >
                        View profile
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && results.length > ITEMS_PER_PAGE && (
            <div className="border border-line rounded-sm bg-surface px-4 py-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={results.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
