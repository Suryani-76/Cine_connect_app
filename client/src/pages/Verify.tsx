import { useState, FormEvent, useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Film, Mail } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

const OTP_LENGTH = 6

const Verify = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const state   = location.state as { email?: string; role?: string } | null
  const [email, setEmail] = useState(state?.email ?? '')
  const role = (state?.role ?? 'production') as 'production' | 'talent'
  usePageTitle('Verify Email')

  const [digits, setDigits]   = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [serverError, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs             = useRef<Array<HTMLInputElement | null>>([])
  const otp                   = digits.join('')

  const handleDigitChange = (index: number, value: string) => {
    const s = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]; next[index] = s; setDigits(next)
    if (s && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!email) { setErr('Email address is required'); return }
    if (otp.length < OTP_LENGTH) { setErr('Please enter the full 6-digit code'); return }
    setLoading(true)
    try {
      const res = await authApi.verify({ email, otp })
      const userRole = (res.user.role ?? role) as 'production' | 'talent'
      setSession(res.access_token, res.refresh_token, {
        id: res.user.id, email: res.user.email ?? email, role: userRole, profileId: null,
      })
      navigate('/create-profile', { state: { user_id: res.user.id, role: userRole } })
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : 'Verification failed')
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

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
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Mail size={18} className="text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-content-heading">Verify your email</h2>
              <p className="text-sm text-content-secondary">
                Code sent to <span className="font-semibold text-content-primary">{email || 'your email'}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {!state?.email && (
              <div>
                <label htmlFor="email" className="label">Email address</label>
                <input id="email" type="email" autoComplete="email" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                  className="input" />
              </div>
            )}

            <div>
              <label className="label">Verification code</label>
              <div className="flex gap-2 justify-between">
                {digits.map((digit, i) => (
                  <input key={i} ref={el => { inputRefs.current[i] = el }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    aria-label={`Digit ${i + 1}`}
                    autoFocus={i === 0}
                    className="w-12 h-14 text-center mono-text text-xl font-bold rounded-lg
                      bg-surface-section border-2 border-surface-border text-content-heading
                      focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all" />
                ))}
              </div>
            </div>

            {serverError && (
              <div className="error-banner">
                <p className="text-sm text-red-600">{serverError}</p>
              </div>
            )}

            <button type="submit" disabled={loading || otp.length < OTP_LENGTH}
              className="btn-primary w-full">
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-content-tertiary">
            Wrong email?{' '}
            <Link to="/register" className="text-brand font-semibold hover:text-brand-dark transition-colors">
              Go back
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Verify
