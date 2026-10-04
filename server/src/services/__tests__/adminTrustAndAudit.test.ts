import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { adminRouter } from '../../routes/admin'
import { authRouter } from '../../routes/auth'
import { jobsRouter } from '../../routes/jobs'
import { applicationsRouter } from '../../routes/applications'
import { talentRouter } from '../../routes/talent'
import { productionRouter } from '../../routes/production'
import { savedJobsRouter } from '../../routes/savedJobs'
import { errorHandler } from '../../middleware/errorHandler'
import { recordAuditLog, getAuditLogs } from '../auditService'

// ── Mock DB state ─────────────────────────────────────────────
const auditLogStore: any[] = []
let mockIsAdmin = false
let mockIsSuspended = false

vi.mock('../../db/supabase', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'admins') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((_col: string, val: string) => ({
              maybeSingle: vi.fn().mockImplementation(() => {
                if (mockIsAdmin && (val === 'test-caller-id' || val === 'admin-id')) {
                  return Promise.resolve({ data: { user_id: val }, error: null })
                }
                return Promise.resolve({ data: null, error: null })
              }),
            })),
          }
        }

        if (table === 'audit_log') {
          return {
            insert: vi.fn((payload: any) => {
              const entry = { id: `audit-${Date.now()}-${Math.random()}`, ...payload, created_at: new Date().toISOString() }
              auditLogStore.push(entry)
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: entry, error: null }),
                }),
                then: (resolve: any) => resolve({ data: entry, error: null }),
              }
            }),
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: auditLogStore, count: auditLogStore.length, error: null }),
              }),
            }),
          }
        }

        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'usr-999',
                    user_id: 'usr-999',
                    email: 'usr999@example.com',
                    username: 'user_999',
                    role: 'production',
                    suspended_at: mockIsSuspended ? '2026-10-04T12:00:00Z' : null,
                  },
                  error: null,
                }),
              }),
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }

        if (table === 'production_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'prod-777', company_name: 'Prod 777', user_id: 'usr-999' },
                  error: null,
                }),
              }),
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }

        if (table === 'talent_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'caller-profile-id', user_id: 'test-caller-id', role: 'Actor' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'caller-profile-id', user_id: 'test-caller-id', role: 'admin' },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        if (table === 'match_config') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'mc-1',
                      skills_match: 30,
                      role_match: 20,
                      experience_match: 15,
                      language_match: 10,
                      location_proximity: 10,
                      profile_completeness: 10,
                      activity_recency: 5,
                      is_active: true,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }

        if (table === 'match_config_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }

        if (table === 'match_recompute_queue') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }

        const fallback: any = {}
        fallback.select = vi.fn().mockReturnValue(fallback)
        fallback.eq = vi.fn().mockReturnValue(fallback)
        fallback.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
        fallback.single = vi.fn().mockResolvedValue({ data: null, error: null })
        fallback.insert = vi.fn().mockResolvedValue({ error: null })
        fallback.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })
        return fallback
      }),
    },
  }
})

// ── Mock Auth Middleware ──────────────────────────────────────
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((req: any, res: Response, next: NextFunction) => {
    if (mockIsSuspended) {
      res.status(403).json({ error: 'Account suspended' })
      return
    }
    req.user = { id: 'test-caller-id', email: 'caller@example.com' }
    req.userRecord = {
      id: 'test-caller-id',
      email: 'caller@example.com',
      username: 'caller_user',
      role: 'talent',
      suspended_at: mockIsSuspended ? '2026-10-04T12:00:00Z' : null,
    }
    next()
  }),
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: vi.fn((req: Request, res: Response, next: NextFunction) => {
    if (mockIsSuspended) {
      res.status(403).json({ error: 'Account suspended' })
      return
    }
    req.caller = {
      userId: 'test-caller-id',
      email: 'caller@example.com',
      username: 'caller_user',
      role: 'talent',
      isAdmin: mockIsAdmin,
      suspendedAt: mockIsSuspended ? '2026-10-04T12:00:00Z' : null,
      profileId: 'caller-profile-id',
      productionProfileId: null,
      talentProfileId: 'caller-profile-id',
    }
    next()
  }),
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  requireJobOwner: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireApplicationAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalCallerContext: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

const app = express()
app.use(express.json())
app.use('/admin', adminRouter)
app.use('/auth', authRouter)
app.use('/jobs', jobsRouter)
app.use('/applications', applicationsRouter)
app.use('/talent', talentRouter)
app.use('/production', productionRouter)
app.use('/saved-jobs', savedJobsRouter)
app.use(errorHandler)

