import { Request, Response, NextFunction } from 'express'
import {
  getPreferencesByUnsubscribeToken,
  unsubscribeByToken,
} from '../services/notificationPreferencesService'

/**
 * Public endpoint to verify unsubscribe token without authentication.
 * Returns safe preference status without leaking internal user IDs.
 */
export async function getUnsubscribeInfo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token
    if (!token) {
      res.status(400).json({ error: 'Token is required' })
      return
    }

    const prefs = await getPreferencesByUnsubscribeToken(token)
    if (!prefs) {
      res.status(404).json({ error: 'Invalid or expired unsubscribe link' })
      return
    }

    res.json({
      valid: true,
      preferences: {
        new_application: prefs.new_application,
        status_change: prefs.status_change,
        new_message: prefs.new_message,
        job_closed: prefs.job_closed,
        talent_alert_match: prefs.talent_alert_match,
        digest_frequency: prefs.digest_frequency,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * Public endpoint to perform one-click or targeted unsubscribe using the token.
 */
export async function executeUnsubscribe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token
    if (!token) {
      res.status(400).json({ error: 'Token is required' })
      return
    }

    const { digestOnly, disableAll } = req.body || {}
    await unsubscribeByToken(token, {
      digestOnly: Boolean(digestOnly),
      disableAll: disableAll !== false,
    })

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed from CineConnect notifications.',
    })
  } catch (err) {
    next(err)
  }
}
