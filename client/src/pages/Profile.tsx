import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Pencil,
  X,
  Check,
  ExternalLink,
  MessageCircle,
  Upload,
  Film,
  Trash2,
  Plus,
  FileText,
  Download,
  Play,
  Loader2,
} from 'lucide-react'
import {
  productionApi,
  talentApi,
  UpdateProductionProfilePayload,
  CreateTalentProfilePayload,
  TalentCredit,
  TalentAvailability,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { PublicFooter } from '../components/PublicFooter'
import { VerifiedBadge } from '../components/VerifiedBadge'

// ── Types ─────────────────────────────────────────────────────

interface ProductionData {
  id?: string
  type: 'production'
  company_name: string
  bio: string | null
  production_details: string | null
  logo_url: string | null
  verified?: boolean
}

interface TalentData {
  id?: string
  type: 'talent'
  full_name: string | null
  bio: string | null
  role: string | null
  roles?: string[]
  skills: string[]
  experience_years: number
  language: string | null
  location: string | null
  avatar_url: string | null
  portfolio_url: string | null
  showreel_url?: string | null
  availability?: TalentAvailability
  has_resume?: boolean
  credits?: TalentCredit[]
}

type ProfileData = ProductionData | TalentData

// ── Helpers ───────────────────────────────────────────────────

const ALLOWED_SHOWREEL_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
]

function getShowreelEmbedUrl(urlString: string): string | null {
  if (!urlString || typeof urlString !== 'string') return null
  try {
    const parsed = new URL(urlString.trim())
    const host = parsed.hostname.toLowerCase()
    if (!ALLOWED_SHOWREEL_HOSTS.includes(host)) return null

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0]
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
    }

    if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'www.youtube-nocookie.com'
    ) {
      if (parsed.pathname.startsWith('/embed/')) {
        const videoId = parsed.pathname.split('/')[2]
        return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
      }
      const videoId = parsed.searchParams.get('v')
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
    }

    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
      const match = parsed.pathname.match(/^\/(\d+)/)
      return match ? `https://player.vimeo.com/video/${match[1]}` : null
    }

    if (host === 'player.vimeo.com') {
      const match = parsed.pathname.match(/\/video\/(\d+)/)
      return match ? `https://player.vimeo.com/video/${match[1]}` : null
    }

    return null
  } catch {
    return null
  }
}

// ── Skill badge ───────────────────────────────────────────────

function SkillBadge({ label }: { label: string }) {
  return <span className="badge bg-surface-overlay border-surface-border text-content-secondary">{label}</span>
}

// ── Editable field ────────────────────────────────────────────

function EditableField({
  label, value, multiline, placeholder, onSave,
}: { label: string; value: string | null | undefined; multiline?: boolean; placeholder?: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  const save = async () => {
    setSaving(true)
    await onSave(draft).catch(() => {})
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-content-tertiary uppercase tracking-wider font-semibold">{label}</label>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-content-tertiary hover:text-brand"
            title="Edit">
            <Pencil size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand resize-none"
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand"
            />
          )}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => { setDraft(value ?? ''); setEditing(false) }}
              className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1">
              <X size={12} /> Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="btn-primary text-xs px-2.5 py-1 flex items-center gap-1">
              <Check size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-content-primary whitespace-pre-wrap">
          {value || <span className="text-content-muted italic">{placeholder || 'Not set'}</span>}
        </p>
      )}
    </div>
  )
}

// ── Profile Component ─────────────────────────────────────────

