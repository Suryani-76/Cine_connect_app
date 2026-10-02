/**
 * callerContext.ts
 * ────────────────
 * Resolves the authenticated caller's public profile from req.user.id.
 * Cached on req.caller so DB is hit once per request.
 *
 * Usage:
 *   router.get('/foo', requireAuth, loadCallerContext, requireRole('production'), handler)
 */

import { Request, Response, NextFunction } from 'express'
import { supabase } from '../db/supabase'

// ── Augment Express Request ───────────────────────────────────

export interface CallerContext {
  userId:          string
  role:            'production' | 'talent'
  profileId:       string        // production_profiles.id  OR  talent_profiles.id
  productionProfileId: string | null
  talentProfileId:     string | null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      caller?: CallerContext
    }
  }
}

// ── Middleware ────────────────────────────────────────────────

export const loadCallerContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // requireAuth must have run first
  const authUser = (req as Express.Request & { user?: { id: string } }).user
  if (!authUser?.id) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    // Fetch public.users row to get the role
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', authUser.id)
      .single()

    if (userErr || !userRow) {
      res.status(401).json({ error: 'User record not found' })
      return
    }

    const role = userRow.role as 'production' | 'talent'
    let productionProfileId: string | null = null
    let talentProfileId:     string | null = null

    if (role === 'production') {
      const { data: pp } = await supabase
        .from('production_profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .single()
      productionProfileId = pp?.id ?? null
    } else {
      const { data: tp } = await supabase
        .from('talent_profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .single()
      talentProfileId = tp?.id ?? null
    }

    req.caller = {
      userId:              authUser.id,
      role,
      profileId:           (productionProfileId ?? talentProfileId) as string,
      productionProfileId,
      talentProfileId,
    }

    next()
  } catch {
    res.status(500).json({ error: 'Failed to load caller context' })
  }
}

// ── Role guard ────────────────────────────────────────────────

export const requireRole = (role: 'production' | 'talent') =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.caller) { res.status(401).json({ error: 'Unauthorized' }); return }
    if (req.caller.role !== role) {
      // 403 for role mismatches (not IDOR — they just have the wrong role)
      res.status(403).json({ error: `This action requires a ${role} account` })
      return
    }
    next()
  }

// ── Job ownership guard ───────────────────────────────────────

/**
 * Verifies the caller is the production owner of jobs/:id.
 * Reads the job id from req.params.id.
 * Returns 404 (not 403) if job belongs to someone else — avoids leaking existence.
 */
export const requireJobOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.caller?.productionProfileId) {
    res.status(403).json({ error: 'Production account required' })
    return
  }

  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

  const { data: job } = await supabase
    .from('jobs')
    .select('production_id')
    .eq('id', jobId)
    .single()

  if (!job || job.production_id !== req.caller.productionProfileId) {
    // Return 404 — don't leak whether a different-owner job exists
    res.status(404).json({ error: 'Job not found' })
    return
  }

  next()
}

// ── Application access guard ──────────────────────────────────

/**
 * mode 'production-owner': caller must own the job the application is for.
 * mode 'talent-owner':     caller must be the applicant.
 * mode 'any-party':        either of the above.
 * Returns 404 on ownership failure (avoids leaking existence).
 */
export const requireApplicationAccess = (
  mode: 'production-owner' | 'talent-owner' | 'any-party'
) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.caller) { res.status(401).json({ error: 'Unauthorized' }); return }

  const appId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

  const { data: app } = await supabase
    .from('applications')
    .select('id, talent_profile_id, jobs(production_id)')
    .eq('id', appId)
    .single()

  if (!app) { res.status(404).json({ error: 'Application not found' }); return }

  const jobProductionId = (app.jobs as unknown as { production_id: string } | null)?.production_id
  const isProductionOwner = req.caller.productionProfileId === jobProductionId
  const isTalentOwner     = req.caller.talentProfileId     === app.talent_profile_id

  const allowed =
    mode === 'production-owner' ? isProductionOwner :
    mode === 'talent-owner'     ? isTalentOwner :
    isProductionOwner || isTalentOwner

  if (!allowed) { res.status(404).json({ error: 'Application not found' }); return }

  next()
}
