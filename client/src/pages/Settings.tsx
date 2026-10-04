import { useState, useEffect } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import {
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle2,
  RefreshCw,
  Bell,
  Mail,
  Copy,
  ExternalLink,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "../context/AuthContext"
import { usePageTitle } from "../hooks/usePageTitle"
import { accountApi, authApi, settingsApi, NotificationPreferences } from "../lib/api"
import { NotificationBell } from "../components/NotificationBell"
import { PublicFooter } from "../components/PublicFooter"

interface ConsentInfo {
  version: string
  consented_at: string
  terms: boolean
  privacy: boolean
}

const Settings = () => {
  usePageTitle("Account Settings & Notifications")
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = searchParams.get("tab") === "notifications" ? "notifications" : "privacy"
  const [activeTab, setActiveTab] = useState<"notifications" | "privacy">(initialTab)

  // Notification Preferences State
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Privacy & Compliance State
  const [exporting, setExporting] = useState(false)
  const [consentInfo, setConsentInfo] = useState<ConsentInfo | null>(null)
  const [loadingConsent, setLoadingConsent] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("")
  const [deleting, setDeleting] = useState(false)

  const userId = user?.id

  // Synchronize tab query param
  const handleTabChange = (tab: "notifications" | "privacy") => {
    setActiveTab(tab)
    setSearchParams(tab === "notifications" ? { tab: "notifications" } : {})
  }

  // Load notification preferences
  useEffect(() => {
    if (!token) return
    setLoadingPrefs(true)
    settingsApi
      .getNotificationPreferences(token)
      .then((data) => {
        setPrefs(data)
      })
      .catch((err) => {
        console.error("Failed to load notification preferences", err)
        toast.error("Could not load notification preferences")
      })
      .finally(() => {
        setLoadingPrefs(false)
      })
  }, [token])

  // Load consent status
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

  const handleSavePreferences = async () => {
    if (!token || !prefs) return
    setSavingPrefs(true)
    try {
      const updated = await settingsApi.updateNotificationPreferences(token, {
        new_application: prefs.new_application,
        status_change: prefs.status_change,
        new_message: prefs.new_message,
        job_closed: prefs.job_closed,
        talent_alert_match: prefs.talent_alert_match,
        digest_frequency: prefs.digest_frequency,
      })
      setPrefs(updated)
      toast.success("Notification preferences saved successfully.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update preferences"
      toast.error(msg)
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleCopyUnsubscribeLink = () => {
    if (!prefs?.unsubscribe_token) return
    const url = `${window.location.origin}/unsubscribe/${prefs.unsubscribe_token}`
    navigator.clipboard.writeText(url)
    toast.success("One-click unsubscribe link copied to clipboard.")
  }

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
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-brand" size={24} />
            <h1 className="text-2xl font-bold text-content-heading">Settings & Preferences</h1>
          </div>
          <p className="text-sm text-content-secondary">
            Manage your email alerts, communication preferences, data portability, and privacy rights.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-surface-border gap-6">
          <button
            type="button"
            onClick={() => handleTabChange("notifications")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "notifications"
                ? "border-brand text-brand"
                : "border-transparent text-content-secondary hover:text-content-heading"
            }`}
          >
            <Bell size={16} />
            Email Notifications
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("privacy")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "privacy"
                ? "border-brand text-brand"
                : "border-transparent text-content-secondary hover:text-content-heading"
            }`}
          >
            <Shield size={16} />
            Privacy & Compliance
          </button>
        </div>

        {/* TAB 1: NOTIFICATION PREFERENCES */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="card p-6 space-y-6">
              <div className="flex items-start justify-between border-b border-surface-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-content-heading flex items-center gap-2">
                    <Mail size={18} className="text-brand" />
                    Transactional & System Emails
                  </h2>
                  <p className="text-sm text-content-secondary mt-1">
                    Select which email notifications you would like to receive. All emails adhere to Resend deliverability standards.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={savingPrefs || loadingPrefs || !prefs}
                  className="btn-primary inline-flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  {savingPrefs ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Save Preferences
                    </>
                  )}
                </button>
              </div>

              {loadingPrefs || !prefs ? (
                <div className="py-12 text-center text-sm text-content-secondary">
                  <RefreshCw size={24} className="animate-spin text-brand mx-auto mb-2" />
                  Loading your notification settings…
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Option 1: New Application */}
                  <label className="flex items-start justify-between p-3 rounded-xl border border-surface-border hover:bg-surface-section cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-content-heading">New Candidate Applications</p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Receive an email immediately when a talent candidate applies to one of your active job listings.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.new_application}
                      onChange={(e) => setPrefs({ ...prefs, new_application: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                  </label>

                  {/* Option 2: Status Change */}
                  <label className="flex items-start justify-between p-3 rounded-xl border border-surface-border hover:bg-surface-section cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-content-heading">Application Status Updates & Interviews</p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Receive alerts when your application status moves (shortlisted, interview scheduled, hired).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.status_change}
                      onChange={(e) => setPrefs({ ...prefs, status_change: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                  </label>

                  {/* Option 3: New Message */}
                  <label className="flex items-start justify-between p-3 rounded-xl border border-surface-border hover:bg-surface-section cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-content-heading">Direct Chat Messages</p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Receive an email when someone messages you on CineConnect (throttled to max 1 email per conversation per 30 minutes).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.new_message}
                      onChange={(e) => setPrefs({ ...prefs, new_message: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                  </label>

                  {/* Option 4: Job Closed */}
                  <label className="flex items-start justify-between p-3 rounded-xl border border-surface-border hover:bg-surface-section cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-content-heading">Job Closures</p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Receive a notice when an open job you applied for or tracked has been closed by the production team.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.job_closed}
                      onChange={(e) => setPrefs({ ...prefs, job_closed: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                  </label>

                  {/* Option 5: Talent Alert Match */}
                  <label className="flex items-start justify-between p-3 rounded-xl border border-surface-border hover:bg-surface-section cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-content-heading">Talent & Job Match Alerts</p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Receive recommendations when newly published jobs match your roles, skills, and alert criteria.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.talent_alert_match}
                      onChange={(e) => setPrefs({ ...prefs, talent_alert_match: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                  </label>

                  {/* Digest Frequency */}
                  <div className="p-4 rounded-xl border border-surface-border bg-surface-section space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-content-heading">Activity Digest Frequency</p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Consolidated summary of new applications, unread messages, and matched opportunities.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 pt-1">
                      {(['off', 'daily', 'weekly'] as const).map((freq) => (
                        <label key={freq} className="flex items-center gap-2 cursor-pointer text-sm capitalize">
                          <input
                            type="radio"
                            name="digest_frequency"
                            value={freq}
                            checked={prefs.digest_frequency === freq}
                            onChange={() => setPrefs({ ...prefs, digest_frequency: freq })}
                            className="text-brand focus:ring-brand"
                          />
                          <span className={prefs.digest_frequency === freq ? 'font-semibold text-brand' : 'text-content-secondary'}>
                            {freq === 'off' ? 'Disabled (Off)' : `${freq} Digest`}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Public Unsubscribe Link */}
                  {prefs.unsubscribe_token && (
                    <div className="rounded-xl border border-surface-border p-4 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                          One-Click Unsubscribe Link
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUnsubscribeLink}
                          className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-medium"
                        >
                          <Copy size={13} /> Copy Link
                        </button>
                      </div>
                      <p className="text-xs text-content-tertiary">
                        This unique link allows one-click unsubscription from emails without requiring password authentication:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}/unsubscribe/${prefs.unsubscribe_token}`}
                          className="input text-xs font-mono text-content-secondary py-1.5"
                        />
                        <Link
                          to={`/unsubscribe/${prefs.unsubscribe_token}`}
                          target="_blank"
                          className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> Test
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRIVACY & COMPLIANCE */}
        {activeTab === "privacy" && (
          <div className="space-y-6">
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
                      <RefreshCw size={15} className="animate-spin" /> Generating JSON…
                    </>
                  ) : (
                    <>
                      <Download size={15} /> Download My Data
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
          </div>
        )}
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
