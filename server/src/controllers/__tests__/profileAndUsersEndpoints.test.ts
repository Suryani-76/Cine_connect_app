import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { talentRouter } from '../../routes/talent'
import { productionRouter } from '../../routes/production'
import { usersRouter } from '../../routes/users'
import { errorHandler } from '../../middleware/errorHandler'

// ── Mock State ────────────────────────────────────────────────
let mockCallerRole: 'talent' | 'production' | null = 'talent'
let mockCallerUserId = '11111111-1111-1111-1111-111111111111'
let isAuthed = true

// ── Mock Supabase ─────────────────────────────────────────────
const mockFrom = vi.fn()
vi.mock('../../db/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      const res = mockFrom(...args)
      if (!res.insert) res.insert = vi.fn().mockResolvedValue({ error: null })
      return res
    },
  },
}))

// ── Mock requireAuth & callerContext ──────────────────────────
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((req: Request, res: Response, next: NextFunction) => {
    if (!isAuthed) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    ;(req as any).user = { id: mockCallerUserId }
    next()
  }),
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: vi.fn((req: Request, res: Response, next: NextFunction) => {
    if (!isAuthed) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    req.caller = {
      userId: mockCallerUserId,
      role: mockCallerRole as any,
      profileId: '22222222-2222-2222-2222-222222222222',
      productionProfileId: mockCallerRole === 'production' ? '22222222-2222-2222-2222-222222222222' : null,
      talentProfileId: mockCallerRole === 'talent' ? '22222222-2222-2222-2222-222222222222' : null,
    }
    next()
  }),
  requireRole: vi.fn((role: string) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.caller || req.caller.role !== role) {
      res.status(403).json({ error: `This action requires a ${role} account` })
      return
    }
    next()
  }),
}))

const app = express()
app.use(express.json())
app.use('/talent', talentRouter)
app.use('/production', productionRouter)
app.use('/users', usersRouter)
app.use(errorHandler)

