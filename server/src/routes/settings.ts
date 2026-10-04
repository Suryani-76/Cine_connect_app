import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '../controllers/settingsController'

export const settingsRouter = Router()

settingsRouter.get(
  '/notifications',
  requireAuth,
  loadCallerContext,
  getNotificationSettings
)

settingsRouter.put(
  '/notifications',
  requireAuth,
  loadCallerContext,
  updateNotificationSettings
)
