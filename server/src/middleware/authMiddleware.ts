import { Request, Response, NextFunction } from 'express'
import { supabase } from '../db/supabase'

/**
 * Verifies the Bearer JWT from the Authorization header using Supabase Auth.
 * Rejects suspended users with 403 on every authenticated route.
 * Caches the user lookup on req for loadCallerContext.
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

  // Check if user is suspended
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, email, username, role, suspended_at')
    .eq('id', data.user.id)
    .single()

  if (userErr || !userRow) {
    res.status(401).json({ error: 'User record not found' })
    return
  }

  if (userRow.suspended_at) {
    res.status(403).json({ error: 'Account suspended' })
    return
  }

  // Attach user to request for downstream handlers and cache user record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(req as any).user = data.user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(req as any).userRecord = userRow

  next()
}
