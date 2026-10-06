import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { productionApi, talentApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { AutocompleteInput } from '../components/AutocompleteInput'
import { AutocompleteTagInput } from '../components/AutocompleteTagInput'

// ── Profile Progress Checklist ────────────────────────────────

interface ChecklistItem {
  id: string
  label: string
  isComplete: boolean
  required?: boolean
}

function ProfileProgress({ items }: { items: ChecklistItem[] }) {
  const completedCount = items.filter((i) => i.isComplete).length
  const totalCount = items.length

  return (
    <div className="p-4 rounded-[3px] bg-paper border border-line space-y-3">
      <div className="flex items-center justify-between text-12">
        <span className="font-semibold text-ink">Profile completion</span>
        <span className="font-mono text-muted tnum">
          {completedCount} of {totalCount} completed
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-1.5 text-12 ${
              item.isComplete ? 'text-ink font-medium' : 'text-muted'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-[1px] flex items-center justify-center text-[10px] shrink-0 ${
                item.isComplete
                  ? 'bg-status-success text-surface'
                  : 'border border-line bg-surface'
              }`}
            >
              {item.isComplete && <Check size={10} />}
            </span>
            <span className="truncate">
              {item.label}
              {item.required && !item.isComplete && (
                <span className="text-status-error ml-0.5">*</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Profile-strength effect on matching explained in one sentence */}
      <p className="text-12 text-muted border-t border-line/60 pt-2.5 leading-relaxed">
        Complete profile credentials directly boost your 7-signal match score by up to 15% across productions.
      </p>
    </div>
  )
}

// ── Production Form ───────────────────────────────────────────

interface ProdForm {
  company_name: string
  bio: string
  production_details: string
}

interface ProdErrors {
  company_name?: string
  bio?: string
  production_details?: string
}

function ProductionForm({
  token,
  onDone,
}: {
  token: string
  onDone: (id: string) => void
}) {
  const [form, setForm] = useState<ProdForm>({
    company_name: '',
    bio: '',
    production_details: '',
  })
  const [errors, setErrors] = useState<ProdErrors>({})
  const [serverError, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const bioLeft = 500 - form.bio.length
  const detailsLeft = 2000 - form.production_details.length

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: undefined }))
  }

  const checklistItems: ChecklistItem[] = [
    { id: 'company_name', label: 'Company name', isComplete: form.company_name.trim().length > 0, required: true },
    { id: 'bio', label: 'Studio bio', isComplete: form.bio.trim().length > 0 },
    { id: 'production_details', label: 'Shoot details', isComplete: form.production_details.trim().length > 0 },
  ]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    const err: ProdErrors = {}
    if (!form.company_name.trim()) err.company_name = 'Company name is required'
    if (form.bio.length > 500) err.bio = 'Max 500 characters'
    if (form.production_details.length > 2000) err.production_details = 'Max 2000 characters'
    if (Object.keys(err).length) {
      setErrors(err)
      return
    }
    setLoading(true)
    try {
      const res = await productionApi.createProfile(
        {
          company_name: form.company_name.trim(),
          bio: form.bio.trim() || undefined,
          production_details: form.production_details.trim() || undefined,
        },
        token
      )
      onDone(res.profile.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create profile'
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
        toast.info('Profile already exists, redirecting to home.')
        onDone('existing')
      } else {
        setErr(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <ProfileProgress items={checklistItems} />

      <Field
        label="Company name"
        required
        hint="Registered production house or studio name."
        htmlFor="company_name"
        error={errors.company_name}
      >
        <Input
          id="company_name"
          name="company_name"
          type="text"
          autoFocus
          value={form.company_name}
          onChange={set}
          placeholder="e.g. Horizon Films"
          error={!!errors.company_name}
          aria-describedby={errors.company_name ? 'company_name-error' : undefined}
        />
      </Field>

      <Field
        label="Bio"
        hint={`Short description of your studio. ${bioLeft} chars left.`}
        htmlFor="bio"
        error={errors.bio}
      >
        <textarea
          id="bio"
          name="bio"
          rows={3}
          value={form.bio}
          onChange={set}
          placeholder="A short overview of your studio and focus genres…"
          className={`w-full rounded-[3px] bg-surface font-sans text-14 text-ink placeholder:text-muted/70 p-3 border border-line focus:border-ink focus:outline-none transition-colors resize-none ${
            errors.bio ? 'border-status-error' : ''
          }`}
          aria-describedby={errors.bio ? 'bio-error' : undefined}
        />
      </Field>

      <Field
        label="Production details"
        hint={`Overview of active or upcoming productions. ${detailsLeft} chars left.`}
        htmlFor="production_details"
        error={errors.production_details}
      >
        <textarea
          id="production_details"
          name="production_details"
          rows={4}
          value={form.production_details}
          onChange={set}
          placeholder="Describe your current slate, formats, and scale…"
          className={`w-full rounded-[3px] bg-surface font-sans text-14 text-ink placeholder:text-muted/70 p-3 border border-line focus:border-ink focus:outline-none transition-colors resize-none ${
            errors.production_details ? 'border-status-error' : ''
          }`}
          aria-describedby={errors.production_details ? 'production_details-error' : undefined}
        />
      </Field>

      {serverError && (
        <div
          role="alert"
          className="p-3 rounded-[3px] bg-status-error/10 border border-status-error/20 text-13 text-status-error font-medium"
        >
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 text-14 font-semibold rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity disabled:opacity-50 mt-2"
      >
        {loading ? 'Saving profile…' : 'Complete setup'}
      </button>
    </form>
  )
}

// ── Talent Form ───────────────────────────────────────────────

interface TalentForm {
  full_name: string
  role: string
  bio: string
  skills: string[]
  location: string
  language: string
}

interface TalentErrors {
  full_name?: string
  role?: string
}

function TalentForm({
  token,
  onDone,
}: {
  token: string
  onDone: (id: string) => void
}) {
  const [form, setForm] = useState<TalentForm>({
    full_name: '',
    role: '',
    bio: '',
    skills: [],
    location: '',
    language: '',
  })
  const [errors, setErrors] = useState<TalentErrors>({})
  const [serverError, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: undefined }))
  }

  const checklistItems: ChecklistItem[] = [
    { id: 'full_name', label: 'Full name', isComplete: form.full_name.trim().length > 0, required: true },
    { id: 'role', label: 'Primary role', isComplete: form.role.trim().length > 0, required: true },
    { id: 'skills', label: 'Skills', isComplete: form.skills.length > 0 },
    { id: 'location', label: 'City', isComplete: form.location.trim().length > 0 },
    { id: 'language', label: 'Language', isComplete: form.language.trim().length > 0 },
    { id: 'bio', label: 'Bio', isComplete: form.bio.trim().length > 0 },
  ]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    const err: TalentErrors = {}
    if (!form.full_name.trim()) err.full_name = 'Full name is required'
    if (!form.role.trim()) err.role = 'Primary role is required'
    if (Object.keys(err).length) {
      setErrors(err)
      return
    }
    setLoading(true)
    try {
      const res = await talentApi.createProfile(
        {
          full_name: form.full_name.trim(),
          role: form.role.trim(),
          bio: form.bio.trim() || undefined,
          skills: form.skills,
          location: form.location.trim() || undefined,
          language: form.language.trim() || undefined,
        },
        token
      )
      onDone(res.profile.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create profile'
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
        toast.info('Profile already exists, redirecting to home.')
        onDone('existing')
      } else {
        setErr(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <ProfileProgress items={checklistItems} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Full name"
          required
          htmlFor="full_name"
          error={errors.full_name}
        >
          <Input
            id="full_name"
            name="full_name"
            type="text"
            autoFocus
            autoComplete="name"
            value={form.full_name}
            onChange={set}
            placeholder="Priya Sharma"
            error={!!errors.full_name}
            aria-describedby={errors.full_name ? 'full_name-error' : undefined}
          />
        </Field>

        <div>
          <AutocompleteInput
            id="role"
            label="Primary role"
            required
            value={form.role}
            onChange={(val) => {
              setForm((p) => ({ ...p, role: val }))
              setErrors((p) => ({ ...p, role: undefined }))
            }}
            type="roles"
            placeholder="e.g. Cinematographer"
            error={errors.role}
          />
        </div>
      </div>

      <div>
        <AutocompleteTagInput
          label="Skills"
          placeholder="Search film skills or type custom and hit Enter…"
          tags={form.skills}
          onChange={(tags) => setForm((p) => ({ ...p, skills: tags }))}
          type="skills"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <AutocompleteInput
            id="location"
            label="Location (City)"
            value={form.location}
            onChange={(val) => setForm((p) => ({ ...p, location: val }))}
            type="cities"
            placeholder="e.g. Mumbai, Kochi"
          />
        </div>

        <Field
          label="Primary language"
          htmlFor="language"
        >
          <Input
            id="language"
            name="language"
            type="text"
            value={form.language}
            onChange={set}
            placeholder="e.g. Hindi, English"
          />
        </Field>
      </div>

      <Field
        label="Bio"
        hint="A concise summary of your credits, equipment, or style."
        htmlFor="bio"
      >
        <textarea
          id="bio"
          name="bio"
          rows={3}
          value={form.bio}
          onChange={set}
          placeholder="A short intro about your background and recent work…"
          className="w-full rounded-[3px] bg-surface font-sans text-14 text-ink placeholder:text-muted/70 p-3 border border-line focus:border-ink focus:outline-none transition-colors resize-none"
        />
      </Field>

      {serverError && (
        <div
          role="alert"
          className="p-3 rounded-[3px] bg-status-error/10 border border-status-error/20 text-13 text-status-error font-medium"
        >
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 text-14 font-semibold rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity disabled:opacity-50 mt-2"
      >
        {loading ? 'Saving profile…' : 'Complete setup'}
      </button>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────

const CreateProfile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token, setProfileId } = useAuth()

  const state = location.state as { user_id?: string; role?: string } | null
  const role = (state?.role ?? user?.role ?? 'production') as 'production' | 'talent'
  const accessToken = token ?? ''
  const isProduction = role === 'production'

  usePageTitle('Create Profile')

  // Requirement 6: If user already has a profile and opens /create-profile, redirect to /home.
  useEffect(() => {
    if (user?.profileId) {
      toast.info('Profile already exists, redirecting to home.')
      navigate('/home', { replace: true })
      return
    }

    // Double check via API if session token exists
    if (accessToken) {
      const checkExisting = async () => {
        try {
          if (role === 'production') {
            const res = await productionApi.getMyProfile(accessToken)
            if (res.profile?.id) {
              setProfileId(res.profile.id)
              toast.info('Profile already exists, redirecting to home.')
              navigate('/home', { replace: true })
            }
          } else {
            const res = await talentApi.getMyProfile(accessToken)
            if (res.profile?.id) {
              setProfileId(res.profile.id)
              toast.info('Profile already exists, redirecting to home.')
              navigate('/home', { replace: true })
            }
          }
        } catch {
          // No profile exists yet, proceed normally
        }
      }
      checkExisting()
    }
  }, [user?.profileId, accessToken, role, navigate, setProfileId])

  const handleDone = (profileId: string) => {
    if (profileId && profileId !== 'existing') {
      setProfileId(profileId)
    }
    navigate('/home', { replace: true })
  }

  return (
    <AuthLayout
      productContext="Complete profile credentials directly power the 7-signal match engine across film departments."
      contextSubtitle="Profile onboarding"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-28 font-extrabold text-ink tracking-tight">
            {isProduction ? 'Production house profile' : 'Your talent profile'}
          </h1>
          <p className="mt-1.5 text-14 text-muted">
            {isProduction
              ? 'Tell talent who you are and what you are working on.'
              : 'Help production houses find and score you accurately.'}
          </p>
        </div>

        {isProduction ? (
          <ProductionForm token={accessToken} onDone={handleDone} />
        ) : (
          <TalentForm token={accessToken} onDone={handleDone} />
        )}
      </div>
    </AuthLayout>
  )
}

export default CreateProfile
