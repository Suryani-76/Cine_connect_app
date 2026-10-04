import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Mail, RefreshCw, ArrowLeft } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'
import { unsubscribeApi } from '../lib/api'
import { PublicFooter } from '../components/PublicFooter'

interface PreferencesState {
  new_application: boolean
  status_change: boolean
  new_message: boolean
  job_closed: boolean
  talent_alert_match: boolean
  digest_frequency: 'off' | 'daily' | 'weekly'
}

const Unsubscribe = () => {
  usePageTitle('Unsubscribe from Email Notifications')
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<PreferencesState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unsubscribed, setUnsubscribed] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid unsubscribe link: no token provided.')
      setLoading(false)
      return
    }

    unsubscribeApi
      .getInfo(token)
      .then((res) => {
        if (res.valid) {
          setPreferences(res.preferences)
        } else {
          setError('This unsubscribe link is invalid or has expired.')
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to verify unsubscribe link.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  const handleUnsubscribeAll = async () => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      await unsubscribeApi.execute(token, { disableAll: true })
      setUnsubscribed(true)
      if (preferences) {
        setPreferences({
          new_application: false,
          status_change: false,
          new_message: false,
          job_closed: false,
          talent_alert_match: false,
          digest_frequency: 'off',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisableDigests = async () => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      await unsubscribeApi.execute(token, { digestOnly: true })
      setUnsubscribed(true)
      if (preferences) {
        setPreferences({
          ...preferences,
          digest_frequency: 'off',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update digest settings.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col justify-between">
      {/* Header */}
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand-text text-xl text-brand-navy">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <Link to="/login" className="nav-link text-sm">
            Sign In &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
        <div className="card p-8 shadow-md border-surface-border">
          {loading ? (
            <div className="text-center py-12 space-y-3">
              <RefreshCw size={28} className="animate-spin text-brand mx-auto" />
              <p className="text-sm text-content-secondary">Verifying your unsubscribe link…</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <h1 className="text-xl font-bold text-content-heading">Link Expired or Invalid</h1>
              <p className="text-sm text-content-secondary">{error}</p>
              <div className="pt-4">
                <Link to="/home" className="btn-secondary inline-flex items-center gap-2 text-sm">
                  <ArrowLeft size={16} /> Return to CineConnect
                </Link>
              </div>
            </div>
          ) : unsubscribed ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h1 className="text-xl font-bold text-content-heading">Preferences Updated</h1>
              <p className="text-sm text-content-secondary max-w-md mx-auto">
                You have been unsubscribed from CineConnect notifications. You won&apos;t receive these emails going forward.
              </p>
              <p className="text-xs text-content-tertiary">
                You can re-enable or modify your preferences anytime from your account settings.
              </p>
              <div className="pt-4">
                <Link to="/home" className="btn-primary inline-flex items-center gap-2 text-sm">
                  <ArrowLeft size={16} /> Go to CineConnect
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand/10 text-brand rounded-xl">
                  <Mail size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-content-heading">Email Preferences</h1>
                  <p className="text-xs text-content-secondary">
                    Manage your email notifications without logging in
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-section border border-surface-border text-xs text-content-secondary space-y-2">
                <p className="font-semibold text-content-primary">Current status:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Applications & Status Updates:{' '}
                    <strong>{preferences?.status_change ? 'Active' : 'Disabled'}</strong>
                  </li>
                  <li>
                    Chat & Direct Messages:{' '}
                    <strong>{preferences?.new_message ? 'Active' : 'Disabled'}</strong>
                  </li>
                  <li>
                    Periodic Digest:{' '}
                    <strong className="capitalize">{preferences?.digest_frequency ?? 'Off'}</strong>
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleUnsubscribeAll}
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-btn transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Updating…
                    </>
                  ) : (
                    'Unsubscribe from All Notifications'
                  )}
                </button>

                {preferences?.digest_frequency !== 'off' && (
                  <button
                    type="button"
                    onClick={handleDisableDigests}
                    disabled={submitting}
                    className="w-full py-2.5 px-4 btn-secondary text-sm flex items-center justify-center gap-2"
                  >
                    Unsubscribe from Digests Only
                  </button>
                )}
              </div>

              <p className="text-center text-xs text-content-tertiary">
                Need to fine-tune alerts?{' '}
                <Link to="/login" className="text-brand hover:underline font-medium">
                  Log in to your account
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

export default Unsubscribe
