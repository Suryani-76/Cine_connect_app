import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { talentAlertsRouter } from '../../routes/talentAlerts'
import { errorHandler } from '../../middleware/errorHandler'
import { supabase } from '../../db/supabase'

let mockCaller: {
  userId: string
  role: 'production' | 'talent'
  productionProfileId: string | null
  talentProfileId: string | null
  profileId: string
} | null = {
  userId: 'prod-user-1',
  role: 'production',
  productionProfileId: 'prod-profile-1',
  talentProfileId: null,
  profileId: 'prod-profile-1',
}

vi.mock('../../db/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: vi.fn((req: { caller?: unknown }, _res: unknown, next: () => void) => {
    req.caller = mockCaller
    next()
  }),
  requireRole: (role: string) => (req: { caller?: { role: string } }, res: any, next: () => void) => {
    if (req.caller?.role !== role) {
      res.status(403).json({ error: `This action requires a ${role} account` })
      return
    }
    next()
  },
}))

const app = express()
app.use(express.json())
app.use('/talent-alerts', talentAlertsRouter)
app.use(errorHandler)

describe('Talent Alerts Controller & PATCH Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCaller = {
      userId: 'prod-user-1',
      role: 'production',
      productionProfileId: 'prod-profile-1',
      talentProfileId: null,
      profileId: 'prod-profile-1',
    }
  })

  describe('GET /talent-alerts', () => {
    it('returns production alerts', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'alert-1', user_id: 'prod-user-1', label: 'Senior Editors', active: true },
            ],
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const res = await request(app).get('/talent-alerts')
      expect(res.status).toBe(200)
      expect(res.body.alerts).toHaveLength(1)
      expect(res.body.alerts[0].label).toBe('Senior Editors')
    })

    it('returns 403 when called by non-production user', async () => {
      mockCaller = {
        userId: 'talent-user-1',
        role: 'talent',
        productionProfileId: null,
        talentProfileId: 'talent-profile-1',
        profileId: 'talent-profile-1',
      }

      const res = await request(app).get('/talent-alerts')
      expect(res.status).toBe(403)
      expect(res.body.error).toContain('requires a production account')
    })
  })

  describe('POST /talent-alerts', () => {
    it('creates alert with valid fields', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'alert-2', label: 'Colorists', active: true, user_id: 'prod-user-1' },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

      const res = await request(app)
        .post('/talent-alerts')
        .send({ label: 'Colorists', role: 'Colorist', skills: ['DaVinci Resolve'] })

      expect(res.status).toBe(201)
      expect(res.body.alert.label).toBe('Colorists')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Colorists',
          user_id: 'prod-user-1',
          active: true,
        })
      )
    })

    it('returns 400 when label is missing', async () => {
      const res = await request(app)
        .post('/talent-alerts')
        .send({ role: 'Colorist' })

      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /talent-alerts/:id', () => {
    it('toggles alert active state successfully', async () => {
      // 1. Ownership check lookup
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'prod-user-1' },
            error: null,
          }),
        }),
      })

      // 2. Update call
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'alert-1', label: 'Senior Editors', active: false },
              error: null,
            }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      } as any)

      const res = await request(app)
        .patch('/talent-alerts/alert-1')
        .send({ active: false })

      expect(res.status).toBe(200)
      expect(res.body.alert.active).toBe(false)
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ active: false }))
    })

    it('returns 404 when alert belongs to another user', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'other-user-999' },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const res = await request(app)
        .patch('/talent-alerts/alert-other')
        .send({ active: false })

      expect(res.status).toBe(404)
      expect(res.body.error).toContain('Alert not found')
    })
  })

  describe('DELETE /talent-alerts/:id', () => {
    it('deletes own alert', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'prod-user-1' },
            error: null,
          }),
        }),
      })

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        delete: mockDelete,
      } as any)

      const res = await request(app).delete('/talent-alerts/alert-1')
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })
  })
})
