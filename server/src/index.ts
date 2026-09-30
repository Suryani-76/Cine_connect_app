import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { healthRouter } from './routes/health'
import { authRouter } from './routes/auth'
import { productionRouter } from './routes/production'
import { jobsRouter } from './routes/jobs'
import { talentRouter } from './routes/talent'
import { applicationsRouter } from './routes/applications'
import { notificationsRouter } from './routes/notifications'
import { dashboardRouter } from './routes/dashboard'
import { errorHandler } from './middleware/errorHandler'

const app  = express()
const PORT = process.env.PORT ?? 3000

// ── Security headers ──────────────────────────────────────────
app.use(helmet())

// ── CORS — restrict to known client origins ───────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ── Rate limiters ─────────────────────────────────────────────

/** Strict limiter for auth endpoints: 10 attempts per 15 min per IP */
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many attempts. Please try again in 15 minutes.' },
})

/** General API limiter: 300 req per min per IP */
const generalLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              300,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests. Please slow down.' },
})

app.use(generalLimiter)

// ── Routes ────────────────────────────────────────────────────
app.use('/health', healthRouter)
app.use('/auth', authLimiter, authRouter)       // strict limit on auth
app.use('/production', productionRouter)
app.use('/jobs', jobsRouter)
app.use('/talent', talentRouter)
app.use('/applications', applicationsRouter)
app.use('/notifications', notificationsRouter)
app.use('/dashboard', dashboardRouter)

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ── Centralised error handler (must be last) ──────────────────
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

// Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

export default app
