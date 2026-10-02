import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateJob, deleteJob, closeJob } from '../../services/jobService'
import { createApplication, updateApplicationStatus, withdrawApplication } from '../../services/applicationService'
import { supabase } from '../../db/supabase'

vi.mock('../../db/supabase', () => {
  const mockFrom = vi.fn()
  return {
    supabase: {
      from: mockFrom,
      auth: { getUser: vi.fn() },
    },
  }
})

describe('Milestone 1 — Job & Application Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Job Editing rules (PUT /jobs/:id)', () => {
    it('allows editing all fields when job is in draft status', async () => {
      const mockJob = {
        id: 'job-1',
        title: 'Original Title',
        job_type: 'freelance',
        status: 'draft',
      }

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
        }),
      })

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockJob, title: 'Updated Title', job_type: 'full_time' },
              error: null,
            }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'jobs') {
          return {
            select: selectMock,
            update: updateMock,
          } as any
        }
        return {} as any
      })

      const res = await updateJob('job-1', { title: 'Updated Title', job_type: 'full_time' })
      expect(res.title).toBe('Updated Title')
      expect(res.job_type).toBe('full_time')
    })

    it('rejects editing title or job_type when job is published (400)', async () => {
      const mockJob = {
        id: 'job-1',
        title: 'Published Title',
        job_type: 'freelance',
        status: 'published',
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
          }),
        }),
      } as any)

      await expect(updateJob('job-1', { title: 'Changed Title' })).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/Cannot edit title of a published job/),
      })

      await expect(updateJob('job-1', { job_type: 'full_time' })).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/Cannot edit job_type of a published job/),
      })
    })

    it('rejects editing any fields when job is closed (409)', async () => {
      const mockJob = {
        id: 'job-1',
        title: 'Closed Job',
        status: 'closed',
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
          }),
        }),
      } as any)

      await expect(updateJob('job-1', { description: 'New description' })).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Cannot edit a closed job/),
      })
    })
  })

  describe('Job Deletion rules (DELETE /jobs/:id)', () => {
    it('allows deleting a draft job', async () => {
      const mockJob = { id: 'job-draft', status: 'draft' }
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
          }),
        }),
        delete: deleteMock,
      } as any)

      await expect(deleteJob('job-draft')).resolves.toBeUndefined()
      expect(deleteMock).toHaveBeenCalled()
    })

    it('allows deleting a published job if it has 0 applications', async () => {
      const mockJob = { id: 'job-pub-empty', status: 'published' }
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
            delete: deleteMock,
          } as any
        }
        if (table === 'applications') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          } as any
        }
        return {} as any
      })

      await expect(deleteJob('job-pub-empty')).resolves.toBeUndefined()
      expect(deleteMock).toHaveBeenCalled()
    })

    it('rejects deleting a job with applications with 409 conflict', async () => {
      const mockJob = { id: 'job-pub-with-apps', status: 'published' }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'applications') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
            }),
          } as any
        }
        return {} as any
      })

      await expect(deleteJob('job-pub-with-apps')).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Cannot delete a job with applications/),
      })
    })
  })

  describe('Application Deadline Enforcement', () => {
    it('rejects applying to a job whose deadline has passed (409)', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString()
      const mockJob = {
        id: 'job-expired',
        status: 'published',
        deadline: pastDate,
        job_requirements: null,
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      await expect(createApplication({
        job_id: 'job-expired',
        talent_profile_id: 'talent-1',
      })).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Application deadline has passed/),
      })
    })
  })

  describe('Withdraw Application (POST /applications/:id/withdraw)', () => {
    it('allows applicant to withdraw from applied status', async () => {
      const mockApp = {
        id: 'app-1',
        talent_profile_id: 'talent-1',
        status: 'applied',
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockApp, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockApp, status: 'withdrawn' },
                error: null,
              }),
            }),
          }),
        }),
      } as any)

      const res = await withdrawApplication('app-1', 'talent-1')
      expect(res.status).toBe('withdrawn')
    })

    it('rejects withdraw if caller is not the owner (403)', async () => {
      const mockApp = {
        id: 'app-1',
        talent_profile_id: 'talent-1',
        status: 'applied',
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockApp, error: null }),
          }),
        }),
      } as any)

      await expect(withdrawApplication('app-1', 'other-talent')).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('rejects withdraw if application is already hired or rejected (409)', async () => {
      const mockHired = { id: 'app-hired', talent_profile_id: 'talent-1', status: 'hired' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockHired, error: null }),
          }),
        }),
      } as any)

      await expect(withdrawApplication('app-hired', 'talent-1')).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Cannot withdraw an application that is already 'hired'/),
      })
    })
  })

  describe('Moving to Hired — Auto-close when hired count >= openings', () => {
    it('auto-closes job and notifies non-final applicants when openings are filled', async () => {
      const mockApp = {
        id: 'app-hire',
        job_id: 'job-1',
        status: 'hired',
      }
      const mockJob = {
        id: 'job-1',
        title: 'Cinematographer',
        openings: 1,
        status: 'published',
      }

      const insertNotifsMock = vi.fn().mockResolvedValue({ error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'applications') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockApp, error: null }),
                }),
              }),
            }),
            select: vi.fn().mockImplementation((fields?: string) => {
              if (fields?.includes('jobs(')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { job_id: 'job-1', jobs: mockJob },
                      error: null,
                    }),
                  }),
                }
              }
              if (fields?.includes('talent_profiles(')) {
                return {
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({
                      data: [
                        { id: 'app-remaining', status: 'applied', talent_profiles: { user_id: 'user-talent-2' } },
                      ],
                      error: null,
                    }),
                  }),
                }
              }
              // Count query for hired
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                }),
              }
            }),
          } as any
        }
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...mockJob, status: 'closed' }, error: null }),
                }),
              }),
            }),
          } as any
        }
        if (table === 'notifications') {
          return {
            insert: insertNotifsMock,
          } as any
        }
        return {} as any
      })

      const res = await updateApplicationStatus('app-hire', 'hired')
      expect(res.status).toBe('hired')
      expect(insertNotifsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: 'user-talent-2',
            type: 'job_closed',
          }),
        ])
      )
    })
  })

  describe('Closing a Job directly (POST /jobs/:id/close)', () => {
    it('notifies all non-final applicants when job is closed', async () => {
      const mockJob = { id: 'job-close', title: 'Director', status: 'published' }
      const insertNotifsMock = vi.fn().mockResolvedValue({ error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...mockJob, status: 'closed' }, error: null }),
                }),
              }),
            }),
          } as any
        }
        if (table === 'applications') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'app-1', status: 'applied', talent_profiles: { user_id: 'user-1' } },
                    { id: 'app-2', status: 'interview', talent_profiles: { user_id: 'user-2' } },
                  ],
                  error: null,
                }),
              }),
            }),
          } as any
        }
        if (table === 'notifications') {
          return {
            insert: insertNotifsMock,
          } as any
        }
        return {} as any
      })

      const closed = await closeJob('job-close')
      expect(closed.status).toBe('closed')
      expect(insertNotifsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'user-1', type: 'job_closed' }),
          expect.objectContaining({ user_id: 'user-2', type: 'job_closed' }),
        ])
      )
    })
  })
})
