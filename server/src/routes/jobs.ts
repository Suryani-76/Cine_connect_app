import { Router } from 'express'
import {
  createJobHandler, setRequirementsHandler, publishJobHandler,
  listJobsHandler, getApplicationsHandler, closeJobHandler,
  getJobByIdHandler, getAnalyticsHandler, recordViewHandler,
  talentMatchesHandler, updateJobHandler, deleteJobHandler,
  getMyJobMatchHandler,
} from '../controllers/jobController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext, requireRole, requireJobOwner } from '../middleware/callerContext'

export const jobsRouter = Router()

// Public — attach caller context if token present (optional auth)
jobsRouter.get('/',     listJobsHandler)      // non-owners only see published

// Applicant preview match score
jobsRouter.get('/:id/my-match',
  requireAuth, loadCallerContext, getMyJobMatchHandler)

jobsRouter.get('/:id',  getJobByIdHandler)    // non-owners only see published

// Auth required — load context
jobsRouter.post('/:id/view',
  requireAuth, loadCallerContext, recordViewHandler)  // skip owner's own views

// Production owner only
jobsRouter.post('/',
  requireAuth, loadCallerContext, requireRole('production'), createJobHandler)

jobsRouter.put('/:id',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, updateJobHandler)

jobsRouter.delete('/:id',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, deleteJobHandler)

jobsRouter.put('/:id/requirements',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, setRequirementsHandler)

jobsRouter.post('/:id/publish',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, publishJobHandler)

jobsRouter.post('/:id/close',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, closeJobHandler)

jobsRouter.get('/:id/applications',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, getApplicationsHandler)

jobsRouter.get('/:id/analytics',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, getAnalyticsHandler)

jobsRouter.get('/:id/talent-matches',
  requireAuth, loadCallerContext, requireRole('production'), requireJobOwner, talentMatchesHandler)
