import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Shield, Download, Trash2, AlertTriangle, FileText, CheckCircle2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "../context/AuthContext"
import { usePageTitle } from "../hooks/usePageTitle"
import { accountApi, authApi } from "../lib/api"
import { NotificationBell } from "../components/NotificationBell"
import { PublicFooter } from "../components/PublicFooter"

interface ConsentInfo {
  version: string
  consented_at: string
  terms: boolean
  privacy: boolean
}

const Settings = () => {
  usePageTitle("Account Settings & Privacy")
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()

  const [exporting, setExporting] = useState(false)
  const [consentInfo, setConsentInfo] = useState<ConsentInfo | null>(null)
  const [loadingConsent, setLoadingConsent] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("")
  const [deleting, setDeleting] = useState(false)

  // token directly from useAuth()
  const userId = user?.id

  useEffect(() => {
    if (!token) return
    setLoadingConsent(true)
    authApi
      .getConsentStatus(token)
      .then((res) => {
        if (res.consent) {
          setConsentInfo({
            version: res.consent.version,
            consented_at: res.consent.consented_at,
            terms: res.consent.terms,
            privacy: res.consent.privacy,
          })
        }
      })
      .catch((err) => {
        console.error("Failed to load consent status", err)
      })
      .finally(() => {
        setLoadingConsent(false)
      })
  }, [token])

  const handleExportData = async () => {
    if (!token) return
    setExporting(true)
    try {
      const blob = await accountApi.exportData(token)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cineconnect-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Data export downloaded successfully.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download data export"
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!token) return
    if (deleteConfirmationText.trim().toUpperCase() !== "DELETE") {
      toast.error("Please type DELETE to confirm account erasure.")
      return
    }

    setDeleting(true)
    try {
      const res = await accountApi.deleteAccount(token)
      toast.success(res.message || "Your account has been permanently deleted.")
      setShowDeleteModal(false)
      await logout()
      navigate("/register")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account"
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col justify-between">
      {/* App Header */}
      <header className="nav">
        <div className="nav-inner">
          <Link to="/home" className="brand-text text-xl text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/search" className="nav-link">Find Talent</Link>
            <Link to="/applications" className="nav-link">Applications</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
            <Link to="/settings" className="nav-link text-brand font-semibold">Settings</Link>
            {userId && token && <NotificationBell userId={userId} token={token} />}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-brand" size={24} />
            <h1 className="text-2xl font-bold text-content-heading">Account & Privacy Settings</h1>
            <span className="badge bg-green-50 text-green-700 border-green-200 text-xs ml-2">
              DPDP 2023 & GDPR Compliant
            </span>
          </div>
          <p className="text-sm text-content-secondary">
            Manage your personal data, data portability rights, compliance consents, and account status.
          </p>
        </div>

        {/* Section 1: Data Portability */}
        <div className="card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-content-heading flex items-center gap-2">
                <Download size={18} className="text-brand" />
                Data Portability (Right to Access)
              </h2>
              <p className="text-sm text-content-secondary mt-1 max-w-2xl">
                Under DPDP Act 2023 §11 and GDPR Article 20, you are entitled to download a complete,
                machine-readable JSON export of your personal information, profile, applications, messages,
                and consents.
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="btn-primary inline-flex items-center gap-2 text-sm whitespace-nowrap"
            >
              {exporting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Generating JSON…
                </>
              ) : (
                <>
                  <Download size={15} />
                  Download My Data
                </>
              )}
            </button>
          </div>

          <div className="rounded-lg bg-surface-section p-3 border border-surface-border text-xs text-content-tertiary">
            <strong>Security Notice:</strong> Data exports are rate-limited to 1 request per hour to prevent
            unauthorized bulk extraction. The export excludes private credentials and other users&apos; confidential details.
          </div>
        </div>

        {/* Section 2: Consents & Legal Agreements */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-content-heading flex items-center gap-2">
            <FileText size={18} className="text-brand" />
            Consents & Legal Framework
          </h2>
          <p className="text-sm text-content-secondary">
            Your active consents recorded on CineConnect:
          </p>

          <div className="rounded-lg border border-surface-border p-4 space-y-3 bg-white">
            {loadingConsent ? (
              <p className="text-xs text-content-tertiary">Loading consent record…</p>
            ) : consentInfo ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-content-primary">
                    Terms of Service & Privacy Policy (v{consentInfo.version})
                  </span>
                </div>
                <span className="text-xs text-content-tertiary">
                  Consented on {new Date(consentInfo.consented_at).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-content-primary">
                    Standard Platform Consent (v1.0)
                  </span>
                </div>
                <span className="text-xs text-content-tertiary">Active</span>
              </div>
            )}

            <div className="pt-2 border-t border-surface-border flex flex-wrap gap-4 text-xs">
              <Link to="/terms" target="_blank" className="text-brand hover:underline">
                View Terms of Service
              </Link>
              <Link to="/privacy" target="_blank" className="text-brand hover:underline">
                View Privacy Policy
              </Link>
              <Link to="/cookies" target="_blank" className="text-brand hover:underline">
                Cookie Policy
              </Link>
              <Link to="/contact" target="_blank" className="text-brand hover:underline">
                Contact Grievance Officer
              </Link>
            </div>
          </div>
        </div>

        {/* Section 3: Account Erasure (Danger Zone) */}
        <div className="card p-6 border-red-200 bg-red-50/20 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-700">
                Right to Erasure (Account Deletion)
              </h2>
              <p className="text-sm text-content-secondary mt-1">
                Under DPDP Act 2023 §12 and GDPR Article 17, you have the unconditional right to request the
                complete erasure of your personal data.
              </p>
              <div className="mt-3 p-3 rounded-lg bg-white border border-red-200 text-xs text-content-secondary space-y-1.5">
                <p className="font-semibold text-red-600">What happens when you delete your account:</p>
                <ul className="list-disc list-inside space-y-0.5 text-content-tertiary">
                  <li>Your user login, email, and authentication tokens are immediately revoked and deleted.</li>
                  <li>Your profile, credits, portfolio showreels, and resumes are permanently removed from cloud storage.</li>
                  <li>Your job applications, open listings, saved jobs, notifications, and alerts are purged.</li>
                  <li>Direct messages sent by you will no longer display your identity.</li>
                  <li>This action is immediate and cannot be undone.</li>
                </ul>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-btn transition-colors inline-flex items-center gap-2"
                >
                  <Trash2 size={15} />
                  Delete My Account Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Permanently Delete Account?</h3>
            </div>
            <p className="text-sm text-content-secondary">
              This action cannot be undone. All your personal data, resumes, media files, and applications will be wiped.
            </p>
            <div>
              <label htmlFor="confirmDelete" className="block text-xs font-medium text-content-secondary mb-1">
                Type <span className="font-bold text-red-600">DELETE</span> to confirm:
              </label>
              <input
                id="confirmDelete"
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="input"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmationText("")
                }}
                className="btn-secondary text-sm"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmationText.trim().toUpperCase() !== "DELETE"}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-btn transition-colors"
              >
                {deleting ? "Purging data…" : "Confirm Permanent Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  )
}

export default Settings
