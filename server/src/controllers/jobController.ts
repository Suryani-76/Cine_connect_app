import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  createJob, setRequirements, publishJob, listJobs,
  getApplicationsForJob, closeJob, getJobById,
  getJobAnalytics, recordJobView, rankTalentForJob,
  updateJob, deleteJob,
} from '../services/jobService'
import { JobStatus } from '../types'
import { sanitizeObject } from '../utils/sanitize'

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}
function isUuid(val: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}
function jid(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
}

// ── Schemas ───────────────────────────────────────────────────

// production_id removed — derived from caller
const createJobSchema = z.object({
  title:        z.string().min(3, 'Title must be at least 3 characters').max(160),
  description:  z.string().min(10, 'Description must be at least 10 characters').max(5000),
  job_type:     z.enum(['freelance', 'contract', 'full_time', 'part_time']).optional(),
  pay_min:      z.number().nonnegative('pay_min must be >= 0').nullable().optional(),
  pay_max:      z.number().nonnegative('pay_max must be >= 0').nullable().optional(),
  pay_currency: z.string().max(10).optional(),
  pay_period:   z.enum(['hour', 'day', 'week', 'month', 'project']).optional(),
  start_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start_date format (YYYY-MM-DD)').nullable().optional(),
  end_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end_date format (YYYY-MM-DD)').nullable().optional(),
  openings:     z.number().int().min(1, 'Openings must be at least 1').optional(),
  deadline:     z.string().nullable().optional(),
}).refine(data => {
  if (data.pay_min != null && data.pay_max != null) {
    return data.pay_min <= data.pay_max
  }
  return true
}, {
  message: 'pay_min cannot exceed pay_max',
  path: ['pay_min'],
}).refine(data => {
  if (data.start_date && data.end_date) {
    return new Date(data.start_date) <= new Date(data.end_date)
  }
  return true
}, {
  message: 'start_date cannot be after end_date',
  path: ['start_date'],
})

const updateJobSchema = z.object({
  title:        z.string().min(3, 'Title must be at least 3 characters').max(160).optional(),
  description:  z.string().min(10, 'Description must be at least 10 characters').max(5000).optional(),
  job_type:     z.enum(['freelance', 'contract', 'full_time', 'part_time']).optional(),
  pay_min:      z.number().nonnegative('pay_min must be >= 0').nullable().optional(),
  pay_max:      z.number().nonnegative('pay_max must be >= 0').nullable().optional(),
  pay_currency: z.string().max(10).optional(),
  pay_period:   z.enum(['hour', 'day', 'week', 'month', 'project']).optional(),
  start_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start_date format (YYYY-MM-DD)').nullable().optional(),
  end_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end_date format (YYYY-MM-DD)').nullable().optional(),
  openings:     z.number().int().min(1, 'Openings must be at least 1').optional(),
  deadline:     z.string().nullable().optional(),
}).refine(data => {
  if (data.pay_min != null && data.pay_max != null) {
    return data.pay_min <= data.pay_max
  }
  return true
}, {
  message: 'pay_min cannot exceed pay_max',
  path: ['pay_min'],
}).refine(data => {
  if (data.start_date && data.end_date) {
    return new Date(data.start_date) <= new Date(data.end_date)
  }
  return true
}, {
  message: 'start_date cannot be after end_date',
  path: ['start_date'],
})

const requirementsSchema = z.object({
  skills:           z.array(z.string().min(1)).max(20).optional(),
  roles:            z.array(z.string().min(1)).max(20).optional(),
  experience_level: z.enum(['entry','mid','senior','any'] as const,
    "experience_level must be 'entry', 'mid', 'senior', or 'any'").optional(),
  language: z.string().max(60).optional(),
  location: z.string().max(120).optional(),
})

// ── GET /jobs — public; non-owners only see published ─────────

