import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin,
  Globe,
  Briefcase,
  Clock,
  Building2,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Check,
  AlertCircle,
  Calendar,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  jobsApi,
  applicationsApi,
  savedJobsApi,
  jobAnalyticsApi,
  JobWithProduction,
  MatchBreakdown,
  talentApi,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { PageHeader } from '../components/PageHeader'
import { LightMeter, Signal } from '../components/ui/LightMeter'
import { DepartmentMark, resolveDepartment } from '../components/ui/DepartmentMark'
import { Modal, ModalContent } from '../components/ui/Modal'

// ── Apply Modal ───────────────────────────────────────────────

interface ApplyModalProps {
  jobId: string
  token: string
  matchPreview: MatchBreakdown | null
  onClose: () => void
  onSuccess: () => void
}

function ApplyModal({ jobId, token, matchPreview, onClose, onSuccess }: ApplyModalProps) {
  const [coverNote, setCoverNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const maxChars = 1000
  const remaining = maxChars - coverNote.length

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await applicationsApi.apply(
        { job_id: jobId, cover_note: coverNote.trim() || undefined },
        token
      )
      toast.success('Application submitted successfully')
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose() }}>
      <ModalContent
        title="Apply for this job"
        description="Submit your application with an optional cover note to the production team."
        className="max-w-lg"
      >
        <div className="space-y-4 pt-1">
          {/* Match Score Preview inside Modal */}
          {matchPreview && (
            <div className="p-3.5 bg-paper rounded-sm border border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-12 font-medium text-muted">Your match score</span>
                <span className="text-11 text-muted">Computed from talent profile</span>
              </div>
              <LightMeter
                score={typeof matchPreview.total === 'number' && !isNaN(matchPreview.total) ? matchPreview.total : 0}
                size="sm"
                showScoreLabel={true}
                expandable={false}
              />
              {matchPreview.missing_skills && matchPreview.missing_skills.length > 0 && (
                <p className="text-11 text-status-warning bg-amber-50/70 border border-amber-200/80 rounded-sm p-2">
                  Missing required skills: <span className="font-semibold">{matchPreview.missing_skills.join(', ')}</span>
                </p>
              )}
            </div>
          )}

          {/* Cover note input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label htmlFor="cover-note-input" className="text-12 font-semibold text-muted">
                Cover note <span className="text-muted font-normal">(optional)</span>
              </label>
              <span className={`text-11 ${remaining < 100 ? 'text-status-warning' : 'text-muted'}`}>
                {remaining} characters left
              </span>
            </div>
            <textarea
              id="cover-note-input"
              rows={5}
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value.slice(0, maxChars))}
              placeholder="Introduce yourself and explain why your experience fits this film production…"
              className="input resize-none w-full text-13"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-sm bg-red-50 border border-red-200 text-12 text-status-error">
              {error}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex gap-2.5 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-13">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary flex-1 text-13"
            >
              {loading ? 'Submitting…' : 'Send application'}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}

// ── Success banner ────────────────────────────────────────────

function SuccessBanner({ onViewApplications }: { onViewApplications: () => void }) {
  return (
    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-status-success font-bold">✓</span>
        <p className="text-13 font-semibold text-status-success">Application submitted</p>
      </div>
      <button
        type="button"
        onClick={onViewApplications}
        className="text-12 text-status-success font-semibold hover:underline"
      >
        View my applications
      </button>
    </div>
  )
}

// ── Deadline status helper ────────────────────────────────────

function getDeadlineStatus(deadline: string | null | undefined): { text: string; isPassed: boolean; isUrgent: boolean } | null {
  if (!deadline) return null
  const d = new Date(deadline)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs <= 0) {
    return { text: 'Deadline passed', isPassed: true, isUrgent: false }
  }
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays > 0) {
    const text = `${diffDays} day${diffDays > 1 ? 's' : ''} left (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
    return { text, isPassed: false, isUrgent: diffDays <= 3 }
  }
  return {
    text: `${diffHours} hour${diffHours !== 1 ? 's' : ''} left`,
    isPassed: false,
    isUrgent: true,
  }
}

// ── Main Page Component ───────────────────────────────────────

const JobDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuth()

  const isTalent = user?.role === 'talent'
  const talentProfileId = user?.profileId ?? ''

  const [job, setJob] = useState<JobWithProduction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setModal] = useState(false)
  const [applied, setApplied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)

  // Talent match score preview
  const [matchPreview, setMatchPreview] = useState<MatchBreakdown | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [talentSkills, setTalentSkills] = useState<string[]>([])

  usePageTitle(job?.title ?? 'Job')

  // Fetch Job details
  useEffect(() => {
    if (!id) return
    setLoading(true)
    jobsApi
      .getById(id, token ?? undefined)
      .then((r) => {
        setJob(r.job)
        if (token) {
          jobAnalyticsApi.recordView(id, token).catch(() => {})
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load job'))
      .finally(() => setLoading(false))
  }, [id, token])

  // Fetch talent match breakdown & profile skills if authenticated talent
  useEffect(() => {
    if (!id || !token || !isTalent) return
    setMatchLoading(true)
    jobsApi
      .myMatch(id, token)
      .then((res) => setMatchPreview(res))
      .catch(() => setMatchPreview(null))
      .finally(() => setMatchLoading(false))

    // Check if job is already saved
    savedJobsApi
      .list(token)
      .then((res) => {
        const isJobSaved = (res.saved || []).some((s) => s.job_id === id)
        setSaved(isJobSaved)
      })
      .catch(() => {})

    // Load talent profile skills for fallback skill checking
    talentApi
      .getMyProfile(token)
      .then((prof) => {
        if (prof?.profile?.skills) {
          setTalentSkills(prof.profile.skills)
        }
      })
      .catch(() => {})
  }, [id, token, isTalent])

  const handleToggleSave = async () => {
    if (!job || !token || !isTalent) return
    setSavingBookmark(true)
    try {
      if (saved) {
        await savedJobsApi.unsave(job.id, token)
        setSaved(false)
        toast.success('Job removed from saved listings')
      } else {
        await savedJobsApi.save(job.id, token)
        setSaved(true)
        toast.success('Job saved to your bookmarks')
      }
    } catch {
      toast.error('Failed to update bookmark')
    } finally {
      setSavingBookmark(false)
    }
  }

  // Format pay helper
  const formatPay = () => {
    if (!job?.pay_min && !job?.pay_max) return null
    const curr = job.pay_currency === 'INR' ? '₹' : (job.pay_currency ?? '₹')
    const period = job.pay_period ? ` / ${job.pay_period}` : ''
    if (job.pay_min && job.pay_max) {
      return `${curr}${Number(job.pay_min).toLocaleString()} – ${curr}${Number(job.pay_max).toLocaleString()}${period}`
    }
    if (job.pay_min) return `From ${curr}${Number(job.pay_min).toLocaleString()}${period}`
    return `Up to ${curr}${Number(job.pay_max).toLocaleString()}${period}`
  }

  // Convert match breakdown signals to LightMeter Signal[] format
  const lightMeterSignals = useMemo<Signal[] | undefined>(() => {
    if (!matchPreview?.signals) return undefined
    const { signals } = matchPreview
    return [
      {
        name: 'Skills',
        score: signals.skills_match?.score ?? 0,
        maxScore: 30,
        weight: signals.skills_match?.weight ?? 30,
        reason: signals.skills_match?.reason,
      },
      {
        name: 'Role',
        score: signals.role_match?.score ?? 0,
        maxScore: 20,
        weight: signals.role_match?.weight ?? 20,
        reason: signals.role_match?.reason,
      },
      {
        name: 'Experience',
        score: signals.experience_match?.score ?? 0,
        maxScore: 15,
        weight: signals.experience_match?.weight ?? 15,
        reason: signals.experience_match?.reason,
      },
      {
        name: 'Language',
        score: signals.language_match?.score ?? 0,
        maxScore: 10,
        weight: signals.language_match?.weight ?? 10,
        reason: signals.language_match?.reason,
      },
      {
        name: 'Location',
        score: signals.location_proximity?.score ?? 0,
        maxScore: 10,
        weight: signals.location_proximity?.weight ?? 10,
        reason: signals.location_proximity?.reason,
      },
      {
        name: 'Profile completeness',
        score: signals.profile_completeness?.score ?? 0,
        maxScore: 10,
        weight: signals.profile_completeness?.weight ?? 10,
        reason: signals.profile_completeness?.reason,
      },
      {
        name: 'Recent activity',
        score: signals.activity_recency?.score ?? 0,
        maxScore: 5,
        weight: signals.activity_recency?.weight ?? 5,
        reason: signals.activity_recency?.reason,
      },
    ]
  }, [matchPreview])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-4">
        <div className="border border-line rounded-sm bg-surface p-8 space-y-4 animate-pulse">
          <div className="h-7 bg-paper rounded w-1/3" />
          <div className="h-4 bg-paper rounded w-1/2" />
          <div className="h-32 bg-paper rounded w-full pt-4" />
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm border border-line rounded-sm p-8 bg-surface">
          <p className="font-bold text-18 text-ink mb-1">Job not found</p>
          <p className="text-14 text-muted mb-5">{error || 'This job may have been removed or unpublished.'}</p>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary text-13">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const req = job.job_requirements
  const prod = job.production_profiles || { company_name: 'Production House', verified: false }
  const primaryRole = req?.roles?.[0] || job.title
  const dept = resolveDepartment(primaryRole)
  const isClosed = job.status === 'closed'
  const isPublished = job.status === 'published'
  const deadlineInfo = getDeadlineStatus(job.deadline)
  const isDeadlinePassed = deadlineInfo?.isPassed ?? false
  const canApply = isTalent && isPublished && !isClosed && !isDeadlinePassed && !applied

  // Missing and matching skills check
  const checkSkillStatus = (skillName: string): { isPresent: boolean; isMissing: boolean } => {
    if (!isTalent) return { isPresent: false, isMissing: false }
    const sLower = skillName.trim().toLowerCase()

    if (matchPreview?.missing_skills) {
      const isMiss = matchPreview.missing_skills.some((ms) => ms.toLowerCase() === sLower)
      if (isMiss) return { isPresent: false, isMissing: true }
    }
    if (matchPreview?.matching_skills) {
      const isPres = matchPreview.matching_skills.some((ms) => ms.toLowerCase() === sLower)
      if (isPres) return { isPresent: true, isMissing: false }
    }

    // Fallback: check profile skills
    if (talentSkills.length > 0) {
      const existsInProfile = talentSkills.some((ts) => ts.toLowerCase() === sLower)
      return existsInProfile ? { isPresent: true, isMissing: false } : { isPresent: false, isMissing: true }
    }

    return { isPresent: false, isMissing: false }
  }

  // Reason summary for score preview
  const missingCount = matchPreview?.missing_skills?.length ?? 0
  const totalRequiredSkills = req?.skills?.length ?? 0
  const scoreReasonsSummary = missingCount > 0
    ? `Missing ${missingCount} of ${totalRequiredSkills} skills: ${matchPreview?.missing_skills?.join(', ')}`
    : matchPreview?.summary_reasons?.[0] || 'High alignment with required film credentials.'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title={job.title}
        breadcrumbs={[
          { label: 'Jobs', href: '/jobs' },
          { label: job.title },
        ]}
      />

      {applied && (
        <SuccessBanner onViewApplications={() => navigate('/home')} />
      )}

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Main Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Card */}
          <div className="border border-line rounded-sm bg-surface p-6 sm:p-7 space-y-4 shadow-subtle">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DepartmentMark department={dept} label={primaryRole} size="sm" />
                <span className="text-11 px-2 py-0.5 rounded-sm border border-line bg-paper text-ink font-medium capitalize">
                  {job.job_type ? job.job_type.replace('_', ' ') : 'Freelance'}
                </span>
                {job.status !== 'published' && (
                  <span className="text-11 px-2 py-0.5 rounded-sm border border-line bg-paper text-muted capitalize">
                    {job.status}
                  </span>
                )}
              </div>

              {/* Studio with verified badge */}
              <div className="flex items-center gap-2 text-14 text-ink">
                <Building2 size={16} className="text-muted shrink-0" />
                {prod.id ? (
                  <Link
                    to={`/company/${prod.id}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    {prod.company_name}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{prod.company_name}</span>
                )}
                {prod.verified && <VerifiedBadge />}
              </div>

              {/* Quick meta row */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-13 text-muted pt-2 border-t border-line/60">
                {req?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-muted" /> {req.location}
                  </span>
                )}
                {req?.language && (
                  <span className="flex items-center gap-1.5">
                    <Globe size={14} className="text-muted" /> {req.language}
                  </span>
                )}
                {req?.experience_level && (
                  <span className="flex items-center gap-1.5 capitalize">
                    <Briefcase size={14} className="text-muted" /> {req.experience_level} level
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-muted" />
                  Posted {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Description in Source Serif (font-serif) */}
          <div className="border border-line rounded-sm bg-surface p-6 sm:p-7 space-y-3.5 shadow-subtle">
            <h2 className="text-16 font-bold text-ink">About the role</h2>
            <div className="font-serif text-15 sm:text-16 leading-relaxed text-ink whitespace-pre-wrap">
              {job.description}
            </div>
          </div>

          {/* Requirements with Present / Missing Badges */}
          {req && (req.skills.length > 0 || req.roles.length > 0) && (
            <div className="border border-line rounded-sm bg-surface p-6 sm:p-7 space-y-5 shadow-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-1">
                <h2 className="text-16 font-bold text-ink">Requirements</h2>
                {isTalent && (
                  <span className="text-11 text-muted">
                    Checked against your talent profile
                  </span>
                )}
              </div>

              {/* Roles */}
              {req.roles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-12 font-semibold text-muted block">Hiring roles</span>
                  <div className="flex flex-wrap gap-2">
                    {req.roles.map((r) => (
                      <span
                        key={r}
                        className="px-2.5 py-1 rounded-sm text-12 font-medium bg-paper border border-line text-ink"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Skills readable list */}
              {req.skills.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-12 font-semibold text-muted block">Required skills</span>
                  <div className="space-y-2">
                    {req.skills.map((skill) => {
                      const { isPresent, isMissing } = checkSkillStatus(skill)

                      return (
                        <div
                          key={skill}
                          className={`flex items-center justify-between p-3 rounded-sm border transition-colors ${
                            isPresent
                              ? 'bg-emerald-50/60 border-emerald-200'
                              : isMissing
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-paper border-line'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isPresent ? (
                              <span className="w-5 h-5 rounded-full bg-status-success text-surface inline-flex items-center justify-center shrink-0">
                                <Check size={13} />
                              </span>
                            ) : isMissing ? (
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-surface inline-flex items-center justify-center shrink-0">
                                <AlertCircle size={13} />
                              </span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-muted shrink-0" />
                            )}
                            <span className="text-14 font-medium text-ink">{skill}</span>
                          </div>

                          {/* Present / Missing indicator text */}
                          {isTalent && (
                            <span
                              className={`text-12 font-medium ${
                                isPresent
                                  ? 'text-status-success'
                                  : isMissing
                                  ? 'text-amber-800'
                                  : 'text-muted'
                              }`}
                            >
                              {isPresent ? 'Present in your profile' : isMissing ? 'Missing from your profile' : ''}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* About Production House */}
          <div className="border border-line rounded-sm bg-surface p-6 sm:p-7 space-y-3.5 shadow-subtle">
            <h2 className="text-16 font-bold text-ink">About the production house</h2>
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-sm bg-ink text-surface font-bold text-15 flex items-center justify-center shrink-0">
                {prod.company_name?.[0]?.toUpperCase() ?? 'P'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-15 text-ink">{prod.company_name}</span>
                  {prod.verified && <VerifiedBadge />}
                </div>
                {prod.bio && (
                  <p className="text-13 text-muted leading-relaxed">{prod.bio}</p>
                )}
                {prod.id && (
                  <Link
                    to={`/company/${prod.id}`}
                    className="inline-flex items-center gap-1 text-12 font-semibold text-ink hover:underline pt-1"
                  >
                    View studio profile <ExternalLink size={12} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
          {/* Key Facts Card */}
          <div className="border border-line rounded-sm bg-surface p-6 space-y-4 shadow-subtle">
            <h2 className="text-15 font-bold text-ink pb-2 border-b border-line">Opportunity facts</h2>

            <div className="space-y-3 text-13">
              {/* Pay */}
              <div>
                <span className="text-11 font-semibold text-muted block mb-0.5">Remuneration</span>
                <span className="text-15 font-semibold text-ink">
                  {formatPay() || 'Unspecified pay'}
                </span>
              </div>

              {/* Shoot Dates */}
              <div>
                <span className="text-11 font-semibold text-muted block mb-0.5">Production dates</span>
                <div className="flex items-center gap-1.5 text-ink">
                  <Calendar size={14} className="text-muted" />
                  <span>
                    {job.start_date || job.end_date
                      ? `${job.start_date ? new Date(job.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Immediate'} – ${job.end_date ? new Date(job.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}`
                      : 'Flexible / To be discussed'}
                  </span>
                </div>
              </div>

              {/* Openings */}
              <div>
                <span className="text-11 font-semibold text-muted block mb-0.5">Openings</span>
                <div className="flex items-center gap-1.5 text-ink">
                  <Users size={14} className="text-muted" />
                  <span>
                    {job.openings ?? 1} {job.openings === 1 ? 'opening' : 'openings'}
                  </span>
                </div>
              </div>

              {/* Deadline countdown (Rule 1: never "Deadline: No deadline") */}
              <div>
                <span className="text-11 font-semibold text-muted block mb-0.5">Application deadline</span>
                <span
                  className={`font-medium ${
                    deadlineInfo?.isPassed
                      ? 'text-status-error'
                      : deadlineInfo?.isUrgent
                      ? 'text-status-warning'
                      : 'text-ink'
                  }`}
                >
                  {deadlineInfo?.text || 'No deadline'}
                </span>
              </div>
            </div>

            {/* Apply & Save Buttons */}
            <div className="pt-3 border-t border-line space-y-2.5">
              {canApply && (
                <button
                  type="button"
                  onClick={() => {
                    if (!talentProfileId) {
                      navigate('/create-profile')
                      return
                    }
                    setModal(true)
                  }}
                  className="btn-primary w-full text-14 py-2.5"
                >
                  Apply now
                </button>
              )}

              {isTalent && isClosed && (
                <div className="w-full text-center py-2 px-3 rounded-sm bg-paper border border-line text-13 font-medium text-muted">
                  Applications closed
                </div>
              )}

              {isTalent && isPublished && !isClosed && isDeadlinePassed && (
                <div className="w-full text-center py-2 px-3 rounded-sm bg-red-50 border border-red-200 text-13 font-medium text-status-error">
                  Deadline passed
                </div>
              )}

              {applied && (
                <div className="w-full text-center py-2 px-3 rounded-sm bg-emerald-50 border border-emerald-200 text-13 font-medium text-status-success">
                  Application submitted
                </div>
              )}

              {/* Save bookmark button */}
              {isTalent && (
                <button
                  type="button"
                  onClick={handleToggleSave}
                  disabled={savingBookmark}
                  className={`btn-secondary w-full text-13 py-2 inline-flex items-center justify-center gap-1.5 ${
                    saved ? 'border-ink text-ink font-semibold' : ''
                  }`}
                >
                  {saved ? (
                    <>
                      <BookmarkCheck size={15} className="fill-ink" />
                      <span>Saved in bookmarks</span>
                    </>
                  ) : (
                    <>
                      <Bookmark size={15} />
                      <span>Save job</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Score Preview Panel (for signed-in talent) */}
          {isTalent && (
            <div className="border border-line rounded-sm bg-surface p-6 space-y-3.5 shadow-subtle">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="text-15 font-bold text-ink">Score preview</h2>
                <span className="text-11 text-muted">7-signal match</span>
              </div>

              {matchLoading ? (
                <div className="space-y-2 py-2 animate-pulse">
                  <div className="h-4 bg-paper rounded w-1/3" />
                  <div className="h-6 bg-paper rounded w-full" />
                </div>
              ) : matchPreview ? (
                <div className="space-y-3">
                  <LightMeter
                    score={typeof matchPreview.total === 'number' && !isNaN(matchPreview.total) ? matchPreview.total : 0}
                    breakdown={lightMeterSignals}
                    size="md"
                    showScoreLabel={true}
                    expandable={true}
                    defaultExpanded={true}
                  />

                  {/* Explainability Reasons */}
                  <div className="p-3 bg-paper rounded-sm border border-line text-12 text-ink space-y-1.5">
                    <span className="font-semibold text-muted block text-11">Match analysis</span>
                    <p className="leading-snug">{scoreReasonsSummary}</p>
                  </div>
                </div>
              ) : (
                <p className="text-12 text-muted">Complete your talent profile to view your match score breakdown.</p>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Apply Modal */}
      {showModal && token && (
        <ApplyModal
          jobId={job.id}
          token={token}
          matchPreview={matchPreview}
          onClose={() => setModal(false)}
          onSuccess={() => {
            setModal(false)
            setApplied(true)
          }}
        />
      )}
    </div>
  )
}

export default JobDetail
