import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'
import { messagesRouter } from '../../routes/messages'
import { conversationsRouter } from '../../routes/conversations'
import { blocksRouter } from '../../routes/blocks'
import { reportsRouter } from '../../routes/reports'
import { adminRouter } from '../../routes/admin'
import { errorHandler } from '../../middleware/errorHandler'

// ── Test User IDs ─────────────────────────────────────────────
const PRODUCTION_USER_ID = '11111111-1111-4111-a111-111111111111'
const TALENT_USER_ID = '22222222-2222-4222-a222-222222222222'
const OTHER_TALENT_ID = '33333333-3333-4333-a333-333333333333'
const OTHER_PROD_ID = '44444444-4444-4444-a444-444444444444'
const ADMIN_USER_ID = '55555555-5555-4555-a555-555555555555'

let currentCaller = {
  userId: PRODUCTION_USER_ID,
  role: 'production' as 'production' | 'talent',
  isAdmin: false,
  profileId: 'pp-1',
  productionProfileId: 'pp-1' as string | null,
  talentProfileId: null as string | null,
}

// ── Mock DB state ─────────────────────────────────────────────
let mockBlocks: Array<{ blocker_id: string; blocked_id: string }> = []
let mockApplications: Array<{ talent_profile_id: string; production_id: string }> = []
let mockMessages: Array<{
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read: boolean
  created_at: string
}> = []
let mockReports: Array<{
  id: string
  reporter_id: string
  target_user_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  resolved_by?: string | null
  resolved_at?: string | null
  resolution_notes?: string | null
}> = []

