import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'
import {
  blockUserHandler,
  unblockUserHandler,
  getBlockedUsersHandler,
} from '../controllers/chatController'

export const blocksRouter = Router()

// GET /blocks - list users blocked by the caller
blocksRouter.get(
  '/',
  requireAuth,
  loadCallerContext,
  getBlockedUsersHandler
)

// POST /blocks - block a user
blocksRouter.post(
  '/',
  requireAuth,
  loadCallerContext,
  blockUserHandler
)

// DELETE /blocks/:userId - unblock a user
blocksRouter.delete(
  '/:userId',
  requireAuth,
  loadCallerContext,
  unblockUserHandler
)
