import { Router } from 'express'
import { statsHandler } from '../controllers/dashboardController'
import { requireAuth } from '../middleware/authMiddleware'

export const dashboardRouter = Router()

/** GET /dashboard/stats?production_id=&user_id= */
dashboardRouter.get('/stats', requireAuth, statsHandler)
