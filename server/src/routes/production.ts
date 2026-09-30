import { Router } from 'express'
import { createProfile, getProfile } from '../controllers/productionController'
import { requireAuth } from '../middleware/authMiddleware'

export const productionRouter = Router()

/** POST /production/profile  (authenticated) */
productionRouter.post('/profile', requireAuth, createProfile)

/** GET /production/profile/:id  (public) */
productionRouter.get('/profile/:id', getProfile)
