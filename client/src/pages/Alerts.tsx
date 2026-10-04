import { useState, useEffect, useCallback, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, Plus, Trash2, CheckCircle2, PauseCircle, MapPin,
  Globe, Film, Sparkles, AlertCircle, X, Loader2, ArrowLeft, RefreshCw
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { talentAlertsApi, TalentAlert } from '../lib/api'

export default function Alerts() {
  usePageTitle('Talent Alerts')
  const { token } = useAuth()
  const accessToken = token ?? ''

  const [alerts, setAlerts] = useState<TalentAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [role, setRole] = useState('')
  const [skillsInput, setSkillsInput] = useState('')
  const [location, setLocation] = useState('')
  const [language, setLanguage] = useState('')

  // Action loading states
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const res = await talentAlertsApi.list(accessToken)
      setAlerts(res.alerts ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load talent alerts')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleToggleActive = async (alertItem: TalentAlert) => {
    if (!accessToken || togglingId) return
    const nextActive = !alertItem.active
    setTogglingId(alertItem.id)

    // Optimistic update
    setAlerts(prev => prev.map(a => a.id === alertItem.id ? { ...a, active: nextActive } : a))

    try {
      const res = await talentAlertsApi.update(alertItem.id, { active: nextActive }, accessToken)
      setAlerts(prev => prev.map(a => a.id === alertItem.id ? res.alert : a))
    } catch (err: unknown) {
      // Rollback
      setAlerts(prev => prev.map(a => a.id === alertItem.id ? { ...a, active: alertItem.active } : a))
      setError('Failed to update alert: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string, alertLabel: string) => {
    if (!accessToken || deletingId) return
    if (!window.confirm(`Delete alert "${alertLabel}"?`)) return

    setDeletingId(id)
    try {
      await talentAlertsApi.delete(id, accessToken)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (err: unknown) {
      setError('Failed to delete alert: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!accessToken) return

    if (!label.trim()) {
      setCreateError('Alert name / label is required')
      return
    }

    setCreateLoading(true)
    setCreateError(null)

    const parsedSkills = skillsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    try {
      const res = await talentAlertsApi.create(
        {
          label: label.trim(),
          role: role.trim() || undefined,
          skills: parsedSkills.length > 0 ? parsedSkills : undefined,
          location: location.trim() || undefined,
          language: language.trim() || undefined,
        },
        accessToken
      )

      setAlerts(prev => [res.alert, ...prev])
      setIsModalOpen(false)
      // Reset form
      setLabel('')
      setRole('')
      setSkillsInput('')
      setLocation('')
      setLanguage('')
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create alert')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-section py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div>
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-brand transition-colors mb-4"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                  <Bell size={20} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-content-heading">Talent Alerts</h1>
                  <p className="text-sm text-content-secondary">
                    Get automated notifications when candidates matching your production criteria register.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setCreateError(null); setIsModalOpen(true) }}
              className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto shrink-0 shadow-sm"
              id="create-alert-btn"
            >
              <Plus size={16} /> Create Alert
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="card p-6 bg-red-50/70 border-red-200 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">Error loading alerts</h3>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={fetchAlerts}
              className="btn-ghost text-xs text-red-700 hover:bg-red-100 flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="card p-6 border border-surface-border animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 w-1/3">
                    <div className="h-5 bg-slate-200 rounded" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="h-8 w-24 bg-slate-200 rounded-full" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-20 bg-slate-200 rounded-md" />
                  <div className="h-6 w-28 bg-slate-200 rounded-md" />
                  <div className="h-6 w-16 bg-slate-200 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && alerts.length === 0 && (
          <div className="card p-12 text-center border-dashed border-2 border-surface-border space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-brand/5 border border-brand/10 text-brand mx-auto flex items-center justify-center">
              <Bell size={28} className="opacity-60" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-lg font-bold text-content-heading">No talent alerts yet</h3>
              <p className="text-sm text-content-secondary">
                Stay ahead of casting and crew hiring. Set criteria for roles, skills, and locations to receive automated notifications.
              </p>
            </div>
            <button
              onClick={() => { setCreateError(null); setIsModalOpen(true) }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} /> Create your first alert
            </button>
          </div>
        )}

        {/* Alerts List */}
        {!loading && !error && alerts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-content-secondary px-1">
              <span>{alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'} configured</span>
              <span>Active alerts trigger notifications on new matches</span>
            </div>

            {alerts.map(item => (
              <div
                key={item.id}
                className={`card p-5 border transition-all duration-200 ${
                  item.active
                    ? 'border-surface-border hover:border-brand/30 shadow-card-sm'
                    : 'border-surface-border/60 bg-slate-50/50 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-content-heading">{item.label}</h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {item.active ? (
                          <>
                            <CheckCircle2 size={12} className="text-emerald-600" /> Active
                          </>
                        ) : (
                          <>
                            <PauseCircle size={12} className="text-slate-400" /> Paused
                          </>
                        )}
                      </span>
                    </div>

                    {/* Criteria pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      {item.role && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-brand font-medium border border-brand/20">
                          <Film size={12} /> {item.role}
                        </span>
                      )}

                      {item.location && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-section text-content-secondary border border-surface-border">
                          <MapPin size={12} /> {item.location}
                        </span>
                      )}

                      {item.language && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-section text-content-secondary border border-surface-border">
                          <Globe size={12} /> {item.language}
                        </span>
                      )}

                      {item.skills && item.skills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-normal text-[11px]"
                            >
                              <Sparkles size={10} className="text-brand" /> {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {!item.role && !item.location && !item.language && (!item.skills || item.skills.length === 0) && (
                        <span className="text-xs text-content-muted italic">Matches all new candidates</span>
                      )}
                    </div>

                    <p className="text-[11px] text-content-muted pt-1">
                      Created {new Date(item.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 sm:self-center shrink-0">
                    <button
                      onClick={() => handleToggleActive(item)}
                      disabled={togglingId === item.id}
                      className={`btn text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                        item.active
                          ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                      title={item.active ? 'Pause notifications' : 'Resume notifications'}
                    >
                      {togglingId === item.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : item.active ? (
                        <>
                          <PauseCircle size={14} /> Pause
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} /> Activate
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(item.id, item.label)}
                      disabled={deletingId === item.id}
                      className="p-2 rounded-lg text-content-muted hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                      title="Delete alert"
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={15} className="animate-spin text-red-500" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(11,37,69,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-2xl shadow-card-md w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-brand" />
                <h2 className="text-base font-bold text-content-heading">Create Talent Alert</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-content-tertiary hover:text-content-primary hover:bg-surface-section transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="label">
                  Alert Label / Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Cinematographers in Mumbai"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Primary Role (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Cinematographer, Editor, Sound Designer"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Required Skills (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. RED Camera, Arri, Color Grading"
                  value={skillsInput}
                  onChange={e => setSkillsInput(e.target.value)}
                  className="input"
                />
                <p className="text-[11px] text-content-muted mt-1">Separate multiple skills with commas</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, Remote"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Language</label>
                  <input
                    type="text"
                    placeholder="e.g. Hindi, English"
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost text-sm"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  {createLoading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save Alert'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
