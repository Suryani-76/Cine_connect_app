import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase'
import { getActiveMatchWeights, updateMatchWeights, validateWeights } from '../services/matchConfigService'
import { processMatchRecomputeQueue } from '../services/recomputeService'
import { recordAuditLog, getAuditLogs } from '../services/auditService'

const updateWeightsSchema = z.object({
  skills_match:         z.number().min(0).max(100),
  role_match:           z.number().min(0).max(100),
  experience_match:     z.number().min(0).max(100),
  language_match:       z.number().min(0).max(100),
  location_proximity:   z.number().min(0).max(100),
  profile_completeness: z.number().min(0).max(100),
  activity_recency:     z.number().min(0).max(100),
  reason:               z.string().optional(),
})

// ── Match Config & Recompute ──────────────────────────────────

export const getMatchConfigHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const weights = await getActiveMatchWeights()
    res.status(200).json({ weights })
  } catch (err) {
    next(err)
  }
}

export const updateMatchConfigHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = updateWeightsSchema.parse(req.body)
    const { reason, ...weights } = parsed

    const check = validateWeights(weights)
    if (!check.valid) {
      res.status(400).json({ error: check.error })
      return
    }

    const userId = req.caller?.userId ?? null
    const result = await updateMatchWeights(weights, userId, reason)

    // Write to unified audit_log as required
    await recordAuditLog({
      actor_id: userId,
      action: 'update_match_config',
      target_type: 'match_config',
      target_id: 'default',
      details: { weights, reason },
    })

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const triggerRecomputeProcessHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const batchSize = req.query.batch_size ? Number(req.query.batch_size) : 50
    const result = await processMatchRecomputeQueue(batchSize)

    // Write to audit_log
    await recordAuditLog({
      actor_id: req.caller?.userId ?? null,
      action: 'process_recompute_queue',
      target_type: 'match_recompute_queue',
      target_id: 'batch',
      details: { batchSize, result },
    })

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

// ── User Suspension Endpoints ─────────────────────────────────

const suspendSchema = z.object({
  reason: z.string().optional(),
})

export const suspendUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const { reason } = suspendSchema.parse(req.body || {})
    const actorId = req.caller?.userId ?? null

    // Confirm target user exists
    const { data: user, error: findErr } = await supabase
      .from('users')
      .select('id, email, username, role')
      .eq('id', targetUserId)
      .single()

    if (findErr || !user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Safety: prevent suspending fellow admins
    const { data: adminTarget } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (adminTarget) {
      res.status(400).json({ error: 'Cannot suspend an administrator account' })
      return
    }

    const suspendedAt = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('users')
      .update({ suspended_at: suspendedAt })
      .eq('id', targetUserId)

    if (updateErr) {
      throw Object.assign(new Error(`Failed to suspend user: ${updateErr.message}`), { statusCode: 500 })
    }

    // Audit log
    await recordAuditLog({
      actor_id: actorId,
      action: 'suspend_user',
      target_type: 'user',
      target_id: targetUserId,
      details: { email: user.email, username: user.username, reason },
    })

    res.status(200).json({
      success: true,
      message: 'User has been suspended',
      user_id: targetUserId,
      suspended_at: suspendedAt,
    })
  } catch (err) {
    next(err)
  }
}

export const unsuspendUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const actorId = req.caller?.userId ?? null

    const { data: user, error: findErr } = await supabase
      .from('users')
      .select('id, email, username')
      .eq('id', targetUserId)
      .single()

    if (findErr || !user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ suspended_at: null })
      .eq('id', targetUserId)

    if (updateErr) {
      throw Object.assign(new Error(`Failed to unsuspend user: ${updateErr.message}`), { statusCode: 500 })
    }

    // Audit log
    await recordAuditLog({
      actor_id: actorId,
      action: 'unsuspend_user',
      target_type: 'user',
      target_id: targetUserId,
      details: { email: user.email, username: user.username },
    })

    res.status(200).json({
      success: true,
      message: 'User suspension revoked',
      user_id: targetUserId,
    })
  } catch (err) {
    next(err)
  }
}

