import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { adminRouter } from '../../routes/admin'
import { errorHandler } from '../../middleware/errorHandler'

vi.mock('../../db/supabase', () => {
  const chain: any = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.insert = vi.fn().mockResolvedValue({ error: null })
  chain.update = vi.fn().mockReturnValue(chain)

  return {
    supabase: {
      from: vi.fn().mockReturnValue(chain),
    },
  }
})

let mockCallerRole = 'talent'

vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.caller = {
      userId: 'test-admin-id',
      role: mockCallerRole as any,
      profileId: 'admin-prof',
      productionProfileId: null,
      talentProfileId: null,
    }
    next()
  }),
}))

const app = express()
app.use(express.json())
app.use('/admin', adminRouter)
app.use(errorHandler)

describe('Admin Endpoints', () => {
  beforeEach(() => {
    mockCallerRole = 'talent'
    delete process.env.ADMIN_KEY
  })

  it('rejects access with 403 when not admin', async () => {
    const res = await request(app).get('/admin/match-config')
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/Admin access required/)
  })

  it('allows access with x-admin-key header', async () => {
    process.env.ADMIN_KEY = 'secret-admin-key'
    const res = await request(app)
      .get('/admin/match-config')
      .set('x-admin-key', 'secret-admin-key')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('weights')
  })

  it('allows access when user has role=admin', async () => {
    mockCallerRole = 'admin'
    const res = await request(app).get('/admin/match-config')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('weights')
  })

  it('rejects PUT /admin/match-config if weights do not sum to 100', async () => {
    mockCallerRole = 'admin'
    const invalidWeights = {
      skills_match: 10,
      role_match: 10,
      experience_match: 10,
      language_match: 10,
      location_proximity: 10,
      profile_completeness: 10,
      activity_recency: 10, // sum = 70
    }

    const res = await request(app)
      .put('/admin/match-config')
      .send(invalidWeights)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/sum to 100/)
  })

  it('updates match weights successfully when valid', async () => {
    mockCallerRole = 'admin'
    const validWeights = {
      skills_match: 35,
      role_match: 15,
      experience_match: 15,
      language_match: 10,
      location_proximity: 10,
      profile_completeness: 10,
      activity_recency: 5, // sum = 100
      reason: 'Prioritizing verified skills',
    }

    const res = await request(app)
      .put('/admin/match-config')
      .send(validWeights)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.weights.skills_match).toBe(35)
  })
})
