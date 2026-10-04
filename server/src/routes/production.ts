import { Router } from 'express'
import {
  createProfile,
  getMyProfile,
  updateProfile,
  getProfile,
} from '../controllers/productionController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const productionRouter = Router()

productionRouter.post('/profile', requireAuth, loadCallerContext, createProfile)
productionRouter.get('/profile',  requireAuth, loadCallerContext, getMyProfile)
productionRouter.put('/profile',  requireAuth, loadCallerContext, updateProfile)
productionRouter.get('/profile/:id', getProfile)  // public / authenticated
