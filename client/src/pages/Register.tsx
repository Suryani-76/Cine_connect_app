import { useState, FormEvent, KeyboardEvent } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { authApi } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'

type Role = 'production' | 'talent'

interface FormState {
  email: string
  password: string
  confirmPassword: string
  username: string
  role: Role
  inviteCode: string
  consentAccepted: boolean
  ageConfirmed: boolean
}

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
  username?: string
  consentAccepted?: string
  ageConfirmed?: string
}

function validate(form: FormState): FieldErrors {
  const e: FieldErrors = {}
  if (!form.email) e.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
  if (!form.username) e.username = 'Username is required'
  else if (form.username.length < 3) e.username = 'Min. 3 characters'
  else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = 'Letters, numbers, underscores only'
  if (!form.password) e.password = 'Password is required'
  else if (form.password.length < 8) e.password = 'Min. 8 characters'
  if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password'
  else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
  if (!form.consentAccepted) e.consentAccepted = 'You must agree to the Terms of Service and Privacy Policy'
  if (!form.ageConfirmed) e.ageConfirmed = 'You must confirm you are 18 years of age or older'
  return e
}

const Register = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  usePageTitle('Create Account')

  const [showPwd, setShowPwd] = useState(false)
  const initialRole: Role = searchParams.get('role') === 'talent' ? 'talent' : 'production'
  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    role: initialRole,
    inviteCode: '',
    consentAccepted: false,
    ageConfirmed: false,
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading]         = useState(false)

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
    setFieldErrors((p) => ({ ...p, [name]: undefined }))
  }

  const handleRoleSelect = (r: Role) => {
    setForm((p) => ({ ...p, role: r }))
  }

  const handleRoleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, r: Role) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleRoleSelect(r)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      handleRoleSelect(r === 'production' ? 'talent' : 'production')
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      handleRoleSelect(r === 'talent' ? 'production' : 'talent')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError('')
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }
    setLoading(true)
    try {
      await authApi.register({
        email: form.email,
        password: form.password,
        username: form.username,
        role: form.role,
        invite_code: form.inviteCode.trim() || undefined,
        age_confirmed: true,
        consent: {
          terms: true,
          privacy: true,
          version: '1.0',
          age_confirmed: true,
        },
      })
      navigate('/verify', { state: { email: form.email, role: form.role } })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const hasMinLength = form.password.length >= 8
  const hasMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword

  return (
    <AuthLayout
      productContext="Connect verified film talent with production offices across all six film departments."
      contextSubtitle="Talent and production onboarding"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-28 font-extrabold text-ink tracking-tight">Create your account</h1>
          <p className="mt-1.5 text-14 text-muted">
            Join the verified film industry network
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Role selector as two large selectable options */}
          <div>
            <label className="text-14 font-medium text-ink block mb-2">
              Select your role
            </label>
            <div
              role="radiogroup"
              aria-label="Account role"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {/* Production option */}
              <button
                type="button"
                role="radio"
                aria-checked={form.role === 'production'}
                tabIndex={form.role === 'production' ? 0 : -1}
                onClick={() => handleRoleSelect('production')}
                onKeyDown={(e) => handleRoleKeyDown(e, 'production')}
                className={`p-4 rounded-[3px] border text-left transition-all flex flex-col justify-between ${
                  form.role === 'production'
                    ? 'border-ink bg-paper ring-1 ring-ink'
                    : 'border-line bg-surface hover:border-muted text-muted'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-14 text-ink">
                      🎬 Production house
                    </span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        form.role === 'production'
                          ? 'border-ink bg-ink'
                          : 'border-line bg-surface'
                      }`}
                    >
                      {form.role === 'production' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-surface" />
                      )}
                    </span>
                  </div>
                  <p className="text-12 text-muted leading-relaxed">
                    Post shoots, score candidates with 7 signals, and hire verified crew.
                  </p>
                </div>
              </button>

              {/* Talent option */}
              <button
                type="button"
                role="radio"
                aria-checked={form.role === 'talent'}
                tabIndex={form.role === 'talent' ? 0 : -1}
                onClick={() => handleRoleSelect('talent')}
                onKeyDown={(e) => handleRoleKeyDown(e, 'talent')}
                className={`p-4 rounded-[3px] border text-left transition-all flex flex-col justify-between ${
                  form.role === 'talent'
                    ? 'border-ink bg-paper ring-1 ring-ink'
                    : 'border-line bg-surface hover:border-muted text-muted'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-14 text-ink">
                      🎭 Talent
                    </span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        form.role === 'talent'
                          ? 'border-ink bg-ink'
                          : 'border-line bg-surface'
                      }`}
                    >
                      {form.role === 'talent' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-surface" />
                      )}
                    </span>
                  </div>
                  <p className="text-12 text-muted leading-relaxed">
                    Build verified credits, receive match alerts, and connect with studios.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <Field
            label="Email address"
            htmlFor="email"
            error={fieldErrors.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              value={form.email}
              onChange={set}
              placeholder="you@example.com"
              error={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
          </Field>

          <Field
            label="Username"
            hint="Unique handle used for your profile address."
            htmlFor="username"
            error={fieldErrors.username}
          >
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={set}
              placeholder="your_handle"
              error={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            error={fieldErrors.password}
          >
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={set}
                placeholder="Min. 8 characters"
                error={!!fieldErrors.password}
                className="pr-10"
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Live password rule feedback */}
            {!fieldErrors.password && form.password && (
              <div className="mt-2 space-y-1 text-12 text-muted">
                <div className="flex items-center gap-1.5">
                  {hasMinLength ? (
                    <Check size={13} className="text-status-success shrink-0" />
                  ) : (
                    <X size={13} className="text-muted shrink-0" />
                  )}
                  <span className={hasMinLength ? 'text-status-success' : 'text-muted'}>
                    At least 8 characters
                  </span>
                </div>
              </div>
            )}
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={fieldErrors.confirmPassword}
          >
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={set}
              placeholder="Re-enter password"
              error={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
            />
            {!fieldErrors.confirmPassword && form.confirmPassword && (
              <div className="mt-1 flex items-center gap-1.5 text-12">
                {hasMatch ? (
                  <>
                    <Check size={13} className="text-status-success shrink-0" />
                    <span className="text-status-success">Passwords match</span>
                  </>
                ) : (
                  <>
                    <X size={13} className="text-status-error shrink-0" />
                    <span className="text-status-error">Passwords do not match</span>
                  </>
                )}
              </div>
            )}
          </Field>

          <Field
            label="Invite Code (optional)"
            hint="Leave blank if registering for the public network."
            htmlFor="inviteCode"
          >
            <Input
              id="inviteCode"
              name="inviteCode"
              type="text"
              value={form.inviteCode}
              onChange={set}
              placeholder="e.g. VIP-LAUNCH-2026"
            />
          </Field>

          {/* Legal Consent Checkbox */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-start gap-2.5">
              <input
                id="consentAccepted"
                name="consentAccepted"
                type="checkbox"
                checked={form.consentAccepted}
                onChange={set}
                className="mt-0.5 h-4 w-4 rounded-[2px] border-line text-ink focus:ring-ink accent-tungsten"
                aria-describedby={fieldErrors.consentAccepted ? 'consent-error' : undefined}
              />
              <label htmlFor="consentAccepted" className="text-12 text-muted leading-relaxed select-none">
                I agree to the{' '}
                <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-ink font-semibold hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-ink font-semibold hover:underline">
                  Privacy Policy
                </Link>
                . Data is processed in compliance with DPDP Act 2023.
              </label>
            </div>
            {fieldErrors.consentAccepted && (
              <p id="consent-error" className="text-12 text-status-error font-medium" role="alert">
                {fieldErrors.consentAccepted}
              </p>
            )}
          </div>

          {/* Age Confirmation Checkbox (Requirement 2) */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-2.5">
              <input
                id="ageConfirmed"
                name="ageConfirmed"
                type="checkbox"
                checked={form.ageConfirmed}
                onChange={set}
                className="mt-0.5 h-4 w-4 rounded-[2px] border-line text-ink focus:ring-ink accent-tungsten"
                aria-describedby={fieldErrors.ageConfirmed ? 'age-error' : undefined}
              />
              <label htmlFor="ageConfirmed" className="text-12 text-muted leading-relaxed select-none">
                I confirm that I am <strong>18 years of age or older</strong>.
              </label>
            </div>
            {fieldErrors.ageConfirmed && (
              <p id="age-error" className="text-12 text-status-error font-medium" role="alert">
                {fieldErrors.ageConfirmed}
              </p>
            )}
          </div>

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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-14 text-muted pt-2">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-ink font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default Register
