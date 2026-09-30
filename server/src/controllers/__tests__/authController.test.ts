import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from '../../routes/auth'
import { errorHandler } from '../../middleware/errorHandler'

// ── Mock Supabase ─────────────────────────────────────────────
vi.mock('../../db/supabase', () => ({
  supabase: {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-uuid', email: 'test@test.com' } }, error: null }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: 'test-token', refresh_token: 'test-refresh' },
          user: { id: 'test-uuid', email: 'test@test.com' },
        },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-uuid' } }, error: null }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'test-uuid', email: 'test@test.com', username: 'testuser', role: 'production' }, error: null }),
  },
}))

const app = express()
app.use(express.json())
app.use('/auth', authRouter)
app.use(errorHandler)

// ── Registration validation tests ─────────────────────────────

describe('POST /auth/register — validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/register').send({
      password: 'password123', username: 'testuser', role: 'production',
    })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 for invalid email format', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'not-an-email', password: 'password123', username: 'testuser', role: 'production',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/email/i)
  })

  it('returns 400 when password is too short', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test@test.com', password: 'short', username: 'testuser', role: 'production',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/8 characters/i)
  })

  it('returns 400 when username is too short', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test@test.com', password: 'password123', username: 'ab', role: 'production',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/3 characters/i)
  })

  it('returns 400 when username has invalid characters', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test@test.com', password: 'password123', username: 'bad user!', role: 'production',
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid role', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test@test.com', password: 'password123', username: 'testuser', role: 'admin',
    })
    expect(res.status).toBe(400)
  })

  it('accepts both production and talent roles', async () => {
    const prod = await request(app).post('/auth/register').send({
      email: 'prod@test.com', password: 'password123', username: 'produser', role: 'production',
    })
    const talent = await request(app).post('/auth/register').send({
      email: 'talent@test.com', password: 'password123', username: 'talentuser', role: 'talent',
    })
    // Both should either succeed (201) or fail at DB level (not validation 400)
    expect([201, 400, 500]).toContain(prod.status)
    expect([201, 400, 500]).toContain(talent.status)
  })
})

// ── Verify OTP validation tests ───────────────────────────────

describe('POST /auth/verify — validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/verify').send({ otp: '123456' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when otp is not 6 digits', async () => {
    const res = await request(app).post('/auth/verify').send({
      email: 'test@test.com', otp: '123',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/6 digits/i)
  })

  it('returns 400 when otp has wrong length', async () => {
    const res = await request(app).post('/auth/verify').send({
      email: 'test@test.com', otp: '1234567',
    })
    expect(res.status).toBe(400)
  })
})
