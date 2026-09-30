import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { applicationsRouter } from '../../routes/applications'
import { errorHandler } from '../../middleware/errorHandler'

vi.mock('../../db/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

const app = express()
app.use(express.json())
app.use('/applications', applicationsRouter)
app.use(errorHandler)

describe('POST /applications', () => {
  it('returns 400 when job_id is missing', async () => {
    const res = await request(app).post('/applications').send({
      talent_profile_id: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when talent_profile_id is not a valid UUID', async () => {
    const res = await request(app).post('/applications').send({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      talent_profile_id: 'not-a-uuid',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/UUID/i)
  })

  it('returns 400 when cover_note exceeds 1000 characters', async () => {
    const res = await request(app).post('/applications').send({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      talent_profile_id: '123e4567-e89b-12d3-a456-426614174001',
      cover_note: 'x'.repeat(1001),
    })
    expect(res.status).toBe(400)
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

  it('accepts all valid pipeline status values', async () => {
    const validStatuses = ['applied', 'shortlisted', 'interview', 'hired', 'rejected']
    for (const status of validStatuses) {
      const res = await request(app)
        .put('/applications/123e4567-e89b-12d3-a456-426614174000/status')
        .send({ status })
      // Will be 404 from mock (no real DB) but NOT 400 (validation passed)
      expect(res.status).not.toBe(400)
    }
  })
})

describe('GET /applications/:id/match-breakdown', () => {
  it('returns 400 for invalid application id', async () => {
    const res = await request(app).get('/applications/bad-id/match-breakdown')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid application id/i)
  })

  it('returns 404 when application not found', async () => {
    const res = await request(app).get('/applications/123e4567-e89b-12d3-a456-426614174000/match-breakdown')
    expect(res.status).toBe(404)
  })
})
