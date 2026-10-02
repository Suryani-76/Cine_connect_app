import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { getActiveMatchWeights, updateMatchWeights, validateWeights } from '../services/matchConfigService'
import { processMatchRecomputeQueue, enqueueMatchRecompute } from '../services/recomputeService'

const updateWeightsSchema = z.object({
  skills_match:         z.number().min(0).max(100),
  role_match:           z.number().min(0).max(100),
  experience_match:     z.number().min(0).max(100),
  language_match:       z.number().min(0).max(100),
  location_proximity:   z.number().min(0).max(100),
  profile_completeness: z.number().min(0).max(100),
  activity_recency:     z.number().min(0).max(100),
  reason:               z.string().optional(),
})

export const getMatchConfigHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const weights = await getActiveMatchWeights()
    res.status(200).json({ weights })
  } catch (err) {
    next(err)
  }
}

export const updateMatchConfigHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = updateWeightsSchema.parse(req.body)
    const { reason, ...weights } = parsed

    const check = validateWeights(weights)
    if (!check.valid) {
      res.status(400).json({ error: check.error })
      return
    }

    const userId = req.caller?.userId ?? null
    const result = await updateMatchWeights(weights, userId, reason)

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const triggerRecomputeProcessHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const batchSize = req.query.batch_size ? Number(req.query.batch_size) : 50
    const result = await processMatchRecomputeQueue(batchSize)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
