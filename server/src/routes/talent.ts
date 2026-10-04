import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import {
  createProfileHandler,
  getMyProfileHandler,
  getProfileByIdHandler,
  updateProfileHandler,
  updateAvailabilityHandler,
  searchHandler,
  uploadAvatarHandler,
  uploadResumeHandler,
  deleteResumeHandler,
  getResumeSignedUrlHandler,
  getMyCreditsHandler,
  createCreditHandler,
  updateCreditHandler,
  deleteCreditHandler,
} from '../controllers/talentController'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext } from '../middleware/callerContext'

export const talentRouter = Router()

// ── Multer Storage Configuration (Memory Storage) ────────────
const avatarMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB strict limit
})

const resumeMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB strict limit
})

const handleAvatarUpload = (req: Request, res: Response, next: NextFunction) => {
  avatarMulter.single('avatar')(req, res, (err) => {
    if (err) return next(err)
    if (!req.file) {
      avatarMulter.single('file')(req, res, next)
    } else {
      next()
    }
  })
}

const handleResumeUpload = (req: Request, res: Response, next: NextFunction) => {
  resumeMulter.single('resume')(req, res, (err) => {
    if (err) return next(err)
    if (!req.file) {
      resumeMulter.single('file')(req, res, next)
    } else {
      next()
    }
  })
}

// ── Profile Endpoints ─────────────────────────────────────────
talentRouter.post('/profile',        requireAuth, loadCallerContext, createProfileHandler)
talentRouter.get('/profile',         requireAuth, loadCallerContext, getMyProfileHandler)
talentRouter.put('/profile',         requireAuth, loadCallerContext, updateProfileHandler)
talentRouter.put('/availability',    requireAuth, loadCallerContext, updateAvailabilityHandler)
talentRouter.get('/profile/:id',     requireAuth, loadCallerContext, getProfileByIdHandler)
talentRouter.get('/search',          requireAuth, loadCallerContext, searchHandler)

// ── Uploads & Documents ───────────────────────────────────────
talentRouter.post('/avatar',         requireAuth, loadCallerContext, handleAvatarUpload, uploadAvatarHandler)
talentRouter.post('/resume',         requireAuth, loadCallerContext, handleResumeUpload, uploadResumeHandler)
talentRouter.delete('/resume',       requireAuth, loadCallerContext, deleteResumeHandler)
talentRouter.get('/:id/resume-url',  requireAuth, loadCallerContext, getResumeSignedUrlHandler)

// ── Credits CRUD (Owner Only, Max 50) ─────────────────────────
talentRouter.get('/credits',         requireAuth, loadCallerContext, getMyCreditsHandler)
talentRouter.post('/credits',        requireAuth, loadCallerContext, createCreditHandler)
talentRouter.put('/credits/:id',     requireAuth, loadCallerContext, updateCreditHandler)
talentRouter.delete('/credits/:id',  requireAuth, loadCallerContext, deleteCreditHandler)
