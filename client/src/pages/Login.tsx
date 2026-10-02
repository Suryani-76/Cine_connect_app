import { useState, FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, Film, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

interface FieldErrors { email?: string; password?: string }

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
      if (err) { setError(err.message); return }
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="auth-card text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-emerald-600 text-xl">✓</span>
        </div>
        <h2 className="text-lg font-bold text-content-heading mb-2">Check your email</h2>
        <p className="text-sm text-content-secondary mb-6">
          We've sent a password reset link to <span className="font-semibold text-content-primary">{email}</span>.
          Check your inbox and follow the link to reset your password.
        </p>
        <button onClick={onBack} className="btn-ghost w-full">Back to sign in</button>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-content-secondary hover:text-brand transition-colors mb-5">
        <ArrowLeft size={14} /> Back to sign in
      </button>
      <h2 className="text-xl font-bold text-content-heading mb-1">Reset your password</h2>
      <p className="text-sm text-content-secondary mb-6">
        Enter your email and we'll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="label">Email address</label>
          <input id="reset-email" type="email" autoComplete="email" autoFocus
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@studio.com" className="input" />
        </div>
        {error && <div className="error-banner"><p className="text-sm text-red-600">{error}</p></div>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Sending…' : 'Send reset link'}
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
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.session || !data.user) {
        setServerErr(error?.message ?? 'Invalid email or password')
        return
      }
      const { data: userRow } = await supabase
        .from('users').select('role').eq('id', data.user.id).single()
      const role = (userRow?.role ?? 'production') as 'production' | 'talent'
      let profileId: string | null = null
      if (role === 'production') {
        const { data: pp } = await supabase
          .from('production_profiles').select('id').eq('user_id', data.user.id).single()
        profileId = pp?.id ?? null
      } else {
        const { data: tp } = await supabase
          .from('talent_profiles').select('id').eq('user_id', data.user.id).single()
        profileId = tp?.id ?? null
      }
      setSession(data.session.access_token, data.session.refresh_token, {
        id: data.user.id, email: data.user.email ?? email, role, profileId,
      })
      navigate(from ?? '/home', { replace: true })
    } catch (err: unknown) {
      setServerErr(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-surface-section flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-navy mb-4">
              <Film size={22} className="text-white" />
            </div>
            <h1 className="brand-text text-3xl text-brand-navy">Cine<span className="text-brand">Connect</span></h1>
          </div>
          <ForgotPasswordPanel onBack={() => setShowForgot(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-section flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-navy mb-4">
            <Film size={22} className="text-white" />
          </div>
          <h1 className="brand-text text-3xl text-brand-navy">Cine<span className="text-brand">Connect</span></h1>
          <p className="text-sm text-content-tertiary mt-1">Film industry talent platform</p>
        </div>

        <div className="auth-card">
          <h2 className="text-xl font-bold text-content-heading mb-1">Welcome back</h2>
          <p className="text-sm text-content-secondary mb-6">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input id="email" type="email" autoComplete="email" autoFocus
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
                placeholder="you@studio.com" className={errors.email ? 'input-error' : 'input'} />
              {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="label mb-0">Password</label>
                <button type="button" onClick={() => setShowForgot(true)}
                  className="text-xs text-brand hover:text-brand-dark transition-colors font-medium">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input id="password" type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password" value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  placeholder="••••••••" className={`${errors.password ? 'input-error' : 'input'} pr-10`} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary transition-colors"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
            </div>

            {serverErr && <div className="error-banner"><p className="text-sm text-red-600">{serverErr}</p></div>}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-content-tertiary">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand font-semibold hover:text-brand-dark transition-colors">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
