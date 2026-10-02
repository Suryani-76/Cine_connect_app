import { Router } from 'express'
import {
  listHandler, markReadHandler, markAllReadHandler, unreadCountHandler,
} from '../controllers/notificationsController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const notificationsRouter = Router()

// All routes: identity from req.caller — never from query/body
notificationsRouter.get('/',             requireAuth, loadCallerContext, listHandler)
notificationsRouter.get('/unread-count', requireAuth, loadCallerContext, unreadCountHandler)
notificationsRouter.put('/read-all',     requireAuth, loadCallerContext, markAllReadHandler)
notificationsRouter.put('/:id/read',     requireAuth, loadCallerContext, markReadHandler)
