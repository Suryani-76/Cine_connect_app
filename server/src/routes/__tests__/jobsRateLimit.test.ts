import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { jobsRouter } from '../jobs'

// ── Mock Supabase ─────────────────────────────────────────────
vi.mock('../../db/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'job-1', production_id: 'prod-1' }, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

// ── Mock requireAuth and callerContext ─────────────────────────
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.caller = {
      userId: 'test-user-uuid',
      role: 'talent',
      profileId: 'talent-profile-uuid',
      productionProfileId: null,
      talentProfileId: 'talent-profile-uuid',
    }
    next()
  }),
  requireRole: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  requireJobOwner: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  requireApplicationAccess: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  optionalCallerContext: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}))

describe('/jobs Rate Limiting Isolation', () => {
  const app = express()
  app.use(express.json())
  app.use('/jobs', jobsRouter)

  it('allows 40 rapid GET /jobs requests without rate limiting', async () => {
    for (let i = 0; i < 40; i++) {
      const res = await request(app).get('/jobs')
      expect(res.status).not.toBe(429)
    }
  })

  it('rate-limits POST /jobs/:id/view on the 31st request with 429 and exact message', async () => {
    const jobId = 'a0000000-0000-0000-0000-000000000001'

    // First 30 requests should succeed
    for (let i = 0; i < 30; i++) {
      const res = await request(app).post(`/jobs/${jobId}/view`)
      expect(res.status).toBe(200)
    }

    // 31st request must hit 429
    const limitedRes = await request(app).post(`/jobs/${jobId}/view`)
    expect(limitedRes.status).toBe(429)
    expect(limitedRes.body).toEqual({ error: 'Too many view requests.' })

    // Other routes (GET /jobs) remain completely unaffected
    const getRes = await request(app).get('/jobs')
    expect(getRes.status).not.toBe(429)
  })
})
