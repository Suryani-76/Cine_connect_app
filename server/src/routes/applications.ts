import { Router } from 'express'
import {
  createApplicationHandler, updateStatusHandler,
  matchBreakdownHandler, myApplicationsHandler,
  withdrawApplicationHandler,
} from '../controllers/applicationsController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext, requireApplicationAccess } from '../middleware/callerContext'

export const applicationsRouter = Router()

// GET /applications/my — talent only; identity from caller
applicationsRouter.get('/my',
  requireAuth, loadCallerContext, myApplicationsHandler)

// POST /applications — talent only; talent_profile_id from caller
applicationsRouter.post('/',
  requireAuth, loadCallerContext, createApplicationHandler)

// POST /applications/:id/withdraw — applicant only
applicationsRouter.post('/:id/withdraw',
  requireAuth, loadCallerContext, requireApplicationAccess('talent-owner'), withdrawApplicationHandler)

// PUT /applications/:id/status — production owner only
applicationsRouter.put('/:id/status',
  requireAuth, loadCallerContext, requireApplicationAccess('production-owner'), updateStatusHandler)

// GET /applications/:id/match-breakdown — production owner OR the applicant
applicationsRouter.get('/:id/match-breakdown',
  requireAuth, loadCallerContext, requireApplicationAccess('any-party'), matchBreakdownHandler)

