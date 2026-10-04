import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import {
  registerUser,
  verifyOtp,
  getUserConsentStatus,
  recordUserConsent,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "../services/authService"

// ── Validation schemas ────────────────────────────────────────

const consentSchema = z.object({
  terms: z.literal(true as const, {
    message: "You must accept the Terms of Service and Privacy Policy",
  }),
  terms_version: z.string().default(CURRENT_TERMS_VERSION),
  privacy_version: z.string().default(CURRENT_PRIVACY_VERSION),
  cookie_consent: z.boolean().optional().default(false),
})

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores"),
  role: z.enum(["production", "talent"] as const, "Role must be 'production' or 'talent'"),
  consent: consentSchema.default({
    terms: true,
    terms_version: CURRENT_TERMS_VERSION,
    privacy_version: CURRENT_PRIVACY_VERSION,
    cookie_consent: false,
  }),
  invite_code: z.string().trim().optional(),
})

const verifySchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
})

const recordConsentSchema = z.object({
  terms_version: z.string().default(CURRENT_TERMS_VERSION),
  privacy_version: z.string().default(CURRENT_PRIVACY_VERSION),
  cookie_consent: z.boolean().optional(),
})

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Validation error"
}

/**
 * POST /auth/register
 * Body: { email, password, username, role, consent?: { terms, terms_version, privacy_version }, invite_code? }
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) })
      return
    }

    const { email, password, username, role, consent, invite_code } = parsed.data
    const user = await registerUser({
      email,
      password,
      username,
      role,
      consent,
      invite_code,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    })

    res.status(201).json({
      message: "Registration successful. Check your email for a verification code.",
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /auth/verify
 * Body: { email, otp }
 */
export const verify = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = verifySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) })
      return
    }

    const { session, user } = await verifyOtp(parsed.data)

    // Fetch the user's role from public.users so the client can redirect correctly
    const { supabase } = await import("../db/supabase")
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user?.id)
      .single()

    res.status(200).json({
      message: "Email verified successfully.",
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      user: { id: user?.id, email: user?.email, role: userRow?.role ?? "production" },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /auth/forgot-password
 * Body: { email }
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as { email?: string }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Valid email address is required" })
      return
    }

    const { supabase } = await import("../db/supabase")
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.ALLOWED_ORIGINS?.split(",")[0] ?? "http://localhost:5173"}/reset-password`,
    })

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    res.status(200).json({ message: "If this email is registered, a reset link has been sent." })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /auth/consent-status
 * Checks if authenticated user has agreed to current terms/privacy versions.
 */
export const getConsentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    const status = await getUserConsentStatus(userId)
    res.status(200).json(status)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /auth/consent
 * Records updated consent when terms/privacy versions change.
 */
export const postConsent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    const parsed = recordConsentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) })
      return
    }

    const result = await recordUserConsent(userId, {
      ...parsed.data,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    })

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /auth/me
 * Returns caller's real-time identity and administrative status.
 * Never trust client storage: is_admin is verified from admins table on the server.
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const caller = req.caller
    if (!caller) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    res.status(200).json({
      user: {
        id: caller.userId,
        email: caller.email,
        username: caller.username,
        role: caller.role,
        is_admin: caller.isAdmin,
        is_suspended: !!caller.suspendedAt,
        suspended_at: caller.suspendedAt,
        profile_id: caller.profileId,
        production_profile_id: caller.productionProfileId,
        talent_profile_id: caller.talentProfileId,
      },
    })
  } catch (err) {
    next(err)
  }
}

