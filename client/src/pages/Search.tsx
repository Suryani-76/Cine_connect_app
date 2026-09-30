import { useState, FormEvent, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, X, ExternalLink } from 'lucide-react'
import { talentApi, TalentProfile } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'

// ── Talent card ───────────────────────────────────────────────

function TalentCard({ talent, highlightSkills }: { talent: TalentProfile; highlightSkills: string[] }) {
  const initials = (talent.full_name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const hlSet    = new Set(highlightSkills.map(s => s.toLowerCase()))
  const daysAgo  = Math.floor((Date.now() - new Date(talent.last_active_at).getTime()) / 86400000)

  const activityLabel =
    daysAgo === 0 ? 'Active today' :
    daysAgo <= 7  ? `Active ${daysAgo}d ago` :
    daysAgo <= 30 ? `Active ${daysAgo}d ago` : 'Inactive 30d+'

  const activityCls =
    daysAgo <= 7  ? 'text-emerald-600' :
    daysAgo <= 30 ? 'text-amber-600'   : 'text-content-muted'

  return (
    <div className="card-hover p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        {talent.avatar_url
          ? <img src={talent.avatar_url} alt={talent.full_name ?? 'Talent avatar'}
              loading="lazy" width={44} height={44}
              className="w-11 h-11 rounded-full object-cover shrink-0" />
          : <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-navy to-brand
              flex items-center justify-center text-white font-bold text-sm shrink-0">{initials}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-content-heading leading-tight truncate">
            {talent.full_name ?? 'Anonymous Talent'}
          </p>
          {talent.role && <p className="text-sm text-brand mt-0.5 truncate">{talent.role}</p>}
          <p className={`text-xs mt-0.5 ${activityCls}`}>{activityLabel}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-content-tertiary">
        {talent.location        && <span>📍 {talent.location}</span>}
        {talent.experience_years > 0 && <span>🎬 {talent.experience_years}y exp</span>}
        {talent.language        && <span>🗣 {talent.language}</span>}
      </div>

      {/* Bio */}
      {talent.bio && <p className="text-sm text-content-secondary line-clamp-2">{talent.bio}</p>}

      {/* Skills */}
      {talent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {talent.skills.slice(0, 8).map(skill => {
            const match = hlSet.has(skill.toLowerCase())
            return (
              <span key={skill}
                className={`badge text-xs font-medium transition-colors
                  ${match
                    ? 'bg-blue-50 border-brand/30 text-brand'
                    : 'bg-surface-section border-surface-border text-content-secondary'
                  }`}>
                {skill}
              </span>
            )
          })}
          {talent.skills.length > 8 && (
            <span className="text-xs text-content-muted self-center">+{talent.skills.length - 8} more</span>
          )}
        </div>
      )}

      {/* Portfolio */}
      {talent.portfolio_url && (
        <a href={talent.portfolio_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-semibold transition-colors mt-auto">
          View portfolio <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}

// ── Filter sidebar ────────────────────────────────────────────

interface Filters { skills: string; role: string; location: string; language: string }

function FilterSidebar({ filters, onChange, onSubmit, onClear, loading }: {
  filters: Filters; onChange: (f: Filters) => void
  onSubmit: (e: FormEvent) => void; onClear: () => void; loading: boolean
}) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...filters, [key]: e.target.value })
  const hasFilters = Object.values(filters).some(v => v.trim())

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-content-heading">Filters</h2>
        {hasFilters && (
          <button type="button" onClick={onClear}
            className="flex items-center gap-1 text-xs text-content-tertiary hover:text-brand transition-colors">
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {[
        { key: 'skills' as const,   label: 'Skills',    placeholder: 'e.g. Cinematography, Editing', hint: 'Comma-separated' },
        { key: 'role' as const,     label: 'Role',      placeholder: 'e.g. Director of Photography' },
        { key: 'location' as const, label: 'Location',  placeholder: 'e.g. Mumbai, Remote' },
        { key: 'language' as const, label: 'Language',  placeholder: 'e.g. English, Hindi' },
      ].map(({ key, label, placeholder, hint }) => (
        <div key={key}>
          <label className="label">{label}</label>
          <input value={filters[key]} onChange={set(key)} placeholder={placeholder} className="input" />
          {hint && <p className="mt-1 text-xs text-content-muted">{hint}</p>}
        </div>
      ))}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Searching…' : <><SearchIcon size={14} /> Search</>}
      </button>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────

const EMPTY: Filters = { skills: '', role: '', location: '', language: '' }

const Search = () => {
  usePageTitle('Find Talent')
  const [filters, setFilters]     = useState<Filters>(EMPTY)
  const [results, setResults]     = useState<TalentProfile[]>([])
  const [searched, setSearched]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [sidebarOpen, setSidebar] = useState(false)

  const runSearch = async (f: Filters) => {
    setLoading(true); setError('')
    try {
      const skills = f.skills ? f.skills.split(',').map(s => s.trim()).filter(Boolean) : undefined
      const res = await talentApi.search({
        skills,
        role:     f.role.trim()     || undefined,
        location: f.location.trim() || undefined,
        language: f.language.trim() || undefined,
      })
      setResults(res.talent); setSearched(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runSearch(EMPTY) }, [])

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); runSearch(filters) }
  const handleClear  = () => { setFilters(EMPTY); runSearch(EMPTY) }

  const highlightSkills = filters.skills ? filters.skills.split(',').map(s => s.trim()).filter(Boolean) : []
  const hasFilters      = Object.values(filters).some(v => v.trim())

  return (
    <div className="page">
      {/* Nav */}
      <header className="nav">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/home" className="brand-text text-xl text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/home"         className="nav-link">Home</Link>
            <Link to="/applications" className="nav-link">Applications</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="section-title">Find Talent</h1>
            <p className="text-sm text-content-tertiary mt-1">
              {searched
                ? `${results.length} result${results.length !== 1 ? 's' : ''}${hasFilters ? ' matching your filters' : ''}`
                : 'Search the talent pool'}
            </p>
          </div>
          <button onClick={() => setSidebar(v => !v)}
            className="sm:hidden btn-ghost text-sm px-3 py-2">
            {sidebarOpen ? 'Hide filters' : 'Filters'}
          </button>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className={`w-64 shrink-0 ${sidebarOpen ? 'block' : 'hidden'} sm:block`}>
            <div className="card p-5 sticky top-20">
              <FilterSidebar
                filters={filters} onChange={setFilters}
                onSubmit={handleSubmit} onClear={handleClear} loading={loading}
              />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {error && <div className="error-banner mb-6"><p className="text-sm text-red-600">{error}</p></div>}

            {/* Skeleton */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="card p-5">
                    <div className="flex gap-3 mb-4">
                      <div className="skeleton w-11 h-11 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-2/3" />
                        <div className="skeleton h-3 w-1/2" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="skeleton h-3 w-full" />
                      <div className="skeleton h-3 w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && searched && results.length === 0 && (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🔍</p>
                <p className="font-bold text-content-heading mb-1">No talent found</p>
                <p className="text-sm text-content-tertiary mb-4">Try adjusting your filters.</p>
                <button onClick={handleClear} className="btn-outline text-sm px-4 py-2">
                  Clear filters
                </button>
              </div>
            )}

            {/* Grid */}
            {!loading && results.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map(talent => (
                  <TalentCard key={talent.id} talent={talent} highlightSkills={highlightSkills} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Search
