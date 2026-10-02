import { Router, Request, Response, NextFunction } from 'express'
import {
  getMatchConfigHandler,
  updateMatchConfigHandler,
  triggerRecomputeProcessHandler,
} from '../controllers/adminController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const adminRouter = Router()

/**
 * Admin authorization guard:
 * Validates either an x-admin-key secret header or an authenticated user with role='admin'.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const adminKey = process.env.ADMIN_KEY
  const providedKey = req.headers['x-admin-key']

  if (adminKey && providedKey === adminKey) {
    return next()
  }

  if (req.caller?.role === 'admin') {
    return next()
  }

  res.status(403).json({ error: 'Admin access required' })
}

// ── Admin Routes ──────────────────────────────────────────────
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
