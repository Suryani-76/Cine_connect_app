import { Link, Navigate } from 'react-router-dom'
import {
  Sparkles,
  Clapperboard,
  Users,
  CheckCircle2,
  Shield,
  MessageSquare,
  TrendingUp,
  Briefcase,
  Star,
  Film,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { PublicFooter } from '../components/PublicFooter'

const Landing = () => {
  usePageTitle(
    'Where Indian Cinema Finds Its Cast & Crew',
    'CineConnect connects verified film talent with leading studios and production houses using AI-powered matching, verified credits, and real-time chat.'
  )
  const { user } = useAuth()

  // Authenticated users redirect straight to /home
  if (user) {
    return <Navigate to="/home" replace />
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col justify-between selection:bg-brand/20">

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-surface-border bg-gradient-to-b from-surface-section/60 to-surface-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand-navy text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles size={14} className="text-brand" />
            India&apos;s Verified Film Industry Network
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-content-heading tracking-tight max-w-4xl mx-auto leading-tight">
            Where Filmmakers and Artists <span className="text-brand">Collaborate & Create</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-content-secondary max-w-2xl mx-auto leading-relaxed">
            Stop relying on scattered WhatsApp groups. CineConnect brings verified credits,
            AI-powered match scoring, and direct communication to Indian cinema production.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register?role=talent"
              className="btn-primary w-full sm:w-auto text-base px-6 py-3.5 inline-flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-shadow"
            >
              <Users size={18} /> Join as Talent
            </Link>
            <Link
              to="/register?role=production"
              className="btn-secondary w-full sm:w-auto text-base px-6 py-3.5 inline-flex items-center justify-center gap-2 bg-white"
            >
              <Clapperboard size={18} /> Hire Crew & Cast
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-content-tertiary">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-green-600" /> 100% Verified Profiles
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-green-600" /> 7-Signal AI Match Engine
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-green-600" /> DPDP Act 2023 Compliant
            </span>
          </div>
        </div>
      </section>

      {/* ── How It Works (Both Sides) ── */}
      <section className="py-20 bg-surface-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-content-heading">Engineered for Both Sides of the Camera</h2>
            <p className="mt-3 text-content-secondary">
              Whether you are casting an indie feature, hiring a Bollywood camera crew, or building your portfolio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* For Production */}
            <div className="card p-8 border-surface-border bg-white shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-navy text-white rounded-xl">
                  <Clapperboard size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-content-heading">For Production Houses & Studios</h3>
                  <p className="text-xs text-brand font-semibold uppercase tracking-wider">Casting Directors • Producers • Department Heads</p>
                </div>
              </div>

              <ul className="space-y-4 text-sm text-content-secondary">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs mt-0.5">1</div>
                  <div>
                    <strong className="text-content-heading">Post Detailed Roles with Requirements:</strong> Set specific skills, departments, locations, and compensation terms.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs mt-0.5">2</div>
                  <div>
                    <strong className="text-content-heading">Automated Match Scoring:</strong> Our transparent engine scores applicants across skills, experience, location, and verified credits.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs mt-0.5">3</div>
                  <div>
                    <strong className="text-content-heading">Direct & Safe Communication:</strong> Initiate in-app chats and schedule auditions without exposing personal numbers.
                  </div>
                </li>
              </ul>

              <div className="pt-2">
                <Link to="/register?role=production" className="btn-secondary text-sm w-full text-center py-2.5 inline-block">
                  Create Studio Account &rarr;
                </Link>
              </div>
            </div>

            {/* For Talent */}
            <div className="card p-8 border-surface-border bg-white shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand text-white rounded-xl">
                  <Film size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-content-heading">For Actors, Technicians & Crew</h3>
                  <p className="text-xs text-brand font-semibold uppercase tracking-wider">Actors • Cinematographers • Editors • Sound Designers</p>
                </div>
              </div>

              <ul className="space-y-4 text-sm text-content-secondary">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs mt-0.5">1</div>
                  <div>
                    <strong className="text-content-heading">Build Your Verified Film Credit Profile:</strong> Showcase project credits, showreels, availability, and PDF resumes.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs mt-0.5">2</div>
                  <div>
                    <strong className="text-content-heading">Match Transparency:</strong> Inspect why you match a posting before you apply, with detailed score breakdowns.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs mt-0.5">3</div>
                  <div>
                    <strong className="text-content-heading">1-Click Applications:</strong> Apply with your verified profile and get instant email alerts when your status advances.
                  </div>
                </li>
              </ul>

              <div className="pt-2">
                <Link to="/register?role=talent" className="btn-primary text-sm w-full text-center py-2.5 inline-block">
                  Build Talent Profile &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ── */}
      <section className="py-20 bg-surface-section border-y border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-content-heading">Why Leading Productions Rely on CineConnect</h2>
            <p className="mt-3 text-content-secondary">
              A high-trust ecosystem designed specifically for the dynamics of Indian film production.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6 bg-white space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-bold text-content-heading text-base">7-Signal Match Engine</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Objective scoring evaluates skills overlap, role history, location proximity, experience, and activity recency.
              </p>
            </div>

            <div className="card p-6 bg-white space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Star size={20} />
              </div>
              <h3 className="font-bold text-content-heading text-base">Verified Film Credits</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Verified badges for studios and structured credit history for cast and crew ensure authentic qualifications.
              </p>
            </div>

            <div className="card p-6 bg-white space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <h3 className="font-bold text-content-heading text-base">Protected Chat & Safety</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Production-gated messaging, block triggers, and audit logging keep creative conversations safe and professional.
              </p>
            </div>

            <div className="card p-6 bg-white space-y-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                <Shield size={20} />
              </div>
              <h3 className="font-bold text-content-heading text-base">Privacy by Design</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Full compliance with India&apos;s DPDP Act 2023 and GDPR: right to access, 1-hour data export, and complete erasure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Browse CTA Banner ── */}
      <section className="py-16 bg-brand-navy text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Ready to cast or get hired on your next production?
          </h2>
          <p className="text-blue-100 max-w-xl mx-auto text-sm sm:text-base">
            Browse hundreds of active listings across directing, cinematography, editing, acting, and technical departments.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/jobs"
              className="btn-primary bg-brand text-brand-navy font-bold px-6 py-3 text-sm inline-flex items-center gap-2 hover:bg-brand/90"
            >
              <Briefcase size={16} /> Browse Open Positions
            </Link>
            <Link
              to="/register"
              className="btn-secondary bg-transparent border-white/40 text-white hover:bg-white/10 px-6 py-3 text-sm"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Public Footer with Legal Links ── */}
      <PublicFooter />
    </div>
  )
}

export default Landing