// ── Production Verification Endpoints ─────────────────────────

export const verifyProductionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const actorId = req.caller?.userId ?? null

    const { data: profile, error: findErr } = await supabase
      .from('production_profiles')
      .select('id, company_name, user_id')
      .eq('id', productionId)
      .single()

    if (findErr || !profile) {
      res.status(404).json({ error: 'Production profile not found' })
      return
    }

    const verifiedAt = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('production_profiles')
      .update({
        verified: true,
        verified_at: verifiedAt,
        verified_by: actorId,
      })
      .eq('id', productionId)

    if (updateErr) {
      throw Object.assign(new Error(`Failed to verify production profile: ${updateErr.message}`), { statusCode: 500 })
    }

    // Audit log
    await recordAuditLog({
      actor_id: actorId,
      action: 'verify_production',
      target_type: 'production_profile',
      target_id: productionId,
      details: { company_name: profile.company_name, user_id: profile.user_id },
    })

    res.status(200).json({
      success: true,
      message: 'Production company verified',
      production_id: productionId,
      verified_at: verifiedAt,
    })
  } catch (err) {
    next(err)
  }
}

export const unverifyProductionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const actorId = req.caller?.userId ?? null

    const { data: profile, error: findErr } = await supabase
      .from('production_profiles')
      .select('id, company_name, user_id')
      .eq('id', productionId)
      .single()

    if (findErr || !profile) {
      res.status(404).json({ error: 'Production profile not found' })
      return
    }

    const { error: updateErr } = await supabase
      .from('production_profiles')
      .update({
        verified: false,
        verified_at: null,
        verified_by: null,
      })
      .eq('id', productionId)

    if (updateErr) {
      throw Object.assign(new Error(`Failed to unverify production profile: ${updateErr.message}`), { statusCode: 500 })
    }

    // Audit log
    await recordAuditLog({
      actor_id: actorId,
      action: 'unverify_production',
      target_type: 'production_profile',
      target_id: productionId,
      details: { company_name: profile.company_name, user_id: profile.user_id },
    })

    res.status(200).json({
      success: true,
      message: 'Production verification revoked',
      production_id: productionId,
    })
  } catch (err) {
    next(err)
  }
}

// ── Audit Log Query ───────────────────────────────────────────

export const getAuditLogHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const targetType = req.query.target_type as string | undefined
    const action = req.query.action as string | undefined

    const result = await getAuditLogs({ page, limit, target_type: targetType, action })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

// ── Admin Users Management List ───────────────────────────────

export const listAdminUsersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, req.query.page ? Number(req.query.page) : 1)
    const limit = Math.min(100, Math.max(1, req.query.limit ? Number(req.query.limit) : 20))
    const search = (req.query.search as string | undefined)?.trim()
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('users')
      .select('id, email, username, role, suspended_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`)
    }

    const { data, count, error } = await query

    if (error) {
      throw Object.assign(new Error(`Failed to list users: ${error.message}`), { statusCode: 500 })
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    res.status(200).json({
      users: data ?? [],
      total,
      page,
      limit,
      totalPages,
    })
  } catch (err) {
    next(err)
  }
}

// ── Admin Production Profiles List ────────────────────────────

export const listAdminProductionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, req.query.page ? Number(req.query.page) : 1)
    const limit = Math.min(100, Math.max(1, req.query.limit ? Number(req.query.limit) : 20))
    const status = req.query.status as string | undefined
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('production_profiles')
      .select('id, user_id, company_name, bio, verified, verified_at, verified_by, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status === 'verified') {
      query = query.eq('verified', true)
    } else if (status === 'unverified') {
      query = query.eq('verified', false)
    }

    const { data, count, error } = await query

    if (error) {
      throw Object.assign(new Error(`Failed to list productions: ${error.message}`), { statusCode: 500 })
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    res.status(200).json({
      productions: data ?? [],
      total,
      page,
      limit,
      totalPages,
    })
  } catch (err) {
    next(err)
  }
}
