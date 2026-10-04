/**
 * callerContext.ts
 * ────────────────
 * Resolves the authenticated caller's profile and administrative status from req.user.id.
 * Caches database lookups so the database is queried at most once per request.
 *
 * Usage:
 *   router.get('/foo', requireAuth, loadCallerContext, requireRole('production'), handler)
 */

import { Request, Response, NextFunction } from 'express'
import { supabase } from '../db/supabase'

// ── Augment Express Request ───────────────────────────────────

export interface CallerContext {
  userId:              string
  email?:              string
  username?:           string
  role:                'production' | 'talent'
  isAdmin?:            boolean
  suspendedAt?:        string | null
  profileId:           string        // production_profiles.id  OR  talent_profiles.id
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
    // 1. Resolve user record (cached on req by requireAuth if available)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userRow = (req as any).userRecord
    if (!userRow) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, role, suspended_at')
        .eq('id', authUser.id)
        .single()

      if (error || !data) {
        res.status(401).json({ error: 'User record not found' })
        return
      }
      userRow = data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(req as any).userRecord = userRow
    }

    // 2. Reject suspended users
    if (userRow.suspended_at) {
      res.status(403).json({ error: 'Account suspended' })
      return
    }

    // 3. Resolve Admin status via admins table
    const { data: adminRow } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle()

    const isAdmin = !!adminRow

    const role = (userRow.role === 'talent' ? 'talent' : 'production') as 'production' | 'talent'
    let productionProfileId: string | null = null
    let talentProfileId:     string | null = null

    if (role === 'production') {
      const { data: pp } = await supabase
        .from('production_profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle()
      productionProfileId = pp?.id ?? null
    } else {
      const { data: tp } = await supabase
        .from('talent_profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle()
      talentProfileId = tp?.id ?? null
    }

    req.caller = {
      userId:              authUser.id,
      email:               userRow.email,
      username:            userRow.username,
      role,
      isAdmin,
      suspendedAt:         userRow.suspended_at ?? null,
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
      res.status(403).json({ error: `This action requires a ${role} account` })
      return
    }
    next()
  }

// ── Job ownership guard ───────────────────────────────────────

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
    res.status(404).json({ error: 'Job not found' })
    return
  }

  next()
}

// ── Application access guard ──────────────────────────────────

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

/**
 * Optional caller context loader: If Authorization header exists, extracts user and
 * loads caller context. If missing or invalid, proceeds silently as anonymous.
 */
export const optionalCallerContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.slice(7).trim()
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      return next()
    }
    ;(req as any).user = data.user
    return loadCallerContext(req, res, next)
  } catch {
    return next()
  }
}

