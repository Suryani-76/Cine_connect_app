import { Request, Response, NextFunction } from 'express'
import {
  listNotifications,
  markNotificationRead,
  markAllRead,
  getUnreadCount,
} from '../services/notificationService'

function isUuid(val: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

/**
 * GET /notifications?user_id=&unread_only=true
 */
export const listHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id     = req.query.user_id     as string | undefined
    const unread_only = req.query.unread_only === 'true'
    const limit       = req.query.limit ? parseInt(req.query.limit as string, 10) : 50

    if (!user_id || !isUuid(user_id)) {
      res.status(400).json({ error: 'user_id (UUID) is required' })
      return
    }

    const notifications = await listNotifications({ user_id, unread_only, limit })
    const unread_count  = notifications.filter(n => !n.read).length

    res.status(200).json({ notifications, unread_count })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /notifications/unread-count?user_id=
 */
export const unreadCountHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.query.user_id as string | undefined
    if (!user_id || !isUuid(user_id)) {
      res.status(400).json({ error: 'user_id (UUID) is required' })
      return
    }
    const count = await getUnreadCount(user_id)
    res.status(200).json({ count })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /notifications/:id/read
 */
export const markReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Invalid notification id' })
      return
    }
    const notification = await markNotificationRead(id)
    res.status(200).json({ notification })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /notifications/read-all?user_id=
 */
export const markAllReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.query.user_id as string | undefined
    if (!user_id || !isUuid(user_id)) {
      res.status(400).json({ error: 'user_id (UUID) is required' })
      return
    }
    await markAllRead(user_id)
    res.status(200).json({ message: 'All notifications marked as read' })
  } catch (err) {
    next(err)
  }
}
