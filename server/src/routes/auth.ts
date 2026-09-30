import { Router } from 'express'
import { register, verify } from '../controllers/authController'

export const authRouter = Router()

/** POST /auth/register */
authRouter.post('/register', register)

/** POST /auth/verify */
authRouter.post('/verify', verify)
