import { useState, FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, Film } from 'lucide-react'
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

const Login = () => {
  const navigate       = useNavigate()
  const location       = useLocation()
  const { setSession } = useAuth()
  const from           = (location.state as { from?: string } | null)?.from ?? null
  usePageTitle('Sign In')

  const [email,     setEmail]    = useState('')
  const [password,  setPassword] = useState('')
  const [showPwd,   setShowPwd]  = useState(false)
  const [errors,    setErrors]   = useState<FieldErrors>({})
  const [serverErr, setServerErr] = useState('')
  const [loading,   setLoading]  = useState(false)

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

  return (
    <div className="min-h-screen bg-surface-section flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-navy mb-4">
            <Film size={22} className="text-white" />
          </div>
          <h1 className="brand-text text-3xl text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </h1>
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
                placeholder="you@studio.com"
                className={errors.email ? 'input-error' : 'input'} />
              {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input id="password" type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  placeholder="••••••••"
                  className={`${errors.password ? 'input-error' : 'input'} pr-10`} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary transition-colors"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
            </div>

            {serverErr && (
              <div className="error-banner">
                <p className="text-sm text-red-600">{serverErr}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-content-tertiary">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand font-semibold hover:text-brand-dark transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