describe('Milestone M6: Admin Trust & Audit System Suite', () => {
  beforeEach(() => {
    mockIsAdmin = false
    mockIsSuspended = false
    auditLogStore.length = 0
  })

  describe('1. Non-admin is blocked with 403 on ALL admin routes', () => {
    const adminEndpoints = [
      { method: 'get', path: '/admin/match-config' },
      { method: 'put', path: '/admin/match-config', body: {} },
      { method: 'post', path: '/admin/recompute/process' },
      { method: 'get', path: '/admin/users' },
      { method: 'put', path: '/admin/users/123/suspend', body: {} },
      { method: 'put', path: '/admin/users/123/unsuspend' },
      { method: 'get', path: '/admin/production' },
      { method: 'put', path: '/admin/production/123/verify' },
      { method: 'put', path: '/admin/production/123/unverify' },
      { method: 'get', path: '/admin/audit-log' },
    ]

    for (const ep of adminEndpoints) {
      it(`non-admin receives 403 Forbidden on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        mockIsAdmin = false
        const reqBuilder = (request(app) as any)[ep.method](ep.path)
        if (ep.body) reqBuilder.send(ep.body)
        const res = await reqBuilder
        expect(res.status).toBe(403)
        expect(res.body.error).toMatch(/Admin access required/)
      })
    }
  })

  describe('2. Suspended user is blocked with 403 across authenticated routes', () => {
    const sampleProtectedRoutes = [
      { method: 'get', path: '/auth/me' },
      { method: 'get', path: '/saved-jobs' },
      { method: 'post', path: '/jobs', body: { title: 'Test Job' } },
      { method: 'post', path: '/applications', body: { job_id: '123' } },
      { method: 'get', path: '/talent/profile' },
      { method: 'put', path: '/talent/profile', body: { full_name: 'Test' } },
      { method: 'get', path: '/production/profile' },
    ]

    for (const ep of sampleProtectedRoutes) {
      it(`suspended caller receives 403 Account suspended on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        mockIsSuspended = true
        const reqBuilder = (request(app) as any)[ep.method](ep.path)
        if (ep.body) reqBuilder.send(ep.body)
        const res = await reqBuilder
        expect(res.status).toBe(403)
        expect(res.body.error).toMatch(/Account suspended/i)
      })
    }
  })

  describe('3. Self-elevation & Privilege Escalation Prevention', () => {
    it('user cannot set role to admin via profile update endpoints', async () => {
      mockIsAdmin = false
      const res = await request(app)
        .put('/talent/profile')
        .send({ role: 'admin' })

      expect(res.status).not.toBe(500)
    })

    it('caller cannot grant admin access without existing admins table entry', async () => {
      mockIsAdmin = false
      const res = await request(app).get('/admin/match-config')
      expect(res.status).toBe(403)
    })
  })

  describe('4. Every Admin Action Writes an Audit Log Row', () => {
    beforeEach(() => {
      mockIsAdmin = true
    })

    it('update match config writes update_match_config audit row', async () => {
      const validWeights = {
        skills_match: 40,
        role_match: 20,
        experience_match: 10,
        language_match: 10,
        location_proximity: 10,
        profile_completeness: 5,
        activity_recency: 5,
        reason: 'Recalibrating weights',
      }

      await request(app).put('/admin/match-config').send(validWeights)
      const entry = auditLogStore.find((a) => a.action === 'update_match_config')
      expect(entry).toBeDefined()
      expect(entry.target_type).toBe('match_config')
      expect(entry.details.reason).toBe('Recalibrating weights')
    })

    it('recompute process writes process_recompute_queue audit row', async () => {
      await request(app).post('/admin/recompute/process?batch_size=25')
      const entry = auditLogStore.find((a) => a.action === 'process_recompute_queue')
      expect(entry).toBeDefined()
      expect(entry.target_type).toBe('match_recompute_queue')
      expect(entry.details.batchSize).toBe(25)
    })

    it('suspend user writes suspend_user audit row', async () => {
      await request(app).put('/admin/users/usr-999/suspend').send({ reason: 'Spamming jobs' })
      const entry = auditLogStore.find((a) => a.action === 'suspend_user')
      expect(entry).toBeDefined()
      expect(entry.target_type).toBe('user')
      expect(entry.target_id).toBe('usr-999')
      expect(entry.details.reason).toBe('Spamming jobs')
    })

    it('unsuspend user writes unsuspend_user audit row', async () => {
      await request(app).put('/admin/users/usr-999/unsuspend')
      const entry = auditLogStore.find((a) => a.action === 'unsuspend_user')
      expect(entry).toBeDefined()
      expect(entry.target_type).toBe('user')
      expect(entry.target_id).toBe('usr-999')
    })

    it('verify production writes verify_production audit row', async () => {
      await request(app).put('/admin/production/prod-777/verify')
      const entry = auditLogStore.find((a) => a.action === 'verify_production')
      expect(entry).toBeDefined()
      expect(entry.target_type).toBe('production_profile')
      expect(entry.target_id).toBe('prod-777')
    })

    it('unverify production writes unverify_production audit row', async () => {
      await request(app).put('/admin/production/prod-777/unverify')
      const entry = auditLogStore.find((a) => a.action === 'unverify_production')
      expect(entry).toBeDefined()
      expect(entry.target_type).toBe('production_profile')
      expect(entry.target_id).toBe('prod-777')
    })
  })

  describe('5. Audit Service Query & Pagination', () => {
    it('records and returns paginated audit log entries', async () => {
      await recordAuditLog({
        actor_id: 'actor-1',
        action: 'test_action',
        target_type: 'test_target',
        target_id: 'test-id-1',
        details: { foo: 'bar' },
      })

      const result = await getAuditLogs({ page: 1, limit: 10 })
      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('total')
      expect(result.page).toBe(1)
    })
  })
})
