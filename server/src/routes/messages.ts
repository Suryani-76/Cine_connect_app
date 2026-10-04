import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'
import {
  sendMessageHandler,
  getMessagesWithUserHandler,
  markConversationReadHandler,
} from '../controllers/chatController'

export const messagesRouter = Router()

/**
 * Message sending rate limit: 20 messages per minute per user
 */
const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Message rate limit exceeded. You may only send 20 messages per minute.' },
  keyGenerator: (req) => {
    return req.caller?.userId ?? (req as any).user?.id ?? req.ip ?? 'unknown'
  },
})

// PUT /messages/read - mark conversation messages as read
messagesRouter.put(
  '/read',
  requireAuth,
  loadCallerContext,
  markConversationReadHandler
)

// POST /messages - send a message (rate limited: 20/min/user)
messagesRouter.post(
  '/',
  requireAuth,
  loadCallerContext,
  messageRateLimiter,
  sendMessageHandler
)

// GET /messages/:otherUserId - get message thread with cursor pagination
messagesRouter.get(
  '/:otherUserId',
  requireAuth,
  loadCallerContext,
  getMessagesWithUserHandler
)
