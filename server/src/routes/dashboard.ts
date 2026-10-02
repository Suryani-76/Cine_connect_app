import { Router } from 'express'
import { statsHandler } from '../controllers/dashboardController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext, requireRole } from '../middleware/callerContext'

export const dashboardRouter = Router()

dashboardRouter.get('/stats',
  requireAuth, loadCallerContext, requireRole('production'), statsHandler)
