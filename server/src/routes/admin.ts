import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../db/supabase'
import {
  getMatchConfigHandler,
  updateMatchConfigHandler,
  triggerRecomputeProcessHandler,
  suspendUserHandler,
  unsuspendUserHandler,
  verifyProductionHandler,
  unverifyProductionHandler,
  getAuditLogHandler,
  listAdminUsersHandler,
  listAdminProductionHandler,
} from '../controllers/adminController'
import {
  getAdminReportsHandler,
  updateAdminReportHandler,
} from '../controllers/chatController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const adminRouter = Router()

/**
 * Admin authorization guard:
 * Validates strictly that the authenticated user exists in the public.admins table.
 * All legacy shared secret headers and role checks are removed.
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check fast path if loadCallerContext already verified admin status
  if (req.caller?.isAdmin) {
    return next()
  }

  // Fallback: lookup directly in admins table using authenticated auth user ID
  const authUser = (req as Express.Request & { user?: { id: string } }).user
  if (authUser?.id) {
    const { data: adminRow } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (adminRow) {
      if (req.caller) req.caller.isAdmin = true
      return next()
    }
  }

  res.status(403).json({ error: 'Admin access required' })
}

// ── Match Engine Admin ─────────────────────────────────────────

adminRouter.get(
  '/match-config',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  getMatchConfigHandler
)

adminRouter.put(
  '/match-config',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  updateMatchConfigHandler
)

adminRouter.post(
  '/recompute/process',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  triggerRecomputeProcessHandler
)

// ── User Suspension Management ────────────────────────────────

adminRouter.get(
  '/users',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  listAdminUsersHandler
)

adminRouter.put(
  '/users/:id/suspend',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  suspendUserHandler
)

adminRouter.put(
  '/users/:id/unsuspend',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  unsuspendUserHandler
)

// ── Production Verification Management ─────────────────────────

adminRouter.get(
  '/production',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  listAdminProductionHandler
)

adminRouter.put(
  '/production/:id/verify',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  verifyProductionHandler
)

adminRouter.put(
  '/production/:id/unverify',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  unverifyProductionHandler
)

// ── Audit Log ──────────────────────────────────────────────────

adminRouter.get(
  '/audit-log',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  getAuditLogHandler
)

// ── Chat Safety Reports Queue ──────────────────────────────────

adminRouter.get(
  '/reports',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  getAdminReportsHandler
)

adminRouter.put(
  '/reports/:id',
  requireAuth,
  loadCallerContext,
  requireAdmin,
  updateAdminReportHandler
)
