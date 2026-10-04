import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  enqueueMatchRecompute,
  recomputeSingleApplication,
  processMatchRecomputeQueue,
} from '../recomputeService'
import { supabase } from '../../db/supabase'

vi.mock('../../db/supabase', () => {
  const mockFrom = vi.fn()
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

describe('recomputeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('enqueueMatchRecompute', () => {
    it('throws error if neither jobId nor talentProfileId is provided', async () => {
      await expect(
        enqueueMatchRecompute({ reason: 'testing missing params' })
      ).rejects.toThrow('Either jobId or talentProfileId must be provided')
    })

    it('enqueues successfully for a job', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      await enqueueMatchRecompute({ jobId: 'job-123', reason: 'requirements updated' })

      expect(supabase.from).toHaveBeenCalledWith('match_recompute_queue')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          job_id: 'job-123',
          talent_profile_id: null,
          reason: 'requirements updated',
          status: 'pending',
        })
      )
    })
  })

  describe('recomputeSingleApplication', () => {
    it('returns false and NEVER updates score for final statuses (hired, rejected, withdrawn)', async () => {
      const mockUpdate = vi.fn()

      for (const finalStatus of ['hired', 'rejected', 'withdrawn']) {
        const mockSingle = vi.fn().mockResolvedValue({
          data: {
            id: 'app-1',
            status: finalStatus,
            match_score: 85,
            talent_profiles: { id: 'talent-1', skills: ['Cinematography'] },
            jobs: { job_requirements: { skills: ['Cinematography'] } },
          },
          error: null,
        })

        vi.mocked(supabase.from).mockImplementation((table: string) => {
          if (table === 'applications') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({ single: mockSingle }),
              update: mockUpdate,
            } as any
          }
          if (table === 'match_config') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            } as any
          }
          return {} as any
        })

        const updated = await recomputeSingleApplication('app-1')
        expect(updated).toBe(false)
        expect(mockUpdate).not.toHaveBeenCalled()
      }
    })

    it('recomputes score and updates for non-final status (applied, shortlisted, interview) idempotently', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'app-active',
          status: 'applied',
          match_score: 50,
          talent_profiles: {
            id: 'talent-1',
            skills: ['Cinematography', 'Lighting', 'DaVinci Resolve'],
            role: 'Cinematographer',
            experience_years: 4,
            language: 'English',
            location: 'Mumbai',
            full_name: 'Priya Sharma',
            bio: 'Bio',
            avatar_url: 'https://example.com/avatar.jpg',
            portfolio_url: 'https://example.com',
            showreel_url: 'https://vimeo.com/123',
            last_active_at: new Date().toISOString(),
          },
          jobs: {
            job_requirements: {
              skills: ['Cinematography', 'Lighting', 'DaVinci Resolve'],
              roles: ['Cinematographer'],
              experience_level: 'mid',
              language: 'English',
              location: 'Mumbai',
            },
          },
        },
        error: null,
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'applications') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue({ single: mockSingle }),
            update: mockUpdate,
          } as any
        }
        if (table === 'match_config') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any
        }
        if (table === 'talent_credits') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          } as any
        }
        return {} as any
      })

      // Run once
      const firstRun = await recomputeSingleApplication('app-active')
      expect(firstRun).toBe(true)
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ match_score: 100 }))

      // Run second time (idempotency check)
      const secondRun = await recomputeSingleApplication('app-active')
      expect(secondRun).toBe(true)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ match_score: 100 }))
    })
  })

  describe('processMatchRecomputeQueue', () => {
    it('returns 0 processed if queue is empty', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'match_recompute_queue') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as any
        }
        return {} as any
      })

      const result = await processMatchRecomputeQueue(10)
      expect(result).toEqual({ processedQueueItems: 0, updatedApplicationsCount: 0 })
    })
  })
})
