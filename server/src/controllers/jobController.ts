import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { createJob, setRequirements, publishJob, listJobs, getApplicationsForJob, closeJob } from '../services/jobService'
import { JobStatus } from '../types'
import { sanitizeObject } from '../utils/sanitize'

// ── Helpers ───────────────────────────────────────────────────

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}

function isUuid(val: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

function jobId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
}

// ── Schemas ───────────────────────────────────────────────────

const createJobSchema = z.object({
  production_id: z.string().uuid('production_id must be a valid UUID'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(160),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
})

const requirementsSchema = z.object({
  skills: z.array(z.string().min(1)).max(20).optional(),
  roles: z.array(z.string().min(1)).max(20).optional(),
  experience_level: z
    .enum(['entry', 'mid', 'senior', 'any'] as const, "experience_level must be 'entry', 'mid', 'senior', or 'any'")
    .optional(),
  language: z.string().max(60).optional(),
  location: z.string().max(120).optional(),
})

// ── Handlers ─────────────────────────────────────────────────

/**
 * POST /jobs
 * Body: { production_id, title, description }
 */
export const createJobHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createJobSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) })
      return
    }
    const job = await createJob(sanitizeObject(parsed.data))
    res.status(201).json({ job })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /jobs/:id/requirements
 * Body: { skills?, roles?, experience_level?, language?, location? }
 */
export const setRequirementsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = jobId(req)
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Invalid job id' })
      return
    }

    const parsed = requirementsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) })
      return
    }

    const requirements = await setRequirements({ job_id: id, ...parsed.data })
    res.status(200).json({ requirements })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /jobs/:id/publish
 */
export const publishJobHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = jobId(req)
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Invalid job id' })
      return
    }
    const job = await publishJob(id)
    res.status(200).json({ job })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /jobs?production_id=&status=
 */
export const listJobsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const production_id = req.query.production_id as string | undefined
    const status = req.query.status as JobStatus | undefined

    if (production_id && !isUuid(production_id)) {
      res.status(400).json({ error: 'Invalid production_id' })
      return
    }

    const validStatuses: JobStatus[] = ['draft', 'published', 'closed']
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: "status must be 'draft', 'published', or 'closed'" })
      return
    }

    const jobs = await listJobs({ production_id, status })
    res.status(200).json({ jobs })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /jobs/:id/applications
 * Returns all applications sorted by match_score desc.
 */
export const getApplicationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = jobId(req)
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Invalid job id' })
      return
    }
    const applications = await getApplicationsForJob(id)
    res.status(200).json({ applications })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /jobs/:id/close
 */
export const closeJobHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = jobId(req)
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Invalid job id' })
      return
    }
    const job = await closeJob(id)
    res.status(200).json({ job })
  } catch (err) {
    next(err)
  }
}
