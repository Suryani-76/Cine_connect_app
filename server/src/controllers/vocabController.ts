import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { searchSkills, searchRoles, searchCities } from '../services/vocabService'

const querySchema = z.object({
  q: z.string().optional().default(''),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const getSkillsVocabHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, limit } = querySchema.parse(req.query)
    const skills = await searchSkills(q, limit)

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    res.status(200).json({ skills })
  } catch (err) {
    next(err)
  }
}

export const getRolesVocabHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, limit } = querySchema.parse(req.query)
    const roles = await searchRoles(q, limit)

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    res.status(200).json({ roles })
  } catch (err) {
    next(err)
  }
}

export const getCitiesVocabHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, limit } = querySchema.parse(req.query)
    const cities = await searchCities(q, limit)

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    res.status(200).json({ cities })
  } catch (err) {
    next(err)
  }
}