export const listJobsHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const production_id = req.query.production_id as string | undefined
    const status        = req.query.status        as JobStatus | undefined

    if (production_id && !isUuid(production_id)) {
      res.status(400).json({ error: 'Invalid production_id' }); return
    }
    const validStatuses: JobStatus[] = ['draft', 'published', 'closed']
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: "status must be 'draft', 'published', or 'closed'" }); return
    }

    // Non-owners may only browse published jobs
    const caller = req.caller
    const isOwner = caller?.productionProfileId &&
                    production_id &&
                    caller.productionProfileId === production_id

    const effectiveStatus: JobStatus | undefined =
      isOwner ? status : (status === 'published' || !status ? 'published' : undefined)

    if (!isOwner && status && status !== 'published') {
      res.status(403).json({ error: 'Only published jobs are visible to non-owners' }); return
    }

    const jobs = await listJobs({ production_id, status: effectiveStatus })
    res.status(200).json({ jobs })
  } catch (err) { next(err) }
}

// ── POST /jobs — production owner; production_id from caller ─

export const createJobHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (!caller.productionProfileId) {
      res.status(403).json({ error: 'Production account required' }); return
    }

    const parsed = createJobSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return }

    const job = await createJob(sanitizeObject({
      production_id: caller.productionProfileId, // from JWT — never body
      ...parsed.data,
    }))
    res.status(201).json({ job })
  } catch (err) { next(err) }
}

// ── GET /jobs/:id — public; only published to non-owners ─────

export const getJobByIdHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }
    const job = await getJobById(id)

    // Non-owners may only see published jobs
    const caller = req.caller
    const isOwner = caller?.productionProfileId &&
                    (job as unknown as { production_id: string }).production_id === caller.productionProfileId
    if (!isOwner && (job as unknown as { status: string }).status !== 'published') {
      res.status(404).json({ error: 'Job not found' }); return
    }

    res.status(200).json({ job })
  } catch (err) { next(err) }
}

// ── PUT /jobs/:id/requirements — ownership via requireJobOwner

export const setRequirementsHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }

    const parsed = requirementsSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return }

    const requirements = await setRequirements({ job_id: id, ...parsed.data })
    res.status(200).json({ requirements })
  } catch (err) { next(err) }
}

// ── PUT /jobs/:id — ownership via requireJobOwner ─────────────

export const updateJobHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }

    const parsed = updateJobSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return }

    const job = await updateJob(id, sanitizeObject(parsed.data))
    res.status(200).json({ job })
  } catch (err) { next(err) }
}

// ── DELETE /jobs/:id — ownership via requireJobOwner ──────────

export const deleteJobHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }

    await deleteJob(id)
    res.status(200).json({ message: 'Job deleted successfully' })
  } catch (err) { next(err) }
}

// ── POST /jobs/:id/publish — ownership via requireJobOwner ────

export const publishJobHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }
    const job = await publishJob(id)
    res.status(200).json({ job })
  } catch (err) { next(err) }
}

// ── POST /jobs/:id/close — ownership via requireJobOwner ──────

export const closeJobHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }
    const job = await closeJob(id)
    res.status(200).json({ job })
  } catch (err) { next(err) }
}

// ── GET /jobs/:id/applications — ownership via requireJobOwner

export const getApplicationsHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }
    const applications = await getApplicationsForJob(id)
    res.status(200).json({ applications })
  } catch (err) { next(err) }
}

// ── GET /jobs/:id/analytics — ownership via requireJobOwner ──

export const getAnalyticsHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }
    const analytics = await getJobAnalytics(id)
    res.status(200).json({ analytics })
  } catch (err) { next(err) }
}

// ── POST /jobs/:id/view — authenticated only; skip owner's own views

export const recordViewHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }

    // Only record views for authenticated users (Step 0.3)
    const caller = req.caller
    if (!caller) {
      res.status(200).json({ ok: true }); return  // anonymous — no-op
    }

    // Don't count the job owner's own views
    if (caller.productionProfileId) {
      const { data: job } = await import('../db/supabase').then(m =>
        m.supabase.from('jobs').select('production_id').eq('id', id).single()
      )
      if (job && (job as { production_id: string }).production_id === caller.productionProfileId) {
        res.status(200).json({ ok: true }); return
      }
    }

    await recordJobView(id, caller.userId)
    res.status(200).json({ ok: true })
  } catch (err) { next(err) }
}

// ── GET /jobs/:id/talent-matches — ownership via requireJobOwner

export const talentMatchesHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = jid(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid job id' }); return }
    const talent = await rankTalentForJob(id)
    res.status(200).json({ talent })
  } catch (err) { next(err) }
}
