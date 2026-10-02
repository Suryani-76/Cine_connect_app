import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  createApplication,
  updateApplicationStatus,
  getMatchBreakdown,
  getMyApplications,
} from '../services/applicationService'
import { APPLICATION_STATUSES, ApplicationStatus } from '../types'
import { sanitizeObject } from '../utils/sanitize'
import { supabase } from '../db/supabase'

// ── Helpers ───────────────────────────────────────────────────

function appId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

// Allowed status transitions
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied:     ['shortlisted', 'rejected'],
  shortlisted: ['interview',   'rejected'],
  interview:   ['hired',       'rejected'],
  hired:       [],
  rejected:    [],
}

// ── Schemas ───────────────────────────────────────────────────

const createApplicationSchema = z.object({
  job_id:     z.string().uuid('job_id must be a valid UUID'),
  cover_note: z.string().max(1000).optional(),
  // talent_profile_id intentionally NOT in schema — derived from caller
})

const updateStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES as [string, ...string[]], {
    error: `status must be one of: ${APPLICATION_STATUSES.join(', ')}`,
  }),
})

// ── POST /applications — talent only; identity from caller ────

export const createApplicationHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent' || !caller.talentProfileId) {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const parsed = createApplicationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Validation error' })
      return
    }

    const application = await createApplication(sanitizeObject({
      job_id:            parsed.data.job_id,
      talent_profile_id: caller.talentProfileId, // from JWT — not body
      cover_note:        parsed.data.cover_note,
    }))
    res.status(201).json({ application })
  } catch (err) { next(err) }
}

// ── PUT /applications/:id/status — production owner only ──────

export const updateStatusHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = appId(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid application id' }); return }

    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Validation error' })
      return
    }

    const newStatus = parsed.data.status as ApplicationStatus

    // Fetch current status to validate transition
    const { data: current } = await supabase
      .from('applications')
      .select('status')
      .eq('id', id)
      .single()

    if (!current) { res.status(404).json({ error: 'Application not found' }); return }

    const allowed = TRANSITIONS[current.status as ApplicationStatus] ?? []
    if (!allowed.includes(newStatus)) {
      res.status(409).json({
        error: `Cannot transition from '${current.status}' to '${newStatus}'. Allowed: [${allowed.join(', ') || 'none'}]`,
      })
      return
    }

    const application = await updateApplicationStatus(id, newStatus)
    res.status(200).json({ application })
  } catch (err) { next(err) }
}

// ── GET /applications/:id/match-breakdown — production owner OR applicant ──

export const matchBreakdownHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = appId(req)
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid application id' }); return }
    // Ownership already verified by requireApplicationAccess('any-party') in the route
    const breakdown = await getMatchBreakdown(id)
    res.status(200).json(breakdown)
  } catch (err) { next(err) }
}

// ── GET /applications/my — talent only; identity from caller ──

export const myApplicationsHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent' || !caller.talentProfileId) {
      res.status(403).json({ error: 'Talent account required' }); return
    }
    const applications = await getMyApplications(caller.talentProfileId)
    res.status(200).json({ applications })
  } catch (err) { next(err) }
}
