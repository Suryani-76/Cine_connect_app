import { Request, Response, NextFunction } from 'express'
import {
  listNotifications,
  markNotificationRead,
  markAllRead,
  getUnreadCount,
} from '../services/notificationService'
import { supabase } from '../db/supabase'

function isUuid(val: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

// Identity ALWAYS from req.caller.userId — never from query/body.

/** GET /notifications?unread_only=true&limit= */
export const listHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const userId      = req.caller!.userId
    const unread_only = req.query.unread_only === 'true'
    const raw         = parseInt(req.query.limit as string ?? '50', 10)
    const limit       = isNaN(raw) ? 50 : Math.min(Math.max(raw, 1), 100)

    const notifications = await listNotifications({ user_id: userId, unread_only, limit })
    const unread_count  = notifications.filter(n => !n.read).length
    res.status(200).json({ notifications, unread_count })
  } catch (err) { next(err) }
}

/** GET /notifications/unread-count */
export const unreadCountHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const count = await getUnreadCount(req.caller!.userId)
    res.status(200).json({ count })
  } catch (err) { next(err) }
}

/** PUT /notifications/:id/read — caller must own the notification */
export const markReadHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!isUuid(id)) { res.status(400).json({ error: 'Invalid notification id' }); return }

    // Ownership check — return 404 not 403
    const { data: notif } = await supabase
      .from('notifications').select('user_id').eq('id', id).single()
    if (!notif || notif.user_id !== req.caller!.userId) {
      res.status(404).json({ error: 'Notification not found' }); return
    }

    const notification = await markNotificationRead(id)
    res.status(200).json({ notification })
  } catch (err) { next(err) }
}

/** PUT /notifications/read-all */
export const markAllReadHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    await markAllRead(req.caller!.userId)
    res.status(200).json({ message: 'All notifications marked as read' })
  } catch (err) { next(err) }
}
