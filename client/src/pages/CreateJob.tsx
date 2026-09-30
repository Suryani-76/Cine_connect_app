import { useState, FormEvent, KeyboardEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { jobsApi, SetRequirementsPayload } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

interface Step1Form { title: string; description: string }
interface Step2Form {
  skills: string[]; roles: string[]
  experience_level: 'entry' | 'mid' | 'senior' | 'any' | ''
  language: string; location: string
}
interface Step1Errors { title?: string; description?: string }
interface Step2Errors { skills?: string; roles?: string }

const EXP_OPTIONS: { value: Step2Form['experience_level']; label: string }[] = [
  { value: '', label: 'Any level' },
  { value: 'entry',  label: 'Entry'  },
  { value: 'mid',    label: 'Mid'    },
  { value: 'senior', label: 'Senior' },
  { value: 'any',    label: 'Any'    },
]

// ── Step indicator ────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ['Job details', 'Requirements', 'Review & publish']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n      = i + 1
        const done   = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done   ? 'bg-brand border-brand text-white'
                : active ? 'border-brand text-brand bg-blue-50'
                :          'border-surface-border text-content-muted bg-white'}`}>
                {done ? <Check size={14} /> : n}
              </div>
              <span className={`text-sm hidden sm:block font-medium
                ${active ? 'text-content-heading' : done ? 'text-content-secondary' : 'text-content-muted'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors
                ${done ? 'bg-brand' : 'bg-surface-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tag input ─────────────────────────────────────────────────

function TagInput({ label, placeholder, tags, onChange, error }: {
  label: string; placeholder: string; tags: string[]
  onChange: (t: string[]) => void; error?: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className={`flex flex-wrap gap-2 rounded-btn bg-white border px-3 py-2
        focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand transition
        ${error ? 'border-red-400' : 'border-surface-border'}`}>
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 bg-blue-50 text-brand border border-brand/20
            text-xs px-2.5 py-1 rounded-full font-medium">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))}
              className="text-brand/60 hover:text-brand ml-0.5 transition-colors">×</button>
          </span>
        ))}
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey} onBlur={add}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-content-primary
            placeholder-content-muted outline-none" />
      </div>
      <p className="mt-1 text-xs text-content-muted">Press Enter or comma to add</p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Review row ────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-xs font-medium text-content-tertiary w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-content-primary">{value}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

