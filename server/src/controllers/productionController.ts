import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  createProductionProfile,
  getProductionProfileById,
} from '../services/productionProfileService'
import { sanitizeObject } from '../utils/sanitize'

// ── Validation schemas ────────────────────────────────────────

const createProfileSchema = z.object({
  user_id: z.string().uuid('user_id must be a valid UUID'),
  company_name: z.string().min(1, 'Company name is required').max(120),
  bio: z.string().max(500).optional(),
  production_details: z.string().max(2000).optional(),
})

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}

// ── Handlers ─────────────────────────────────────────────────

/**
 * POST /production/profile
 * Body: { user_id, company_name, bio?, production_details? }
 */
export const createProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) })
      return
    }

    const profile = await createProductionProfile(sanitizeObject(parsed.data))
    res.status(201).json({ profile })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /production/profile/:id
 */
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid profile id' })
      return
    }

    const profile = await getProductionProfileById(id)
    res.status(200).json({ profile })
  } catch (err) {
    next(err)
  }
}
