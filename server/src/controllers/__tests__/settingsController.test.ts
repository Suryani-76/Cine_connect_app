import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { settingsRouter } from '../../routes/settings'
import { unsubscribeRouter } from '../../routes/unsubscribe'
import { errorHandler } from '../../middleware/errorHandler'
import * as prefsService from '../../services/notificationPreferencesService'

let mockCaller: { userId: string; role: 'production' | 'talent'; profileId: string } | null = {
  userId: 'user-777',
  role: 'talent',
  profileId: 'talent-777',
}

vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: vi.fn((req: { caller?: unknown }, _res: unknown, next: () => void) => {
    req.caller = mockCaller
    next()
  }),
}))

vi.mock('../../services/notificationPreferencesService', () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  getPreferencesByUnsubscribeToken: vi.fn(),
  unsubscribeByToken: vi.fn(),
}))

const app = express()
app.use(express.json())
app.use('/settings', settingsRouter)
app.use('/unsubscribe', unsubscribeRouter)
app.use(errorHandler)

describe('Settings & Unsubscribe Controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCaller = {
      userId: 'user-777',
      role: 'talent',
      profileId: 'talent-777',
    }
  })

  describe('GET /settings/notifications', () => {
    it('returns user notification preferences', async () => {
      const mockPrefs = {
        user_id: 'user-777',
        new_application: true,
        status_change: true,
        new_message: true,
        job_closed: true,
        talent_alert_match: true,
        digest_frequency: 'daily',
        unsubscribe_token: 'tok-abc',
      }
      vi.mocked(prefsService.getNotificationPreferences).mockResolvedValue(mockPrefs as any)

      const res = await request(app).get('/settings/notifications')

      expect(res.status).toBe(200)
      expect(res.body.new_application).toBe(true)
      expect(res.body.digest_frequency).toBe('daily')
      expect(prefsService.getNotificationPreferences).toHaveBeenCalledWith('user-777')
    })
  })

  describe('PUT /settings/notifications', () => {
    it('updates user notification preferences', async () => {
      const updatedPrefs = {
        user_id: 'user-777',
        new_application: false,
        digest_frequency: 'weekly',
      }
      vi.mocked(prefsService.updateNotificationPreferences).mockResolvedValue(updatedPrefs as any)

      const res = await request(app)
        .put('/settings/notifications')
        .send({ new_application: false, digest_frequency: 'weekly' })

      expect(res.status).toBe(200)
      expect(res.body.new_application).toBe(false)
      expect(prefsService.updateNotificationPreferences).toHaveBeenCalledWith('user-777', {
        new_application: false,
        digest_frequency: 'weekly',
      })
    })
  })

  describe('GET /unsubscribe/:token', () => {
    it('returns preference status without authentication and hides user_id', async () => {
      vi.mocked(prefsService.getPreferencesByUnsubscribeToken).mockResolvedValue({
        user_id: 'internal-private-id',
        new_application: true,
        status_change: false,
        new_message: true,
        job_closed: true,
        talent_alert_match: true,
        digest_frequency: 'daily',
        unsubscribe_token: 'tok-xyz',
      } as any)

      const res = await request(app).get('/unsubscribe/tok-xyz')

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(true)
      expect(res.body.preferences.new_application).toBe(true)
      expect(res.body.preferences.status_change).toBe(false)
      expect(res.body.user_id).toBeUndefined() // Ensure user_id is never leaked!
    })

    it('returns 404 for invalid token', async () => {
      vi.mocked(prefsService.getPreferencesByUnsubscribeToken).mockResolvedValue(null)

      const res = await request(app).get('/unsubscribe/invalid-token')

      expect(res.status).toBe(404)
      expect(res.body.error).toContain('Invalid or expired')
    })
  })

  describe('POST /unsubscribe/:token', () => {
    it('executes unsubscribe and returns success confirmation', async () => {
      vi.mocked(prefsService.unsubscribeByToken).mockResolvedValue({} as any)

      const res = await request(app)
        .post('/unsubscribe/tok-xyz')
        .send({ disableAll: true })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(prefsService.unsubscribeByToken).toHaveBeenCalledWith('tok-xyz', {
        digestOnly: false,
        disableAll: true,
      })
    })
  })
})
