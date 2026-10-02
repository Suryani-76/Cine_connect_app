import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { saveJob, unsaveJob, getSavedJobs } from '../services/savedJobsService'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext, requireRole } from '../middleware/callerContext'

export const savedJobsRouter = Router()

const jobIdSchema = z.object({ job_id: z.string().uuid('job_id must be a valid UUID') })

// All identity from req.caller.talentProfileId

savedJobsRouter.get('/',
  requireAuth, loadCallerContext, requireRole('talent'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profileId = req.caller!.talentProfileId!
      const saved = await getSavedJobs(profileId)
      res.json({ saved })
    } catch (err) { next(err) }
  })

savedJobsRouter.post('/',
  requireAuth, loadCallerContext, requireRole('talent'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = jobIdSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message }); return
      }
      await saveJob(parsed.data.job_id, req.caller!.talentProfileId!)
      res.json({ ok: true })
    } catch (err) { next(err) }
  })

savedJobsRouter.delete('/',
  requireAuth, loadCallerContext, requireRole('talent'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = jobIdSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message }); return
      }
      await unsaveJob(parsed.data.job_id, req.caller!.talentProfileId!)
      res.json({ ok: true })
    } catch (err) { next(err) }
  })
