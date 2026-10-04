import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  createTalentProfile,
  updateTalentProfile,
  searchTalent,
  getTalentProfileByUserId,
  getTalentProfileById,
  updateTalentAvailability,
  getCreditsByTalentProfileId,
  createCredit,
  updateCredit,
  deleteCredit,
  uploadTalentAvatar,
  uploadTalentResume,
  deleteTalentResume,
  getTalentResumeSignedUrl,
} from '../services/talentService'
import { sanitizeObject } from '../utils/sanitize'
import { isValidShowreelUrl } from '../services/storageService'

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}

const showreelUrlValidator = z
  .string()
  .url('showreel_url must be a valid URL')
  .refine(
    url => isValidShowreelUrl(url),
    'showreel_url must be a valid YouTube or Vimeo URL'
  )
  .optional()
  .nullable()

const createTalentSchema = z.object({
  full_name:        z.string().max(120).optional(),
  bio:              z.string().max(2000).optional(),
  role:             z.string().max(100).optional(),
  roles:            z.array(z.string().min(1).max(100)).max(20).optional(),
  skills:           z.array(z.string().min(1).max(50)).max(30).optional(),
  experience_years: z.number().int().min(0).max(50).optional(),
  language:         z.string().max(60).optional(),
  location:         z.string().max(120).optional(),
  avatar_url:       z.string().url('avatar_url must be a valid URL').optional().nullable(),
  portfolio_url:    z.string().url('portfolio_url must be a valid URL').optional().nullable(),
  showreel_url:     showreelUrlValidator,
  availability:     z.enum(['open', 'busy', 'unavailable']).optional(),
})

const updateAvailabilitySchema = z.object({
  availability: z.enum(['open', 'busy', 'unavailable'], {
    message: "availability must be 'open', 'busy', or 'unavailable'",
  }),
})

const creditSchema = z.object({
  project_title:      z.string().min(1, 'project_title is required').max(150),
  role:               z.string().min(1, 'role is required').max(100),
  year:               z.number().int().min(1900).max(2100).optional().nullable(),
  production_company: z.string().max(150).optional().nullable(),
  description:        z.string().max(1000).optional().nullable(),
  link:               z.string().url('link must be a valid URL').optional().nullable(),
})

const updateCreditSchema = creditSchema.partial()

const searchSchema = z.object({
  skills:       z.string().max(500).optional(),
  role:         z.string().max(100).optional(),
  location:     z.string().max(120).optional(),
  language:     z.string().max(60).optional(),
  availability: z.enum(['all', 'open', 'busy', 'unavailable']).optional(),
  limit:        z.coerce.number().int().min(1).max(50).default(20),
  offset:       z.coerce.number().int().min(0).default(0),
})

/** Helper to resolve caller's talent profile id */
async function resolveCallerTalentProfileId(req: Request): Promise<string> {
  const caller = req.caller!
  if (caller.talentProfileId) return caller.talentProfileId
  const profile = await getTalentProfileByUserId(caller.userId)
  return profile.id
}

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
 * GET /talent/profile — caller's own talent profile
 */
export const getMyProfileHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const profile = await getTalentProfileByUserId(caller.userId)
    res.status(200).json({ profile })
  } catch (err) { next(err) }
}

/**
 * GET /talent/profile/:id — authenticated view; non-sensitive fields only, never email or phone
 */
export const getProfileByIdHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid profile id' }); return
    }

    const profile = await getTalentProfileById(id)
    res.status(200).json({ profile })
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
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    let profileId: string
    try {
      profileId = await resolveCallerTalentProfileId(req)
    } catch {
      res.status(404).json({ error: 'Talent profile not found' }); return
    }

    const parsed = createTalentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const profile = await updateTalentProfile(
      profileId,
      sanitizeObject(parsed.data)
    )
    res.status(200).json({ profile })
  } catch (err) { next(err) }
}

/**
 * PUT /talent/availability
 * Updates caller's availability status ('open', 'busy', 'unavailable').
 */
export const updateAvailabilityHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const parsed = updateAvailabilitySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    const result = await updateTalentAvailability(profileId, parsed.data.availability)
    res.status(200).json(result)
  } catch (err) { next(err) }
}

/**
 * POST /talent/avatar
 * Multipart form upload for talent avatar (jpeg, png, webp; 2 MB limit; magic bytes verified; rejects SVG).
 */
export const uploadAvatarHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    if (!req.file) {
      res.status(400).json({ error: 'Avatar image file is required' }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    const result = await uploadTalentAvatar(caller.userId, profileId, req.file)
    res.status(200).json(result)
  } catch (err) { next(err) }
}

/**
 * POST /talent/resume
 * Multipart form upload for talent resume (PDF only; 5 MB limit; %PDF magic bytes verified).
 */
export const uploadResumeHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    if (!req.file) {
      res.status(400).json({ error: 'Resume PDF file is required' }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    const result = await uploadTalentResume(caller.userId, profileId, req.file)
    res.status(200).json(result)
  } catch (err) { next(err) }
}

/**
 * DELETE /talent/resume
 * Deletes caller's resume document from private storage.
 */
export const deleteResumeHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    const result = await deleteTalentResume(profileId)
    res.status(200).json(result)
  } catch (err) { next(err) }
}

/**
 * GET /talent/:id/resume-url
 * Returns a signed URL (60s expiry) for the talent's resume.
 * Permitted only for the profile owner and production users who received an application from that talent.
 */
export const getResumeSignedUrlHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid profile id' }); return
    }

    const result = await getTalentResumeSignedUrl(id, caller)
    res.status(200).json(result)
  } catch (err) { next(err) }
}

/**
 * GET /talent/credits
 * Returns credits for caller's own profile.
 */
export const getMyCreditsHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    const credits = await getCreditsByTalentProfileId(profileId)
    res.status(200).json({ credits })
  } catch (err) { next(err) }
}

/**
 * POST /talent/credits
 * Creates a new credit for caller's talent profile (max 50 credits).
 */
export const createCreditHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const parsed = creditSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    const credit = await createCredit({
      talent_profile_id: profileId,
      ...sanitizeObject(parsed.data),
    })
    res.status(201).json({ credit })
  } catch (err) { next(err) }
}

/**
 * PUT /talent/credits/:id
 * Updates an existing credit (owner only).
 */
export const updateCreditHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const creditId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!creditId || !/^[0-9a-f-]{36}$/i.test(creditId)) {
      res.status(400).json({ error: 'Invalid credit id' }); return
    }

    const parsed = updateCreditSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    const credit = await updateCredit(
      creditId,
      profileId,
      sanitizeObject(parsed.data)
    )
    res.status(200).json({ credit })
  } catch (err) { next(err) }
}

/**
 * DELETE /talent/credits/:id
 * Deletes an existing credit (owner only).
 */
export const deleteCreditHandler = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller!
    if (caller.role !== 'talent') {
      res.status(403).json({ error: 'Talent account required' }); return
    }

    const creditId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!creditId || !/^[0-9a-f-]{36}$/i.test(creditId)) {
      res.status(400).json({ error: 'Invalid credit id' }); return
    }

    const profileId = await resolveCallerTalentProfileId(req)
    await deleteCredit(creditId, profileId)
    res.status(200).json({ message: 'Credit deleted successfully' })
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

    const { skills: rawSkills, role, location, language, availability, limit, offset } = parsed.data
    const skills = rawSkills
      ? rawSkills.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const talent = await searchTalent({
      skills,
      role,
      location,
      language,
      availability: availability === 'all' ? undefined : availability,
      limit,
      offset,
    })
    res.status(200).json({ talent })
  } catch (err) { next(err) }
}
