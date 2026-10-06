import { useState, FormEvent, useRef, KeyboardEvent, ClipboardEvent, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

const Verify = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const state = location.state as { email?: string; role?: string } | null
  const [email, setEmail] = useState(state?.email ?? '')
  const role = (state?.role ?? 'production') as 'production' | 'talent'
  usePageTitle('Verify Email')

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [serverError, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState('')
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const otp = digits.join('')

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleDigitChange = (index: number, value: string) => {
    const s = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = s
    setDigits(next)
    setErr('')
    if (s && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((ch, i) => {
      next[i] = ch
    })
    setDigits(next)
    setErr('')
    const nextFocusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    inputRefs.current[nextFocusIndex]?.focus()
  }

  const handleResend = async () => {
    if (countdown > 0 || !email) return
    setResending(true)
    setResendStatus('')
    setErr('')
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (error) {
        setResendStatus('Could not resend code. Please try again.')
      } else {
        setResendStatus('New verification code sent.')
        setCountdown(RESEND_COOLDOWN)
      }
    } catch {
      setResendStatus('Could not resend code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setResendStatus('')
    if (!email) {
      setErr('Email address is required')
      return
    }
    if (otp.length < OTP_LENGTH) {
      setErr('Please enter the full 6-digit code')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.verify({ email, otp })
      const userRole = (res.user.role ?? role) as 'production' | 'talent'
      setSession(res.access_token, res.refresh_token, {
        id: res.user.id,
        email: res.user.email ?? email,
        role: userRole,
        profileId: null,
      })
      navigate('/create-profile', { state: { user_id: res.user.id, role: userRole } })
    } catch {
      // Requirement 3: specific error text
      setErr('That code is wrong or expired. Request a new one.')
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      productContext="Protected email verification ensures genuine crew representation and secure messaging."
      contextSubtitle="Identity and security verification"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-28 font-extrabold text-ink tracking-tight">Verify your email</h1>
          <p className="mt-1.5 text-14 text-muted">
            Code sent to <span className="font-semibold text-ink">{email || 'your email'}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {!state?.email && (
            <Field
              label="Email address"
              htmlFor="verify-email"
            >
              <Input
                id="verify-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
          )}

          <div>
            <label className="text-14 font-medium text-ink block mb-2">
              6-digit verification code
            </label>
            <div className="flex gap-2 sm:gap-3 justify-between">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  aria-label={`Digit ${i + 1}`}
                  autoFocus={i === 0}
                  className="w-11 h-14 sm:w-13 sm:h-16 text-center text-22 font-mono font-bold rounded-[3px] border border-line bg-surface text-ink focus:border-ink focus:outline-none transition-colors"
                />
              ))}
            </div>
          </div>

          {/* Specific error text */}
          {serverError && (
            <div
              role="alert"
              className="p-3 rounded-[3px] bg-status-error/10 border border-status-error/20 text-13 text-status-error font-medium"
            >
              {serverError}
            </div>
          )}

          {/* Resend success notice */}
          {resendStatus && (
            <div
              role="status"
              className="p-3 rounded-[3px] bg-status-success/10 border border-status-success/20 text-13 text-status-success font-medium"
            >
              {resendStatus}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.length < OTP_LENGTH}
            className="w-full py-3 px-4 text-14 font-semibold rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify email'}
          </button>
        </form>

        {/* Clear resend with countdown */}
        <div className="pt-2 text-center text-13 space-y-2">
          <p className="text-muted">
            Didn't receive the code?{' '}
            {countdown > 0 ? (
              <span className="font-mono text-muted">
                Resend code in {countdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-ink font-semibold hover:underline"
              >
                {resending ? 'Sending…' : 'Resend verification code'}
              </button>
            )}
          </p>

          <p>
            <Link
              to="/register"
              className="text-12 text-muted hover:text-ink transition-colors"
            >
              Wrong email address? Go back to register
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

export default Verify
