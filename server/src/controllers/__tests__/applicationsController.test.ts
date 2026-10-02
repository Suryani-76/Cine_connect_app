import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { applicationsRouter } from '../../routes/applications'
import { errorHandler } from '../../middleware/errorHandler'

// ── Mock Supabase ─────────────────────────────────────────────
vi.mock('../../db/supabase', () => ({
  supabase: {
    from:       vi.fn().mockReturnThis(),
    select:     vi.fn().mockReturnThis(),
    eq:         vi.fn().mockReturnThis(),
    single:     vi.fn().mockResolvedValue({ data: null, error: null }),
    insert:     vi.fn().mockReturnThis(),
    update:     vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth:       { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } }, error: null }) },
  },
}))

// ── Mock requireAuth ──────────────────────────────────────────
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

// ── Mock callerContext with a talent caller ───────────────────
vi.mock('../../middleware/callerContext', () => {
  const fakeTalentCaller = {
    userId:              'cccccccc-cccc-cccc-cccc-cccccccccccc',
    role:                'talent' as const,
    profileId:           'dddddddd-dddd-dddd-dddd-dddddddddddd',
    productionProfileId: null,
    talentProfileId:     'dddddddd-dddd-dddd-dddd-dddddddddddd',
  }

  return {
    loadCallerContext: vi.fn((req: Request, _res: Response, next: NextFunction) => {
      req.caller = fakeTalentCaller
      next()
    }),
    requireRole: vi.fn((_role: string) =>
      (_req: Request, _res: Response, next: NextFunction) => next()
    ),
    requireJobOwner: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    requireApplicationAccess: vi.fn((_mode: string) =>
      (_req: Request, _res: Response, next: NextFunction) => next()
    ),
  }
})

const app = express()
app.use(express.json())
app.use('/applications', applicationsRouter)
app.use(errorHandler)

// ── Tests ─────────────────────────────────────────────────────

describe('POST /applications', () => {
  it('returns 400 when job_id is missing', async () => {
    const res = await request(app).post('/applications').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when job_id is not a valid UUID', async () => {
    const res = await request(app).post('/applications').send({
      job_id: 'not-a-uuid',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/UUID/i)
  })

  it('returns 400 when cover_note exceeds 1000 characters', async () => {
    const res = await request(app).post('/applications').send({
      job_id:     '123e4567-e89b-12d3-a456-426614174000',
      cover_note: 'x'.repeat(1001),
    })
    expect(res.status).toBe(400)
  })

  it('does NOT accept talent_profile_id in body (derived from JWT)', async () => {
    // talent_profile_id should be ignored — only job_id is accepted in body
    const res = await request(app).post('/applications').send({
      job_id:            '123e4567-e89b-12d3-a456-426614174000',
      talent_profile_id: '123e4567-e89b-12d3-a456-426614174001',
    })
    // Not 400 — body validation passes; will fail at DB level from mock
    expect(res.status).not.toBe(400)
  })
})

describe('PUT /applications/:id/status', () => {
  it('returns 400 for invalid application id', async () => {
    const res = await request(app)
      .put('/applications/not-a-uuid/status')
      .send({ status: 'shortlisted' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid application id/i)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .put('/applications/123e4567-e89b-12d3-a456-426614174000/status')
      .send({ status: 'accepted' })
    expect(res.status).toBe(400)
  })

  it('accepts all valid pipeline status values (not 400)', async () => {
    const validStatuses = ['applied', 'shortlisted', 'interview', 'hired', 'rejected']
    for (const status of validStatuses) {
      const res = await request(app)
        .put('/applications/123e4567-e89b-12d3-a456-426614174000/status')
        .send({ status })
      expect(res.status).not.toBe(400)
    }
  })

  it('accepts interview status with interview_at timestamp', async () => {
    const res = await request(app)
      .put('/applications/123e4567-e89b-12d3-a456-426614174000/status')
      .send({ status: 'interview', interview_at: '2026-10-15T14:00:00Z' })
    expect(res.status).not.toBe(400)
  })
})

describe('POST /applications/:id/withdraw', () => {
  it('returns 400 for invalid application id', async () => {
    const res = await request(app).post('/applications/bad-id/withdraw')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid application id/i)
  })
})

describe('GET /applications/:id/match-breakdown', () => {
  it('returns 400 for invalid application id', async () => {
    const res = await request(app).get('/applications/bad-id/match-breakdown')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid application id/i)
  })

  it('returns 404 when application not found', async () => {
    const res = await request(app)
      .get('/applications/123e4567-e89b-12d3-a456-426614174000/match-breakdown')
    expect(res.status).toBe(404)
  })
})