export function Profile() {
  const { user, token, logout } = useAuth()
  const navigate        = useNavigate()
  const { id: paramId } = useParams<{ id: string }>()

  const viewingOwnProfile = !paramId || paramId === user?.id

  const [profile, setProfile]     = useState<ProfileData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [, setUserId]             = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [resumeLoading, setResumeLoading]     = useState(false)
  const [resumeMessage, setResumeMessage]     = useState('')

  // Credits modal / form state
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null)
  const [creditForm, setCreditForm] = useState({
    project_title: '',
    role: '',
    year: new Date().getFullYear().toString(),
    production_company: '',
    description: '',
    link: '',
  })
  const [savingCredit, setSavingCredit] = useState(false)
  const [creditError, setCreditError]   = useState('')

  usePageTitle(profile
    ? (profile.type === 'production' ? profile.company_name : profile.full_name ?? 'Profile')
    : 'Profile'
  )

  useEffect(() => {
    const targetId = viewingOwnProfile ? (user?.id ?? '') : (paramId ?? '')
    if (!targetId) { setLoading(false); return }
    setUserId(targetId)
    loadProfile(targetId)
  }, [paramId, user?.id, token])

  const loadProfile = async (uid: string) => {
    setLoading(true)
    setError('')

    // 1. If viewing own profile and authenticated, use dedicated own profile endpoints
    if (viewingOwnProfile && token) {
      if (user?.role === 'production') {
        try {
          const res = await productionApi.getMyProfile(token)
          if (res?.profile) {
            setProfile({ type: 'production', ...res.profile })
            setLoading(false)
            return
          }
        } catch {
          // Fall through
        }
      } else if (user?.role === 'talent') {
        try {
          const res = await talentApi.getMyProfile(token)
          if (res?.profile) {
            setProfile({ type: 'talent', ...res.profile })
            setLoading(false)
            return
          }
        } catch {
          // Fall through
        }
      }
    }

    // 2. Try fetching as production profile by id / user_id
    try {
      const prod = await productionApi.getProfile(uid, token ?? undefined)
      if (prod?.profile) {
        setProfile({ type: 'production', ...prod.profile })
        setLoading(false)
        return
      }
    } catch {
      // not production
    }

    // 3. Try fetching as talent profile by id / user_id
    try {
      if (token) {
        const talent = await talentApi.getProfile(uid, token)
        if (talent?.profile) {
          setProfile({ type: 'talent', ...talent.profile })
          setLoading(false)
          return
        }
      }
    } catch {
      // not talent either
    }

    setError('Profile not found')
    setLoading(false)
  }

  // Generic save helper — updates profile via Express PUT endpoints
  const saveField = async (field: string, value: string) => {
    if (!token) return
    const isProduction = profile?.type === 'production'

    if (isProduction) {
      const update: UpdateProductionProfilePayload = {}
      if (field === 'company_name') update.company_name = value
      else if (field === 'bio') update.bio = value
      else if (field === 'production_details') update.production_details = value
      else if (field === 'logo_url') update.logo_url = value

      const res = await productionApi.updateProfile(update, token)
      setProfile(prev => prev ? ({ ...prev, ...res.profile, type: 'production' }) : null)
    } else {
      const update: Partial<CreateTalentProfilePayload> = {}
      if (field === 'skills') {
        update.skills = value.split(',').map(s => s.trim()).filter(Boolean)
      } else if (field === 'experience_years') {
        update.experience_years = parseInt(value, 10) || 0
      } else if (field === 'full_name') {
        update.full_name = value
      } else if (field === 'bio') {
        update.bio = value
      } else if (field === 'role') {
        update.role = value
      } else if (field === 'roles') {
        update.roles = value.split(',').map(s => s.trim()).filter(Boolean)
      } else if (field === 'language') {
        update.language = value
      } else if (field === 'location') {
        update.location = value
      } else if (field === 'avatar_url') {
        update.avatar_url = value
      } else if (field === 'portfolio_url') {
        update.portfolio_url = value
      } else if (field === 'showreel_url') {
        update.showreel_url = value || null
      }

      try {
        const res = await talentApi.updateProfile(update, token)
        setProfile(prev => prev ? ({ ...prev, ...res.profile, type: 'talent' }) : null)
      } catch (err: any) {
        alert(err.message || 'Failed to update field')
      }
    }
  }

  // Avatar upload via Server Endpoint
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingAvatar(true)
    try {
      const res = await talentApi.uploadAvatar(file, token)
      setProfile(prev => prev ? ({ ...prev, avatar_url: res.avatar_url }) : null)
    } catch (err: any) {
      alert(err.message || 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  // Resume upload via Server Endpoint
  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingResume(true)
    setResumeMessage('')
    try {
      await talentApi.uploadResume(file, token)
      setProfile(prev => prev ? ({ ...prev, has_resume: true }) : null)
      setResumeMessage('Resume uploaded successfully!')
    } catch (err: any) {
      alert(err.message || 'Failed to upload resume')
    } finally {
      setUploadingResume(false)
      e.target.value = ''
    }
  }

  // Delete resume via Server Endpoint
  const handleDeleteResume = async () => {
    if (!token || !confirm('Are you sure you want to delete your resume?')) return
    setResumeLoading(true)
    try {
      await talentApi.deleteResume(token)
      setProfile(prev => prev ? ({ ...prev, has_resume: false }) : null)
      setResumeMessage('Resume deleted')
    } catch (err: any) {
      alert(err.message || 'Failed to delete resume')
    } finally {
      setResumeLoading(false)
    }
  }

  // View / Download signed resume URL
  const handleViewResume = async () => {
    if (!token || !profile?.id) return
    setResumeLoading(true)
    try {
      const res = await talentApi.getResumeSignedUrl(profile.id, token)
      window.open(res.signed_url, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
      alert(err.message || 'Unable to open resume')
    } finally {
      setResumeLoading(false)
    }
  }

  // Availability change
  const handleAvailabilityChange = async (newVal: TalentAvailability) => {
    if (!token) return
    try {
      await talentApi.updateAvailability(newVal, token)
      setProfile(prev => prev ? ({ ...prev, availability: newVal }) : null)
    } catch (err: any) {
      alert(err.message || 'Failed to update availability')
    }
  }

  // Credits CRUD Handlers
  const openAddCreditModal = () => {
    setEditingCreditId(null)
    setCreditForm({
      project_title: '',
      role: '',
      year: new Date().getFullYear().toString(),
      production_company: '',
      description: '',
      link: '',
    })
    setCreditError('')
    setShowCreditModal(true)
  }

  const openEditCreditModal = (credit: TalentCredit) => {
    setEditingCreditId(credit.id)
    setCreditForm({
      project_title: credit.project_title,
      role: credit.role,
      year: credit.year ? credit.year.toString() : '',
      production_company: credit.production_company || '',
      description: credit.description || '',
      link: credit.link || '',
    })
    setCreditError('')
    setShowCreditModal(true)
  }

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSavingCredit(true)
    setCreditError('')

    const payload = {
      project_title: creditForm.project_title.trim(),
      role: creditForm.role.trim(),
      year: creditForm.year ? parseInt(creditForm.year, 10) : null,
      production_company: creditForm.production_company.trim() || null,
      description: creditForm.description.trim() || null,
      link: creditForm.link.trim() || null,
    }

    try {
      if (editingCreditId) {
        const res = await talentApi.updateCredit(editingCreditId, payload, token)
        setProfile(prev => {
          if (!prev || prev.type !== 'talent') return prev
          const updatedCredits = (prev.credits || []).map(c => c.id === editingCreditId ? res.credit : c)
          return { ...prev, credits: updatedCredits }
        })
      } else {
        const res = await talentApi.createCredit(payload, token)
        setProfile(prev => {
          if (!prev || prev.type !== 'talent') return prev
          const updatedCredits = [res.credit, ...(prev.credits || [])]
          return { ...prev, credits: updatedCredits }
        })
      }
      setShowCreditModal(false)
    } catch (err: any) {
      setCreditError(err.message || 'Failed to save credit')
    } finally {
      setSavingCredit(false)
    }
  }

  const handleDeleteCredit = async (creditId: string) => {
    if (!token || !confirm('Are you sure you want to delete this credit?')) return
    try {
      await talentApi.deleteCredit(creditId, token)
      setProfile(prev => {
        if (!prev || prev.type !== 'talent') return prev
        const updatedCredits = (prev.credits || []).filter(c => c.id !== creditId)
        return { ...prev, credits: updatedCredits }
      })
    } catch (err: any) {
      alert(err.message || 'Failed to delete credit')
    }
  }

  if (loading) {
    return (
      <div className="page">
        <header className="nav"><div className="nav-inner"><Link to="/home" className="brand-text text-xl font-semibold text-content-primary">Cine<span className="text-brand">Connect</span></Link></div></header>
        <main className="page-content">
          <div className="card p-8 space-y-4 max-w-2xl">
            {[1,2,3].map(i => <div key={i} className="skeleton h-6 rounded" />)}
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-content-primary font-medium mb-1">Profile not found</p>
          <Link to="/home" className="text-brand hover:text-brand-light text-sm transition-colors">← Back home</Link>
        </div>
      </div>
    )
  }

  const isOwn = viewingOwnProfile
  const showreelEmbed = profile?.type === 'talent' && profile.showreel_url ? getShowreelEmbedUrl(profile.showreel_url) : null

  return (
    <div className="page">
      <header className="nav">
        <div className="nav-inner">
          <Link to="/home" className="brand-text text-xl font-semibold text-content-primary tracking-tight">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/home"         className="nav-link">Home</Link>
            <Link to="/applications" className="nav-link">Applications</Link>
            {isOwn && (
              <Link to="/settings" className="nav-link">Settings</Link>
            )}
            {isOwn && (
              <button onClick={logout}
                className="nav-link text-red-400 hover:text-red-300">Sign out</button>
            )}
          </nav>
        </div>
      </header>

      <main className="page-content">
        <div className="max-w-2xl">

          {/* ── Header ────────────────────────────────────────── */}
          <div className="card p-6 mb-6">
            <div className="flex items-start gap-5">
              {/* Avatar with server-side upload */}
              <div className="shrink-0 relative group">
                {profile?.type === 'talent' && profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar"
                    loading="lazy" width={64} height={64}
                    className="w-16 h-16 rounded-full object-cover bg-surface-overlay" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-brand-dark
                    flex items-center justify-center text-gray-950 text-xl font-bold">
                    {profile?.type === 'production'
                      ? (profile.company_name?.[0] ?? '?').toUpperCase()
                      : (profile?.full_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                  </div>
                )}

                {/* Upload overlay for talent owner */}
                {isOwn && profile?.type === 'talent' && (
                  <label className="absolute inset-0 rounded-full flex items-center justify-center
                    bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Upload photo (JPEG, PNG, WebP ≤ 2MB)">
                    {uploadingAvatar ? (
                      <Loader2 size={16} className="text-white animate-spin" />
                    ) : (
                      <Upload size={16} className="text-white" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={handleAvatarFileChange}
                    />
                  </label>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="section-title mb-0 truncate">
                    {profile?.type === 'production'
                      ? profile.company_name
                      : profile?.full_name ?? user?.email}
                  </h1>
                  {profile?.type === 'production' && profile.verified && <VerifiedBadge />}
                </div>

                {profile?.type === 'talent' && profile.role && (
                  <p className="text-sm font-medium text-brand">{profile.role}</p>
                )}

                {/* Availability status badge or toggle */}
                {profile?.type === 'talent' && (
                  <div className="mt-2">
                    {isOwn ? (
                      <div className="inline-flex items-center gap-2">
                        <span className="text-xs text-content-tertiary">Status:</span>
                        <select
                          value={profile.availability || 'open'}
                          onChange={e => handleAvailabilityChange(e.target.value as TalentAvailability)}
                          className="bg-surface-overlay text-xs border border-surface-border rounded px-2 py-1 text-content-primary focus:outline-none focus:border-brand">
                          <option value="open">🟢 Open to Work</option>
                          <option value="busy">🟡 Busy on Project</option>
                          <option value="unavailable">⚪ Unavailable</option>
                        </select>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        profile.availability === 'open' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                        profile.availability === 'busy' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          profile.availability === 'open' ? 'bg-emerald-500' :
                          profile.availability === 'busy' ? 'bg-amber-500' : 'bg-gray-400'
                        }`} />
                        {profile.availability === 'open' ? 'Open to Work' : profile.availability === 'busy' ? 'Busy on Project' : 'Unavailable'}
                      </span>
                    )}
                  </div>
                )}

                {profile?.type === 'talent' && (
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-content-tertiary">
                    {profile.location     && <span>📍 {profile.location}</span>}
                    {profile.language     && <span>🗣 {profile.language}</span>}
                    {profile.experience_years > 0 && <span>🎬 {profile.experience_years}y exp</span>}
                  </div>
                )}

                <p className="text-xs text-content-muted mt-1">
                  {profile?.type === 'production' ? 'Production House' : 'Talent'}
                </p>
              </div>

              {/* Message button for non-own profiles */}
              {!isOwn && paramId && (
                <button
                  onClick={() => navigate(`/chat?peer=${paramId}`)}
                  className="btn-outline flex items-center gap-2 shrink-0">
                  <MessageCircle size={15} /> Message
                </button>
              )}
            </div>
          </div>

          {/* ── Details ───────────────────────────────────────── */}
          <div className="card p-6 space-y-6">
            {profile?.type === 'production' && (
              <>
                {isOwn ? (
                  <>
                    <EditableField label="Company name" value={profile.company_name} onSave={v => saveField('company_name', v)} />
                    <EditableField label="Bio" value={profile.bio} multiline onSave={v => saveField('bio', v)} />
                    <EditableField label="Production details" value={profile.production_details} multiline onSave={v => saveField('production_details', v)} />
                  </>
                ) : (
                  <>
                    <div><p className="text-xs text-content-tertiary uppercase tracking-wider mb-1">Bio</p><p className="text-sm text-content-primary">{profile.bio ?? 'No bio set'}</p></div>
                    <div><p className="text-xs text-content-tertiary uppercase tracking-wider mb-1">Production details</p><p className="text-sm text-content-primary whitespace-pre-wrap">{profile.production_details ?? '—'}</p></div>
                  </>
                )}
              </>
            )}

            {profile?.type === 'talent' && (
              <>
                {isOwn ? (
                  <>
                    <EditableField label="Full name" value={profile.full_name} onSave={v => saveField('full_name', v)} />
                    <EditableField label="Primary Role" value={profile.role} onSave={v => saveField('role', v)} />
                    <EditableField
                      label="All Roles (comma-separated, includes secondary roles)"
                      value={profile.roles?.join(', ') || profile.role || ''}
                      placeholder="e.g. Cinematographer, Colorist, Camera Operator"
                      onSave={v => saveField('roles', v)}
                    />
                    <EditableField label="Bio" value={profile.bio} multiline onSave={v => saveField('bio', v)} />
                    <EditableField label="Skills (comma-separated)" value={profile.skills.join(', ')} onSave={v => saveField('skills', v)} />
                    <EditableField label="Location" value={profile.location} onSave={v => saveField('location', v)} />
                    <EditableField label="Language" value={profile.language} onSave={v => saveField('language', v)} />
                    <EditableField label="Portfolio URL" value={profile.portfolio_url} onSave={v => saveField('portfolio_url', v)} />
                    <EditableField
                      label="Showreel URL (YouTube or Vimeo)"
                      value={profile.showreel_url}
                      placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                      onSave={v => saveField('showreel_url', v)}
                    />
                  </>
                ) : (
                  <>
                    <div><p className="text-xs text-content-tertiary uppercase tracking-wider mb-1">Bio</p><p className="text-sm text-content-primary">{profile.bio ?? '—'}</p></div>
                    {profile.roles && profile.roles.length > 1 && (
                      <div>
                        <p className="text-xs text-content-tertiary uppercase tracking-wider mb-2">Roles</p>
                        <div className="flex flex-wrap gap-2">
                          {profile.roles.map(r => (
                            <span key={r} className="badge bg-brand/10 border-brand/30 text-brand font-medium">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.skills.length > 0 && (
                      <div>
                        <p className="text-xs text-content-tertiary uppercase tracking-wider mb-2">Skills</p>
                        <div className="flex flex-wrap gap-2">{profile.skills.map(s => <SkillBadge key={s} label={s} />)}</div>
                      </div>
                    )}
                    {profile.portfolio_url && (
                      <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand hover:text-brand-light text-sm transition-colors">
                        View portfolio <ExternalLink size={13} />
                      </a>
                    )}
                  </>
                )}

                {/* ── Showreel Embed ─────────────────────────────── */}
                <div>
                  <p className="text-xs text-content-tertiary uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
                    <Play size={13} /> Showreel
                  </p>
                  {showreelEmbed ? (
                    <div className="rounded-xl overflow-hidden border border-surface-border aspect-video bg-black/40 shadow-sm">
                      <iframe
                        src={showreelEmbed}
                        title="Showreel"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    </div>
                  ) : profile.showreel_url ? (
                    <p className="text-xs text-amber-500">
                      Showreel link provided ({profile.showreel_url}) must be a valid YouTube or Vimeo link to embed.
                    </p>
                  ) : (
                    <p className="text-sm text-content-muted italic">No showreel added</p>
                  )}
                </div>

                {/* ── Resume / CV Section ────────────────────────── */}
                <div className="pt-4 border-t border-surface-border">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-content-tertiary uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <FileText size={13} /> Resume / CV
                    </p>
                    {isOwn && profile.has_resume && (
                      <button onClick={handleDeleteResume} disabled={resumeLoading}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  {profile.has_resume ? (
                    <div className="p-3.5 bg-surface-overlay rounded-xl border border-surface-border flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <FileText size={20} className="text-brand shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-content-primary">Resume Document (PDF)</p>
                          <p className="text-xs text-content-tertiary">Verified and secured</p>
                        </div>
                      </div>
                      <button
                        onClick={handleViewResume}
                        disabled={resumeLoading}
                        className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0">
                        {resumeLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        View Resume
                      </button>
                    </div>
                  ) : (
                    <div>
                      {isOwn ? (
                        <div className="p-4 border border-dashed border-surface-border rounded-xl text-center">
                          <p className="text-xs text-content-tertiary mb-2">Upload your resume in PDF format (up to 5 MB)</p>
                          <label className="btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer">
                            {uploadingResume ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                            Upload PDF Resume
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              disabled={uploadingResume}
                              onChange={handleResumeFileChange}
                            />
                          </label>
                        </div>
                      ) : (
                        <p className="text-sm text-content-muted italic">No resume uploaded</p>
                      )}
                    </div>
                  )}
                  {resumeMessage && <p className="text-xs text-emerald-500 mt-2">{resumeMessage}</p>}
                </div>

                {/* ── Credits & Filmography ──────────────────────── */}
                <div className="pt-4 border-t border-surface-border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-content-tertiary uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Film size={13} /> Filmography & Credits
                      </p>
                      {isOwn && (
                        <p className="text-[11px] text-content-muted">
                          {(profile.credits?.length || 0)} of 50 credits added
                        </p>
                      )}
                    </div>
                    {isOwn && (
                      <button
                        onClick={openAddCreditModal}
                        disabled={(profile.credits?.length || 0) >= 50}
                        className="btn-primary text-xs px-3 py-1 flex items-center gap-1">
                        <Plus size={13} /> Add Credit
                      </button>
                    )}
                  </div>

                  {profile.credits && profile.credits.length > 0 ? (
                    <div className="space-y-3">
                      {profile.credits.map(credit => (
                        <div
                          key={credit.id}
                          className="p-3.5 bg-surface-overlay rounded-xl border border-surface-border flex items-start justify-between gap-3 group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-content-heading">{credit.project_title}</h4>
                              {credit.year && (
                                <span className="text-xs text-content-tertiary font-medium">({credit.year})</span>
                              )}
                              <span className="badge bg-brand/10 border-brand/30 text-brand text-[11px]">
                                {credit.role}
                              </span>
                            </div>
                            {credit.production_company && (
                              <p className="text-xs text-content-secondary mt-0.5">
                                Production: {credit.production_company}
                              </p>
                            )}
                            {credit.description && (
                              <p className="text-xs text-content-tertiary mt-1 whitespace-pre-wrap">
                                {credit.description}
                              </p>
                            )}
                            {credit.link && (
                              <a
                                href={credit.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline mt-1.5">
                                Project Link <ExternalLink size={10} />
                              </a>
                            )}
                          </div>

                          {isOwn && (
                            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditCreditModal(credit)}
                                className="p-1 text-content-tertiary hover:text-brand transition-colors"
                                title="Edit credit">
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteCredit(credit.id)}
                                className="p-1 text-content-tertiary hover:text-red-400 transition-colors"
                                title="Delete credit">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-content-muted italic">No credits listed yet</p>
                  )}
                </div>
              </>
            )}

            {isOwn && (
              <div className="card p-5 border-surface-border bg-surface-section flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                <div>
                  <h4 className="text-sm font-semibold text-content-heading">Data Rights & Privacy (DPDP / GDPR)</h4>
                  <p className="text-xs text-content-tertiary">Download your data, inspect legal consents, or request account erasure.</p>
                </div>
                <Link to="/settings" className="btn-secondary text-xs whitespace-nowrap self-start sm:self-auto">
                  Manage Data & Privacy
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Credit Modal ─────────────────────────────────────── */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-content-heading">
                {editingCreditId ? 'Edit Credit' : 'Add Production Credit'}
              </h3>
              <button
                onClick={() => setShowCreditModal(false)}
                className="text-content-tertiary hover:text-content-primary">
                <X size={18} />
              </button>
            </div>

            {creditError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {creditError}
              </p>
            )}

            <form onSubmit={handleSaveCredit} className="space-y-3.5">
              <div>
                <label className="text-xs text-content-secondary font-medium block mb-1">
                  Project Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sacred Games, Gully Boy"
                  value={creditForm.project_title}
                  onChange={e => setCreditForm({ ...creditForm, project_title: e.target.value })}
                  className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-content-secondary font-medium block mb-1">
                    Role <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Camera Operator"
                    value={creditForm.role}
                    onChange={e => setCreditForm({ ...creditForm, role: e.target.value })}
                    className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="text-xs text-content-secondary font-medium block mb-1">Year</label>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="e.g. 2023"
                    value={creditForm.year}
                    onChange={e => setCreditForm({ ...creditForm, year: e.target.value })}
                    className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-content-secondary font-medium block mb-1">Production Company / Client</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Dharma Productions"
                  value={creditForm.production_company}
                  onChange={e => setCreditForm({ ...creditForm, production_company: e.target.value })}
                  className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs text-content-secondary font-medium block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Details about your responsibilities or achievements"
                  value={creditForm.description}
                  onChange={e => setCreditForm({ ...creditForm, description: e.target.value })}
                  className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-content-secondary font-medium block mb-1">Project Link (IMDb, Trailer, etc.)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={creditForm.link}
                  onChange={e => setCreditForm({ ...creditForm, link: e.target.value })}
                  className="w-full text-sm bg-surface-overlay border border-surface-border rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="btn-secondary text-xs px-3 py-1.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCredit}
                  className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5">
                  {savingCredit && <Loader2 size={13} className="animate-spin" />}
                  {editingCreditId ? 'Save Changes' : 'Add Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  )
}

export default Profile
