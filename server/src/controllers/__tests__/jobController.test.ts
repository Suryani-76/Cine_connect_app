import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { jobsRouter } from '../../routes/jobs'
import { errorHandler } from '../../middleware/errorHandler'

// ── Mock Supabase so no real DB calls are made ────────────────
vi.mock('../../db/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  },
}))

// Mock requireAuth to skip JWT validation in tests
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

const app = express()
app.use(express.json())
app.use('/jobs', jobsRouter)
app.use(errorHandler)

// ── Tests ─────────────────────────────────────────────────────

describe('POST /jobs', () => {
  it('returns 400 when production_id is missing', async () => {
    const res = await request(app).post('/jobs').send({
      title: 'Lead Cinematographer',
      description: 'Looking for an experienced cinematographer.',
    })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when title is too short', async () => {
    const res = await request(app).post('/jobs').send({
      production_id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'ab',
      description: 'Looking for an experienced cinematographer.',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/3 characters/)
  })

  it('returns 400 when description is too short', async () => {
    const res = await request(app).post('/jobs').send({
      production_id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Lead Cinematographer',
      description: 'Short',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/10 characters/)
  })

  it('returns 400 for invalid UUID production_id', async () => {
    const res = await request(app).post('/jobs').send({
      production_id: 'not-a-uuid',
      title: 'Lead Cinematographer',
      description: 'Looking for an experienced cinematographer.',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/UUID/)
  })
})

describe('GET /jobs', () => {
  it('returns 200 with jobs array', async () => {
    const res = await request(app).get('/jobs')
    // With mocked DB returning null data, should still return 200 with empty jobs
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
    const res = await request(app).put('/jobs/bad-id/requirements').send({ skills: ['Lighting'] })
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
