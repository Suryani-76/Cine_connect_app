import { useEffect, useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Film } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'

const MIN_LENGTH = 8

interface FieldErrors { password?: string; confirm?: string }

function validate(password: string, confirm: string): FieldErrors {
  const e: FieldErrors = {}
  if (!password) e.password = 'Password is required'
  else if (password.length < MIN_LENGTH) e.password = `Min. ${MIN_LENGTH} characters`
  if (!confirm) e.confirm = 'Please confirm your password'
  else if (password !== confirm) e.confirm = 'Passwords do not match'
  return e
}

const ResetPassword = () => {
  const navigate = useNavigate()
  usePageTitle('Reset Password')

  const [ready,    setReady]    = useState(false)
  const [expired,  setExpired]  = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [errors,   setErrors]   = useState<FieldErrors>({})
  const [loading,  setLoading]  = useState(false)

  // Wait for Supabase to exchange the URL fragment for a session
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true)
      }
      if (event === 'SIGNED_IN' && session) {
        // Also covers the case where recovery link sets a session directly
        setReady(true)
      }
    })

    // If there's already a recovery session (e.g. page reload)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    // Timeout: if no recovery event in 5s, the link is likely expired/invalid
    const timer = setTimeout(() => {
      setExpired(prev => { if (!prev) return true; return prev })
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(password, confirm)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Password updated. Please sign in.')
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  // ── Expired / invalid link ────────────────────────────────

  if (expired && !ready) {
    return (
      <div className="min-h-screen bg-surface-section flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-navy mb-4">
              <Film size={22} className="text-white" />
            </div>
            <h1 className="brand-text text-3xl text-brand-navy">
              Cine<span className="text-brand">Connect</span>
            </h1>
          </div>

          <div className="auth-card text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-xl">✕</span>
            </div>
            <h2 className="text-lg font-bold text-content-heading mb-2">Link expired or invalid</h2>
            <p className="text-sm text-content-secondary mb-6">
              This password reset link has expired or has already been used.
              Request a new one from the sign-in page.
            </p>
            <Link to="/login" className="btn-primary inline-block">Back to sign in</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading state ─────────────────────────────────────────

  if (!ready) {
    return (
      <div className="min-h-screen bg-surface-section flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  // ── Reset form ────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-section flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-navy mb-4">
            <Film size={22} className="text-white" />
          </div>
          <h1 className="brand-text text-3xl text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </h1>
        </div>

        <div className="auth-card">
          <h2 className="text-xl font-bold text-content-heading mb-1">Set new password</h2>
          <p className="text-sm text-content-secondary mb-6">
            Choose a strong password — at least {MIN_LENGTH} characters.
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* New password */}
            <div>
              <label htmlFor="password" className="label">New password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  placeholder={`Min. ${MIN_LENGTH} characters`}
                  className={`${errors.password ? 'input-error' : 'input'} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label htmlFor="confirm" className="label">Confirm new password</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: undefined })) }}
                placeholder="Re-enter password"
                className={errors.confirm ? 'input-error' : 'input'}
              />
              {errors.confirm && <p className="mt-1.5 text-xs text-red-500">{errors.confirm}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-content-tertiary">
            Remembered it?{' '}
            <Link to="/login" className="text-brand font-semibold hover:text-brand-dark transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
