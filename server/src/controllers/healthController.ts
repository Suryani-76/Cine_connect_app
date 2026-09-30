import { Request, Response } from 'express'

/**
 * GET /health
 */
export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' })
}
