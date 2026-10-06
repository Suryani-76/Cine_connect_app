import { useEffect, useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'

const MIN_LENGTH = 8

interface FieldErrors {
  password?: string
  confirm?: string
}

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

  // Wait for Supabase to exchange URL fragment for a session
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true)
      }
      if (event === 'SIGNED_IN' && session) {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    const timer = setTimeout(() => {
      setExpired((prev) => (!prev ? true : prev))
    }, 5000)

    return () => {
      authListener?.subscription?.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(password, confirm)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
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

  const hasMinLength = password.length >= MIN_LENGTH
  const hasMatch = confirm.length > 0 && password === confirm

  if (expired && !ready) {
    return (
      <AuthLayout
        productContext="Secure access to your productions, cast rosters, and confidential deal terms."
        contextSubtitle="Access recovery"
      >
        <div className="space-y-6">
          <div className="w-10 h-10 rounded-[3px] bg-status-error/10 border border-status-error/20 flex items-center justify-center">
            <X size={20} className="text-status-error" />
          </div>
          <div>
            <h1 className="text-28 font-extrabold text-ink tracking-tight">Link expired or invalid</h1>
            <p className="mt-2 text-14 text-muted leading-relaxed">
              This password reset link has expired or has already been used. Please request a new one from the sign-in page.
            </p>
          </div>
          <Link
            to="/login"
            className="w-full inline-block text-center py-3 px-4 text-14 font-semibold rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (!ready) {
    return (
      <AuthLayout
        productContext="Secure access to your productions, cast rosters, and confidential deal terms."
        contextSubtitle="Access recovery"
      >
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-6 h-6 border-2 border-line border-t-ink rounded-full animate-spin" />
          <p className="text-14 text-muted font-medium">Validating recovery link…</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      productContext="Secure access to your productions, cast rosters, and confidential deal terms."
      contextSubtitle="Access recovery"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-28 font-extrabold text-ink tracking-tight">Set new password</h1>
          <p className="mt-1.5 text-14 text-muted">
            Choose a strong password with at least {MIN_LENGTH} characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            label="New password"
            htmlFor="password"
            error={errors.password}
          >
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setErrors((p) => ({ ...p, password: undefined }))
                }}
                placeholder={`Min. ${MIN_LENGTH} characters`}
                error={!!errors.password}
                className="pr-10"
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {password && (
              <div className="mt-2 space-y-1 text-12 text-muted">
                <div className="flex items-center gap-1.5">
                  {hasMinLength ? (
                    <Check size={13} className="text-status-success shrink-0" />
                  ) : (
                    <X size={13} className="text-muted shrink-0" />
                  )}
                  <span className={hasMinLength ? 'text-status-success' : 'text-muted'}>
                    At least {MIN_LENGTH} characters
                  </span>
                </div>
              </div>
            )}
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirm"
            error={errors.confirm}
          >
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setErrors((p) => ({ ...p, confirm: undefined }))
              }}
              placeholder="Re-enter new password"
              error={!!errors.confirm}
              aria-describedby={errors.confirm ? 'confirm-error' : undefined}
            />
            {confirm && (
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-14 font-semibold rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity disabled:opacity-50 mt-2"
          >
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>

        <p className="text-center text-14 text-muted pt-2">
          <Link to="/login" className="text-ink font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default ResetPassword
