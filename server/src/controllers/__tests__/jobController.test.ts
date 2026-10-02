import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { jobsRouter } from '../../routes/jobs'
import { errorHandler } from '../../middleware/errorHandler'

// ── Mock Supabase ─────────────────────────────────────────────
vi.mock('../../db/supabase', () => ({
  supabase: {
    from:        vi.fn().mockReturnThis(),
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    range:       vi.fn().mockReturnThis(),
    single:      vi.fn().mockResolvedValue({ data: null, error: null }),
    insert:      vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    upsert:      vi.fn().mockReturnThis(),
    in:          vi.fn().mockReturnThis(),
    auth:        { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) },
  },
}))

// ── Mock requireAuth — always passes ──────────────────────────
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

// ── Mock callerContext — inject fake caller on every request ──
vi.mock('../../middleware/callerContext', () => {
  const fakeProductionCaller = {
    userId:              'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    role:                'production' as const,
    profileId:           'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    productionProfileId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    talentProfileId:     null,
  }

  return {
    loadCallerContext: vi.fn((req: Request, _res: Response, next: NextFunction) => {
      req.caller = fakeProductionCaller
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
app.use('/jobs', jobsRouter)
app.use(errorHandler)

// ── Tests ─────────────────────────────────────────────────────

describe('POST /jobs', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/jobs').send({
      description: 'Looking for an experienced cinematographer.',
    })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when title is too short', async () => {
    const res = await request(app).post('/jobs').send({
      title: 'ab',
      description: 'Looking for an experienced cinematographer.',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/3 characters/)
  })

  it('returns 400 when description is too short', async () => {
    const res = await request(app).post('/jobs').send({
      title: 'Lead Cinematographer',
      description: 'Short',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/10 characters/)
  })

  it('does NOT require production_id in body (derived from JWT)', async () => {
    // production_id is now derived from req.caller — should not appear in Zod schema
    const res = await request(app).post('/jobs').send({
      title: 'Lead Cinematographer',
      description: 'Looking for an experienced cinematographer.',
    })
    // 500 from mocked DB returning null — but NOT 400 (body validation passed)
    expect(res.status).not.toBe(400)
  })
})

describe('GET /jobs', () => {
  it('returns 200 with jobs array', async () => {
    const res = await request(app).get('/jobs')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('jobs')
  })

  it('returns 400 for invalid production_id UUID', async () => {
    const res = await request(app).get('/jobs?production_id=not-a-uuid')
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await request(app).get('/jobs?status=invalid')
    expect(res.status).toBe(400)
  })
})

describe('PUT /jobs/:id/requirements', () => {
  it('returns 400 for invalid job id', async () => {
    const res = await request(app)
      .put('/jobs/bad-id/requirements').send({ skills: ['Lighting'] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid job id/)
  })

  it('returns 400 for invalid experience_level', async () => {
    const res = await request(app)
      .put('/jobs/123e4567-e89b-12d3-a456-426614174000/requirements')
      .send({ experience_level: 'expert' })
    expect(res.status).toBe(400)
  })
})

describe('PUT /jobs/:id', () => {
  it('returns 400 for invalid job id', async () => {
    const res = await request(app).put('/jobs/bad-id').send({ title: 'New Title' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid job id/)
  })

  it('returns 400 when pay_min > pay_max', async () => {
    const res = await request(app)
      .put('/jobs/123e4567-e89b-12d3-a456-426614174000')
      .send({ pay_min: 50000, pay_max: 30000 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/pay_min cannot exceed pay_max/)
  })

  it('returns 400 when start_date > end_date', async () => {
    const res = await request(app)
      .put('/jobs/123e4567-e89b-12d3-a456-426614174000')
      .send({ start_date: '2026-12-01', end_date: '2026-11-01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/start_date cannot be after end_date/)
  })

  it('returns 400 when openings is less than 1', async () => {
    const res = await request(app)
      .put('/jobs/123e4567-e89b-12d3-a456-426614174000')
      .send({ openings: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Openings must be at least 1/)
  })
})

describe('DELETE /jobs/:id', () => {
  it('returns 400 for invalid job id', async () => {
    const res = await request(app).delete('/jobs/bad-id')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid job id/)
  })
})

