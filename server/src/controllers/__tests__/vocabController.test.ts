import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { vocabRouter } from '../../routes/vocab'
import { errorHandler } from '../../middleware/errorHandler'

vi.mock('../../db/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  },
}))

const app = express()
app.use(express.json())
app.use('/vocab', vocabRouter)
app.use(errorHandler)

describe('Vocab Endpoints', () => {
  describe('GET /vocab/skills', () => {
    it('returns 200 with default seed skills and sets cache headers', async () => {
      const res = await request(app).get('/vocab/skills')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('skills')
      expect(Array.isArray(res.body.skills)).toBe(true)
      expect(res.body.skills.length).toBeGreaterThan(0)
      expect(res.headers['cache-control']).toContain('public')
    })

    it('filters skills with query q', async () => {
      const res = await request(app).get('/vocab/skills?q=cinema')
      expect(res.status).toBe(200)
      expect(res.body.skills.some((s: { name: string }) => s.name.toLowerCase().includes('cinema'))).toBe(true)
    })

    it('respects limit parameter', async () => {
      const res = await request(app).get('/vocab/skills?limit=5')
      expect(res.status).toBe(200)
      expect(res.body.skills.length).toBeLessThanOrEqual(5)
    })
  })

  describe('GET /vocab/roles', () => {
    it('returns 200 with seed roles', async () => {
      const res = await request(app).get('/vocab/roles?q=director')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('roles')
      expect(res.body.roles.some((r: { name: string }) => r.name.toLowerCase().includes('director'))).toBe(true)
    })
  })

  describe('GET /vocab/cities', () => {
    it('returns 200 with Indian film hub cities', async () => {
      const res = await request(app).get('/vocab/cities?q=mumbai')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('cities')
      expect(res.body.cities.some((c: { name: string }) => c.name.toLowerCase().includes('mumbai'))).toBe(true)
    })
  })
})
