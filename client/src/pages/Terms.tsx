import { Link } from "react-router-dom"
import { Scale, ArrowLeft, CheckCircle, ShieldAlert, Film, BookOpen } from "lucide-react"
import { usePageTitle } from "../hooks/usePageTitle"
import { PublicFooter } from "../components/PublicFooter"

export default function Terms() {
  usePageTitle("Terms of Service")

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
            <Scale size={14} /> Marketplace Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-content-heading tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-content-tertiary">
            Version 1.0 • Effective Date: October 2, 2026 • Last Updated: October 2, 2026
          </p>
        </div>

        <div className="space-y-8 text-sm sm:text-base text-content-secondary leading-relaxed">
          {/* Section 1 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <Film size={20} className="text-brand" /> 1. Nature of the Platform
            </h2>
            <p className="mb-3">
              CineConnect is a curated, two-sided film-industry marketplace platform engineered to enable Production Houses to discover, evaluate, and connect with creative and technical film industry Talent (such as cinematographers, actors, editors, sound designers, writers, and crew).
            </p>
            <p>
              CineConnect operates strictly as a technology intermediary under Section 79 of the Information Technology Act, 2000. <strong>CineConnect is not an employer, talent agency, casting agency, or labor union.</strong> Any engagements, contracts, deal memos, or compensation arrangements agreed upon between Production Houses and Talent are made directly between the respective parties.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-brand" /> 2. Eligibility & Account Responsibilities
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Age Requirement:</strong> You must be at least 18 years of age to register an account on CineConnect.</li>
              <li><strong>Accurate Information:</strong> Users must provide truthful, authentic information regarding identity, credits, and production entities. Misrepresentation of film credits or production affiliation is grounds for immediate termination.</li>
              <li><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your authentication credentials and OTP tokens. You must notify us immediately of any unauthorized access.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <BookOpen size={20} className="text-brand" /> 3. Intellectual Property & Showreels
            </h2>
            <p className="mb-3">
              <strong>Talent and Production Houses retain 100% ownership of their pre-existing intellectual property</strong>, including film footage, showreels, headshots, screenplays, audio files, and portfolio materials.
            </p>
            <p>
              By uploading media to CineConnect, you grant us a worldwide, non-exclusive, royalty-free, limited license strictly for the purpose of operating, hosting, and displaying your profile and media to prospective employers within the marketplace and computing algorithmic match scores.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <ShieldAlert size={20} className="text-brand" /> 4. Prohibited Conduct
            </h2>
            <p className="mb-3">Users of CineConnect agree never to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Scrape, extract, or harvest user profiles, phone numbers, or email addresses via automated scripts or crawlers.</li>
              <li>Post fraudulent, misleading, unverified, or exploitative job listings, casting calls, or audition notices.</li>
              <li>Charge audition fees or unauthorized fees to talent in violation of industry and statutory guild norms.</li>
              <li>Upload malicious files, cross-site scripting (XSS) vectors (including malicious SVG files), or unauthorized copyrighted media.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-content-heading mb-4 flex items-center gap-2">
              <Scale size={20} className="text-brand" /> 5. Governing Law & Dispute Resolution
            </h2>
            <p className="mb-3">
              These Terms of Service shall be governed by and construed in accordance with the laws of the Republic of India.
            </p>
            <p>
              Any disputes, controversies, or claims arising out of or relating to these Terms or platform operations shall be subject to the exclusive jurisdiction of the competent courts situated in <strong>Mumbai, Maharashtra, India</strong>.
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
