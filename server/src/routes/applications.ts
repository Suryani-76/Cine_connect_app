import { Router } from 'express'
import {
  createApplicationHandler,
  updateStatusHandler,
  matchBreakdownHandler,
  myApplicationsHandler,
} from '../controllers/applicationsController'
import { requireAuth } from '../middleware/authMiddleware'

export const applicationsRouter = Router()

/** GET  /applications/my?talent_profile_id= — authenticated talent */
applicationsRouter.get('/my',                 requireAuth, myApplicationsHandler)

/** POST /applications                        — authenticated talent */
applicationsRouter.post('/',                  requireAuth, createApplicationHandler)

/** PUT  /applications/:id/status             — authenticated production house */
applicationsRouter.put('/:id/status',         requireAuth, updateStatusHandler)

/** GET  /applications/:id/match-breakdown    — authenticated */
applicationsRouter.get('/:id/match-breakdown', requireAuth, matchBreakdownHandler)
