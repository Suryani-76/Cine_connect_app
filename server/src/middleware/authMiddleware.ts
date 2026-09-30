import { Request, Response, NextFunction } from 'express'
import { supabase } from '../db/supabase'

/**
 * Verifies the Bearer JWT from the Authorization header using Supabase Auth.
 * Attaches the decoded user to `req.user` on success.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.split(' ')[1]

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Attach user to request for downstream handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(req as any).user = data.user

  next()
}
