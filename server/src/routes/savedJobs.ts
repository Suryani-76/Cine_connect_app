import { Router, Request, Response, NextFunction } from 'express'
import { saveJob, unsaveJob, getSavedJobs } from '../services/savedJobsService'
import { requireAuth } from '../middleware/authMiddleware'

export const savedJobsRouter = Router()

/** GET  /saved-jobs?talent_profile_id= */
savedJobsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.query.talent_profile_id as string
    if (!id) { res.status(400).json({ error: 'talent_profile_id required' }); return }
    const saved = await getSavedJobs(id)
    res.json({ saved })
  } catch (err) { next(err) }
})

/** POST /saved-jobs { job_id, talent_profile_id } */
savedJobsRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { job_id, talent_profile_id } = req.body as { job_id: string; talent_profile_id: string }
    if (!job_id || !talent_profile_id) { res.status(400).json({ error: 'job_id and talent_profile_id required' }); return }
    await saveJob(job_id, talent_profile_id)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

/** DELETE /saved-jobs { job_id, talent_profile_id } */
savedJobsRouter.delete('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { job_id, talent_profile_id } = req.body as { job_id: string; talent_profile_id: string }
    if (!job_id || !talent_profile_id) { res.status(400).json({ error: 'job_id and talent_profile_id required' }); return }
    await unsaveJob(job_id, talent_profile_id)
    res.json({ ok: true })
  } catch (err) { next(err) }
})
