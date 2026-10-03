import { Link } from "react-router-dom"
import { Cookie, ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react"
import { usePageTitle } from "../hooks/usePageTitle"
import { PublicFooter } from "../components/PublicFooter"

export default function Cookies() {
  usePageTitle("Cookie Policy")

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <header className="border-b border-surface-border bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-brand transition-colors">
            <ArrowLeft size={16} /> Back to CineConnect
          </Link>
          <span className="text-xs font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md">
            DRAFT — review by counsel before launch
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-grow">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-3">
            <Cookie size={14} /> Tracking & Storage Notice
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-content-heading tracking-tight mb-2">
            Cookie & Local Storage Policy
          </h1>
          <p className="text-sm text-content-tertiary">
            Version 1.0 • Effective Date: October 2, 2026 • Last Updated: October 2, 2026
          </p>
        </div>

        <div className="space-y-8 text-sm sm:text-base text-content-secondary leading-relaxed">
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <ShieldCheck size={20} className="text-brand" /> 1. How CineConnect Uses Cookies & Local Storage
            </h2>
            <p className="mb-4">
              CineConnect values user privacy and adheres to data minimization. We do not use third-party cross-site advertising cookies or behavioral ad tracking networks. We primarily utilize browser <code>localStorage</code> and session tokens strictly necessary to maintain authenticated sessions and platform security.
            </p>

            <div className="overflow-x-auto mt-6">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-section text-content-heading">
                    <th className="py-3 px-4 font-semibold">Identifier</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Purpose</th>
                    <th className="py-3 px-4 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  <tr>
                    <td className="py-3 px-4 font-mono">sb-*-auth-token</td>
                    <td className="py-3 px-4"><span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">Strictly Essential</span></td>
                    <td className="py-3 px-4">Cryptographic JWT bearer token storing authenticated user session.</td>
                    <td className="py-3 px-4">Session / Expired after logout</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono">cineconnect_consent</td>
                    <td className="py-3 px-4"><span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">Strictly Essential</span></td>
                    <td className="py-3 px-4">Stores consent acceptance status and policy version agreed upon.</td>
                    <td className="py-3 px-4">12 Months</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono">cineconnect_analytics</td>
                    <td className="py-3 px-4"><span className="badge bg-blue-50 text-blue-700 border-blue-200">Functional Analytics</span></td>
                    <td className="py-3 px-4">Aggregated, privacy-friendly funnel conversion counters (zero PII).</td>
                    <td className="py-3 px-4">30 Days (Consent Gated)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-brand" /> 2. Managing Your Preferences
            </h2>
            <p className="mb-3">
              Essential cookies cannot be disabled as the marketplace application cannot function without session authentication.
            </p>
            <p>
              You can block or delete cookies via your browser settings at any time (e.g. Chrome Settings → Privacy and Security → Clear browsing data). Note that clearing essential storage will require you to log back in to your account.
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
