import { useState, useEffect, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Check, Lock, AlertTriangle, AlertCircle,
  Loader2, Send, Sparkles
} from 'lucide-react'
import { jobsApi, SetRequirementsPayload, JobType, PayPeriod, JobWithProduction } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { AutocompleteInput } from '../components/AutocompleteInput'
import { AutocompleteTagInput } from '../components/AutocompleteTagInput'

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
  language: string
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
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'any', label: 'Any' },
]

const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: 'freelance', label: 'Freelance' },
  { value: 'contract', label: 'Contract' },
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
]

const PAY_PERIOD_OPTIONS: { value: PayPeriod; label: string }[] = [
  { value: 'project', label: 'Per Project' },
  { value: 'hour', label: 'Per Hour' },
  { value: 'day', label: 'Per Day' },
  { value: 'week', label: 'Per Week' },
  { value: 'month', label: 'Per Month' },
]

function StepIndicator({
  current,
  onSelectStep,
}: {
  current: number
  onSelectStep: (step: number) => void
}) {
  const steps = ['Job details', 'Requirements', 'Review & save']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => onSelectStep(n)}
              className="flex items-center gap-2 shrink-0 group text-left"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done
                    ? 'bg-brand border-brand text-white'
                    : active
                    ? 'border-brand text-brand bg-blue-50'
                    : 'border-surface-border text-content-muted bg-white group-hover:border-slate-400'
                }`}
              >
                {done ? <Check size={14} /> : n}
              </div>
              <span
                className={`text-sm hidden sm:block font-medium ${
                  active ? 'text-content-heading' : done ? 'text-content-secondary' : 'text-content-muted'
                }`}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                  done ? 'bg-brand' : 'bg-surface-border'
                }`}
              />
            )}
          </div>
        )
      })}
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
    language: '',
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

        // Format deadline if present
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
            language: reqs.language || '',
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

  const handleStep1 = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)

    if (!id || !accessToken) return
    const err: Step1Errors = {}

    if (!step1.title.trim()) err.title = 'Title is required'
    else if (step1.title.length < 3) err.title = 'Must be at least 3 characters'

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
      pay_min: pMin ?? null,
      pay_max: pMax ?? null,
      pay_currency: step1.pay_currency || 'INR',
      pay_period: step1.pay_period || 'project',
      start_date: step1.start_date || null,
      end_date: step1.end_date || null,
      openings: Number(step1.openings) || 1,
      deadline: step1.deadline ? new Date(step1.deadline).toISOString() : null,
    }

    // Only allow updating title and job_type if NOT published
    if (!isPublished) {
      payload.title = step1.title.trim()
      payload.job_type = step1.job_type
    }

    try {
      const res = await jobsApi.update(id, payload, accessToken)
      setJob(prev => prev ? { ...prev, ...res.job } : null)
      setStep(2)
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to update job details')
    } finally {
      setSaving(false)
    }
  }

  const handleStep2 = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)

    if (!id || !accessToken) return
    const err: Step2Errors = {}
    if (step2.skills.length > 20) err.skills = 'Maximum 20 skills'
    if (step2.roles.length > 20) err.roles = 'Maximum 20 roles'
    if (Object.keys(err).length) {
      setS2Errors(err)
      return
    }

    setSaving(true)
    try {
      const payload: SetRequirementsPayload = {
        skills: step2.skills,
        roles: step2.roles,
        language: step2.language.trim() || undefined,
        location: step2.location.trim() || undefined,
        experience_level: (step2.experience_level || undefined) as SetRequirementsPayload['experience_level'],
      }
      await jobsApi.setRequirements(id, payload, accessToken)
      setStep(3)
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to update requirements')
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
      navigate(`/jobs/${id}`)
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to publish job')
    } finally {
      setSaving(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-surface-section px-4 py-10">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="card p-8 space-y-6 animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-1/2" />
            <div className="space-y-4 pt-4">
              <div className="h-10 bg-slate-100 rounded" />
              <div className="h-28 bg-slate-100 rounded" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (fetchError || !job || !isOwner) {
    return (
      <div className="min-h-screen bg-surface-section px-4 py-16 flex items-center justify-center">
        <div className="card max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold text-content-heading">Access Denied</h2>
          <p className="text-sm text-content-secondary">
            {fetchError || 'You do not have access to edit this job posting.'}
          </p>
          <div className="pt-2">
            <Link to="/home" className="btn-primary inline-flex items-center gap-2">
              <ArrowLeft size={16} /> Return to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isClosed) {
    return (
      <div className="min-h-screen bg-surface-section px-4 py-16 flex items-center justify-center">
        <div className="card max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-bold text-content-heading">Job Post Closed</h2>
          <p className="text-sm text-content-secondary">
            This job posting has been closed and cannot be edited.
          </p>
          <div className="pt-2">
            <Link to="/home" className="btn-primary inline-flex items-center gap-2">
              <ArrowLeft size={16} /> Return to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-section px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 text-sm text-content-secondary hover:text-brand transition-colors mb-4"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-content-heading">Edit Job Post</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    isPublished
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isPublished ? 'Published' : 'Draft'}
                </span>
              </div>
              <p className="text-sm text-content-tertiary mt-1">
                {isPublished
                  ? 'Update compensation, schedule, and talent requirements.'
                  : 'Update job details and requirements before publishing.'}
              </p>
            </div>

            <Link
              to={`/jobs/${job.id}`}
              className="text-xs text-brand hover:underline font-semibold self-start sm:self-auto"
            >
              View public post →
            </Link>
          </div>
        </div>

        {/* Informational banner for Published jobs */}
        {isPublished && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <Lock size={14} className="text-blue-700" />
              <span>Published job editing constraints</span>
            </div>
            <p className="text-blue-700 leading-relaxed">
              Job title and contract type are locked to maintain applicant clarity. You can update description,
              pay, schedule dates, openings, and requirements. Updating requirements will automatically recompute
              match scores for candidates.
            </p>
          </div>
        )}

        <div className="card p-8">
          <StepIndicator current={step} onSelectStep={n => setStep(n)} />

          {/* Step 1: Job Details */}
          {step === 1 && (
            <form onSubmit={handleStep1} noValidate className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="title" className="label mb-0">
                    Job title <span className="text-red-500">*</span>
                  </label>
                  {isPublished && (
                    <span className="text-xs text-content-muted flex items-center gap-1">
                      <Lock size={12} /> Locked on published jobs
                    </span>
                  )}
                </div>
                <input
                  id="title"
                  value={step1.title}
                  disabled={isPublished}
                  onChange={e => {
                    setStep1(p => ({ ...p, title: e.target.value }))
                    setS1Errors(p => ({ ...p, title: undefined }))
                  }}
                  placeholder="e.g. Lead Cinematographer"
                  className={`${step1Errors.title ? 'input-error' : 'input'} ${
                    isPublished ? 'bg-slate-100 cursor-not-allowed opacity-80' : ''
                  }`}
                />
                {step1Errors.title && <p className="mt-1.5 text-xs text-red-500">{step1Errors.title}</p>}
              </div>

              {/* Job type & Openings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="job-type" className="label mb-0">
                      Job type
                    </label>
                    {isPublished && (
                      <span className="text-xs text-content-muted flex items-center gap-1">
                        <Lock size={12} /> Locked
                      </span>
                    )}
                  </div>
                  <select
                    id="job-type"
                    value={step1.job_type}
                    disabled={isPublished}
                    onChange={e => setStep1(p => ({ ...p, job_type: e.target.value as JobType }))}
                    className={`input ${isPublished ? 'bg-slate-100 cursor-not-allowed opacity-80' : ''}`}
                  >
                    {JOB_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="openings" className="label">
                    Openings
                  </label>
                  <input
                    id="openings"
                    type="number"
                    min={1}
                    value={step1.openings}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10)
                      setStep1(p => ({ ...p, openings: isNaN(val) ? 1 : Math.max(1, val) }))
                      setS1Errors(p => ({ ...p, openings: undefined }))
                    }}
                    className={step1Errors.openings ? 'input-error' : 'input'}
                  />
                  {step1Errors.openings && <p className="mt-1.5 text-xs text-red-500">{step1Errors.openings}</p>}
                </div>
              </div>

              {/* Pay fields */}
              <div>
                <label className="label">Compensation (optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    id="pay-min"
                    type="number"
                    placeholder="Min (₹)"
                    value={step1.pay_min}
                    onChange={e => {
                      setStep1(p => ({ ...p, pay_min: e.target.value }))
                      setS1Errors(p => ({ ...p, pay: undefined }))
                    }}
                    className="input text-sm"
                  />
                  <input
                    id="pay-max"
                    type="number"
                    placeholder="Max (₹)"
                    value={step1.pay_max}
                    onChange={e => {
                      setStep1(p => ({ ...p, pay_max: e.target.value }))
                      setS1Errors(p => ({ ...p, pay: undefined }))
                    }}
                    className="input text-sm"
                  />
                  <select
                    id="pay-currency"
                    value={step1.pay_currency}
                    onChange={e => setStep1(p => ({ ...p, pay_currency: e.target.value }))}
                    className="input text-sm"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                  <select
                    id="pay-period"
                    value={step1.pay_period}
                    onChange={e => setStep1(p => ({ ...p, pay_period: e.target.value as PayPeriod }))}
                    className="input text-sm"
                  >
                    {PAY_PERIOD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {step1Errors.pay && <p className="mt-1.5 text-xs text-red-500">{step1Errors.pay}</p>}
              </div>

              {/* Dates & Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="start-date" className="label">
                    Start date
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={step1.start_date}
                    onChange={e => {
                      setStep1(p => ({ ...p, start_date: e.target.value }))
                      setS1Errors(p => ({ ...p, dates: undefined }))
                    }}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="label">
                    End date
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={step1.end_date}
                    onChange={e => {
                      setStep1(p => ({ ...p, end_date: e.target.value }))
                      setS1Errors(p => ({ ...p, dates: undefined }))
                    }}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="deadline" className="label">
                    Apply deadline
                  </label>
                  <input
                    id="deadline"
                    type="datetime-local"
                    value={step1.deadline}
                    onChange={e => {
                      setStep1(p => ({ ...p, deadline: e.target.value }))
                      setS1Errors(p => ({ ...p, deadline: undefined }))
                    }}
                    className="input text-sm"
                  />
                </div>
              </div>
              {step1Errors.dates && <p className="mt-1 text-xs text-red-500">{step1Errors.dates}</p>}
              {step1Errors.deadline && <p className="mt-1 text-xs text-red-500">{step1Errors.deadline}</p>}

              {/* Description */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label htmlFor="description" className="label mb-0">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${descRemaining < 200 ? 'text-amber-600' : 'text-content-muted'}`}>
                    {descRemaining} left
                  </span>
                </div>
                <textarea
                  id="description"
                  rows={6}
                  value={step1.description}
                  onChange={e => {
                    setStep1(p => ({ ...p, description: e.target.value }))
                    setS1Errors(p => ({ ...p, description: undefined }))
                  }}
                  placeholder="Describe the role, responsibilities, shoot schedule, requirements…"
                  className={`${step1Errors.description ? 'input-error' : 'input'} resize-none`}
                />
                {step1Errors.description && <p className="mt-1.5 text-xs text-red-500">{step1Errors.description}</p>}
              </div>

              {serverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {serverError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-ghost text-xs text-content-secondary"
                >
                  Skip to requirements →
                </button>
                <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save Details & Continue →'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Requirements */}
          {step === 2 && (
            <form onSubmit={handleStep2} noValidate className="space-y-5">
              <div className="p-3.5 bg-brand/5 border border-brand/20 rounded-xl flex items-start gap-2.5 text-xs text-content-secondary">
                <Sparkles size={16} className="text-brand shrink-0 mt-0.5" />
                <span>
                  Changes to required skills, roles, or experience level will automatically trigger an
                  applicant score recomputation across all registered candidates.
                </span>
              </div>

              <AutocompleteTagInput
                label="Skills"
                placeholder="e.g. Cinematography, Lighting, RED Camera…"
                tags={step2.skills}
                onChange={t => {
                  setStep2(p => ({ ...p, skills: t }))
                  setS2Errors(p => ({ ...p, skills: undefined }))
                }}
                type="skills"
                error={step2Errors.skills}
              />

              <AutocompleteTagInput
                label="Roles"
                placeholder="e.g. Director of Photography, Gaffer…"
                tags={step2.roles}
                onChange={t => {
                  setStep2(p => ({ ...p, roles: t }))
                  setS2Errors(p => ({ ...p, roles: undefined }))
                }}
                type="roles"
                error={step2Errors.roles}
              />

              <div>
                <label htmlFor="exp" className="label">
                  Experience level
                </label>
                <select
                  id="exp"
                  value={step2.experience_level}
                  onChange={e =>
                    setStep2(p => ({
                      ...p,
                      experience_level: e.target.value as Step2Form['experience_level'],
                    }))
                  }
                  className="input"
                >
                  {EXP_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="language" className="label">
                    Language
                  </label>
                  <input
                    id="language"
                    value={step2.language}
                    onChange={e => setStep2(p => ({ ...p, language: e.target.value }))}
                    placeholder="e.g. English, Hindi"
                    className="input"
                  />
                </div>
                <div>
                  <AutocompleteInput
                    id="location"
                    label="Location"
                    value={step2.location}
                    onChange={val => setStep2(p => ({ ...p, location: val }))}
                    type="cities"
                    placeholder="e.g. Mumbai, Remote"
                  />
                </div>
              </div>

              {serverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {serverError}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost">
                  ← Back to details
                </button>
                <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save Requirements & Review →'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Review & Save / Publish */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Details review */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-content-tertiary uppercase tracking-wider">
                    Job details
                  </h2>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs text-brand font-semibold hover:text-brand-dark transition-colors"
                  >
                    Edit details
                  </button>
                </div>
                <div className="bg-surface-section rounded-xl border border-surface-border p-4 space-y-3">
                  <div>
                    <p className="text-xs text-content-tertiary mb-0.5">Title</p>
                    <p className="font-semibold text-content-heading">{step1.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-content-tertiary">Type: </span>
                      <span className="font-medium capitalize">{step1.job_type.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-xs text-content-tertiary">Openings: </span>
                      <span className="font-medium">{step1.openings}</span>
                    </div>
                  </div>
                  {(step1.pay_min || step1.pay_max) && (
                    <div>
                      <p className="text-xs text-content-tertiary mb-0.5">Pay</p>
                      <p className="text-sm font-medium text-content-primary">
                        {step1.pay_currency} {step1.pay_min || '0'} {step1.pay_max ? `– ${step1.pay_max}` : ''} /{' '}
                        {step1.pay_period}
                      </p>
                    </div>
                  )}
                  {(step1.start_date || step1.end_date) && (
                    <div>
                      <p className="text-xs text-content-tertiary mb-0.5">Dates</p>
                      <p className="text-sm text-content-primary">
                        {step1.start_date || 'Immediate'}
                        {step1.end_date ? ` to ${step1.end_date}` : ''}
                      </p>
                    </div>
                  )}
                  {step1.deadline && (
                    <div>
                      <p className="text-xs text-content-tertiary mb-0.5">Deadline</p>
                      <p className="text-sm text-content-primary">
                        {new Date(step1.deadline).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-content-tertiary mb-0.5">Description</p>
                    <p className="text-sm text-content-secondary line-clamp-3">{step1.description}</p>
                  </div>
                </div>
              </section>

              {/* Requirements review */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-content-tertiary uppercase tracking-wider">
                    Requirements
                  </h2>
                  <button
                    onClick={() => setStep(2)}
                    className="text-xs text-brand font-semibold hover:text-brand-dark transition-colors"
                  >
                    Edit requirements
                  </button>
                </div>
                <div className="bg-surface-section rounded-xl border border-surface-border p-4 space-y-3">
                  {step2.skills.length > 0 && (
                    <div>
                      <p className="text-xs text-content-tertiary mb-1.5">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {step2.skills.map((s, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-blue-50 text-brand text-xs rounded-md font-medium border border-brand/20"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {step2.roles.length > 0 && (
                    <div>
                      <p className="text-xs text-content-tertiary mb-1.5">Roles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {step2.roles.map((r, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-slate-100 text-content-primary text-xs rounded-md font-medium"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {step2.experience_level && (
                      <div>
                        <span className="text-xs text-content-tertiary">Experience: </span>
                        <span className="font-medium capitalize">{step2.experience_level}</span>
                      </div>
                    )}
                    {step2.language && (
                      <div>
                        <span className="text-xs text-content-tertiary">Language: </span>
                        <span className="font-medium">{step2.language}</span>
                      </div>
                    )}
                    {step2.location && (
                      <div className="col-span-2">
                        <span className="text-xs text-content-tertiary">Location: </span>
                        <span className="font-medium">{step2.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {serverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {serverError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-surface-border">
                <button type="button" onClick={() => setStep(2)} className="btn-ghost w-full sm:w-auto">
                  ← Back to requirements
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {!isPublished ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate('/home')}
                        className="btn-ghost text-xs w-full sm:w-auto"
                      >
                        Keep Draft & Exit
                      </button>
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={saving}
                        className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        {saving ? (
                          <>
                            <Loader2 size={15} className="animate-spin" /> Publishing…
                          </>
                        ) : (
                          <>
                            <Send size={15} /> Publish Now
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <Link
                      to={`/jobs/${job.id}`}
                      className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Check size={15} /> Finished Editing (View Post)
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
