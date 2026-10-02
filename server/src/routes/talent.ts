import { Router } from 'express'
import { createProfileHandler, searchHandler } from '../controllers/talentController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const talentRouter = Router()

talentRouter.post('/profile', requireAuth, loadCallerContext, createProfileHandler)
// Step 0.6: search now requires auth + pagination
talentRouter.get('/search',   requireAuth, loadCallerContext, searchHandler)
