import { useState, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Film, Check } from 'lucide-react'
import { productionApi, talentApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

// ── Step dot ──────────────────────────────────────────────────

function StepDot({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  const base = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 transition-all'
  if (done)   return <div className={`${base} bg-brand border-brand text-white`}><Check size={14} /></div>
  if (active) return <div className={`${base} border-brand text-brand bg-blue-50`}>{label}</div>
  return        <div className={`${base} border-surface-border text-content-muted bg-white`}>{label}</div>
}

// ── Production form ───────────────────────────────────────────

interface ProdForm   { company_name: string; bio: string; production_details: string }
interface ProdErrors { company_name?: string; bio?: string; production_details?: string }

function ProductionForm({ userId, token, onDone }: {
  userId: string; token: string; onDone: (id: string) => void
}) {
  const [form, setForm]     = useState<ProdForm>({ company_name: '', bio: '', production_details: '' })
  const [errors, setErrors] = useState<ProdErrors>({})
  const [serverError, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const bioLeft     = 500  - form.bio.length
  const detailsLeft = 2000 - form.production_details.length

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
    setErrors(p => ({ ...p, [name]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setErr('')
    const err: ProdErrors = {}
    if (!form.company_name.trim()) err.company_name = 'Company name is required'
    if (form.bio.length > 500) err.bio = 'Max 500 characters'
    if (form.production_details.length > 2000) err.production_details = 'Max 2000 characters'
    if (Object.keys(err).length) { setErrors(err); return }
    setLoading(true)
    try {
      const res = await productionApi.createProfile({
        user_id: userId, company_name: form.company_name.trim(),
        bio: form.bio.trim() || undefined,
        production_details: form.production_details.trim() || undefined,
      }, token)
      onDone(res.profile.id)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not create profile') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="company_name" className="label">
          Company name <span className="text-red-500">*</span>
        </label>
        <input id="company_name" name="company_name" type="text" autoFocus
          value={form.company_name} onChange={set} placeholder="e.g. Horizon Films"
          className={errors.company_name ? 'input-error' : 'input'} />
        {errors.company_name && <p className="mt-1.5 text-xs text-red-500">{errors.company_name}</p>}
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <label htmlFor="bio" className="label mb-0">Bio</label>
          <span className={`text-xs ${bioLeft < 50 ? 'text-amber-600' : 'text-content-muted'}`}>{bioLeft} left</span>
        </div>
        <textarea id="bio" name="bio" rows={3} value={form.bio} onChange={set}
          placeholder="A short description of your studio…"
          className="input resize-none" />
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <label htmlFor="production_details" className="label mb-0">Production details</label>
          <span className={`text-xs ${detailsLeft < 200 ? 'text-amber-600' : 'text-content-muted'}`}>{detailsLeft} left</span>
        </div>
        <textarea id="production_details" name="production_details" rows={5} value={form.production_details} onChange={set}
          placeholder="Describe your current or upcoming productions…"
          className="input resize-none" />
      </div>

      {serverError && <div className="error-banner"><p className="text-sm text-red-600">{serverError}</p></div>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Saving…' : 'Complete setup'}
      </button>
    </form>
  )
}

// ── Talent form ───────────────────────────────────────────────

interface TalentForm   { full_name: string; role: string; bio: string; skills: string; location: string; language: string }
interface TalentErrors { full_name?: string; role?: string }

function TalentForm({ userId, token, onDone }: {
  userId: string; token: string; onDone: (id: string) => void
}) {
  const [form, setForm]     = useState<TalentForm>({ full_name: '', role: '', bio: '', skills: '', location: '', language: '' })
  const [errors, setErrors] = useState<TalentErrors>({})
  const [serverError, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
    setErrors(p => ({ ...p, [name]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setErr('')
    const err: TalentErrors = {}
    if (!form.full_name.trim()) err.full_name = 'Full name is required'
    if (!form.role.trim()) err.role = 'Primary role is required'
    if (Object.keys(err).length) { setErrors(err); return }
    setLoading(true)
    try {
      const skills = form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : []
      const res = await talentApi.createProfile({
        user_id: userId, full_name: form.full_name.trim(), role: form.role.trim(),
        bio: form.bio.trim() || undefined, skills,
        location: form.location.trim() || undefined, language: form.language.trim() || undefined,
      }, token)
      onDone(res.profile.id)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not create profile') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="full_name" className="label">
            Full name <span className="text-red-500">*</span>
          </label>
          <input id="full_name" name="full_name" type="text" autoFocus
            value={form.full_name} onChange={set} placeholder="Priya Sharma"
            className={errors.full_name ? 'input-error' : 'input'} />
          {errors.full_name && <p className="mt-1.5 text-xs text-red-500">{errors.full_name}</p>}
        </div>
        <div>
          <label htmlFor="role" className="label">
            Primary role <span className="text-red-500">*</span>
          </label>
          <input id="role" name="role" type="text"
            value={form.role} onChange={set} placeholder="e.g. Cinematographer"
            className={errors.role ? 'input-error' : 'input'} />
          {errors.role && <p className="mt-1.5 text-xs text-red-500">{errors.role}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="skills" className="label">Skills</label>
        <input id="skills" name="skills" type="text"
          value={form.skills} onChange={set}
          placeholder="Cinematography, Lighting, DaVinci Resolve…" className="input" />
        <p className="mt-1 text-xs text-content-muted">Comma-separated</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="location" className="label">Location</label>
          <input id="location" name="location" type="text"
            value={form.location} onChange={set} placeholder="e.g. Mumbai" className="input" />
        </div>
        <div>
          <label htmlFor="language" className="label">Language</label>
          <input id="language" name="language" type="text"
            value={form.language} onChange={set} placeholder="e.g. English" className="input" />
        </div>
      </div>

      <div>
        <label htmlFor="bio" className="label">Bio</label>
        <textarea id="bio" name="bio" rows={3} value={form.bio} onChange={set}
          placeholder="A short intro about yourself and your work…" className="input resize-none" />
      </div>

      {serverError && <div className="error-banner"><p className="text-sm text-red-600">{serverError}</p></div>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Saving…' : 'Complete setup'}
      </button>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────

const CreateProfile = () => {
  const navigate                  = useNavigate()
  const location                  = useLocation()
  const { user, token, setProfileId } = useAuth()

  const state       = location.state as { user_id?: string; role?: string } | null
  const userId      = state?.user_id ?? user?.id ?? ''
  const role        = (state?.role ?? user?.role ?? 'production') as 'production' | 'talent'
  const accessToken = token ?? ''
  const isProduction = role === 'production'

  usePageTitle('Create Profile')

  const handleDone = (profileId: string) => {
    setProfileId(profileId)
    navigate('/home')
  }

  return (
    <div className="min-h-screen bg-surface-section flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-navy mb-4">
            <Film size={22} className="text-white" />
          </div>
          <h1 className="brand-text text-3xl text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </h1>
          <p className="mt-2 text-sm text-content-tertiary">
            {isProduction ? 'Set up your studio profile' : 'Set up your talent profile'}
          </p>
        </div>

        <div className="card p-8 shadow-card-md">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            <StepDot done label="1" />
            <div className="h-0.5 flex-1 bg-brand rounded-full" />
            <StepDot done label="2" />
            <div className="h-0.5 flex-1 bg-brand rounded-full" />
            <StepDot active label="3" />
          </div>

          <h2 className="text-xl font-bold text-content-heading mb-1">
            {isProduction ? 'Production house profile' : 'Your talent profile'}
          </h2>
          <p className="text-sm text-content-secondary mb-6">
            {isProduction ? 'Tell talent who you are and what you\'re working on.' : 'Help production houses find you.'}
          </p>

          {isProduction
            ? <ProductionForm userId={userId} token={accessToken} onDone={handleDone} />
            : <TalentForm     userId={userId} token={accessToken} onDone={handleDone} />
          }
        </div>
      </div>
    </div>
  )
}

export default CreateProfile