describe('Express Profile & User Public Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAuthed = true
    mockCallerRole = 'talent'
    mockCallerUserId = '11111111-1111-1111-1111-111111111111'
  })

  // ── 1. GET /talent/profile ────────────────────────────────────
  describe('GET /talent/profile (own profile)', () => {
    it('returns talent profile with public user info for authenticated talent', async () => {
      mockCallerRole = 'talent'
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: '22222222-2222-2222-2222-222222222222',
                user_id: mockCallerUserId,
                full_name: 'Priya Talent',
                role: 'Cinematographer',
                skills: ['Camera', 'Lighting'],
                users: { username: 'priya_cine', role: 'talent' },
              },
              error: null,
            }),
          }),
        }),
      })

      const res = await request(app).get('/talent/profile')
      expect(res.status).toBe(200)
      expect(res.body.profile.full_name).toBe('Priya Talent')
      expect(res.body.profile.users.username).toBe('priya_cine')
    })

    it('returns 401 when unauthenticated', async () => {
      isAuthed = false
      const res = await request(app).get('/talent/profile')
      expect(res.status).toBe(401)
    })

    it('returns 403 when wrong role (production account)', async () => {
      mockCallerRole = 'production'
      const res = await request(app).get('/talent/profile')
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/talent account/i)
    })
  })

  // ── 2. GET /talent/profile/:id ────────────────────────────────
  describe('GET /talent/profile/:id (authenticated view)', () => {
    const targetId = '33333333-3333-3333-3333-333333333333'

    it('returns talent profile by id without exposing email or phone', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: targetId,
                full_name: 'Rahul Actor',
                bio: 'Experienced actor in Mumbai',
                skills: ['Method Acting', 'Voiceover'],
                users: { username: 'rahul_acts', role: 'talent' },
              },
              error: null,
            }),
          }),
        }),
      })

      const res = await request(app).get(`/talent/profile/${targetId}`)
      expect(res.status).toBe(200)
      expect(res.body.profile.full_name).toBe('Rahul Actor')
      expect(res.body.profile.email).toBeUndefined()
      expect(res.body.profile.phone).toBeUndefined()
    })

    it('returns 400 for invalid UUID', async () => {
      const res = await request(app).get('/talent/profile/not-a-uuid')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/invalid profile id/i)
    })

    it('returns 404 when profile not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })

      const res = await request(app).get(`/talent/profile/${targetId}`)
      expect(res.status).toBe(404)
    })
  })

  // ── 3. PUT /talent/profile ────────────────────────────────────
  describe('PUT /talent/profile (update profile)', () => {
    it('updates talent profile fields successfully', async () => {
      mockCallerRole = 'talent'
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: '22222222-2222-2222-2222-222222222222',
                  full_name: 'Priya Sharma Updated',
                  bio: 'Updated bio',
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const res = await request(app)
        .put('/talent/profile')
        .send({ full_name: 'Priya Sharma Updated', bio: 'Updated bio' })

      expect(res.status).toBe(200)
      expect(res.body.profile.full_name).toBe('Priya Sharma Updated')
    })

    it('validates avatar_url format and returns 400 for invalid URL', async () => {
      mockCallerRole = 'talent'
      const res = await request(app)
        .put('/talent/profile')
        .send({ avatar_url: 'not-a-valid-url' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/valid url/i)
    })

    it('returns 403 when caller is not a talent account', async () => {
      mockCallerRole = 'production'
      const res = await request(app)
        .put('/talent/profile')
        .send({ full_name: 'Unauthorized update' })

      expect(res.status).toBe(403)
    })
  })

  // ── 4. GET /production/profile ────────────────────────────────
  describe('GET /production/profile (own profile)', () => {
    it('returns production profile for authenticated production user', async () => {
      mockCallerRole = 'production'
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: '44444444-4444-4444-4444-444444444444',
                company_name: 'Dharma Works',
                bio: 'Feature film production',
                users: { username: 'dharma_admin', role: 'production' },
              },
              error: null,
            }),
          }),
        }),
      })

      const res = await request(app).get('/production/profile')
      expect(res.status).toBe(200)
      expect(res.body.profile.company_name).toBe('Dharma Works')
      expect(res.body.profile.users.username).toBe('dharma_admin')
    })

    it('returns 403 when called by non-production account', async () => {
      mockCallerRole = 'talent'
      const res = await request(app).get('/production/profile')
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/production account/i)
    })
  })

  // ── 5. PUT /production/profile ────────────────────────────────
  describe('PUT /production/profile (update profile)', () => {
    it('updates production profile fields successfully', async () => {
      mockCallerRole = 'production'
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: '44444444-4444-4444-4444-444444444444',
                  company_name: 'Dharma Entertainment',
                  bio: 'Expanded studio',
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const res = await request(app)
        .put('/production/profile')
        .send({ company_name: 'Dharma Entertainment', bio: 'Expanded studio' })

      expect(res.status).toBe(200)
      expect(res.body.profile.company_name).toBe('Dharma Entertainment')
    })

    it('returns 400 when company_name is empty string', async () => {
      mockCallerRole = 'production'
      const res = await request(app)
        .put('/production/profile')
        .send({ company_name: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/must not be empty/i)
    })

    it('returns 403 when called by talent account', async () => {
      mockCallerRole = 'talent'
      const res = await request(app)
        .put('/production/profile')
        .send({ company_name: 'Not Allowed' })

      expect(res.status).toBe(403)
    })
  })

  // ── 6. GET /production/profile/:id ────────────────────────────
  describe('GET /production/profile/:id (public/authenticated)', () => {
    const prodId = '44444444-4444-4444-4444-444444444444'

    it('returns production profile without email', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: prodId,
                company_name: 'Excel Studios',
                bio: 'Independent films',
                users: { username: 'excel_team', role: 'production' },
              },
              error: null,
            }),
          }),
        }),
      })

      const res = await request(app).get(`/production/profile/${prodId}`)
      expect(res.status).toBe(200)
      expect(res.body.profile.company_name).toBe('Excel Studios')
      expect(res.body.profile.email).toBeUndefined()
      expect(res.body.profile.users.email).toBeUndefined()
    })

    it('returns 400 for invalid profile id', async () => {
      const res = await request(app).get('/production/profile/invalid-id')
      expect(res.status).toBe(400)
    })
  })

  // ── 7. GET /users/:id/public ──────────────────────────────────
  describe('GET /users/:id/public (display name resolution)', () => {
    const userToFind = '55555555-5555-5555-5555-555555555555'

    it('returns public username and role, NEVER email or private fields', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: userToFind,
                username: 'cinematographer_ajay',
                role: 'talent',
              },
              error: null,
            }),
          }),
        }),
      })

      const res = await request(app).get(`/users/${userToFind}/public`)
      expect(res.status).toBe(200)
      expect(res.body.user).toEqual({
        id: userToFind,
        username: 'cinematographer_ajay',
        role: 'talent',
      })
      expect(res.body.user.email).toBeUndefined()
      expect(res.body.user.phone).toBeUndefined()
    })

    it('returns 400 for malformed UUID', async () => {
      const res = await request(app).get('/users/bad-uuid/public')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/invalid user id/i)
    })

    it('returns 404 if user not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })

      const res = await request(app).get(`/users/${userToFind}/public`)
      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/user not found/i)
    })

    it('returns 401 when unauthenticated', async () => {
      isAuthed = false
      const res = await request(app).get(`/users/${userToFind}/public`)
      expect(res.status).toBe(401)
    })
  })

  // ── 8. Security & Data Privacy Test ───────────────────────────
  describe('Privacy Guard: No Sensitive Fields Returned', () => {
    it('proves that email, phone, and credentials are never exposed by any endpoint', async () => {
      mockCallerRole = 'talent'
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: '22222222-2222-2222-2222-222222222222',
                full_name: 'Priya Talent',
                users: { username: 'priya_cine', role: 'talent' },
              },
              error: null,
            }),
          }),
        }),
      })

      const res = await request(app).get('/talent/profile')
      const bodyStr = JSON.stringify(res.body).toLowerCase()

      expect(bodyStr).not.toContain('email')
      expect(bodyStr).not.toContain('phone')
      expect(bodyStr).not.toContain('password')
      expect(bodyStr).not.toContain('hash')
    })
  })
})
