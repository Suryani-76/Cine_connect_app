import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import { rateLimit } from "express-rate-limit"
import { healthRouter } from "./routes/health"
import { authRouter } from "./routes/auth"
import { accountRouter } from "./routes/account"
import { productionRouter } from "./routes/production"
import { jobsRouter } from "./routes/jobs"
import { talentRouter } from "./routes/talent"
import { applicationsRouter } from "./routes/applications"
import { notificationsRouter } from "./routes/notifications"
import { dashboardRouter } from "./routes/dashboard"
import { savedJobsRouter } from "./routes/savedJobs"
import { talentAlertsRouter } from "./routes/talentAlerts"
import { vocabRouter } from "./routes/vocab"
import { adminRouter } from "./routes/admin"
import { usersRouter } from "./routes/users"
import { messagesRouter } from "./routes/messages"
import { conversationsRouter } from "./routes/conversations"
import { blocksRouter } from "./routes/blocks"
import { reportsRouter } from "./routes/reports"
import { settingsRouter } from "./routes/settings"
import { unsubscribeRouter } from "./routes/unsubscribe"
import { errorHandler } from "./middleware/errorHandler"

const app  = express()
const PORT = process.env.PORT ?? 3000

// ── Reverse Proxy Trust (Fly.io Mumbai) ────────────────────────
// Enables accurate req.ip evaluation behind Fly.io edge proxies
app.set("trust proxy", 1)

// ── Security headers ──────────────────────────────────────────
app.use(helmet())

// ── CORS — restrict to exact known client origins ─────────────
const rawAllowed = process.env.ALLOWED_ORIGINS?.trim()

if (process.env.NODE_ENV === "production") {
  if (!rawAllowed) {
    console.error("FATAL [CORS]: ALLOWED_ORIGINS must be set in production.")
    process.exit(1)
  }
  const origins = rawAllowed.split(",").map(o => o.trim())
  if (origins.some(o => o === "*" || o === "" || o.includes("/*"))) {
    console.error("FATAL [CORS]: Wildcards are strictly disallowed in ALLOWED_ORIGINS in production.")
    process.exit(1)
  }
}

const ALLOWED_ORIGINS = (rawAllowed || "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser requests (server-to-server, curl, tests) with no Origin header
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ extended: true, limit: "1mb" }))

// ── Rate limiters ─────────────────────────────────────────────

/** Strict limiter for auth endpoints: 10 attempts per 15 min per IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  keyGenerator: (req) => req.ip ?? "unknown",
})

/** General API limiter: 300 req per min per IP */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  keyGenerator: (req) => req.ip ?? "unknown",
})

app.use(generalLimiter)

// ── Routes ────────────────────────────────────────────────────
app.use("/health", healthRouter)
app.use("/auth", authLimiter, authRouter)       // strict limit on auth
app.use("/account", accountRouter)              // data export & deletion (DPDP/GDPR)
app.use("/production", productionRouter)
app.use("/jobs", jobsRouter)
app.use("/talent", talentRouter)
app.use("/applications", applicationsRouter)
app.use("/notifications", notificationsRouter)
app.use("/dashboard", dashboardRouter)
app.use("/saved-jobs", savedJobsRouter)
app.use("/talent-alerts", talentAlertsRouter)
app.use("/vocab", vocabRouter)
app.use("/admin", adminRouter)
app.use("/users", usersRouter)
app.use("/messages", messagesRouter)
app.use("/conversations", conversationsRouter)
app.use("/blocks", blocksRouter)
app.use("/reports", reportsRouter)
app.use("/settings", settingsRouter)
app.use("/unsubscribe", unsubscribeRouter)

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" })
})

// ── Centralised error handler (must be last) ──────────────────
app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

// ── Graceful Shutdown (SIGTERM / SIGINT) ──────────────────────
// Stop accepting new connections, drain in-flight requests, then exit cleanly.
let isShuttingDown = false

export function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`[Shutdown] ${signal} signal received. Initiating graceful shutdown...`)

  // Stop accepting new connections and drain existing in-flight requests
  server.close((err) => {
    if (err) {
      console.error('[Shutdown] Error while closing HTTP server:', err)
      process.exit(1)
    }
    console.log('[Shutdown] HTTP server closed and in-flight requests drained. Exiting cleanly.')
    process.exit(0)
  })

  // Hard deadline to ensure process does not hang indefinitely (15 seconds)
  const shutdownTimer = setTimeout(() => {
    console.error('[Shutdown] Graceful shutdown timeout (15s) exceeded. Forcing termination.')
    process.exit(1)
  }, 15000)
  shutdownTimer.unref()
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Prevent unhandled promise rejections from crashing the process
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason)
})

export default app