// ── Mock Supabase ─────────────────────────────────────────────
vi.mock('../../db/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'admins') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => ({
                data: val === ADMIN_USER_ID ? { user_id: ADMIN_USER_ID } : null,
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'users') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                const role =
                  val === PRODUCTION_USER_ID || val === OTHER_PROD_ID
                    ? 'production'
                    : val === ADMIN_USER_ID
                    ? 'admin'
                    : 'talent'
                return {
                  data: { id: val, username: `user_${val.slice(0, 4)}`, role, suspended_at: null },
                  error: null,
                }
              },
              maybeSingle: async () => {
                const role =
                  val === PRODUCTION_USER_ID || val === OTHER_PROD_ID
                    ? 'production'
                    : val === ADMIN_USER_ID
                    ? 'admin'
                    : 'talent'
                return {
                  data: { id: val, username: `user_${val.slice(0, 4)}`, role, suspended_at: null },
                  error: null,
                }
              },
            }),
            in: (_col: string, vals: string[]) => ({
              then: (resolve: any) =>
                resolve({
                  data: vals.map((v) => ({
                    id: v,
                    username: `user_${v.slice(0, 4)}`,
                    role: v === PRODUCTION_USER_ID ? 'production' : 'talent',
                  })),
                  error: null,
                }),
            }),
          }),
        }
      }

      if (table === 'talent_profiles') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => ({
                data: { id: `tp-${val.slice(0, 4)}`, user_id: val },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'production_profiles') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => ({
                data: { id: `pp-${val.slice(0, 4)}`, user_id: val },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'user_blocks') {
        return {
          select: () => ({
            or: (_filter: string) => {
              return {
                then: (resolve: any) => resolve({ data: mockBlocks, error: null }),
                order: () => ({
                  then: (resolve: any) => resolve({ data: mockBlocks, error: null }),
                }),
              }
            },
            eq: (_col: string, val: string) => ({
              order: () => ({
                then: (resolve: any) =>
                  resolve({
                    data: mockBlocks.filter((b) => b.blocker_id === val),
                    error: null,
                  }),
              }),
            }),
          }),
          insert: (item: any) => ({
            select: () => ({
              single: async () => {
                mockBlocks.push(item)
                return { data: { ...item, created_at: new Date().toISOString() }, error: null }
              },
            }),
          }),
          delete: () => ({
            eq: (_col1: string, val1: string) => ({
              eq: async (_col2: string, val2: string) => {
                mockBlocks = mockBlocks.filter(
                  (b) => !(b.blocker_id === val1 && b.blocked_id === val2)
                )
                return { error: null }
              },
            }),
          }),
        }
      }

      if (table === 'applications') {
        return {
          select: () => ({
            eq: (_col1: string, tpId: string) => ({
              eq: (_col2: string, ppId: string) => ({
                limit: () => ({
                  then: (resolve: any) => {
                    const match = mockApplications.filter(
                      (a) => a.talent_profile_id === tpId && a.production_id === ppId
                    )
                    resolve({ data: match, error: null })
                  },
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'messages') {
        return {
          select: () => ({
            eq: (_col1: string, sId: string) => ({
              eq: (_col2: string, rId: string) => ({
                limit: () => ({
                  then: (resolve: any) => {
                    const found = mockMessages.filter(
                      (m) => m.sender_id === sId && m.recipient_id === rId
                    )
                    resolve({ data: found, error: null })
                  },
                }),
              }),
            }),
            or: (_filter: string) => ({
              order: () => ({
                limit: (lim: number) => ({
                  then: (resolve: any) => resolve({ data: mockMessages.slice(0, lim), error: null }),
                }),
                then: (resolve: any) => resolve({ data: mockMessages, error: null }),
              }),
            }),
          }),
          insert: (item: any) => ({
            select: () => ({
              single: async () => {
                const newMsg = {
                  id: `msg-${Date.now()}`,
                  ...item,
                  created_at: new Date().toISOString(),
                }
                mockMessages.push(newMsg)
                return { data: newMsg, error: null }
              },
            }),
          }),
          update: (fields: any) => ({
            eq: (_col1: string, val1: string) => ({
              eq: (_col2: string, val2: string) => ({
                eq: (_col3: string, val3: any) => ({
                  select: () => ({
                    then: (resolve: any) => {
                      let updated = 0
                      mockMessages.forEach((m) => {
                        if (
                          m.sender_id === val1 &&
                          m.recipient_id === val2 &&
                          m.read === val3
                        ) {
                          Object.assign(m, fields)
                          updated++
                        }
                      })
                      resolve({ data: Array(updated).fill({ id: 'msg-upd' }), error: null })
                    },
                  }),
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'chat_reports') {
        return {
          select: () => ({
            order: () => ({
              range: (from: number, to: number) => ({
                then: (resolve: any) =>
                  resolve({
                    data: mockReports.slice(from, to + 1),
                    count: mockReports.length,
                    error: null,
                  }),
              }),
            }),
            eq: () => ({
              order: () => ({
                range: (from: number, to: number) => ({
                  then: (resolve: any) =>
                    resolve({
                      data: mockReports.slice(from, to + 1),
                      count: mockReports.length,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
          insert: (item: any) => ({
            select: () => ({
              single: async () => {
                const rep = {
                  id: `rep-${Date.now()}`,
                  ...item,
                  created_at: new Date().toISOString(),
                }
                mockReports.push(rep)
                return { data: rep, error: null }
              },
            }),
          }),
          update: (fields: any) => ({
            eq: (_col: string, val: string) => ({
              select: () => ({
                single: async () => {
                  const rep = mockReports.find((r) => r.id === val)
                  if (rep) Object.assign(rep, fields)
                  return { data: rep, error: null }
                },
              }),
            }),
          }),
        }
      }

      if (table === 'audit_log') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: 'audit-1', created_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        }
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
  },
}))

// ── Mock Auth Middleware ──────────────────────────────────────
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    ;(req as any).user = { id: currentCaller.userId }
    next()
  },
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: (req: Request, _res: Response, next: NextFunction) => {
    req.caller = {
      userId: currentCaller.userId,
      role: currentCaller.role,
      isAdmin: currentCaller.isAdmin,
      profileId: currentCaller.profileId,
      productionProfileId: currentCaller.productionProfileId,
      talentProfileId: currentCaller.talentProfileId,
    }
    next()
  },
}))

const app = express()
app.use(express.json())
app.use('/messages', messagesRouter)
app.use('/conversations', conversationsRouter)
app.use('/blocks', blocksRouter)
app.use('/reports', reportsRouter)
app.use('/admin', adminRouter)
app.use(errorHandler)

describe('Milestone M4: Chat Safety & Messaging Rules Suite', () => {
  beforeEach(() => {
    mockBlocks = []
    mockApplications = []
    mockMessages = []
    mockReports = []
    currentCaller = {
      userId: PRODUCTION_USER_ID,
      role: 'production',
      isAdmin: false,
      profileId: 'pp-1',
      productionProfileId: 'pp-1',
      talentProfileId: null,
    }
  })

  // ── 1. Full Permission Matrix ─────────────────────────────────
  describe('1. Messaging Permission Matrix', () => {
    it('production may message talent who applied to one of their jobs', async () => {
      mockApplications.push({
        talent_profile_id: `tp-${TALENT_USER_ID.slice(0, 4)}`,
        production_id: 'pp-1',
      })

      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: TALENT_USER_ID, body: 'We liked your audition reel!' })

      expect(res.status).toBe(201)
      expect(res.body.message.body).toBe('We liked your audition reel!')
    })

    it('production may message talent found through search (non-applicant)', async () => {
      // No application exists
      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: TALENT_USER_ID, body: 'Found your profile via search!' })

      expect(res.status).toBe(201)
      expect(res.body.message.body).toBe('Found your profile via search!')
    })

    it('production cannot message another production company', async () => {
      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: OTHER_PROD_ID, body: 'Collab inquiry' })

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Production users may only message talent accounts')
    })

    it('talent to production without application and without prior message is rejected (403)', async () => {
      currentCaller = {
        userId: TALENT_USER_ID,
        role: 'talent',
        isAdmin: false,
        profileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
        productionProfileId: null,
        talentProfileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
      }

      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: PRODUCTION_USER_ID, body: 'Can I audition?' })

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Talent may message a production user only if they have an application')
    })

    it('talent to production with existing application is permitted (201)', async () => {
      currentCaller = {
        userId: TALENT_USER_ID,
        role: 'talent',
        isAdmin: false,
        profileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
        productionProfileId: null,
        talentProfileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
      }
      mockApplications.push({
        talent_profile_id: `tp-${TALENT_USER_ID.slice(0, 4)}`,
        production_id: `pp-${PRODUCTION_USER_ID.slice(0, 4)}`,
      })

      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: PRODUCTION_USER_ID, body: 'Following up on my application.' })

      expect(res.status).toBe(201)
      expect(res.body.message.body).toBe('Following up on my application.')
    })

    it('talent to production after production messaged first is permitted (201)', async () => {
      currentCaller = {
        userId: TALENT_USER_ID,
        role: 'talent',
        isAdmin: false,
        profileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
        productionProfileId: null,
        talentProfileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
      }
      // Production previously messaged talent
      mockMessages.push({
        id: 'msg-prior-1',
        sender_id: PRODUCTION_USER_ID,
        recipient_id: TALENT_USER_ID,
        body: 'Hello from casting!',
        read: true,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      })

      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: PRODUCTION_USER_ID, body: 'Thanks for reaching out!' })

      expect(res.status).toBe(201)
      expect(res.body.message.body).toBe('Thanks for reaching out!')
    })

    it('talent cannot message another talent account', async () => {
      currentCaller = {
        userId: TALENT_USER_ID,
        role: 'talent',
        isAdmin: false,
        profileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
        productionProfileId: null,
        talentProfileId: `tp-${TALENT_USER_ID.slice(0, 4)}`,
      }

      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: OTHER_TALENT_ID, body: 'Hey friend' })

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Talent users may only message production accounts')
    })
  })

  // ── 2. Block Enforcement in Both Directions ────────────────────
  describe('2. User Block Enforcement', () => {
    it('blocks messaging if sender has blocked recipient', async () => {
      mockBlocks.push({ blocker_id: PRODUCTION_USER_ID, blocked_id: TALENT_USER_ID })

      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: TALENT_USER_ID, body: 'Unwanted contact' })

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Cannot send message: a block exists between these users')
    })

    it('blocks messaging if recipient has blocked sender', async () => {
      mockBlocks.push({ blocker_id: TALENT_USER_ID, blocked_id: PRODUCTION_USER_ID })

      const res = await request(app)
        .post('/messages')
        .send({ recipient_id: TALENT_USER_ID, body: 'Hello there' })

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Cannot send message: a block exists between these users')
    })

    it('POST /blocks successfully blocks a user', async () => {
      const res = await request(app)
        .post('/blocks')
        .send({ blocked_id: TALENT_USER_ID })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(mockBlocks.some((b) => b.blocked_id === TALENT_USER_ID)).toBe(true)
    })

    it('DELETE /blocks/:userId unblocks user', async () => {
      mockBlocks.push({ blocker_id: PRODUCTION_USER_ID, blocked_id: TALENT_USER_ID })

      const res = await request(app).delete(`/blocks/${TALENT_USER_ID}`)
      expect(res.status).toBe(200)
      expect(mockBlocks.length).toBe(0)
    })

    it('GET /blocks lists blocked users', async () => {
      mockBlocks.push({ blocker_id: PRODUCTION_USER_ID, blocked_id: TALENT_USER_ID })

      const res = await request(app).get('/blocks')
      expect(res.status).toBe(200)
      expect(res.body.blocks).toHaveLength(1)
      expect(res.body.blocks[0].blocked_id).toBe(TALENT_USER_ID)
    })
  })

  // ── 3. Content Sanitization & Validation ───────────────────────
  describe('3. Content Sanitization & Validation', () => {
    it('strips HTML tags from message body', async () => {
      const res = await request(app)
        .post('/messages')
        .send({
          recipient_id: TALENT_USER_ID,
          body: '<script>alert("xss")</script> <b>Great</b> show! <img src="x" onerror="evil()" />',
        })

      expect(res.status).toBe(201)
      expect(res.body.message.body).toBe('alert("xss") Great show!')
    })

    it('rejects empty message body after stripping HTML (400)', async () => {
      const res = await request(app)
        .post('/messages')
        .send({
          recipient_id: TALENT_USER_ID,
          body: '   <div>  </div>   ',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Message body cannot be empty')
    })

    it('rejects message body exceeding 2000 characters (400)', async () => {
      const longBody = 'A'.repeat(2001)
      const res = await request(app)
        .post('/messages')
        .send({
          recipient_id: TALENT_USER_ID,
          body: longBody,
        })

      expect(res.status).toBe(400)
    })

    it('enforces 20 messages per minute rate limit and isolates across users', async () => {
      // Use dedicated user ID so other tests are not affected
      const RATE_TEST_USER_ID = '99999999-9999-4999-a999-999999999999'
      currentCaller = {
        userId: RATE_TEST_USER_ID,
        role: 'production',
        isAdmin: false,
        profileId: 'pp-rate',
        productionProfileId: 'pp-rate',
        talentProfileId: null,
      }

      // First 20 messages should succeed
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post('/messages')
          .send({
            recipient_id: TALENT_USER_ID,
            body: `Hello message ${i + 1}`,
          })
        expect(res.status).toBe(201)
      }

      // 21st message must be blocked with 429
      const limitedRes = await request(app)
        .post('/messages')
        .send({
          recipient_id: TALENT_USER_ID,
          body: 'Hello message 21 - should be blocked',
        })

      expect(limitedRes.status).toBe(429)
      expect(limitedRes.body.error).toContain('Message rate limit exceeded')
    })
  })

  // ── 4. Cursor Pagination & Read Tracking ───────────────────────
  describe('4. Threads, Pagination & Read State', () => {
    it('GET /messages/:otherUserId returns cursor paginated messages and permission status', async () => {
      mockMessages.push({
        id: 'msg-1',
        sender_id: PRODUCTION_USER_ID,
        recipient_id: TALENT_USER_ID,
        body: 'Message 1',
        read: false,
        created_at: new Date().toISOString(),
      })

      const res = await request(app).get(`/messages/${TALENT_USER_ID}`)
      expect(res.status).toBe(200)
      expect(res.body.messages).toHaveLength(1)
      expect(res.body.can_message).toBe(true)
      expect(res.body.is_blocked).toBe(false)
    })

    it('PUT /messages/read marks messages from peer as read', async () => {
      mockMessages.push({
        id: 'msg-unread',
        sender_id: TALENT_USER_ID,
        recipient_id: PRODUCTION_USER_ID,
        body: 'Unread note',
        read: false,
        created_at: new Date().toISOString(),
      })

      const res = await request(app)
        .put('/messages/read')
        .send({ other_user_id: TALENT_USER_ID })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('GET /conversations returns list with unread badges and peer details', async () => {
      mockMessages.push({
        id: 'msg-conv',
        sender_id: TALENT_USER_ID,
        recipient_id: PRODUCTION_USER_ID,
        body: 'Hello Producer',
        read: false,
        created_at: new Date().toISOString(),
      })

      const res = await request(app).get('/conversations')
      expect(res.status).toBe(200)
      expect(res.body.conversations).toBeDefined()
    })
  })

  // ── 5. Chat Reports & Admin Review ─────────────────────────────
  describe('5. Chat Reports & Admin Review', () => {
    it('POST /reports submits a safety report', async () => {
      const res = await request(app)
        .post('/reports')
        .send({
          target_user_id: TALENT_USER_ID,
          reason: 'harassment',
          details: 'Unprofessional behavior in conversation',
        })

      expect(res.status).toBe(201)
      expect(res.body.report.reason).toBe('harassment')
      expect(res.body.report.status).toBe('open')
    })

    it('POST /reports rejects self-reporting (400)', async () => {
      const res = await request(app)
        .post('/reports')
        .send({
          target_user_id: PRODUCTION_USER_ID,
          reason: 'spam',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Cannot report yourself')
    })

    it('admin can list reports via GET /admin/reports', async () => {
      currentCaller = {
        userId: ADMIN_USER_ID,
        role: 'production',
        isAdmin: true,
        profileId: 'admin-1',
        productionProfileId: null,
        talentProfileId: null,
      }
      mockReports.push({
        id: 'rep-1',
        reporter_id: PRODUCTION_USER_ID,
        target_user_id: TALENT_USER_ID,
        reason: 'spam',
        details: 'Bulk automated messaging',
        status: 'open',
        created_at: new Date().toISOString(),
      })

      const res = await request(app).get('/admin/reports')
      expect(res.status).toBe(200)
      expect(res.body.reports).toHaveLength(1)
    })

    it('admin can update report status via PUT /admin/reports/:id with audit trail', async () => {
      currentCaller = {
        userId: ADMIN_USER_ID,
        role: 'production',
        isAdmin: true,
        profileId: 'admin-1',
        productionProfileId: null,
        talentProfileId: null,
      }
      mockReports.push({
        id: 'rep-10',
        reporter_id: PRODUCTION_USER_ID,
        target_user_id: TALENT_USER_ID,
        reason: 'scam',
        details: 'Fake job post link',
        status: 'open',
        created_at: new Date().toISOString(),
      })

      const res = await request(app)
        .put('/admin/reports/rep-10')
        .send({
          status: 'actioned',
          resolution_notes: 'User suspended by admin',
        })

      expect(res.status).toBe(200)
      expect(res.body.report.status).toBe('actioned')
      expect(res.body.report.resolution_notes).toBe('User suspended by admin')
    })
  })

  // ── 6. Migration 021 Verification ──────────────────────────────
  describe('6. Migration 021 RLS Verification', () => {
    it('migration 021 file revokes INSERT, UPDATE, DELETE on messages from authenticated and drops policies', () => {
      const migPath = path.resolve(
        __dirname,
        '../../../../supabase/migrations/021_revoke_message_insert.sql'
      )
      expect(fs.existsSync(migPath)).toBe(true)
      const content = fs.readFileSync(migPath, 'utf-8')

      // Verifies write privileges revoked
      expect(content).toContain('REVOKE INSERT, UPDATE, DELETE ON public.messages FROM anon, authenticated;')
      // Verifies sender insert policy dropped
      expect(content).toContain('DROP POLICY IF EXISTS "messages: sender insert" ON public.messages;')
      // Verifies recipient update policy dropped
      expect(content).toContain('DROP POLICY IF EXISTS "messages: recipient update" ON public.messages;')
      // Verifies select policy retained for Realtime
      expect(content).toContain('GRANT SELECT ON public.messages TO authenticated;')
      expect(content).toContain('CREATE POLICY "messages: participant read"')
    })
  })
})
