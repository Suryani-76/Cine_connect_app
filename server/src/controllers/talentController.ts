import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { createTalentProfile, updateTalentProfile, searchTalent } from '../services/talentService'
import { sanitizeObject } from '../utils/sanitize'

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}

const createTalentSchema = z.object({
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

const searchSchema = z.object({
  skills:   z.string().max(500).optional(),
  role:     z.string().max(100).optional(),
  location: z.string().max(120).optional(),
  language: z.string().max(60).optional(),
  limit:    z.coerce.number().int().min(1).max(50).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
})

/**
 * POST /talent/profile
 * user_id derived from req.caller — never from body.
 */
export const createProfileHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const parsed = createTalentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const profile = await createTalentProfile(
      sanitizeObject({ user_id: caller.userId, ...parsed.data })
    )
    res.status(201).json({ profile })
  } catch (err) { next(err) }
}

/**
 * PUT /talent/profile
 * Updates talent profile and enqueues match score recomputation.
 */
export const updateProfileHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent' || !caller.talentProfileId) {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const parsed = createTalentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const profile = await updateTalentProfile(
      caller.talentProfileId,
      sanitizeObject(parsed.data)
    )
    res.status(200).json({ profile })
  } catch (err) { next(err) }
}

/**
 * GET /talent/search — requires auth; paginated; never returns email.
 */
export const searchHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const parsed = searchSchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const { skills: rawSkills, role, location, language, limit, offset } = parsed.data
    const skills = rawSkills
      ? rawSkills.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const talent = await searchTalent({ skills, role, location, language, limit, offset })
    res.status(200).json({ talent })
  } catch (err) { next(err) }
}
