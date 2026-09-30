import { Request, Response, NextFunction } from 'express'
import { getDashboardStats } from '../services/dashboardService'

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/**
 * GET /dashboard/stats?production_id=&user_id=
 */
export const statsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const production_id = req.query.production_id as string | undefined
    const user_id       = req.query.user_id       as string | undefined

    if (!production_id || !isUuid(production_id)) {
      res.status(400).json({ error: 'production_id (UUID) is required' })
      return
    }
    if (!user_id || !isUuid(user_id)) {
      res.status(400).json({ error: 'user_id (UUID) is required' })
      return
    }

    const stats = await getDashboardStats(production_id, user_id)
    res.status(200).json({ stats })
  } catch (err) {
    next(err)
  }
}
