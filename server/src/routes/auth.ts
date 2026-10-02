import { Router } from 'express'
import { register, verify, forgotPassword } from '../controllers/authController'

export const authRouter = Router()

authRouter.post('/register',        register)
authRouter.post('/verify',          verify)
authRouter.post('/forgot-password', forgotPassword)
