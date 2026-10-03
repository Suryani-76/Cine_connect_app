import { Router } from "express"
import {
  register,
  verify,
  forgotPassword,
  getConsentStatus,
  postConsent,
} from "../controllers/authController"
import { requireAuth } from "../middleware/authMiddleware"
import { verifyCaptcha } from "../middleware/captchaMiddleware"

export const authRouter = Router()

authRouter.post("/register", verifyCaptcha, register)
authRouter.post("/verify", verifyCaptcha, verify)
authRouter.post("/forgot-password", verifyCaptcha, forgotPassword)

// Consent management (Step 3.1)
authRouter.get("/consent-status", requireAuth, getConsentStatus)
authRouter.post("/consent", requireAuth, postConsent)
