import { Router } from 'express'
import {
  createJobHandler, setRequirementsHandler, publishJobHandler,
  listJobsHandler, getApplicationsHandler, closeJobHandler,
  getJobByIdHandler, getAnalyticsHandler, recordViewHandler,
  talentMatchesHandler,
} from '../controllers/jobController'
import { requireAuth } from '../middleware/authMiddleware'

export const jobsRouter = Router()

jobsRouter.get('/',                    listJobsHandler)
jobsRouter.post('/',                   requireAuth, createJobHandler)
jobsRouter.get('/:id',                 getJobByIdHandler)
jobsRouter.post('/:id/view',           recordViewHandler)
jobsRouter.get('/:id/analytics',       requireAuth, getAnalyticsHandler)
jobsRouter.get('/:id/talent-matches',  requireAuth, talentMatchesHandler)
jobsRouter.put('/:id/requirements',    requireAuth, setRequirementsHandler)
jobsRouter.post('/:id/publish',        requireAuth, publishJobHandler)
jobsRouter.post('/:id/close',          requireAuth, closeJobHandler)
jobsRouter.get('/:id/applications',    requireAuth, getApplicationsHandler)
