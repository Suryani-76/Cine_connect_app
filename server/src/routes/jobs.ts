import { Router } from 'express'
import {
  createJobHandler,
  setRequirementsHandler,
  publishJobHandler,
  listJobsHandler,
  getApplicationsHandler,
  closeJobHandler,
  getJobByIdHandler,
} from '../controllers/jobController'
import { requireAuth } from '../middleware/authMiddleware'

export const jobsRouter = Router()

jobsRouter.get('/',                    listJobsHandler)                       // public
jobsRouter.post('/',                   requireAuth, createJobHandler)
jobsRouter.get('/:id',                 getJobByIdHandler)                     // public — single job
jobsRouter.put('/:id/requirements',    requireAuth, setRequirementsHandler)
jobsRouter.post('/:id/publish',        requireAuth, publishJobHandler)
jobsRouter.post('/:id/close',          requireAuth, closeJobHandler)
jobsRouter.get('/:id/applications',    requireAuth, getApplicationsHandler)
