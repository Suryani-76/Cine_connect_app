import { Request, Response, NextFunction } from "express"

/**
 * Validates Cloudflare Turnstile CAPTCHA response if CAPTCHA_ENABLED is active.
 * Transparently passes through if CAPTCHA_ENABLED is false or unset.
 */
export const verifyCaptcha = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (process.env.CAPTCHA_ENABLED !== "true") {
    return next()
  }

  const token =
    (req.headers["cf-turnstile-response"] as string) ||
    req.body?.turnstile_token ||
    req.body?.captcha_token

  if (!token) {
    res.status(400).json({ error: "Captcha verification required. Please complete the security check." })
    return
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
    console.warn("[captchaMiddleware] CAPTCHA_ENABLED is true but TURNSTILE_SECRET_KEY is missing.")
    return next()
  }

  try {
    const formData = new URLSearchParams()
    formData.append("secret", secretKey)
    formData.append("response", token)
    if (req.ip) formData.append("remoteip", req.ip)

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    })

    const outcome = (await response.json()) as { success: boolean; "error-codes"?: string[] }

    if (!outcome.success) {
      res.status(400).json({
        error: "Security verification failed. Please refresh and try again.",
        details: outcome["error-codes"],
      })
      return
    }

    next()
  } catch (err) {
    console.error("[captchaMiddleware] Failed to verify turnstile token:", err)
    res.status(500).json({ error: "Security service temporarily unavailable. Please try again." })
  }
}
