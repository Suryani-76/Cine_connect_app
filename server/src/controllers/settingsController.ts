import { Request, Response, NextFunction } from 'express'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../services/notificationPreferencesService'

export async function getNotificationSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.caller?.userId ?? (req as unknown as { user?: { id: string } }).user?.id
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const prefs = await getNotificationPreferences(userId)
    res.json(prefs)
  } catch (err) {
    next(err)
  }
}

export async function updateNotificationSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.caller?.userId ?? (req as unknown as { user?: { id: string } }).user?.id
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const updated = await updateNotificationPreferences(userId, req.body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}
