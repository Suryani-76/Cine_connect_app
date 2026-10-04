import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'
import { getConversationsHandler } from '../controllers/chatController'

export const conversationsRouter = Router()

// GET /conversations - get paginated conversation list
conversationsRouter.get(
  '/',
  requireAuth,
  loadCallerContext,
  getConversationsHandler
)
