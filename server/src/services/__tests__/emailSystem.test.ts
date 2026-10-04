import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  renderEmailTemplate,
  SupportedTemplate,
} from '../email/templates'
import {
  MockEmailProvider,
  setEmailProvider,
  getEmailProvider,
} from '../email/emailProvider'
import {
  processOutboxRecord,
  getBackoffDelayMs,
  BACKOFF_DELAYS_MS,
  isConversationThrottled,
} from '../../workers/emailWorker'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getPreferencesByUnsubscribeToken,
  unsubscribeByToken,
} from '../notificationPreferencesService'
import {
  purgeOldReadNotifications,
  purgeOldEmailOutbox,
  runRetentionPurge,
} from '../retentionService'
import { supabase } from '../../db/supabase'
import { DbEmailOutbox } from '../../types'

vi.mock('../../db/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('Email & Preferences Subsystem (Milestone M5)', () => {
  let mockProvider: MockEmailProvider

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider = new MockEmailProvider()
    setEmailProvider(mockProvider)
  })

  // ── 1. Template Rendering Snapshots & Plain-Text Generation ───
  describe('Email Templates (HTML + Plain Text + Brand Colors #0B2545 & #E0A96D)', () => {
    const unsubToken = '11111111-2222-3333-4444-555555555555'

    it('renders new_application template with applicant and job details', () => {
      const rendered = renderEmailTemplate(
        'new_application',
        {
          applicant_name: 'John Actor',
          job_title: 'Lead Cinematographer',
          cover_note: 'Excited about this indie feature.',
          application_id: 'app-123',
        },
        unsubToken,
        'https://cineconnect.test'
      )

      expect(rendered.subject).toBe('New Application: John Actor applied for Lead Cinematographer')
      expect(rendered.html).toContain('#0B2545')
      expect(rendered.html).toContain('#E0A96D')
      expect(rendered.html).toContain('John Actor')
      expect(rendered.html).toContain('Lead Cinematographer')
      expect(rendered.html).toContain('Excited about this indie feature.')
      expect(rendered.html).toContain(`https://cineconnect.test/unsubscribe/${unsubToken}`)
      expect(rendered.html).toContain('https://cineconnect.test/settings?tab=notifications')

      expect(rendered.text).toContain('John Actor has applied for Lead Cinematographer.')
      expect(rendered.text).toContain(`https://cineconnect.test/unsubscribe/${unsubToken}`)
    })

    it('renders status_change template with interview date and calendar highlight', () => {
      const interviewDate = '2026-10-15T14:30:00.000Z'
      const rendered = renderEmailTemplate(
        'status_change',
        {
          job_title: 'Sound Designer',
          status: 'interview',
          companyName: 'Paramount India',
          interview_at: interviewDate,
        },
        unsubToken,
        'https://cineconnect.test'
      )

      expect(rendered.subject).toContain('Sound Designer (INTERVIEW)')
      expect(rendered.html).toContain('INTERVIEW')
      expect(rendered.html).toContain('Interview Scheduled')
      expect(rendered.html).toContain('#0B2545')
      expect(rendered.html).toContain('#E0A96D')
      expect(rendered.text).toContain('Interview Date & Time:')
      expect(rendered.text).toContain(`https://cineconnect.test/unsubscribe/${unsubToken}`)
    })

    it('renders new_message template with sender preview and chat link', () => {
      const rendered = renderEmailTemplate(
        'new_message',
        {
          sender_name: 'Mira Casting',
          message_preview: 'Hello! Are you available next Tuesday for auditions?',
        },
        unsubToken,
        'https://cineconnect.test'
      )

      expect(rendered.subject).toBe('New message from Mira Casting on CineConnect')
      expect(rendered.html).toContain('Mira Casting')
      expect(rendered.html).toContain('Hello! Are you available next Tuesday for auditions?')
      expect(rendered.html).toContain('https://cineconnect.test/chat')
      expect(rendered.text).toContain('New Direct Message from Mira Casting')
      expect(rendered.text).toContain(`https://cineconnect.test/unsubscribe/${unsubToken}`)
    })

    it('renders job_closed template', () => {
      const rendered = renderEmailTemplate(
        'job_closed',
        {
          job_title: 'Focus Puller',
          company_name: 'Studio X',
        },
        unsubToken,
        'https://cineconnect.test'
      )

      expect(rendered.subject).toBe('Notice: Focus Puller has been closed')
      expect(rendered.html).toContain('Focus Puller')
      expect(rendered.html).toContain('Studio X')
      expect(rendered.text).toContain('Job Closed: Focus Puller')
    })

    it('renders talent_alert_match template', () => {
      const rendered = renderEmailTemplate(
        'talent_alert_match',
        {
          job_title: 'Gaffer',
          company_name: 'Bollywood Lights',
          location: 'Mumbai',
          job_id: 'job-999',
        },
        unsubToken,
        'https://cineconnect.test'
      )

      expect(rendered.subject).toBe('Talent Alert: New opening for Gaffer')
      expect(rendered.html).toContain('Gaffer')
      expect(rendered.html).toContain('Bollywood Lights')
      expect(rendered.html).toContain('https://cineconnect.test/jobs/job-999')
    })

    it('renders digest template with aggregated counts', () => {
      const rendered = renderEmailTemplate(
        'digest',
        {
          frequency: 'weekly',
          new_applications_count: 5,
          unread_messages_count: 2,
          matching_jobs_count: 8,
        },
        unsubToken,
        'https://cineconnect.test'
      )

      expect(rendered.subject).toBe('Your CineConnect Weekly Digest')
      expect(rendered.html).toContain('5')
      expect(rendered.html).toContain('2')
      expect(rendered.html).toContain('8')
      expect(rendered.text).toContain('- Applications: 5')
      expect(rendered.text).toContain('- Messages: 2')
      expect(rendered.text).toContain('- Opportunities: 8')
    })
  })

  // ── 2. Preference Filtering ───────────────────────────────────
  describe('Notification Preference Filtering in Worker', () => {
    const mockRow: DbEmailOutbox = {
      id: 'outbox-1',
      recipient_email: 'talent@example.com',
      user_id: 'user-talent-1',
      subject: 'New Application',
      template_name: 'new_application',
      payload: { applicant_name: 'Alice', job_title: 'Editor' },
      status: 'pending',
      attempts: 1,
      max_attempts: 5,
      next_attempt_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    it('skips dispatch and marks sent when notification type is disabled in user preferences', async () => {
      // Mock user lookup
      const mockUserSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-talent-1', email: 'talent@example.com', suspended_at: null },
          error: null,
        }),
      })

      // Mock notification_preferences lookup (new_application = false)
      const mockPrefsSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: 'user-talent-1',
            new_application: false, // Disabled!
            status_change: true,
            new_message: true,
            job_closed: true,
            talent_alert_match: true,
            digest_frequency: 'daily',
            unsubscribe_token: 'tok-123',
          },
          error: null,
        }),
      })

      const mockOutboxUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return { select: vi.fn().mockReturnValue({ eq: mockUserSelect }) } as any
        }
        if (table === 'notification_preferences') {
          return { select: vi.fn().mockReturnValue({ eq: mockPrefsSelect }) } as any
        }
        if (table === 'email_outbox') {
          return { update: mockOutboxUpdate } as any
        }
        return {} as any
      })

      const outcome = await processOutboxRecord(mockRow)

      expect(outcome).toBe('skipped_preference')
      expect(mockProvider.sentEmails.length).toBe(0)
      expect(mockOutboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          last_error: expect.stringContaining('disabled by user preference'),
        })
      )
    })

    it('sends email when notification type is enabled in user preferences', async () => {
      const mockUserSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-talent-1', email: 'talent@example.com', suspended_at: null },
          error: null,
        }),
      })

      const mockPrefsSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: 'user-talent-1',
            new_application: true, // Enabled!
            status_change: true,
            new_message: true,
            job_closed: true,
            talent_alert_match: true,
            digest_frequency: 'daily',
            unsubscribe_token: 'tok-123',
          },
          error: null,
        }),
      })

      const mockOutboxUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return { select: vi.fn().mockReturnValue({ eq: mockUserSelect }) } as any
        }
        if (table === 'notification_preferences') {
          return { select: vi.fn().mockReturnValue({ eq: mockPrefsSelect }) } as any
        }
        if (table === 'email_outbox') {
          return { update: mockOutboxUpdate } as any
        }
        return {} as any
      })

      const outcome = await processOutboxRecord(mockRow)

      expect(outcome).toBe('sent')
      expect(mockProvider.sentEmails.length).toBe(1)
      expect(mockProvider.sentEmails[0].to).toBe('talent@example.com')
      expect(mockOutboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          sent_at: expect.any(String),
          last_error: null,
        })
      )
    })
  })

  // ── 3. Suspended Users Suppression ────────────────────────────
  describe('Suspended User Filtering', () => {
    it('marks outbox dead and suppresses email if recipient is suspended', async () => {
      const mockRow: DbEmailOutbox = {
        id: 'outbox-suspended',
        recipient_email: 'spammer@example.com',
        user_id: 'user-spammer',
        subject: 'Welcome',
        template_name: 'new_message',
        payload: { conversation_id: 'c1' },
        status: 'pending',
        attempts: 1,
        max_attempts: 5,
        next_attempt_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockUserSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'user-spammer',
            email: 'spammer@example.com',
            suspended_at: '2026-09-01T00:00:00Z', // Suspended!
          },
          error: null,
        }),
      })

      const mockOutboxUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return { select: vi.fn().mockReturnValue({ eq: mockUserSelect }) } as any
        }
        if (table === 'email_outbox') {
          return { update: mockOutboxUpdate } as any
        }
        return {} as any
      })

      const outcome = await processOutboxRecord(mockRow)

      expect(outcome).toBe('suspended')
      expect(mockProvider.sentEmails.length).toBe(0)
      expect(mockOutboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dead',
          last_error: 'Recipient account is suspended',
        })
      )
    })
  })

  // ── 4. Conversation Throttling (30 Minutes) ───────────────────
  describe('Conversation Throttling for new_message', () => {
    it('throttles subsequent new_message emails for the same conversation within 30 minutes', async () => {
      const mockRow: DbEmailOutbox = {
        id: 'outbox-msg-2',
        recipient_email: 'actor@example.com',
        user_id: 'user-actor',
        subject: 'New message',
        template_name: 'new_message',
        payload: { conversation_id: 'conv-abc', sender_id: 'director-1' },
        status: 'pending',
        attempts: 1,
        max_attempts: 5,
        next_attempt_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Mock user & preferences lookup
      const mockUserSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-actor', email: 'actor@example.com', suspended_at: null },
          error: null,
        }),
      })
      const mockPrefsSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { user_id: 'user-actor', new_message: true, unsubscribe_token: 'tok' },
          error: null,
        }),
      })

      // Mock outbox query finding an email sent 5 minutes ago for same conversation
      const mockOutboxQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        neq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'outbox-msg-1',
                payload: { conversation_id: 'conv-abc' },
                created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                sent_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
              },
            ],
            error: null,
          }),
        })),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return { select: vi.fn().mockReturnValue({ eq: mockUserSelect }) } as any
        }
        if (table === 'notification_preferences') {
          return { select: vi.fn().mockReturnValue({ eq: mockPrefsSelect }) } as any
        }
        if (table === 'email_outbox') {
          return mockOutboxQuery as any
        }
        return {} as any
      })

      const outcome = await processOutboxRecord(mockRow)

      expect(outcome).toBe('throttled')
      expect(mockProvider.sentEmails.length).toBe(0)
      expect(mockOutboxQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          last_error: expect.stringContaining('30-minute conversation rate limit'),
        })
      )
    })
  })

  // ── 5. Retry with Exponential Backoff & Dead State ────────────
  describe('Retry, Backoff & Dead State Transition', () => {
    it('calculates exponential backoff progression properly', () => {
      expect(getBackoffDelayMs(1)).toBe(1 * 60 * 1000)   // 1 min
      expect(getBackoffDelayMs(2)).toBe(5 * 60 * 1000)   // 5 min
      expect(getBackoffDelayMs(3)).toBe(30 * 60 * 1000)  // 30 min
      expect(getBackoffDelayMs(4)).toBe(120 * 60 * 1000) // 2 hours
      expect(getBackoffDelayMs(5)).toBe(120 * 60 * 1000) // max cap
    })

    it('sets status to failed and schedules next attempt on attempt 1 failure', async () => {
      mockProvider.failNext = true
      mockProvider.failError = 'Resend rate limit reached'

      const mockRow: DbEmailOutbox = {
        id: 'outbox-retry-1',
        recipient_email: 'client@example.com',
        user_id: 'user-client',
        subject: 'Hello',
        template_name: 'new_application',
        payload: { applicant_name: 'Bob', job_title: 'DP' },
        status: 'pending',
        attempts: 1, // First attempt
        max_attempts: 5,
        next_attempt_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockUserSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-client', email: 'client@example.com', suspended_at: null },
          error: null,
        }),
      })
      const mockPrefsSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { user_id: 'user-client', new_application: true, unsubscribe_token: 'tok' },
          error: null,
        }),
      })

      const mockOutboxUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') return { select: vi.fn().mockReturnValue({ eq: mockUserSelect }) } as any
        if (table === 'notification_preferences') return { select: vi.fn().mockReturnValue({ eq: mockPrefsSelect }) } as any
        if (table === 'email_outbox') return { update: mockOutboxUpdate } as any
        return {} as any
      })

      const outcome = await processOutboxRecord(mockRow)

      expect(outcome).toBe('failed')
      expect(mockOutboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          last_error: 'Resend rate limit reached',
          next_attempt_at: expect.any(String),
        })
      )
    })

    it('transitions to dead state after 5 failed attempts', async () => {
      mockProvider.failNext = true
      mockProvider.failError = 'Account quota exceeded'

      const mockRow: DbEmailOutbox = {
        id: 'outbox-dead-5',
        recipient_email: 'client@example.com',
        user_id: 'user-client',
        subject: 'Hello',
        template_name: 'new_application',
        payload: { applicant_name: 'Bob', job_title: 'DP' },
        status: 'failed',
        attempts: 5, // Reached max attempts!
        max_attempts: 5,
        next_attempt_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockUserSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-client', email: 'client@example.com', suspended_at: null },
          error: null,
        }),
      })
      const mockPrefsSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { user_id: 'user-client', new_application: true, unsubscribe_token: 'tok' },
          error: null,
        }),
      })

      const mockOutboxUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') return { select: vi.fn().mockReturnValue({ eq: mockUserSelect }) } as any
        if (table === 'notification_preferences') return { select: vi.fn().mockReturnValue({ eq: mockPrefsSelect }) } as any
        if (table === 'email_outbox') return { update: mockOutboxUpdate } as any
        return {} as any
      })

      const outcome = await processOutboxRecord(mockRow)

      expect(outcome).toBe('dead')
      expect(mockOutboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dead',
          last_error: expect.stringContaining('Failed after 5 attempts: Account quota exceeded'),
        })
      )
    })
  })

  // ── 6. Unsubscribe Token Handling & Preference Updating ───────
  describe('Unsubscribe Token Handling', () => {
    const unsubToken = 'a0000000-0000-0000-0000-000000000001'

    it('resolves preferences via token without user login', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              user_id: 'u-1',
              unsubscribe_token: unsubToken,
              digest_frequency: 'daily',
              new_application: true,
            },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const result = await getPreferencesByUnsubscribeToken(unsubToken)
      expect(result).not.toBeNull()
      expect(result?.unsubscribe_token).toBe(unsubToken)
      expect(mockSelect).toHaveBeenCalledWith('*')
    })

    it('disables all notifications on one-click unsubscribe without login', async () => {
      // Mock existing record
      const mockExisting = {
        user_id: 'u-1',
        unsubscribe_token: unsubToken,
        new_application: true,
        status_change: true,
        digest_frequency: 'daily',
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockExisting, error: null }),
        }),
      })

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ...mockExisting,
                new_application: false,
                status_change: false,
                new_message: false,
                job_closed: false,
                talent_alert_match: false,
                digest_frequency: 'off',
              },
              error: null,
            }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      } as any)

      const updated = await unsubscribeByToken(unsubToken, { disableAll: true })

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          new_application: false,
          status_change: false,
          new_message: false,
          job_closed: false,
          talent_alert_match: false,
          digest_frequency: 'off',
        })
      )
      expect(updated.digest_frequency).toBe('off')
    })

    it('disables digest only when digestOnly is specified', async () => {
      const mockExisting = {
        user_id: 'u-1',
        unsubscribe_token: unsubToken,
        digest_frequency: 'weekly',
        new_message: true,
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockExisting, error: null }),
        }),
      })

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockExisting, digest_frequency: 'off' },
              error: null,
            }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      } as any)

      await unsubscribeByToken(unsubToken, { digestOnly: true })

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          digest_frequency: 'off',
        })
      )
    })
  })

  // ── 7. Retention Purge ────────────────────────────────────────
  describe('Retention Purge Job', () => {
    it('purges read notifications older than 90 days and 30-day outbox records', async () => {
      const mockNotifSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'n-old-1' }, { id: 'n-old-2' }],
        error: null,
      })
      const mockNotifLt = vi.fn().mockReturnValue({ select: mockNotifSelect })
      const mockNotifEq = vi.fn().mockReturnValue({ lt: mockNotifLt })
      const mockNotifDelete = vi.fn().mockReturnValue({ eq: mockNotifEq })

      const mockOutboxSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'out-old-1' }],
        error: null,
      })
      const mockOutboxLt = vi.fn().mockReturnValue({ select: mockOutboxSelect })
      const mockOutboxDelete = vi.fn().mockReturnValue({ lt: mockOutboxLt })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'notifications') {
          return { delete: mockNotifDelete } as any
        }
        if (table === 'email_outbox') {
          return { delete: mockOutboxDelete } as any
        }
        return {} as any
      })

      const result = await runRetentionPurge()

      expect(result.notificationsPurged).toBe(2)
      expect(result.outboxPurged).toBe(1)
      expect(mockNotifEq).toHaveBeenCalledWith('read', true)
      expect(mockNotifLt).toHaveBeenCalledWith('created_at', expect.any(String))
      expect(mockOutboxLt).toHaveBeenCalledWith('created_at', expect.any(String))
    })
  })
})
