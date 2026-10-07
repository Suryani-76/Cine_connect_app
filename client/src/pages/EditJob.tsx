import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Check,
  Lock,
  AlertTriangle,
  AlertCircle,
  Building2,
  MapPin,
  Eye,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { jobsApi, SetRequirementsPayload, JobType, PayPeriod, JobWithProduction } from '../lib/api'
import {
  formatJobType,
  formatExperienceLevel,
  formatPayRange,
  formatDateRange,
  formatDeadlineDate,
  pluralize,
} from '../lib/formatters'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { AutocompleteInput } from '../components/AutocompleteInput'
import { AutocompleteTagInput } from '../components/AutocompleteTagInput'
import { DepartmentMark, resolveDepartment } from '../components/ui/DepartmentMark'
import { LightMeter } from '../components/ui/LightMeter'
import { VerifiedBadge } from '../components/VerifiedBadge'

interface Step1Form {
  title: string
  description: string
  job_type: JobType
  pay_min: string
  pay_max: string
  pay_currency: string
  pay_period: PayPeriod
  start_date: string
  end_date: string
  openings: number
  deadline: string
}

interface Step2Form {
  skills: string[]
  roles: string[]
  experience_level: 'entry' | 'mid' | 'senior' | 'any' | ''
  languages: string[]
  location: string
}

interface Step1Errors {
  title?: string
  description?: string
  pay?: string
  dates?: string
  openings?: string
  deadline?: string
}

interface Step2Errors {
  skills?: string
  roles?: string
}

const EXP_OPTIONS: { value: Step2Form['experience_level']; label: string }[] = [
  { value: '', label: 'Any level' },
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
  { value: 'any', label: 'Any level' },
]

const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: 'freelance', label: 'Freelance' },
  { value: 'contract', label: 'Contract' },
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
]

const PAY_PERIOD_OPTIONS: { value: PayPeriod; label: string }[] = [
  { value: 'project', label: 'Per project' },
  { value: 'hour', label: 'Per hour' },
  { value: 'day', label: 'Per day' },
  { value: 'week', label: 'Per week' },
  { value: 'month', label: 'Per month' },
]

