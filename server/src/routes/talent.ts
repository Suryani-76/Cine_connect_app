import { Router } from 'express'
import { createProfileHandler, updateProfileHandler, searchHandler } from '../controllers/talentController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const talentRouter = Router()

talentRouter.post('/profile', requireAuth, loadCallerContext, createProfileHandler)
talentRouter.put('/profile',  requireAuth, loadCallerContext, updateProfileHandler)
// Step 0.6: search now requires auth + pagination
talentRouter.get('/search',   requireAuth, loadCallerContext, searchHandler)
