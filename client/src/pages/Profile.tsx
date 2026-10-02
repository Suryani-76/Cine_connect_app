import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, X, Check, ExternalLink, MessageCircle, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

// ── Types ─────────────────────────────────────────────────────

interface ProductionData {
  type: 'production'
  company_name: string
  bio: string | null
  production_details: string | null
  logo_url: string | null
}

interface TalentData {
  type: 'talent'
  full_name: string | null
  bio: string | null
  role: string | null
  skills: string[]
  experience_years: number
  language: string | null
  location: string | null
  avatar_url: string | null
  portfolio_url: string | null
}

type ProfileData = ProductionData | TalentData

// ── Skill badge ───────────────────────────────────────────────

function SkillBadge({ label }: { label: string }) {
  return <span className="badge bg-surface-overlay border-surface-border text-content-secondary">{label}</span>
}

// ── Editable field ────────────────────────────────────────────

function EditableField({
  label, value, multiline, onSave,
}: { label: string; value: string | null; multiline?: boolean; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')
  const [saving, setSaving]   = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave(draft).catch(() => {})
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-content-tertiary uppercase tracking-wider">{label}</span>
        {!editing && (
          <button onClick={() => { setDraft(value ?? ''); setEditing(true) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-content-tertiary hover:text-brand">
            <Pencil size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {multiline
            ? <textarea rows={4} value={draft} onChange={e => setDraft(e.target.value)}
                className="input resize-none text-sm" />
            : <input value={draft} onChange={e => setDraft(e.target.value)} className="input text-sm" />
          }
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1">
              <Check size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={`text-sm ${value ? 'text-content-primary' : 'text-content-muted italic'}`}>
          {value || `No ${label.toLowerCase()} set`}
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

const Profile = () => {
  const { user, logout } = useAuth()
  const { id: paramId }  = useParams<{ id?: string }>()
  const navigate         = useNavigate()
  const viewingOwnProfile = !paramId || paramId === user?.id
  usePageTitle(viewingOwnProfile ? 'My Profile' : 'Profile')

  const [profile, setProfile]   = useState<ProfileData | null>(null)
  const [userId, setUserId]      = useState<string>(viewingOwnProfile ? (user?.id ?? '') : paramId ?? '')
  const [loading, setLoading]   = useState(true)
  const [error, setError]        = useState('')

  useEffect(() => {
    const targetId = viewingOwnProfile ? (user?.id ?? '') : (paramId ?? '')
    if (!targetId) { setLoading(false); return }
    setUserId(targetId)
    loadProfile(targetId)
  }, [paramId, user?.id])

  const loadProfile = async (uid: string) => {
    setLoading(true)
    setError('')

    // Try production profile first
    const { data: prod } = await supabase
      .from('production_profiles')
      .select('company_name, bio, production_details, logo_url')
      .eq('user_id', uid)
      .single()

    if (prod) {
      setProfile({ type: 'production', ...prod })
      setLoading(false)
      return
    }

    // Fallback to talent profile
    const { data: talent } = await supabase
      .from('talent_profiles')
      .select('full_name, bio, role, skills, experience_years, language, location, avatar_url, portfolio_url')
      .eq('user_id', uid)
      .single()

    if (talent) {
      setProfile({ type: 'talent', ...talent })
      setLoading(false)
      return
    }

    setError('Profile not found')
    setLoading(false)
  }

  // Generic save helper — updates the right table
  const saveField = async (field: string, value: string) => {
    const table = profile?.type === 'production' ? 'production_profiles' : 'talent_profiles'
    const update: Record<string, string | string[] | number> = {}

    if (field === 'skills') {
      update.skills = value.split(',').map(s => s.trim()).filter(Boolean)
    } else if (field === 'experience_years') {
      update.experience_years = parseInt(value, 10) || 0
    } else {
      update[field] = value
    }

    const { error: e } = await supabase.from(table).update(update).eq('user_id', userId)
    if (e) throw e

    // Refresh local state
    setProfile(prev => {
      if (!prev) return prev
      if (field === 'skills' && prev.type === 'talent') {
        return { ...prev, skills: update.skills as string[] }
      }
      return { ...prev, [field]: update[field] } as ProfileData
    })
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
              {/* Avatar with upload for own profile */}
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
                {/* Upload overlay for own profile */}
                {isOwn && (
                  <label className="absolute inset-0 rounded-full flex items-center justify-center
                    bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Upload photo">
                    <Upload size={16} className="text-white" />
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file || !userId) return
                        const ext  = file.name.split('.').pop()
                        const path = `avatars/${userId}.${ext}`
                        const { error: upErr } = await supabase.storage
                          .from('avatars')
                          .upload(path, file, { upsert: true })
                        if (upErr) return
                        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
                        const url = urlData.publicUrl
                        await saveField('avatar_url', url)
                      }} />
                  </label>
                )}
              </div>

              <div className="flex-1">
                <h1 className="section-title mb-0.5">
                  {profile?.type === 'production'
                    ? profile.company_name
                    : profile?.full_name ?? user?.email}
                </h1>
                {profile?.type === 'talent' && profile.role && (
                  <p className="text-sm text-brand">{profile.role}</p>
                )}
                {profile?.type === 'talent' && (
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-content-tertiary">
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
                    <EditableField label="Role" value={profile.role} onSave={v => saveField('role', v)} />
                    <EditableField label="Bio" value={profile.bio} multiline onSave={v => saveField('bio', v)} />
                    <EditableField label="Skills (comma-separated)" value={profile.skills.join(', ')} onSave={v => saveField('skills', v)} />
                    <EditableField label="Location" value={profile.location} onSave={v => saveField('location', v)} />
                    <EditableField label="Language" value={profile.language} onSave={v => saveField('language', v)} />
                    <EditableField label="Portfolio URL" value={profile.portfolio_url} onSave={v => saveField('portfolio_url', v)} />
                  </>
                ) : (
                  <>
                    <div><p className="text-xs text-content-tertiary uppercase tracking-wider mb-1">Bio</p><p className="text-sm text-content-primary">{profile.bio ?? '—'}</p></div>
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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Profile
