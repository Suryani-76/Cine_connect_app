import { useState, FormEvent } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Eye, EyeOff, Film } from "lucide-react"
import { authApi } from "../lib/api"
import { usePageTitle } from "../hooks/usePageTitle"
import { PublicFooter } from "../components/PublicFooter"

type Role = "production" | "talent"
interface FormState {
  email: string
  password: string
  confirmPassword: string
  username: string
  role: Role
  inviteCode: string
  consentAccepted: boolean
}
interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
  username?: string
  consentAccepted?: string
}

function validate(form: FormState): FieldErrors {
  const e: FieldErrors = {}
  if (!form.email) e.email = "Email is required"
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email"
  if (!form.username) e.username = "Username is required"
  else if (form.username.length < 3) e.username = "Min. 3 characters"
  else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = "Letters, numbers, underscores only"
  if (!form.password) e.password = "Password is required"
  else if (form.password.length < 8) e.password = "Min. 8 characters"
  if (!form.confirmPassword) e.confirmPassword = "Please confirm your password"
  else if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match"
  if (!form.consentAccepted) e.consentAccepted = "You must agree to the Terms of Service and Privacy Policy"
  return e
}

const Register = () => {
  const navigate  = useNavigate()
  usePageTitle("Create Account")
  const [showPwd, setShowPwd] = useState(false)
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    role: "production",
    inviteCode: "",
    consentAccepted: false,
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading]         = useState(false)

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value }))
    setFieldErrors(p => ({ ...p, [name]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError("")
    const errs = validate(form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setLoading(true)
    try {
      await authApi.register({
        email: form.email,
        password: form.password,
        username: form.username,
        role: form.role,
        invite_code: form.inviteCode.trim() || undefined,
        consent: {
          terms: true,
          privacy: true,
          version: "1.0",
        },
      })
      navigate("/verify", { state: { email: form.email, role: form.role } })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const cls = (f: keyof FieldErrors) => fieldErrors[f] ? "input-error" : "input"

  return (
    <div className="min-h-screen bg-surface-section flex flex-col justify-between">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
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
                  {(["production", "talent"] as Role[]).map(r => (
                    <button key={r} type="button"
                      onClick={() => setForm(p => ({ ...p, role: r }))}
                      className={`rounded-btn border-2 px-4 py-3 text-sm font-semibold transition-all text-left
                        ${form.role === r
                          ? "border-brand bg-brand/5 text-brand"
                          : "border-surface-border text-content-secondary hover:border-brand/40"}`}>
                      {r === "production" ? "🎬 Production House" : "🎭 Talent"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" autoFocus
                  value={form.email} onChange={set} placeholder="you@example.com"
                  className={cls("email")} />
                {fieldErrors.email && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="username" className="label">Username</label>
                <input id="username" name="username" type="text" autoComplete="username"
                  value={form.username} onChange={set} placeholder="your_handle"
                  className={cls("username")} />
                {fieldErrors.username && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.username}</p>}
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input id="password" name="password" type={showPwd ? "text" : "password"}
                    autoComplete="new-password" value={form.password} onChange={set}
                    placeholder="Min. 8 characters" className={`${cls("password")} pr-10`} />
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
                  placeholder="Re-enter password" className={cls("confirmPassword")} />
                {fieldErrors.confirmPassword && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
              </div>

              <div>
                <label htmlFor="inviteCode" className="label">Invite Code <span className="text-content-tertiary font-normal">(optional)</span></label>
                <input id="inviteCode" name="inviteCode" type="text"
                  value={form.inviteCode} onChange={set}
                  placeholder="e.g. VIP-LAUNCH-2026" className="input" />
              </div>

              {/* DPDP 2023 & GDPR Mandatory Consent */}
              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <input
                    id="consentAccepted"
                    name="consentAccepted"
                    type="checkbox"
                    checked={form.consentAccepted}
                    onChange={set}
                    className="mt-1 h-4 w-4 rounded border-surface-border text-brand focus:ring-brand"
                  />
                  <label htmlFor="consentAccepted" className="text-xs text-content-secondary leading-relaxed">
                    I agree to the{" "}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-brand font-medium hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand font-medium hover:underline">
                      Privacy Policy
                    </Link>
                    . I understand my data is processed in accordance with India&apos;s DPDP Act 2023 and GDPR guidelines.
                  </label>
                </div>
                {fieldErrors.consentAccepted && (
                  <p className="mt-1.5 text-xs text-red-500">{fieldErrors.consentAccepted}</p>
                )}
              </div>

              {serverError && (
                <div className="error-banner">
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-content-tertiary">
              Already have an account?{" "}
              <Link to="/login" className="text-brand font-semibold hover:text-brand-dark transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}

export default Register
