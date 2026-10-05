import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Check,
  ShieldCheck,
  MapPin,
  Calendar,
  IndianRupee,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLandingMeta } from '../hooks/useLandingMeta'
import { LightMeter, Signal } from '../components/ui/LightMeter'
import { DepartmentMark, DepartmentKey } from '../components/ui/DepartmentMark'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { PublicFooter } from '../components/PublicFooter'
import { vocabApi, VocabItem } from '../lib/api'

// ── Static Sample Data for Hero Live Miniature ───────────────

interface CandidateSample {
  id: string
  label: string
  experience: string
  city: string
  skills: string
  settledScore: number
  initialScore: number
}

const SAMPLE_CANDIDATES: CandidateSample[] = [
  {
    id: 'c1',
    label: 'Candidate #4108',
    experience: '8 yrs',
    city: 'Mumbai',
    skills: 'Focus Pulling, ARRI Alexa, Gaffer',
    settledScore: 94,
    initialScore: 52,
  },
  {
    id: 'c2',
    label: 'Candidate #2915',
    experience: '6 yrs',
    city: 'Mumbai',
    skills: 'Steadicam, Lighting Design',
    settledScore: 86,
    initialScore: 68,
  },
  {
    id: 'c3',
    label: 'Candidate #7032',
    experience: '4 yrs',
    city: 'Pune',
    skills: 'Camera Operator, DIT',
    settledScore: 72,
    initialScore: 81,
  },
]

// ── Seven Matching Signals (Real Product Evaluation Content) ──

const SEVEN_SIGNALS: Signal[] = [
  {
    name: 'Skills match',
    weight: 30,
    score: 28,
    reason: 'Evaluates required technical competencies and equipment proficiencies directly against candidate experience.',
  },
  {
    name: 'Role match',
    weight: 20,
    score: 20,
    reason: 'Validates credited history in this specific department hierarchy and role position.',
  },
  {
    name: 'Experience match',
    weight: 15,
    score: 13,
    reason: 'Assesses total years on active film sets against the production scale.',
  },
  {
    name: 'Language fluency',
    weight: 10,
    score: 10,
    reason: 'Confirms working language proficiency required for direction and department heads on set.',
  },
  {
    name: 'Location proximity',
    weight: 10,
    score: 10,
    reason: 'Measures proximity to the shooting location to minimize travel time and lodging requirements.',
  },
  {
    name: 'Profile completeness',
    weight: 10,
    score: 9,
    reason: 'Reflects verified credits, showreel links, union memberships, and contact readiness.',
  },
  {
    name: 'Activity recency',
    weight: 5,
    score: 4,
    reason: 'Prioritizes talent actively available, responsive, and seeking film productions.',
  },
]

// ── Roles and Skills by Department ───────────────────────────

interface DepartmentGroup {
  key: DepartmentKey
  name: string
  roles: string[]
  skills: string[]
}

const STATIC_DEPARTMENTS: DepartmentGroup[] = [
  {
    key: 'camera',
    name: 'Camera',
    roles: [
      'Cinematographer',
      'Camera Operator',
      'First Assistant Camera (1st AC)',
      'Second Assistant Camera (2nd AC)',
      'Steadicam Operator',
      'Drone Operator',
      'Digital Imaging Technician (DIT)',
    ],
    skills: ['ARRI Alexa', 'Cooke Anamorphic', 'Focus Pulling', 'Lighting Design'],
  },
  {
    key: 'sound',
    name: 'Sound',
    roles: [
      'Sound Designer',
      'Production Sound Mixer',
      'Boom Operator',
      'Sync Sound Recordist',
      'Foley Artist',
      'Re-recording Mixer',
    ],
    skills: ['Dolby Atmos', 'Pro Tools', 'Location Sound', 'Lavalier Rigging'],
  },
  {
    key: 'editing',
    name: 'Editing',
    roles: [
      'Editor',
      'Colorist',
      'Assistant Editor',
      'Post-Production Supervisor',
      'Visual Effects (VFX) Supervisor',
    ],
    skills: ['DaVinci Resolve', 'Avid Media Composer', 'ACES Workflow', 'Premiere Pro'],
  },
  {
    key: 'art and costume',
    name: 'Art & Costume',
    roles: [
      'Production Designer',
      'Art Director',
      'Costume Designer',
      'Set Dresser',
      'Key Makeup Artist',
    ],
    skills: ['Set Drafting', 'Period Research', 'SFX Makeup', 'Wardrobe Breakdown'],
  },
  {
    key: 'cast',
    name: 'Cast',
    roles: [
      'Lead Actor',
      'Supporting Actor',
      'Voice Artist',
      'Stunt Coordinator',
      'Background Artist',
    ],
    skills: ['Method Acting', 'Action Wirework', 'Dialogue Delivery', 'ADR Sync'],
  },
  {
    key: 'production',
    name: 'Production',
    roles: [
      'Producer',
      'Line Producer',
      'Executive Producer',
      'First Assistant Director (1st AD)',
      'Second Assistant Director (2nd AD)',
      'Production Manager',
    ],
    skills: ['Shooting Schedule', 'Call Sheets', 'Location Permits', 'Budget Management'],
  },
]

