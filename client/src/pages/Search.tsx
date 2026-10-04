import { useState, FormEvent, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, X, ExternalLink, ArrowRight } from 'lucide-react'
import { talentApi, TalentProfile } from '../lib/api'
import { useAuth } from '../context/AuthContext'
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

  const availabilityConfig = {
    open:        { label: 'Available', dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
    busy:        { label: 'Busy',      dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
    unavailable: { label: 'Unavailable', dot: 'bg-gray-400', badge: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  }[talent.availability || 'open']

  return (
    <div className="card-hover p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {talent.avatar_url
            ? <img src={talent.avatar_url} alt={talent.full_name ?? 'Talent avatar'}
                loading="lazy" width={44} height={44}
                className="w-11 h-11 rounded-full object-cover shrink-0" />
            : <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-navy to-brand
                flex items-center justify-center text-white font-bold text-sm shrink-0">{initials}</div>
          }
          <div className="flex-1 min-w-0">
            <Link to={`/profile/${talent.id}`} className="font-semibold text-content-heading leading-tight truncate hover:text-brand transition-colors block">
              {talent.full_name ?? 'Anonymous Talent'}
            </Link>
            {talent.role && <p className="text-sm text-brand mt-0.5 truncate">{talent.role}</p>}
            <p className={`text-xs mt-0.5 ${activityCls}`}>{activityLabel}</p>
          </div>
        </div>

        {/* Availability Badge */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${availabilityConfig.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${availabilityConfig.dot}`} />
          {availabilityConfig.label}
        </span>
      </div>

      {/* Secondary Roles */}
      {talent.roles && talent.roles.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-content-muted">Also:</span>
          {talent.roles.filter(r => r !== talent.role).map(r => (
            <span key={r} className="text-xs px-2 py-0.5 rounded bg-surface-overlay text-content-secondary border border-surface-border">
              {r}
            </span>
          ))}
        </div>
      )}

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

      {/* Actions */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-border">
        {talent.portfolio_url ? (
          <a href={talent.portfolio_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-medium transition-colors">
            Portfolio <ExternalLink size={11} />
          </a>
        ) : <span />}

        <Link
          to={`/profile/${talent.id}`}
          className="inline-flex items-center gap-1 text-xs text-brand font-medium hover:underline">
          View Profile <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

// ── Filter sidebar ────────────────────────────────────────────

interface Filters {
  skills: string
  role: string
  location: string
  language: string
  availability: string
}

function FilterSidebar({ filters, onChange, onSubmit, onClear, loading }: {
  filters: Filters; onChange: (f: Filters) => void
  onSubmit: (e: FormEvent) => void; onClear: () => void; loading: boolean
}) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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

      <div>
        <label className="label">Availability</label>
        <select
          value={filters.availability}
          onChange={set('availability')}
          className="input bg-surface-overlay text-sm">
          <option value="">All availability statuses</option>
          <option value="open">🟢 Available</option>
          <option value="busy">🟡 Busy</option>
          <option value="unavailable">⚪ Unavailable</option>
        </select>
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

const EMPTY: Filters = { skills: '', role: '', location: '', language: '', availability: '' }

const Search = () => {
  usePageTitle('Find Talent')
  const { token } = useAuth()
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
        role:         f.role.trim()         || undefined,
        location:     f.location.trim()     || undefined,
        language:     f.language.trim()     || undefined,
        availability: f.availability.trim() || undefined,
      }, token ?? undefined)
      setResults(res.talent); setSearched(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runSearch(EMPTY) }, [token])

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
          {/* Sidebar desktop */}
          <aside className="hidden sm:block w-64 shrink-0">
            <div className="card p-5 sticky top-24">
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                onSubmit={handleSubmit}
                onClear={handleClear}
                loading={loading}
              />
            </div>
          </aside>

          {/* Sidebar mobile */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 sm:hidden bg-black/60 flex justify-end">
              <div className="w-80 bg-surface-card h-full p-6 overflow-y-auto">
                <FilterSidebar
                  filters={filters}
                  onChange={setFilters}
                  onSubmit={e => { handleSubmit(e); setSidebar(false) }}
                  onClear={() => { handleClear(); setSidebar(false) }}
                  loading={loading}
                />
              </div>
            </div>
          )}

          {/* Results grid */}
          <div className="flex-1 min-w-0">
            {error && (
              <div className="card p-4 border-l-4 border-l-red-500 bg-red-500/10 text-red-400 text-sm mb-6">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="card p-5 space-y-3">
                    <div className="flex gap-3">
                      <div className="skeleton w-11 h-11 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <div className="skeleton h-4 w-32 rounded" />
                        <div className="skeleton h-3 w-20 rounded" />
                      </div>
                    </div>
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-2/3 rounded" />
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="card p-12 text-center text-content-muted">
                <p className="text-3xl mb-3">🔍</p>
                <p className="font-semibold text-content-primary">No talent found</p>
                <p className="text-xs text-content-tertiary mt-1">Try relaxing your search terms or clearing filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map(t => (
                  <TalentCard key={t.id} talent={t} highlightSkills={highlightSkills} />
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
