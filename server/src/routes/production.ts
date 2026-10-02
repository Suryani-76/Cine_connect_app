import { Router } from 'express'
import { createProfile, getProfile } from '../controllers/productionController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const productionRouter = Router()

productionRouter.post('/profile', requireAuth, loadCallerContext, createProfile)
productionRouter.get('/profile/:id', getProfile)  // public
