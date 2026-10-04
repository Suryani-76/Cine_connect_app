import { Router } from "express"
import {
  register,
  verify,
  forgotPassword,
  getConsentStatus,
  postConsent,
  getMe,
} from "../controllers/authController"
import { requireAuth } from "../middleware/authMiddleware"
import { loadCallerContext } from "../middleware/callerContext"
import { verifyCaptcha } from "../middleware/captchaMiddleware"

export const authRouter = Router()

authRouter.post("/register", verifyCaptcha, register)
authRouter.post("/verify", verifyCaptcha, verify)
authRouter.post("/forgot-password", verifyCaptcha, forgotPassword)

// Session identity & admin verification
authRouter.get("/me", requireAuth, loadCallerContext, getMe)

// Consent management (Step 3.1)
authRouter.get("/consent-status", requireAuth, getConsentStatus)
authRouter.post("/consent", requireAuth, postConsent)
