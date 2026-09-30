import { Router } from 'express'
import {
  createJobHandler,
  setRequirementsHandler,
  publishJobHandler,
  listJobsHandler,
  getApplicationsHandler,
  closeJobHandler,
} from '../controllers/jobController'
import { requireAuth } from '../middleware/authMiddleware'

export const jobsRouter = Router()

jobsRouter.get('/',                    listJobsHandler)
jobsRouter.post('/',                   requireAuth, createJobHandler)
jobsRouter.put('/:id/requirements',    requireAuth, setRequirementsHandler)
jobsRouter.post('/:id/publish',        requireAuth, publishJobHandler)
jobsRouter.post('/:id/close',          requireAuth, closeJobHandler)
jobsRouter.get('/:id/applications',    requireAuth, getApplicationsHandler)
