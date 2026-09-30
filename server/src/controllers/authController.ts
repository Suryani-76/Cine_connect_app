import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { registerUser, verifyOtp } from '../services/authService'

// ── Validation schemas ────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  role: z.enum(['production', 'talent'] as const, "Role must be 'production' or 'talent'"),
})

const verifySchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
})

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Validation error'
}

/**
 * POST /auth/register
 * Body: { email, password, username, role: 'production' | 'talent' }
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

    const { email, password, username, role } = parsed.data
    const user = await registerUser({ email, password, username, role })
    res.status(201).json({
      message: 'Registration successful. Check your email for a verification code.',
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
    const { supabase } = await import('../db/supabase')
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user?.id)
      .single()

    res.status(200).json({
      message: 'Email verified successfully.',
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      user: { id: user?.id, email: user?.email, role: userRow?.role ?? 'production' },
    })
  } catch (err) {
    next(err)
  }
}
