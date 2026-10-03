import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  createProductionProfile,
  getProductionProfileById,
} from '../services/productionProfileService'
import { sanitizeObject } from '../utils/sanitize'

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}

const createProfileSchema = z.object({
  company_name:       z.string().min(1, 'Company name is required').max(150),
  bio:                z.string().max(2000).optional(),
  production_details: z.string().max(3000).optional(),
})

/**
 * POST /production/profile
 * user_id derived from req.caller — never from body.
 */
export const createProfile = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'production') {
      res.status(403).json({ error: 'Production account required' }); return
    }

    const parsed = createProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const profile = await createProductionProfile(
      sanitizeObject({ user_id: caller.userId, ...parsed.data })
    )
    res.status(201).json({ profile })
  } catch (err) { next(err) }
}

/** GET /production/profile/:id — public, no sensitive fields */
export const getProfile = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid profile id' }); return
    }
    const profile = await getProductionProfileById(id)
    res.status(200).json({ profile })
  } catch (err) { next(err) }
}
