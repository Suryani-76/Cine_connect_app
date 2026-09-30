import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { createTalentProfile, searchTalent } from '../services/talentService'
import { sanitizeObject } from '../utils/sanitize'

// ── Helpers ───────────────────────────────────────────────────

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}

// ── Schemas ───────────────────────────────────────────────────

const createTalentSchema = z.object({
  user_id:          z.string().uuid('user_id must be a valid UUID'),
  full_name:        z.string().max(120).optional(),
  bio:              z.string().max(500).optional(),
  role:             z.string().max(100).optional(),
  skills:           z.array(z.string().min(1)).max(30).optional(),
  experience_years: z.number().int().min(0).max(50).optional(),
  language:         z.string().max(60).optional(),
  location:         z.string().max(120).optional(),
  avatar_url:       z.string().url('avatar_url must be a valid URL').optional(),
  portfolio_url:    z.string().url('portfolio_url must be a valid URL').optional(),
})

// ── Handlers ─────────────────────────────────────────────────

/**
 * POST /talent/profile
 * Body: CreateTalentProfileInput
 */
export const createProfileHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createTalentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) })
      return
    }
    const profile = await createTalentProfile(sanitizeObject(parsed.data))
    res.status(201).json({ profile })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /talent/search?skills=Acting,Editing&role=Editor&location=Mumbai&language=English
 * skills param is a comma-separated string.
 */
export const searchHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawSkills  = req.query.skills   as string | undefined
    const role       = req.query.role     as string | undefined
    const location   = req.query.location as string | undefined
    const language   = req.query.language as string | undefined

    const skills = rawSkills
      ? rawSkills.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const talent = await searchTalent({ skills, role, location, language })
    res.status(200).json({ talent })
  } catch (err) {
    next(err)
  }
}
