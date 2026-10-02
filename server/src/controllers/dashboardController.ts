import { Request, Response, NextFunction } from 'express'
import { getDashboardStats } from '../services/dashboardService'

/** GET /dashboard/stats — identity from req.caller */
export const statsHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (!caller.productionProfileId) {
      res.status(403).json({ error: 'Production account required' })
      return
    }
    const stats = await getDashboardStats(caller.productionProfileId, caller.userId)
    res.status(200).json({ stats })
  } catch (err) { next(err) }
}
