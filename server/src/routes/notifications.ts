import { Router } from 'express'
import {
  listHandler,
  markReadHandler,
  markAllReadHandler,
  unreadCountHandler,
} from '../controllers/notificationsController'
import { requireAuth } from '../middleware/authMiddleware'

export const notificationsRouter = Router()

/** GET  /notifications?user_id=&unread_only=  */
notificationsRouter.get('/',              requireAuth, listHandler)

/** GET  /notifications/unread-count?user_id=  */
notificationsRouter.get('/unread-count',  requireAuth, unreadCountHandler)

/** PUT  /notifications/read-all?user_id=      */
notificationsRouter.put('/read-all',      requireAuth, markAllReadHandler)

/** PUT  /notifications/:id/read               */
notificationsRouter.put('/:id/read',      requireAuth, markReadHandler)
