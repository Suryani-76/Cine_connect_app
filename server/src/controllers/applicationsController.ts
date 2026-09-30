import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  createApplication,
  updateApplicationStatus,
  getMatchBreakdown,
} from '../services/applicationService'
import { APPLICATION_STATUSES } from '../types'
import { sanitizeObject } from '../utils/sanitize'

// ── Helpers ───────────────────────────────────────────────────

function appId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

// ── Schemas ───────────────────────────────────────────────────

const createApplicationSchema = z.object({
  job_id:            z.string().uuid('job_id must be a valid UUID'),
  talent_profile_id: z.string().uuid('talent_profile_id must be a valid UUID'),
  cover_note:        z.string().max(1000).optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES as [string, ...string[]], {
    error: `status must be one of: ${APPLICATION_STATUSES.join(', ')}`,
  }),
})

// ── Handlers ─────────────────────────────────────────────────

/**
 * POST /applications
 * Body: { job_id, talent_profile_id, cover_note? }
 */
export const createApplicationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createApplicationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Validation error' })
      return
    }
    const application = await createApplication(sanitizeObject(parsed.data))
    res.status(201).json({ application })
  } catch (err) {
    next(err)
  }
}

// ── Handlers ─────────────────────────────────────────────────

/**
 * PUT /applications/:id/status
 * Body: { status }
 */
export const updateStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = appId(req)
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Invalid application id' })
      return
    }

    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Validation error'
      res.status(400).json({ error: msg })
      return
    }

    const application = await updateApplicationStatus(
      id,
      parsed.data.status as import('../types').ApplicationStatus
    )
    res.status(200).json({ application })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /applications/:id/match-breakdown
 */
export const matchBreakdownHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = appId(req)
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Invalid application id' })
      return
    }

    const breakdown = await getMatchBreakdown(id)
    res.status(200).json(breakdown)
  } catch (err) {
    next(err)
  }
}