const CreateJob = () => {
  usePageTitle('Create Job')
  const navigate = useNavigate()
  const { user, token: authToken } = useAuth()
  const accessToken  = authToken ?? ''
  const productionId = user?.profileId ?? ''

  const [step, setStep]             = useState(1)
  const [createdJobId, setJobId]    = useState<string | null>(null)
  const [step1, setStep1]           = useState<Step1Form>({ title: '', description: '' })
  const [step1Errors, setS1Errors]  = useState<Step1Errors>({})
  const [step2, setStep2]           = useState<Step2Form>({ skills: [], roles: [], experience_level: '', language: '', location: '' })
  const [step2Errors, setS2Errors]  = useState<Step2Errors>({})
  const [loading, setLoading]       = useState(false)
  const [serverError, setServerError] = useState('')

  const descRemaining = 5000 - step1.description.length

  const handleStep1 = async (e: FormEvent) => {
    e.preventDefault(); setServerError('')
    const err: Step1Errors = {}
    if (!step1.title.trim()) err.title = 'Title is required'
    else if (step1.title.length < 3) err.title = 'Must be at least 3 characters'
    if (!step1.description.trim()) err.description = 'Description is required'
    else if (step1.description.length < 10) err.description = 'Must be at least 10 characters'
    if (Object.keys(err).length) { setS1Errors(err); return }
    setLoading(true)
    try {
      const res = await jobsApi.create({ production_id: productionId, title: step1.title.trim(), description: step1.description.trim() }, accessToken)
      setJobId(res.job.id); setStep(2)
    } catch (e: unknown) { setServerError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handleStep2 = async (e: FormEvent) => {
    e.preventDefault(); setServerError('')
    if (!createdJobId) return
    const err: Step2Errors = {}
    if (step2.skills.length > 20) err.skills = 'Maximum 20 skills'
    if (step2.roles.length > 20) err.roles = 'Maximum 20 roles'
    if (Object.keys(err).length) { setS2Errors(err); return }
    setLoading(true)
    try {
      const payload: SetRequirementsPayload = {
        skills: step2.skills, roles: step2.roles,
        language: step2.language.trim() || undefined,
        location: step2.location.trim() || undefined,
        experience_level: (step2.experience_level || undefined) as SetRequirementsPayload['experience_level'],
      }
      await jobsApi.setRequirements(createdJobId, payload, accessToken)
      setStep(3)
    } catch (e: unknown) { setServerError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handlePublish = async () => {
    if (!createdJobId) return
    setLoading(true); setServerError('')
    try { await jobsApi.publish(createdJobId, accessToken); navigate('/home') }
    catch (e: unknown) { setServerError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface-section px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/home"
            className="inline-flex items-center gap-1.5 text-sm text-content-secondary hover:text-brand transition-colors mb-4">
            <ArrowLeft size={14} /> Back to home
          </Link>
          <h1 className="text-2xl font-bold text-content-heading">Create a job post</h1>
          <p className="text-sm text-content-tertiary mt-1">Find the right talent for your production</p>
        </div>

        <div className="card p-8">
          <StepIndicator current={step} />

          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1} noValidate className="space-y-5">
              <div>
                <label htmlFor="title" className="label">
                  Job title <span className="text-red-500">*</span>
                </label>
                <input id="title" value={step1.title} autoFocus
                  onChange={e => { setStep1(p => ({ ...p, title: e.target.value })); setS1Errors(p => ({ ...p, title: undefined })) }}
                  placeholder="e.g. Lead Cinematographer"
                  className={step1Errors.title ? 'input-error' : 'input'} />
                {step1Errors.title && <p className="mt-1.5 text-xs text-red-500">{step1Errors.title}</p>}
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <label htmlFor="description" className="label mb-0">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${descRemaining < 200 ? 'text-amber-600' : 'text-content-muted'}`}>
                    {descRemaining} left
                  </span>
                </div>
                <textarea id="description" rows={7} value={step1.description}
                  onChange={e => { setStep1(p => ({ ...p, description: e.target.value })); setS1Errors(p => ({ ...p, description: undefined })) }}
                  placeholder="Describe the role, responsibilities, shoot schedule, compensation…"
                  className={`${step1Errors.description ? 'input-error' : 'input'} resize-none`} />
                {step1Errors.description && <p className="mt-1.5 text-xs text-red-500">{step1Errors.description}</p>}
              </div>

              {serverError && <div className="error-banner"><p className="text-sm text-red-600">{serverError}</p></div>}

              <div className="flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Saving…' : 'Next: Requirements →'}
                </button>
              </div>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleStep2} noValidate className="space-y-5">
              <TagInput label="Skills" placeholder="e.g. Cinematography, Lighting…"
                tags={step2.skills}
                onChange={t => { setStep2(p => ({ ...p, skills: t })); setS2Errors(p => ({ ...p, skills: undefined })) }}
                error={step2Errors.skills} />

              <TagInput label="Roles" placeholder="e.g. Director of Photography, Gaffer…"
                tags={step2.roles}
                onChange={t => { setStep2(p => ({ ...p, roles: t })); setS2Errors(p => ({ ...p, roles: undefined })) }}
                error={step2Errors.roles} />

              <div>
                <label htmlFor="exp" className="label">Experience level</label>
                <select id="exp" value={step2.experience_level}
                  onChange={e => setStep2(p => ({ ...p, experience_level: e.target.value as Step2Form['experience_level'] }))}
                  className="input">
                  {EXP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="language" className="label">Language</label>
                  <input id="language" value={step2.language}
                    onChange={e => setStep2(p => ({ ...p, language: e.target.value }))}
                    placeholder="e.g. English" className="input" />
                </div>
                <div>
                  <label htmlFor="location" className="label">Location</label>
                  <input id="location" value={step2.location}
                    onChange={e => setStep2(p => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Mumbai, Remote" className="input" />
                </div>
              </div>

              {serverError && <div className="error-banner"><p className="text-sm text-red-600">{serverError}</p></div>}

              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost">← Back</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Saving…' : 'Next: Review →'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Details review */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-content-tertiary uppercase tracking-wider">Job details</h2>
                  <button onClick={() => setStep(1)} className="text-xs text-brand font-semibold hover:text-brand-dark transition-colors">Edit</button>
                </div>
                <div className="bg-surface-section rounded-xl border border-surface-border p-4 space-y-3">
                  <div>
                    <p className="text-xs text-content-tertiary mb-0.5">Title</p>
                    <p className="font-semibold text-content-heading">{step1.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary mb-0.5">Description</p>
                    <p className="text-sm text-content-secondary whitespace-pre-wrap line-clamp-4">{step1.description}</p>
                  </div>
                </div>
              </section>

              {/* Requirements review */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-content-tertiary uppercase tracking-wider">Requirements</h2>
                  <button onClick={() => setStep(2)} className="text-xs text-brand font-semibold hover:text-brand-dark transition-colors">Edit</button>
                </div>
                <div className="bg-surface-section rounded-xl border border-surface-border p-4 space-y-3">
                  <ReviewRow label="Skills"      value={step2.skills.length ? step2.skills.join(', ') : '—'} />
                  <ReviewRow label="Roles"       value={step2.roles.length  ? step2.roles.join(', ')  : '—'} />
                  <ReviewRow label="Experience"  value={step2.experience_level || 'Any level'} />
                  <ReviewRow label="Language"    value={step2.language || '—'} />
                  <ReviewRow label="Location"    value={step2.location || '—'} />
                </div>
              </section>

              {serverError && <div className="error-banner"><p className="text-sm text-red-600">{serverError}</p></div>}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={() => navigate('/home')} className="btn-ghost flex-1">Save as draft</button>
                <button onClick={handlePublish} disabled={loading} className="btn-navy flex-1">
                  {loading ? 'Publishing…' : '🚀 Publish job'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateJob
