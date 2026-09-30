import { Router } from 'express'
import { getHealth } from '../controllers/healthController'

export const healthRouter = Router()

/**
 * GET /health
 * Returns server health status.
 */
healthRouter.get('/', getHealth)
