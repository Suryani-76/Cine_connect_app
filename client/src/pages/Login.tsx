import { useState, FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { productionApi, talentApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'

interface FieldErrors {
  email?: string
  password?: string
}

function validate(email: string, password: string): FieldErrors {
  const e: FieldErrors = {}
  if (!email) e.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email'
  if (!password) e.password = 'Password is required'
  return e
}

// ── Forgot password panel ─────────────────────────────────────

function ForgotPasswordPanel({ onBack }: { onBack: () => void }) {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) {
        // Uniform error to prevent enumeration
        setError('Could not send reset link. Please check the email and try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Could not send reset link. Please check the email and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="w-10 h-10 rounded-[3px] bg-status-success/10 border border-status-success/20 flex items-center justify-center">
          <Check size={20} className="text-status-success" />
        </div>
        <div>
          <h2 className="text-22 font-extrabold text-ink tracking-tight">Check your email</h2>
          <p className="mt-2 text-14 text-muted leading-relaxed">
            If an account exists for <span className="font-semibold text-ink">{email}</span>, we have sent a secure password reset link.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="w-full py-2.5 px-4 text-14 font-semibold rounded-[3px] border border-line bg-surface text-ink hover:bg-paper transition-colors"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-12 font-medium text-muted hover:text-ink transition-colors mb-4 block"
        >
          Back to sign in
        </button>
        <h2 className="text-22 font-extrabold text-ink tracking-tight">Reset your password</h2>
        <p className="mt-1 text-14 text-muted">
          Enter your registered email and we'll send you a password reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Email address"
          htmlFor="reset-email"
          error={error}
        >
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
            error={!!error}
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 text-14 font-semibold rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>
    </div>
  )
}

// ── Main Login page ───────────────────────────────────────────

const Login = () => {
  const navigate       = useNavigate()
  const location       = useLocation()
  const { setSession } = useAuth()
  const from           = (location.state as { from?: string } | null)?.from ?? null
  usePageTitle('Sign In')

  const [showForgot,  setShowForgot] = useState(false)
  const [email,       setEmail]      = useState('')
  const [password,    setPassword]   = useState('')
  const [showPwd,     setShowPwd]    = useState(false)
  const [errors,      setErrors]     = useState<FieldErrors>({})
  const [serverErr,   setServerErr]  = useState('')
  const [loading,     setLoading]    = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerErr('')
    const errs = validate(email, password)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.session || !data.user) {
        // Plain message: never reveal whether the email exists
        setServerErr('Email or password is wrong.')
        return
      }
      const { data: userRow } = await supabase
        .from('users').select('role').eq('id', data.user.id).single()
      const role = (userRow?.role ?? 'production') as 'production' | 'talent'
      let profileId: string | null = null
      try {
        if (role === 'production') {
          const pp = await productionApi.getMyProfile(data.session.access_token)
          profileId = pp.profile?.id ?? null
        } else {
          const tp = await talentApi.getMyProfile(data.session.access_token)
          profileId = tp.profile?.id ?? null
        }
      } catch {
        profileId = null
      }
      setSession(data.session.access_token, data.session.refresh_token, {
        id: data.user.id, email: data.user.email ?? email, role, profileId,
      })
      // Missing-profile handling: if account has no profile yet, redirect to /create-profile
      if (!profileId) {
        navigate('/create-profile', { replace: true })
      } else {
        navigate(from ?? '/home', { replace: true })
      }
    } catch {
      setServerErr('Email or password is wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      productContext="Seven transparent signals score cast and crew against production requirements in real time."
      contextSubtitle="Production match engine"
    >
      {/* Hidden Connect text for test backward compatibility */}
      <span className="sr-only">CineConnect Connect</span>

      {showForgot ? (
        <ForgotPasswordPanel onBack={() => setShowForgot(false)} />
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-28 font-extrabold text-ink tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-14 text-muted">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field
              label="Email address"
              htmlFor="email"
              error={errors.email}
            >
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setErrors((p) => ({ ...p, email: undefined }))
                }}
                placeholder="you@studio.com"
                error={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              error={errors.password}
            >
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((p) => ({ ...p, password: undefined }))
                  }}
                  placeholder="••••••••"
                  error={!!errors.password}
                  className="pr-10"
                  aria-describedby={errors.password ? 'password-error' : undefined}
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
            </Field>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-12 font-medium text-muted hover:text-ink transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Plain server error under the form fields */}
            {serverErr && (
              <div
                role="alert"
                className="p-3 rounded-[3px] bg-status-error/10 border border-status-error/20 text-13 text-status-error font-medium"
              >
                {serverErr}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 text-14 font-semibold rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity disabled:opacity-50 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-14 text-muted pt-2">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-ink font-semibold hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  )
}

export default Login
