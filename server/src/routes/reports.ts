import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'
import { createReportHandler } from '../controllers/chatController'

export const reportsRouter = Router()

// POST /reports - submit a safety report
reportsRouter.post(
  '/',
  requireAuth,
  loadCallerContext,
  createReportHandler
)
