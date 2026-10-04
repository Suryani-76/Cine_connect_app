import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../db/supabase'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const usersRouter = Router()

/**
 * GET /users/:id/public
 * Returns non-sensitive public user info (username, role) for display name resolution.
 * NEVER returns email, phone, or other private user data.
 */
usersRouter.get(
  '/:id/public',
  requireAuth,
  loadCallerContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        res.status(400).json({ error: 'Invalid user id' })
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      res.status(200).json({
        user: {
          id: data.id,
          username: data.username,
          role: data.role,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)
