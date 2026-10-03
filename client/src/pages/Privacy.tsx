import { Link } from "react-router-dom"
import { Shield, ArrowLeft, Lock, FileText, Server, AlertCircle } from "lucide-react"
import { usePageTitle } from "../hooks/usePageTitle"
import { PublicFooter } from "../components/PublicFooter"

export default function Privacy() {
  usePageTitle("Privacy Policy")

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      {/* Top Navbar */}
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-grow">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-3">
            <Shield size={14} /> DPDP Act 2023 & GDPR Notice
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-content-heading tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-content-tertiary">
            Version 1.0 • Effective Date: October 2, 2026 • Last Updated: October 2, 2026
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-sm sm:text-base text-content-secondary leading-relaxed">
          {/* Section 1 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <Lock size={20} className="text-brand" /> 1. Data Fiduciary & Scope
            </h2>
            <p className="mb-3">
              CineConnect Media Technologies Private Limited ("CineConnect", "we", "our", or "us") operates a two-sided film-industry marketplace platform connecting Production Houses and Creative Talent. Under the Digital Personal Data Protection Act, 2023 (DPDP Act, India) and international data protection standards such as the General Data Protection Regulation (GDPR), CineConnect acts as the <strong>Data Fiduciary</strong> (or Data Controller) regarding your personal data.
            </p>
            <p>
              This Privacy Policy explains what personal data we collect, why we collect it, how it is processed and secured, the third-party subprocessors we engage, and how you may exercise your statutory rights as a Data Principal.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <FileText size={20} className="text-brand" /> 2. Personal Data We Collect
            </h2>
            <p className="mb-4">
              We collect only the minimum personal data strictly necessary to facilitate verified connections and matchmaking between production houses and industry talent:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li><strong>Account Credentials:</strong> Email address, username, encrypted password hash (handled securely via Supabase Auth), and assigned platform role (Production or Talent).</li>
              <li><strong>Talent Professional Profile:</strong> Full name, professional bio, primary craft/role (e.g. Director of Photography, Sound Designer, Actor), verified skills, years of industry experience, primary spoken/working languages, base location/city, profile avatar image, portfolio/IMDb links, and credit history.</li>
              <li><strong>Production House Profile:</strong> Company name, verified bio, company logo, and production details/slate description.</li>
              <li><strong>Marketplace Activities:</strong> Job listings created, applications submitted, cover notes, pipeline status changes (shortlist, interview, hire, reject), bookmarked/saved jobs, customized job alerts, and direct messages sent and received on the platform.</li>
              <li><strong>Technical & Consent Logs:</strong> IP address, browser user-agent, session tokens, consent version timestamp, and device metadata strictly used for account security and rate-limiting enforcement.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <Server size={20} className="text-brand" /> 3. Data Processors & Hosting Infrastructure
            </h2>
            <p className="mb-4">
              We host our services with industry-leading cloud infrastructure providers adhering to stringent ISO/IEC 27001, SOC 2 Type II, and DPDP-compliant standards:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
              <div className="border border-surface-border rounded-lg p-4 bg-surface-section">
                <p className="font-semibold text-content-heading">Supabase Inc. (AWS ap-south-1 Mumbai)</p>
                <p className="text-xs text-content-tertiary mt-1">Primary database, row-level security (RLS), authentication, and encrypted object storage for avatars and documents.</p>
              </div>
              <div className="border border-surface-border rounded-lg p-4 bg-surface-section">
                <p className="font-semibold text-content-heading">Fly.io Inc. (Mumbai Region: bom)</p>
                <p className="text-xs text-content-tertiary mt-1">Backend Express API container execution in India, ensuring localized low-latency and domestic data residency compliance.</p>
              </div>
              <div className="border border-surface-border rounded-lg p-4 bg-surface-section">
                <p className="font-semibold text-content-heading">Vercel Inc. (Global Edge CDN)</p>
                <p className="text-xs text-content-tertiary mt-1">Encrypted HTTPS distribution of frontend web application assets with strict Content Security Policies.</p>
              </div>
              <div className="border border-surface-border rounded-lg p-4 bg-surface-section">
                <p className="font-semibold text-content-heading">Resend Inc.</p>
                <p className="text-xs text-content-tertiary mt-1">Transactional email delivery for 6-digit OTP verification codes and important application pipeline notifications.</p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <Shield size={20} className="text-brand" /> 4. Data Retention & Automated Purging
            </h2>
            <p className="mb-3">
              We retain personal data only for as long as your account remains active or as required by applicable Indian laws. In compliance with data minimization principles:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Read Notifications:</strong> Automatically purged from database storage after <strong>90 days</strong>.</li>
              <li><strong>Email Outbox Logs:</strong> Transient email delivery logs are permanently purged after <strong>30 days</strong>.</li>
              <li><strong>Account Deletion:</strong> When an account is deleted via the Settings page, our cascading deletion pipeline immediately and permanently purges your profile, job listings, application history, message threads, uploaded avatar, and resumes from all databases and storage buckets.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-brand" /> 5. Your Rights as a Data Principal
            </h2>
            <p className="mb-4">
              Under the DPDP Act 2023 and GDPR, you possess absolute, enforceable rights over your personal data:
            </p>
            <div className="space-y-3">
              <div className="p-3.5 bg-surface-section rounded-lg border border-surface-border">
                <p className="font-semibold text-content-heading text-sm">Right to Access & Data Portability</p>
                <p className="text-xs text-content-secondary mt-0.5">You can download a complete, machine-readable JSON archive of all your personal data at any time via <code>GET /account/export</code> or your Profile Settings page.</p>
              </div>
              <div className="p-3.5 bg-surface-section rounded-lg border border-surface-border">
                <p className="font-semibold text-content-heading text-sm">Right to Correction & Updating</p>
                <p className="text-xs text-content-secondary mt-0.5">You can update your personal details, credits, verified skills, and craft information directly through your inline profile editor.</p>
              </div>
              <div className="p-3.5 bg-surface-section rounded-lg border border-surface-border">
                <p className="font-semibold text-content-heading text-sm">Right to Erasure (Account Deletion)</p>
                <p className="text-xs text-content-secondary mt-0.5">You have the unconditional right to erase your account and associated assets permanently via the Account Deletion feature.</p>
              </div>
              <div className="p-3.5 bg-surface-section rounded-lg border border-surface-border">
                <p className="font-semibold text-content-heading text-sm">Right to Grievance Redressal</p>
                <p className="text-xs text-content-secondary mt-0.5">You may direct any privacy concerns or complaints to our designated Grievance Officer who will acknowledge your complaint within 24 hours.</p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <Shield size={20} className="text-brand" /> 6. Grievance Officer (DPDP Act & IT Rules 2021)
            </h2>
            <p className="mb-4">
              In accordance with Section 13 of the Digital Personal Data Protection Act, 2023 and Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the contact details of the Grievance Officer are:
            </p>
            <div className="bg-surface-section p-4 rounded-lg border border-surface-border text-xs sm:text-sm space-y-1.5 font-mono">
              <p><strong>Designation:</strong> Grievance Officer, CineConnect Media Technologies Pvt. Ltd.</p>
              <p><strong>Officer Name:</strong> [DRAFT — review by counsel: Mr. A. Sharma]</p>
              <p><strong>Email Address:</strong> <a href="mailto:grievance@cineconnect.in" className="text-brand underline">grievance@cineconnect.in</a></p>
              <p><strong>Physical Address:</strong> [DRAFT — review by counsel: Film City Complex, Goregaon (East), Mumbai, Maharashtra 400065, India]</p>
              <p><strong>Response SLA:</strong> Acknowledgment within 24 hours; complete resolution within 15–30 days.</p>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