function StepIndicator({
  current,
  onSelectStep,
}: {
  current: number
  onSelectStep: (step: number) => void
}) {
  const steps = [
    { n: 1, label: 'Job details' },
    { n: 2, label: 'Requirements' },
    { n: 3, label: 'Review & save' },
  ]

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map(({ n, label }, i) => {
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => onSelectStep(n)}
              className="flex items-center gap-2 shrink-0 group text-left cursor-pointer"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-12 font-bold border-2 transition-all ${
                  done
                    ? 'bg-ink border-ink text-surface'
                    : active
                    ? 'border-ink text-ink bg-paper'
                    : 'border-line text-muted bg-surface group-hover:border-ink'
                }`}
              >
                {done ? <Check size={14} /> : n}
              </div>
              <span
                className={`text-13 hidden sm:block font-medium ${
                  active ? 'text-ink font-semibold' : done ? 'text-ink' : 'text-muted'
                }`}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                  done ? 'bg-ink' : 'bg-line'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-1.5 border-b border-line/60 last:border-b-0">
      <span className="text-12 font-medium text-muted w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-13 text-ink font-medium">{value}</span>
    </div>
  )
}

function LiveJobPreview({
  step1,
  step2,
  studioName,
}: {
  step1: Step1Form
  step2: Step2Form
  studioName: string
}) {
  const primaryRole = step2.roles[0] || step1.title || 'Crew role'
  const dept = resolveDepartment(primaryRole)

  return (
    <div className="border border-line rounded-sm bg-surface p-5 space-y-4 shadow-subtle">
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <div className="flex items-center gap-1.5 text-12 font-semibold text-muted">
          <Eye size={14} />
          <span>Talent view preview</span>
        </div>
        <span className="text-11 font-medium text-muted">
          Live preview
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <DepartmentMark department={dept} label={primaryRole} size="sm" />
          <span className="text-11 px-2 py-0.5 rounded-sm border border-line bg-paper text-ink font-medium">
            {formatJobType(step1.job_type)}
          </span>
        </div>

        <h3 className="text-17 font-bold text-ink leading-snug">
          {step1.title || 'Job title preview'}
        </h3>

        <div className="flex items-center gap-1.5 text-13 text-ink">
          <Building2 size={14} className="text-muted shrink-0" />
          <span className="font-semibold">{studioName || 'Your Studio'}</span>
          <VerifiedBadge />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-12 text-muted pt-1">
          <span className="font-medium text-ink">
            {formatPayRange({
              pay_min: step1.pay_min,
              pay_max: step1.pay_max,
              pay_currency: step1.pay_currency,
              pay_period: step1.pay_period,
            })}
          </span>
          {step2.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-muted" /> {step2.location}
            </span>
          )}
          <span>{formatDeadlineDate(step1.deadline)}</span>
        </div>

        {/* Requirements Pills */}
        {(step2.roles.length > 0 || step2.skills.length > 0 || step2.languages.length > 0) && (
          <div className="pt-2 border-t border-line/60 space-y-1.5">
            <span className="text-11 font-semibold text-muted block">Required skills & details</span>
            <div className="flex flex-wrap gap-1.5">
              {step2.roles.map((r) => (
                <span key={r} className="px-2 py-0.5 rounded-sm bg-paper border border-line text-11 text-ink">
                  {r}
                </span>
              ))}
              {step2.skills.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-sm bg-paper border border-line text-11 text-ink">
                  {s}
                </span>
              ))}
              {step2.languages.map((l) => (
                <span key={l} className="px-2 py-0.5 rounded-sm bg-paper border border-line text-11 text-ink">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description snippet in Source Serif */}
        <div className="pt-2 border-t border-line/60">
          <span className="text-11 font-semibold text-muted block mb-1">About the role</span>
          <p className="font-serif text-13 leading-relaxed text-ink line-clamp-3">
            {step1.description || 'Provide a comprehensive overview of the role, expectations, and production timeline…'}
          </p>
        </div>

        {/* Sample LightMeter */}
        <div className="pt-2 border-t border-line/60 space-y-1">
          <div className="flex items-center justify-between text-11 text-muted">
            <span className="font-medium text-ink">Sample score</span>
            <span className="text-11 text-muted">Applicant view</span>
          </div>
          <LightMeter score={88} size="sm" showScoreLabel={true} expandable={false} />
        </div>
      </div>
    </div>
  )
}

export default function EditJob() {
  const { id } = useParams<{ id: string }>()
  usePageTitle('Edit Job')
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const accessToken = token ?? ''

  const [job, setJob] = useState<JobWithProduction | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(true)

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const [step1, setStep1] = useState<Step1Form>({
    title: '',
    description: '',
    job_type: 'freelance',
    pay_min: '',
    pay_max: '',
    pay_currency: 'INR',
    pay_period: 'project',
    start_date: '',
    end_date: '',
    openings: 1,
    deadline: '',
  })
  const [step1Errors, setS1Errors] = useState<Step1Errors>({})

  const [step2, setStep2] = useState<Step2Form>({
    skills: [],
    roles: [],
    experience_level: '',
    languages: [],
    location: '',
  })
  const [step2Errors, setS2Errors] = useState<Step2Errors>({})

  // Fetch job & populate
  useEffect(() => {
    if (!id || !accessToken) return
    let isMounted = true

    const loadJob = async () => {
      setInitialLoading(true)
      setFetchError(null)
      try {
        const res = await jobsApi.getById(id, accessToken)
        const jobData = res.job

        if (!isMounted) return
        setJob(jobData)

        // Check ownership
        if (user?.profileId && jobData.production_id !== user.profileId) {
          setIsOwner(false)
          setFetchError('You do not have permission to edit this job post.')
          return
        }

        let formattedDeadline = ''
        if (jobData.deadline) {
          try {
            const d = new Date(jobData.deadline)
            formattedDeadline = d.toISOString().slice(0, 16)
          } catch {
            formattedDeadline = ''
          }
        }

        setStep1({
          title: jobData.title || '',
          description: jobData.description || '',
          job_type: jobData.job_type || 'freelance',
          pay_min: jobData.pay_min !== null && jobData.pay_min !== undefined ? String(jobData.pay_min) : '',
          pay_max: jobData.pay_max !== null && jobData.pay_max !== undefined ? String(jobData.pay_max) : '',
          pay_currency: jobData.pay_currency || 'INR',
          pay_period: jobData.pay_period || 'project',
          start_date: jobData.start_date || '',
          end_date: jobData.end_date || '',
          openings: jobData.openings || 1,
          deadline: formattedDeadline,
        })

        if (jobData.job_requirements) {
          const reqs = jobData.job_requirements
          setStep2({
            skills: reqs.skills || [],
            roles: reqs.roles || [],
            experience_level: (reqs.experience_level as Step2Form['experience_level']) || '',
            languages: reqs.language ? reqs.language.split(',').map((s) => s.trim()).filter(Boolean) : [],
            location: reqs.location || '',
          })
        }
      } catch (err: unknown) {
        if (!isMounted) return
        setFetchError(err instanceof Error ? err.message : 'Job not found')
      } finally {
        if (isMounted) setInitialLoading(false)
      }
    }

    loadJob()
    return () => {
      isMounted = false
    }
  }, [id, accessToken, user?.profileId])

  const isPublished = job?.status === 'published'
  const isClosed = job?.status === 'closed'
  const descRemaining = 5000 - step1.description.length

  // Validation helper on blur
  const validateField = (field: keyof Step1Form) => {
    const errs: Step1Errors = { ...step1Errors }

    if (field === 'title' && !isPublished) {
      if (!step1.title.trim()) errs.title = 'Title is required'
      else if (step1.title.trim().length < 3) errs.title = 'Must be at least 3 characters'
      else delete errs.title
    }

    if (field === 'description') {
      if (!step1.description.trim()) errs.description = 'Description is required'
      else if (step1.description.trim().length < 10) errs.description = 'Must be at least 10 characters'
      else delete errs.description
    }

    if (field === 'pay_min' || field === 'pay_max') {
      const pMin = step1.pay_min ? parseFloat(step1.pay_min) : undefined
      const pMax = step1.pay_max ? parseFloat(step1.pay_max) : undefined
      if (pMin !== undefined && pMin < 0) errs.pay = 'Minimum pay cannot be negative'
      else if (pMax !== undefined && pMax < 0) errs.pay = 'Maximum pay cannot be negative'
      else if (pMin !== undefined && pMax !== undefined && pMin > pMax) {
        errs.pay = 'Minimum pay cannot exceed maximum pay'
      } else {
        delete errs.pay
      }
    }

    if (field === 'start_date' || field === 'end_date') {
      if (step1.start_date && step1.end_date && new Date(step1.start_date) > new Date(step1.end_date)) {
        errs.dates = 'Start date cannot be after end date'
      } else {
        delete errs.dates
      }
    }

    if (field === 'openings') {
      if (step1.openings < 1) errs.openings = 'At least 1 opening is required'
      else delete errs.openings
    }

    if (field === 'deadline') {
      if (step1.deadline && isNaN(new Date(step1.deadline).getTime())) {
        errs.deadline = 'Invalid deadline date'
      } else {
        delete errs.deadline
      }
    }

    setS1Errors(errs)
  }

  // Automatic draft saving helper
  const autoSaveDraft = useCallback(
    async (currentStep1: Step1Form, currentStep2: Step2Form) => {
      if (!id || !accessToken) return
      setDraftStatus('saving')

      const pMin = currentStep1.pay_min ? parseFloat(currentStep1.pay_min) : undefined
      const pMax = currentStep1.pay_max ? parseFloat(currentStep1.pay_max) : undefined

      const payload: Record<string, unknown> = {
        description: currentStep1.description.trim() || 'Job description',
        pay_min: !isNaN(pMin!) ? pMin : null,
        pay_max: !isNaN(pMax!) ? pMax : null,
        pay_currency: currentStep1.pay_currency || 'INR',
        pay_period: currentStep1.pay_period || 'project',
        start_date: currentStep1.start_date || null,
        end_date: currentStep1.end_date || null,
        openings: Number(currentStep1.openings) || 1,
        deadline: currentStep1.deadline ? new Date(currentStep1.deadline).toISOString() : null,
      }

      if (!isPublished) {
        payload.title = currentStep1.title.trim()
        payload.job_type = currentStep1.job_type
      }

      try {
        await jobsApi.update(id, payload, accessToken)

        if (
          currentStep2.skills.length > 0 ||
          currentStep2.roles.length > 0 ||
          currentStep2.languages.length > 0 ||
          currentStep2.location ||
          currentStep2.experience_level
        ) {
          const reqPayload: SetRequirementsPayload = {
            skills: currentStep2.skills,
            roles: currentStep2.roles,
            language: currentStep2.languages.join(', ').trim() || undefined,
            location: currentStep2.location.trim() || undefined,
            experience_level: (currentStep2.experience_level || undefined) as SetRequirementsPayload['experience_level'],
          }
          await jobsApi.setRequirements(id, reqPayload, accessToken)
        }

        setDraftStatus('saved')
      } catch {
        setDraftStatus('idle')
      }
    },
    [id, accessToken, isPublished]
  )

  const handleStep1 = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!id || !accessToken) return

    const err: Step1Errors = {}
    if (!step1.title.trim() && !isPublished) err.title = 'Title is required'
    else if (step1.title.length < 3 && !isPublished) err.title = 'Must be at least 3 characters'

    if (!step1.description.trim()) err.description = 'Description is required'
    else if (step1.description.length < 10) err.description = 'Must be at least 10 characters'

    const pMin = step1.pay_min ? parseFloat(step1.pay_min) : undefined
    const pMax = step1.pay_max ? parseFloat(step1.pay_max) : undefined
    if (pMin !== undefined && pMin < 0) err.pay = 'Minimum pay cannot be negative'
    if (pMax !== undefined && pMax < 0) err.pay = 'Maximum pay cannot be negative'
    if (pMin !== undefined && pMax !== undefined && pMin > pMax) {
      err.pay = 'Minimum pay cannot exceed maximum pay'
    }

    if (step1.start_date && step1.end_date && new Date(step1.start_date) > new Date(step1.end_date)) {
      err.dates = 'Start date cannot be after end date'
    }

    if (step1.openings < 1) {
      err.openings = 'At least 1 opening is required'
    }

    if (step1.deadline && isNaN(new Date(step1.deadline).getTime())) {
      err.deadline = 'Invalid deadline date'
    }

    if (Object.keys(err).length) {
      setS1Errors(err)
      return
    }

    setSaving(true)

    const payload: Record<string, unknown> = {
      description: step1.description.trim(),
      pay_min: !isNaN(pMin!) ? pMin : null,
      pay_max: !isNaN(pMax!) ? pMax : null,
      pay_currency: step1.pay_currency || 'INR',
      pay_period: step1.pay_period || 'project',
      start_date: step1.start_date || null,
      end_date: step1.end_date || null,
      openings: Number(step1.openings) || 1,
      deadline: step1.deadline ? new Date(step1.deadline).toISOString() : null,
    }

    if (!isPublished) {
      payload.title = step1.title.trim()
      payload.job_type = step1.job_type
    }

    try {
      const res = await jobsApi.update(id, payload, accessToken)
      setJob(res.job as unknown as JobWithProduction)
      setDraftStatus('saved')
      setStep(2)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to update job details')
    } finally {
      setSaving(false)
    }
  }

  const handleStep2 = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!id || !accessToken) return

    const err: Step2Errors = {}
    if (step2.skills.length > 20) err.skills = 'Maximum 20 skills allowed'
    if (step2.roles.length > 20) err.roles = 'Maximum 20 roles allowed'

    if (Object.keys(err).length) {
      setS2Errors(err)
      return
    }

    setSaving(true)
    try {
      const payload: SetRequirementsPayload = {
        skills: step2.skills,
        roles: step2.roles,
        language: step2.languages.join(', ').trim() || undefined,
        location: step2.location.trim() || undefined,
        experience_level: (step2.experience_level || undefined) as SetRequirementsPayload['experience_level'],
      }
      await jobsApi.setRequirements(id, payload, accessToken)
      setDraftStatus('saved')
      setStep(3)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to update requirements')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!id || !accessToken) return
    setSaving(true)
    setServerError(null)
    try {
      await jobsApi.publish(id, accessToken)
      toast.success('Job published')
      navigate('/home')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to publish job')
    } finally {
      setSaving(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-4">
        <div className="border border-line rounded-sm bg-surface p-8 space-y-4 animate-pulse">
          <div className="h-6 w-32 bg-paper rounded" />
          <div className="h-8 bg-paper rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (fetchError || !job || !isOwner) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="border border-line rounded-sm p-8 max-w-md w-full text-center space-y-4 bg-surface">
          <div className="w-12 h-12 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto">
            <AlertCircle size={22} />
          </div>
          <h2 className="text-18 font-bold text-ink">Access Denied</h2>
          <p className="text-14 text-muted">
            {fetchError || 'You do not have permission to edit this job post.'}
          </p>
          <div className="pt-2">
            <Link to="/home" className="btn-primary text-13">
              Return to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isClosed) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="border border-line rounded-sm p-8 max-w-md w-full text-center space-y-4 bg-surface">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle size={22} />
          </div>
          <h2 className="text-18 font-bold text-ink">Job Post Closed</h2>
          <p className="text-14 text-muted">
            This job posting has been closed and cannot be edited.
          </p>
          <div className="pt-2">
            <Link to="/home" className="btn-primary text-13">
              Return to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-line">
        <div>
          <Link
            to="/home"
            className="inline-flex items-center text-12 text-muted hover:text-ink transition-colors mb-2"
          >
            Back to dashboard
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-24 sm:text-28 font-bold text-ink tracking-tight leading-tight">
              Edit job post
            </h1>
            <span
              className={`text-11 px-2 py-0.5 rounded-sm border font-medium capitalize ${
                job.status === 'published'
                  ? 'bg-emerald-50 text-status-success border-emerald-200'
                  : 'bg-paper text-muted border-line'
              }`}
            >
              {job.status}
            </span>
          </div>
        </div>

        {/* Status / Link actions */}
        <div className="flex items-center gap-3">
          {draftStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-12 text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Saving...
            </span>
          )}
          {draftStatus === 'saved' && (
            <span className="flex items-center gap-1 text-12 text-status-success font-medium">
              <CheckCircle2 size={13} /> Draft saved just now
            </span>
          )}
          <Link
            to={`/jobs/${job.id}`}
            className="text-12 text-ink font-semibold hover:underline"
          >
            View public post
          </Link>
        </div>
      </div>

      {/* Informational banner for Published jobs (tested in EditJob.test.tsx) */}
      {isPublished && (
        <div className="p-4 bg-paper border border-line rounded-sm text-12 text-ink space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <Lock size={14} className="text-muted" />
            <span>Published job editing constraints</span>
          </div>
          <p className="text-muted leading-relaxed">
            Job title and contract type are locked to maintain applicant clarity. You can update description,
            pay, schedule dates, openings, and requirements. Updating requirements will automatically recompute
            match scores for candidates.
          </p>
        </div>
      )}

      {/* 2-Column Wizard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Stepper (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-line rounded-sm bg-surface p-6 sm:p-7 shadow-subtle">
            <StepIndicator current={step} onSelectStep={(n) => setStep(n)} />

            {/* Step 1: Job Details */}
            {step === 1 && (
              <form onSubmit={handleStep1} noValidate className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="title" className="text-12 font-semibold text-muted">
                      Job title <span className="text-status-error">*</span>
                    </label>
                    {isPublished && (
                      <span className="text-11 text-muted flex items-center gap-1">
                        <Lock size={12} /> Locked on published jobs
                      </span>
                    )}
                  </div>
                  <input
                    id="title"
                    value={step1.title}
                    disabled={isPublished}
                    onChange={(e) => {
                      setStep1((p) => ({ ...p, title: e.target.value }))
                      setS1Errors((p) => ({ ...p, title: undefined }))
                    }}
                    onBlur={() => {
                      validateField('title')
                      autoSaveDraft(step1, step2)
                    }}
                    placeholder="e.g. Lead Cinematographer"
                    className={`input text-14 w-full ${step1Errors.title ? 'border-status-error' : ''} ${
                      isPublished ? 'bg-paper text-muted cursor-not-allowed' : ''
                    }`}
                  />
                  {step1Errors.title && (
                    <p className="mt-1 text-12 text-status-error">{step1Errors.title}</p>
                  )}
                </div>

                {/* Job type & Openings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="job-type" className="text-12 font-semibold text-muted">
                        Job type
                      </label>
                      {isPublished && (
                        <span className="text-11 text-muted flex items-center gap-1">
                          <Lock size={12} /> Locked
                        </span>
                      )}
                    </div>
                    <select
                      id="job-type"
                      value={step1.job_type}
                      disabled={isPublished}
                      onChange={(e) => setStep1((p) => ({ ...p, job_type: e.target.value as JobType }))}
                      onBlur={() => autoSaveDraft(step1, step2)}
                      className={`select h-[38px] text-13 w-full border border-line rounded-[3px] bg-surface px-3 py-2 ${isPublished ? 'bg-paper text-muted cursor-not-allowed' : ''}`}
                    >
                      {JOB_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="openings" className="text-12 font-semibold text-muted block mb-1">
                      Openings
                    </label>
                    <input
                      id="openings"
                      type="number"
                      min={1}
                      value={step1.openings}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        setStep1((p) => ({ ...p, openings: isNaN(val) ? 1 : Math.max(1, val) }))
                        setS1Errors((p) => ({ ...p, openings: undefined }))
                      }}
                      onBlur={() => {
                        validateField('openings')
                        autoSaveDraft(step1, step2)
                      }}
                      className="input text-13 w-full"
                    />
                    {step1Errors.openings && (
                      <p className="mt-1 text-12 text-status-error">{step1Errors.openings}</p>
                    )}
                  </div>
                </div>

                {/* Pay fields */}
                <div>
                  <label className="text-12 font-semibold text-muted block mb-1">
                    Pay range <span className="font-normal">(optional)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={step1.pay_min}
                      onChange={(e) => {
                        setStep1((p) => ({ ...p, pay_min: e.target.value }))
                        setS1Errors((p) => ({ ...p, pay: undefined }))
                      }}
                      onBlur={() => {
                        validateField('pay_min')
                        autoSaveDraft(step1, step2)
                      }}
                      className="input text-13"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={step1.pay_max}
                      onChange={(e) => {
                        setStep1((p) => ({ ...p, pay_max: e.target.value }))
                        setS1Errors((p) => ({ ...p, pay: undefined }))
                      }}
                      onBlur={() => {
                        validateField('pay_max')
                        autoSaveDraft(step1, step2)
                      }}
                      className="input text-13"
                    />
                    <select
                      value={step1.pay_period}
                      onChange={(e) => setStep1((p) => ({ ...p, pay_period: e.target.value as PayPeriod }))}
                      onBlur={() => autoSaveDraft(step1, step2)}
                      className="select h-[38px] text-13 border border-line rounded-[3px] bg-surface px-3 py-2"
                    >
                      {PAY_PERIOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {step1Errors.pay && <p className="mt-1 text-12 text-status-error">{step1Errors.pay}</p>}
                </div>

                {/* Dates & Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="start-date" className="text-12 font-semibold text-muted block mb-1">
                      Start date
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={step1.start_date}
                      onChange={(e) => {
                        setStep1((p) => ({ ...p, start_date: e.target.value }))
                        setS1Errors((p) => ({ ...p, dates: undefined }))
                      }}
                      onBlur={() => {
                        validateField('start_date')
                        autoSaveDraft(step1, step2)
                      }}
                      className="input text-13 w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="text-12 font-semibold text-muted block mb-1">
                      End date
                    </label>
                    <input
                      id="end-date"
                      type="date"
                      value={step1.end_date}
                      onChange={(e) => {
                        setStep1((p) => ({ ...p, end_date: e.target.value }))
                        setS1Errors((p) => ({ ...p, dates: undefined }))
                      }}
                      onBlur={() => {
                        validateField('end_date')
                        autoSaveDraft(step1, step2)
                      }}
                      className="input text-13 w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="deadline" className="text-12 font-semibold text-muted block mb-1">
                      Application deadline
                    </label>
                    <input
                      id="deadline"
                      type="datetime-local"
                      value={step1.deadline}
                      onChange={(e) => {
                        setStep1((p) => ({ ...p, deadline: e.target.value }))
                        setS1Errors((p) => ({ ...p, deadline: undefined }))
                      }}
                      onBlur={() => {
                        validateField('deadline')
                        autoSaveDraft(step1, step2)
                      }}
                      className="input text-13 w-full"
                    />
                  </div>
                </div>
                {step1Errors.dates && <p className="mt-1 text-12 text-status-error">{step1Errors.dates}</p>}
                {step1Errors.deadline && <p className="mt-1 text-12 text-status-error">{step1Errors.deadline}</p>}

                {/* Description */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label htmlFor="description" className="text-12 font-semibold text-muted">
                      Description <span className="text-status-error">*</span>
                    </label>
                    <span className={`text-11 ${descRemaining < 200 ? 'text-status-warning' : 'text-muted'}`}>
                      {descRemaining} left
                    </span>
                  </div>
                  <textarea
                    id="description"
                    rows={6}
                    value={step1.description}
                    onChange={(e) => {
                      setStep1((p) => ({ ...p, description: e.target.value }))
                      setS1Errors((p) => ({ ...p, description: undefined }))
                    }}
                    onBlur={() => {
                      validateField('description')
                      autoSaveDraft(step1, step2)
                    }}
                    placeholder="Describe responsibilities, expectations, and production timeline…"
                    className={`input resize-none w-full font-serif text-14 leading-relaxed ${
                      step1Errors.description ? 'border-status-error' : ''
                    }`}
                  />
                  {step1Errors.description && (
                    <p className="mt-1 text-12 text-status-error">{step1Errors.description}</p>
                  )}
                </div>

                {serverError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-12 text-status-error rounded-sm">
                    {serverError}
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => {
                      autoSaveDraft(step1, step2)
                      navigate('/home')
                    }}
                    className="btn-ghost text-13"
                  >
                    Save draft and exit
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary text-13">
                    {saving ? 'Saving…' : 'Save details and continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Requirements */}
            {step === 2 && (
              <form onSubmit={handleStep2} noValidate className="space-y-4">
                <AutocompleteTagInput
                  label="Required roles"
                  placeholder="e.g. Director of Photography, Colorist, Editor…"
                  tags={step2.roles}
                  onChange={(t) => {
                    setStep2((p) => ({ ...p, roles: t }))
                    setS2Errors((p) => ({ ...p, roles: undefined }))
                    autoSaveDraft(step1, { ...step2, roles: t })
                  }}
                  type="roles"
                  error={step2Errors.roles}
                />

                <AutocompleteTagInput
                  label="Required skills"
                  placeholder="e.g. DaVinci Resolve, RED Camera, Sync Sound…"
                  tags={step2.skills}
                  onChange={(t) => {
                    setStep2((p) => ({ ...p, skills: t }))
                    setS2Errors((p) => ({ ...p, skills: undefined }))
                    autoSaveDraft(step1, { ...step2, skills: t })
                  }}
                  type="skills"
                  error={step2Errors.skills}
                />

                <div>
                  <label htmlFor="exp" className="text-12 font-semibold text-muted block mb-1">
                    Experience level
                  </label>
                  <select
                    id="exp"
                    value={step2.experience_level}
                    onChange={(e) => {
                      const val = e.target.value as Step2Form['experience_level']
                      setStep2((p) => ({ ...p, experience_level: val }))
                      autoSaveDraft(step1, { ...step2, experience_level: val })
                    }}
                    className="select h-[38px] text-13 w-full border border-line rounded-[3px] bg-surface px-3 py-2"
                  >
                    {EXP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div>
                    <AutocompleteTagInput
                      label="Language"
                      placeholder="e.g. Hindi, English, Tamil…"
                      tags={step2.languages}
                      onChange={(t) => {
                        setStep2((p) => ({ ...p, languages: t }))
                        autoSaveDraft(step1, { ...step2, languages: t })
                      }}
                      type="languages"
                      helpText=""
                    />
                  </div>
                  <div>
                    <AutocompleteInput
                      id="location"
                      label="Location / City"
                      value={step2.location}
                      onChange={(val) => {
                        setStep2((p) => ({ ...p, location: val }))
                        autoSaveDraft(step1, { ...step2, location: val })
                      }}
                      type="cities"
                      placeholder="e.g. Bangalore, Mumbai"
                    />
                  </div>
                </div>

                {serverError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-12 text-status-error rounded-sm">
                    {serverError}
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-line">
                  <button type="button" onClick={() => setStep(1)} className="btn-ghost text-13">
                    Back to details
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary text-13">
                    {saving ? 'Saving…' : 'Save requirements and review'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Review & Save / Publish */}
            {step === 3 && (
              <div className="space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-line">
                    <h2 className="text-13 font-bold text-ink">Job details</h2>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-12 text-ink font-semibold hover:underline"
                    >
                      Edit details
                    </button>
                  </div>
                  <div className="bg-paper rounded-sm p-4 space-y-1">
                    <ReviewRow label="Title" value={step1.title || 'Untitled post'} />
                    <ReviewRow label="Type" value={formatJobType(step1.job_type)} />
                    <ReviewRow label="Openings" value={pluralize(step1.openings, 'opening')} />
                    <ReviewRow
                      label="Pay"
                      value={formatPayRange({
                        pay_min: step1.pay_min,
                        pay_max: step1.pay_max,
                        pay_currency: step1.pay_currency,
                        pay_period: step1.pay_period,
                      })}
                    />
                    <ReviewRow
                      label="Dates"
                      value={formatDateRange(step1.start_date, step1.end_date)}
                    />
                    <ReviewRow
                      label="Deadline"
                      value={formatDeadlineDate(step1.deadline)}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-line">
                    <h2 className="text-13 font-bold text-ink">Requirements</h2>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-12 text-ink font-semibold hover:underline"
                    >
                      Edit requirements
                    </button>
                  </div>
                  <div className="bg-paper rounded-sm p-4 space-y-1">
                    <ReviewRow label="Roles" value={step2.roles.length ? step2.roles.join(', ') : 'None specified'} />
                    <ReviewRow label="Skills" value={step2.skills.length ? step2.skills.join(', ') : 'None specified'} />
                    <ReviewRow label="Experience" value={formatExperienceLevel(step2.experience_level)} />
                    <ReviewRow label="Language" value={step2.languages.length ? step2.languages.join(', ') : 'Any language'} />
                    <ReviewRow label="Location" value={step2.location || 'Flexible'} />
                  </div>
                </section>

                {serverError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-12 text-status-error rounded-sm">
                    {serverError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-line">
                  <button type="button" onClick={() => setStep(2)} className="btn-ghost w-full sm:w-auto text-13">
                    Back to requirements
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {!isPublished ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            autoSaveDraft(step1, step2)
                            navigate('/home')
                          }}
                          className="btn-ghost text-13 w-full sm:w-auto"
                        >
                          Keep draft & exit
                        </button>
                        <button
                          type="button"
                          onClick={handlePublish}
                          disabled={saving}
                          className="btn-primary text-13 w-full sm:w-auto"
                        >
                          {saving ? 'Publishing…' : 'Publish job'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          toast.success('Job changes saved')
                          navigate(`/jobs/${job.id}`)
                        }}
                        className="btn-primary text-13 w-full sm:w-auto"
                      >
                        Finished editing (View post)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Preview Panel (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-20">
          <LiveJobPreview
            step1={step1}
            step2={step2}
            studioName={job.production_profiles?.company_name || user?.company_name || localStorage.getItem('cc_company_name') || 'Your Studio'}
          />
        </div>
      </div>
    </div>
  )
}
