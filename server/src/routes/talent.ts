import { Router } from 'express'
import { createProfileHandler, searchHandler } from '../controllers/talentController'
import { requireAuth } from '../middleware/authMiddleware'

export const talentRouter = Router()

/** POST /talent/profile   — authenticated talent user */
talentRouter.post('/profile', requireAuth, createProfileHandler)

/** GET  /talent/search?skills=&role=&location=&language=   — public */
talentRouter.get('/search', searchHandler)