export default function Landing() {
  useLandingMeta()
  const { user } = useAuth()

  // Authenticated users redirect straight to /home
  if (user) {
    return <Navigate to="/home" replace />
  }

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // ── Hero Miniature State ─────────────────────────────────────
  // If reduced motion is preferred: immediately sorted and settled with 0 delay
  const [candidates, setCandidates] = useState<CandidateSample[]>(() => {
    if (prefersReducedMotion) {
      return [...SAMPLE_CANDIDATES].sort((a, b) => b.settledScore - a.settledScore)
    }
    // Start in initial unranked order
    return [SAMPLE_CANDIDATES[2], SAMPLE_CANDIDATES[1], SAMPLE_CANDIDATES[0]]
  })

  const [currentScores, setCurrentScores] = useState<Record<string, number>>(() => {
    if (prefersReducedMotion) {
      return {
        c1: SAMPLE_CANDIDATES[0].settledScore,
        c2: SAMPLE_CANDIDATES[1].settledScore,
        c3: SAMPLE_CANDIDATES[2].settledScore,
      }
    }
    return {
      c1: SAMPLE_CANDIDATES[0].initialScore,
      c2: SAMPLE_CANDIDATES[1].initialScore,
      c3: SAMPLE_CANDIDATES[2].initialScore,
    }
  })

  const [isRanked, setIsRanked] = useState<boolean>(prefersReducedMotion)

  useEffect(() => {
    if (prefersReducedMotion) return

    // Settle needle scores after 350ms
    const settleTimer = setTimeout(() => {
      setCurrentScores({
        c1: SAMPLE_CANDIDATES[0].settledScore,
        c2: SAMPLE_CANDIDATES[1].settledScore,
        c3: SAMPLE_CANDIDATES[2].settledScore,
      })
    }, 350)

    // Reorder into rank order after 850ms, then stay still
    const reorderTimer = setTimeout(() => {
      setCandidates([...SAMPLE_CANDIDATES].sort((a, b) => b.settledScore - a.settledScore))
      setIsRanked(true)
    }, 850)

    return () => {
      clearTimeout(settleTimer)
      clearTimeout(reorderTimer)
    }
  }, [prefersReducedMotion])

  // ── Controlled Vocabulary fetch (falls back to static) ────────
  const [departments, setDepartments] = useState<DepartmentGroup[]>(STATIC_DEPARTMENTS)

  useEffect(() => {
    let isMounted = true
    vocabApi
      .roles()
      .then((res) => {
        if (!isMounted || !res?.roles?.length) return
        // Optional enrich: if backend roles exist, ensure canonical departments retain them
        const roleList: VocabItem[] = res.roles
        setDepartments((prev) =>
          prev.map((group) => {
            const apiRolesForGroup = roleList
              .filter((r) => r.department?.toLowerCase().includes(group.key))
              .map((r) => r.name)
            if (!apiRolesForGroup.length) return group
            const combined = Array.from(new Set([...group.roles, ...apiRolesForGroup]))
            return { ...group, roles: combined }
          })
        )
      })
      .catch(() => {
        // Fall back gracefully to static defaults (renders without API)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between selection:bg-tungsten/30 text-ink">
      {/* ── Section 1: Hero ─────────────────────────────────── */}
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="w-full border-b border-line bg-surface pt-12 pb-16 lg:pt-20 lg:pb-24 scroll-mt-16"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 xl:gap-10 items-center">
            {/* Left: Headline & Actions */}
            <div className="lg:col-span-6 flex flex-col items-start text-left">
              <h1
                id="hero-heading"
                className="text-32 sm:text-40 lg:text-56 font-extrabold text-ink tracking-tight leading-[1.1] scroll-mt-16 sm:scroll-mt-20"
              >
                Hire film crew that fits the job, not just the title.
              </h1>

              <p className="mt-5 text-16 sm:text-18 text-muted leading-relaxed max-w-xl">
                CineConnect scores cast and crew against every production requirement using seven
                transparent signals, verified credits, and direct communication.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Link
                  to="/register?role=production"
                  className="btn-primary text-16 font-semibold py-3 px-6 text-center rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity"
                >
                  Post a job
                </Link>
                <Link
                  to="/register?role=talent"
                  className="btn-secondary text-16 font-semibold py-3 px-6 text-center rounded-[3px] border border-line bg-surface text-ink hover:bg-paper transition-colors"
                >
                  Find film work
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-y-2 gap-x-6 text-12 text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Check size={14} className="text-tungsten" />
                  Verified film credits
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check size={14} className="text-tungsten" />
                  7-signal match scoring
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check size={14} className="text-tungsten" />
                  Export or delete your data any time
                </span>
              </div>
            </div>

            {/* Right: Live Miniature of the Product */}
            <div className="lg:col-span-6 w-full">
              <div
                className="bg-paper border border-line rounded-[3px] p-4 sm:p-5 shadow-xs"
                data-testid="live-miniature"
              >
                {/* Miniature Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-line text-12 text-muted">
                  <span className="font-semibold text-12 text-ink">
                    Live match preview
                  </span>
                  <span className="tnum">3 applicants evaluated</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                  {/* Job card on the left */}
                  <div className="md:col-span-5 bg-surface border border-line rounded-[3px] p-3.5 flex flex-col justify-between gap-3 h-full">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <DepartmentMark department="camera" size="sm" />
                        <span className="text-[11px] text-muted">Feature Film</span>
                      </div>

                      <div>
                        <h2 className="text-14 font-bold text-ink leading-snug">
                          Cinematographer
                        </h2>
                        <p className="text-12 text-muted mt-0.5">
                          12-day feature shoot, Mumbai
                        </p>
                      </div>

                      <div className="flex flex-col gap-1 text-[11px] text-muted pt-1 border-t border-line/60">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="shrink-0 text-muted" />
                          <span>Mumbai, Maharashtra</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="shrink-0 text-muted" />
                          <span>12 shoot days</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <IndianRupee size={11} className="shrink-0 text-muted" />
                          <span className="tnum">₹2,50,000 budget</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-line/60">
                      <span className="px-1.5 py-0.5 bg-paper text-[10px] text-ink rounded-[2px] border border-line">
                        ARRI Alexa
                      </span>
                      <span className="px-1.5 py-0.5 bg-paper text-[10px] text-ink rounded-[2px] border border-line">
                        Cooke Anamorphic
                      </span>
                    </div>
                  </div>

                  {/* Three candidate rows on the right */}
                  <div className="md:col-span-7 flex flex-col justify-between gap-2.5">
                    {candidates.map((cand, idx) => {
                      const score = currentScores[cand.id] ?? cand.settledScore
                      const rankNumber = idx + 1

                      return (
                        <div
                          key={cand.id}
                          className="bg-surface border border-line rounded-[3px] p-3 flex flex-col gap-2 transition-all duration-300"
                          data-testid={`candidate-row-${cand.id}`}
                        >
                          <div className="flex items-center justify-between text-12">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] tnum ${
                                  isRanked && rankNumber === 1
                                    ? 'bg-tungsten/20 text-ink border border-tungsten/40'
                                    : 'bg-paper text-muted border border-line'
                                }`}
                              >
                                {isRanked ? `#${rankNumber}` : 'Pending'}
                              </span>
                              <span className="font-semibold text-ink text-12">
                                {cand.label}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted tnum">
                              {cand.experience} • {cand.city}
                            </span>
                          </div>

                          {/* Candidate LightMeter */}
                          <LightMeter
                            score={score}
                            size="sm"
                            showScoreLabel={true}
                            expandable={false}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: How Matching Works ───────────────────── */}
      <section
        id="how-matching-works"
        aria-labelledby="how-matching-works-heading"
        className="py-16 lg:py-24 bg-surface border-b border-line scroll-mt-16 sm:scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2
              id="how-matching-works-heading"
              className="text-28 sm:text-40 font-extrabold text-ink tracking-tight scroll-mt-16 sm:scroll-mt-20"
            >
              How matching works
            </h2>
            <p className="mt-3 text-16 text-muted leading-relaxed">
              Every candidate score is calculated from seven signals. Production teams see
              exactly why someone matches, and crew and cast see how their profile measures against the role.
            </p>
          </div>

          {/* Single large LightMeter with expanded breakdown */}
          <div className="mt-10 bg-paper border border-line rounded-[3px] p-6 lg:p-8 max-w-4xl">
            <div className="mb-4">
              <span className="text-12 font-medium text-muted">
                Sample match evaluation
              </span>
              <h3 className="text-18 font-bold text-ink mt-1">
                Cinematographer candidate evaluation
              </h3>
            </div>

            <LightMeter
              score={94}
              breakdown={SEVEN_SIGNALS}
              size="lg"
              defaultExpanded={true}
              expandable={true}
              label="Overall match score"
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: For Production Offices and For Crew and Cast ── */}
      <section
        id="audiences"
        aria-label="For production offices and crew"
        className="py-16 lg:py-24 bg-paper border-b border-line scroll-mt-16 sm:scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* Column 1: For Production Offices */}
            <div className="bg-surface border border-line rounded-[3px] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <h2
                  id="production-heading"
                  className="text-22 sm:text-28 font-bold text-ink scroll-mt-16 sm:scroll-mt-20"
                >
                  For production offices
                </h2>
                <p className="text-14 text-muted mt-1">
                  Producers, casting directors, and department heads staffing productions.
                </p>

                <ul className="mt-6 flex flex-col gap-4 text-14 text-ink">
                  <li className="flex items-start gap-3">
                    <Check size={14} className="text-ink shrink-0 mt-1" />
                    <span>
                      Filter crew by verified film credits rather than unverified resumes.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={14} className="text-ink shrink-0 mt-1" />
                    <span>
                      Evaluate applicant fit instantly with 7-signal match scores before opening a message.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={14} className="text-ink shrink-0 mt-1" />
                    <span>
                      Initiate secure direct contact and contract discussions without sharing private phone numbers.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-line">
                <Link
                  to="/register?role=production"
                  className="inline-flex items-center text-14 font-semibold text-ink hover:underline"
                >
                  Register as a production office
                </Link>
              </div>
            </div>

            {/* Column 2: For Crew and Cast */}
            <div className="bg-surface border border-line rounded-[3px] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <h2
                  id="crew-heading"
                  className="text-22 sm:text-28 font-bold text-ink scroll-mt-16 sm:scroll-mt-20"
                >
                  For crew and cast
                </h2>
                <p className="text-14 text-muted mt-1">
                  Actors, technicians, and crew members seeking film projects.
                </p>

                <ul className="mt-6 flex flex-col gap-4 text-14 text-ink">
                  <li className="flex items-start gap-3">
                    <Check size={14} className="text-ink shrink-0 mt-1" />
                    <span>
                      Showcase validated credits and showreels in a single profile.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={14} className="text-ink shrink-0 mt-1" />
                    <span>
                      See how closely your experience matches any job before you spend time applying.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check size={14} className="text-ink shrink-0 mt-1" />
                    <span>
                      Receive direct interview and audition requests from verified studio productions.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-line">
                <Link
                  to="/register?role=talent"
                  className="inline-flex items-center text-14 font-semibold text-ink hover:underline"
                >
                  Register as crew or cast
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Roles We Cover ────────────────────────── */}
      <section
        id="roles-we-cover"
        aria-labelledby="roles-heading"
        className="py-16 lg:py-24 bg-surface border-b border-line scroll-mt-16 sm:scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2
              id="roles-heading"
              className="text-28 sm:text-40 font-extrabold text-ink tracking-tight scroll-mt-16 sm:scroll-mt-20"
            >
              Roles we cover
            </h2>
            <p className="mt-3 text-16 text-muted leading-relaxed">
              Explore positions across all primary film departments. Every role links directly to
              open listings in that specialization.
            </p>
          </div>

          {/* Ruled Table */}
          <div className="w-full border-t border-b border-line">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Film departments and covered roles</caption>
              <thead>
                <tr className="border-b border-line text-12 font-medium text-muted">
                  <th scope="col" className="py-3 pr-4 sm:pr-6 font-medium w-36 sm:w-48">
                    Department
                  </th>
                  <th scope="col" className="py-3 font-medium">
                    Typical roles
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {departments.map((dept) => (
                  <tr key={dept.key} className="hover:bg-paper/40 transition-colors">
                    <td className="py-4 pr-4 sm:pr-6 align-top">
                      <DepartmentMark department={dept.key} label={dept.name} size="md" />
                    </td>
                    <td className="py-4 align-top">
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-14">
                        {dept.roles.map((role) => (
                          <Link
                            key={role}
                            to={`/jobs?q=${encodeURIComponent(role)}`}
                            className="text-ink hover:underline font-medium transition-colors"
                          >
                            {role}
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Section 5: Trust and Verification ────────────────── */}
      <section
        id="trust-and-verification"
        aria-labelledby="trust-heading"
        className="py-16 lg:py-24 bg-paper border-b border-line scroll-mt-16 sm:scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2
              id="trust-heading"
              className="text-28 sm:text-40 font-extrabold text-ink tracking-tight scroll-mt-16 sm:scroll-mt-20"
            >
              Trust and verification
            </h2>
            <p className="mt-3 text-16 text-muted leading-relaxed">
              Film productions require authentic identities, safe communications, and strict privacy
              safeguards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* Privacy and consent */}
            <div className="bg-surface border border-line rounded-[3px] p-6 sm:p-8 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-ink">
                <ShieldCheck size={20} className="text-ink" />
                <h3 className="text-18 font-bold text-ink">
                  Privacy and consent
                </h3>
              </div>

              <p className="text-14 text-muted leading-relaxed">
                We collect only the professional credits, media showreels, and contact details you choose to share, never selling or sharing your data with third parties. You retain complete control to access, export, or permanently delete your account data at any time via your account settings or our{' '}
                <Link to="/privacy" className="text-ink font-semibold underline hover:opacity-80">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            {/* Verified studio badge explanation */}
            <div className="bg-surface border border-line rounded-[3px] p-6 sm:p-8 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <VerifiedBadge size={14} showText={true} />
                <h3 className="text-18 font-bold text-ink">
                  Verified studio badge
                </h3>
              </div>

              <p className="text-14 text-muted leading-relaxed">
                The verified studio badge indicates an authenticated production house with verified
                corporate credentials and active industry standing. Every role, contract offer, and
                audition from a verified studio is backed by an authenticated production entity,
                protecting cast and crew from spoofed listings and unauthorized contacts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Final Call to Action ──────────────────── */}
      <section
        id="get-started"
        aria-labelledby="cta-heading"
        className="py-16 lg:py-24 bg-surface text-ink border-b border-line scroll-mt-16 sm:scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl flex flex-col items-start text-left">
            <h2
              id="cta-heading"
              className="text-28 sm:text-40 font-extrabold text-ink tracking-tight scroll-mt-16 sm:scroll-mt-20"
            >
              Ready to assemble your crew or book your next film production?
            </h2>

            <p className="mt-4 text-16 text-muted leading-relaxed max-w-xl">
              Join verified studios, directors, technicians, and cast collaborating across Indian cinema.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Link
                to="/register?role=production"
                className="btn-primary text-16 font-semibold py-3 px-6 text-center rounded-[3px] bg-tungsten text-ink hover:opacity-95 transition-opacity"
              >
                Post a job
              </Link>
              <Link
                to="/register?role=talent"
                className="btn-secondary text-16 font-semibold py-3 px-6 text-center rounded-[3px] border border-line bg-surface text-ink hover:bg-paper transition-colors"
              >
                Find film work
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Public Footer with Legal Links ──────────────────── */}
      <PublicFooter />
    </div>
  )
}
