import { Router } from "express"
import { rateLimit } from "express-rate-limit"
import { requireAuth } from "../middleware/authMiddleware"
import { loadCallerContext } from "../middleware/callerContext"
import { exportAccountData, deleteAccount } from "../controllers/accountController"

export const accountRouter = Router()

/**
 * Strict export rate limiter: 1 export request per 1 hour per user.
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You may only request a full data export once per hour. Please try again later." },
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => req.caller?.userId ?? (req as unknown as { user?: { id: string } }).user?.id ?? req.ip ?? "unknown",
})

accountRouter.get(
  "/export",
  requireAuth,
  loadCallerContext,
  exportLimiter,
  exportAccountData
)

accountRouter.delete(
  "/",
  requireAuth,
  loadCallerContext,
  deleteAccount
)
