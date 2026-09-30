import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Film } from 'lucide-react'
import { authApi } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'

type Role = 'production' | 'talent'
interface FormState { email: string; password: string; confirmPassword: string; username: string; role: Role }
interface FieldErrors { email?: string; password?: string; confirmPassword?: string; username?: string }

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
  return e
}

const Register = () => {
  const navigate  = useNavigate()
  usePageTitle('Create Account')
  const [showPwd, setShowPwd] = useState(false)
  const [form, setForm] = useState<FormState>({
    email: '', password: '', confirmPassword: '', username: '', role: 'production',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading]         = useState(false)

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
    setFieldErrors(p => ({ ...p, [name]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError('')
    const errs = validate(form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setLoading(true)
    try {
      await authApi.register({ email: form.email, password: form.password, username: form.username, role: form.role })
      navigate('/verify', { state: { email: form.email, role: form.role } })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const cls = (f: keyof FieldErrors) => fieldErrors[f] ? 'input-error' : 'input'

  return (
    <div className="min-h-screen bg-surface-section flex items-center justify-center px-4 py-12">
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
          <h2 className="text-xl font-bold text-content-heading mb-1">Create your account</h2>
          <p className="text-sm text-content-secondary mb-6">Join the film industry network</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Role selector */}
            <div>
              <p className="label">I am a…</p>
              <div className="grid grid-cols-2 gap-3">
                {(['production', 'talent'] as Role[]).map(r => (
                  <button key={r} type="button"
                    onClick={() => setForm(p => ({ ...p, role: r }))}
                    className={`rounded-btn border-2 px-4 py-3 text-sm font-semibold transition-all text-left
                      ${form.role === r
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-surface-border text-content-secondary hover:border-brand/40'}`}>
                    {r === 'production' ? '🎬 Production House' : '🎭 Talent'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" autoFocus
                value={form.email} onChange={set} placeholder="you@example.com"
                className={cls('email')} />
              {fieldErrors.email && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="username" className="label">Username</label>
              <input id="username" name="username" type="text" autoComplete="username"
                value={form.username} onChange={set} placeholder="your_handle"
                className={cls('username')} />
              {fieldErrors.username && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.username}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input id="password" name="password" type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password" value={form.password} onChange={set}
                  placeholder="Min. 8 characters" className={`${cls('password')} pr-10`} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary transition-colors">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">Confirm password</label>
              <input id="confirmPassword" name="confirmPassword" type="password"
                autoComplete="new-password" value={form.confirmPassword} onChange={set}
                placeholder="Re-enter password" className={cls('confirmPassword')} />
              {fieldErrors.confirmPassword && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
            </div>

            {serverError && (
              <div className="error-banner">
                <p className="text-sm text-red-600">{serverError}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-content-tertiary">
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-semibold hover:text-brand-dark transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
