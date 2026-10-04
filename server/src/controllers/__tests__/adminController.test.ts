import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { adminRouter } from '../../routes/admin'
import { errorHandler } from '../../middleware/errorHandler'

let mockAuditInserts: any[] = []
let mockIsAdmin = false

vi.mock('../../db/supabase', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'admins') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((_col: string, val: string) => ({
              maybeSingle: vi.fn().mockImplementation(() => {
                // Only caller is admin if mockIsAdmin is true, never target user
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
              mockAuditInserts.push(payload)
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 'audit-id', ...payload }, error: null }),
                }),
                then: (resolve: any) => resolve({ data: { id: 'audit-id', ...payload }, error: null }),
              }
            }),
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [{ id: 'audit-1', action: 'test', created_at: new Date().toISOString() }],
                  count: 1,
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'test-target-user', email: 'target@example.com', username: 'target_user' },
                  error: null,
                }),
              }),
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [{ id: 'user-1', email: 'u1@example.com', username: 'u1', role: 'talent' }],
                  count: 1,
                  error: null,
                }),
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
                  data: { id: 'test-prod-id', company_name: 'Test Productions', user_id: 'user-1' },
                  error: null,
                }),
              }),
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [{ id: 'prod-1', company_name: 'Prod 1', verified: false }],
                  count: 1,
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
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

        // Generic fallback
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

vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((req: unknown, _res: unknown, next: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(req as any).user = { id: 'test-caller-id', email: 'caller@example.com' }
    next()
  }),
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.caller = {
      userId: 'test-caller-id',
      role: 'production',
      isAdmin: mockIsAdmin,
      profileId: 'caller-prof',
      productionProfileId: 'caller-prof',
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
    mockIsAdmin = false
    mockAuditInserts = []
  })

  it('rejects access with 403 when user is not an administrator', async () => {
    mockIsAdmin = false
    const res = await request(app).get('/admin/match-config')
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/Admin access required/)
  })

  it('allows access when user is verified in admins table (isAdmin = true)', async () => {
    mockIsAdmin = true
    const res = await request(app).get('/admin/match-config')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('weights')
  })

  it('rejects PUT /admin/match-config if weights do not sum to 100', async () => {
    mockIsAdmin = true
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

  it('updates match weights successfully and writes to audit_log', async () => {
    mockIsAdmin = true
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
    expect(res.body).toHaveProperty('weights')

    const auditRecord = mockAuditInserts.find((r) => r.action === 'update_match_config')
    expect(auditRecord).toBeDefined()
    expect(auditRecord.target_type).toBe('match_config')
  })

  it('triggers recompute queue processing and writes to audit_log', async () => {
    mockIsAdmin = true
    const res = await request(app)
      .post('/admin/recompute/process?batch_size=10')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('processedQueueItems')

    const auditRecord = mockAuditInserts.find((r) => r.action === 'process_recompute_queue')
    expect(auditRecord).toBeDefined()
  })

  it('suspends user and records audit row', async () => {
    mockIsAdmin = true
    const res = await request(app)
      .put('/admin/users/test-target-user/suspend')
      .send({ reason: 'Violated terms' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/suspended/i)

    const auditRecord = mockAuditInserts.find((r) => r.action === 'suspend_user')
    expect(auditRecord).toBeDefined()
    expect(auditRecord.target_id).toBe('test-target-user')
  })

  it('unsuspends user and records audit row', async () => {
    mockIsAdmin = true
    const res = await request(app)
      .put('/admin/users/test-target-user/unsuspend')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/revoked/i)

    const auditRecord = mockAuditInserts.find((r) => r.action === 'unsuspend_user')
    expect(auditRecord).toBeDefined()
    expect(auditRecord.target_id).toBe('test-target-user')
  })

  it('verifies production profile and records audit row', async () => {
    mockIsAdmin = true
    const res = await request(app)
      .put('/admin/production/test-prod-id/verify')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const auditRecord = mockAuditInserts.find((r) => r.action === 'verify_production')
    expect(auditRecord).toBeDefined()
    expect(auditRecord.target_id).toBe('test-prod-id')
  })

  it('unverifies production profile and records audit row', async () => {
    mockIsAdmin = true
    const res = await request(app)
      .put('/admin/production/test-prod-id/unverify')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const auditRecord = mockAuditInserts.find((r) => r.action === 'unverify_production')
    expect(auditRecord).toBeDefined()
    expect(auditRecord.target_id).toBe('test-prod-id')
  })

  it('returns paginated audit logs', async () => {
    mockIsAdmin = true
    const res = await request(app).get('/admin/audit-log?page=1&limit=10')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('items')
    expect(res.body).toHaveProperty('total')
  })
})
