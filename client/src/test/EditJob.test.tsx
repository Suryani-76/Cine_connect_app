import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EditJob from '../pages/EditJob'
import * as AuthContext from '../context/AuthContext'
import { jobsApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    jobsApi: {
      getById: vi.fn(),
      update: vi.fn(),
      setRequirements: vi.fn(),
      publish: vi.fn(),
    },
  }
})

const mockDraftJob = {
  id: 'job-draft-1',
  production_id: 'prod-profile-1',
  title: 'Lead Animator',
  description: 'Original draft description for animator role.',
  status: 'draft' as const,
  job_type: 'contract' as const,
  pay_min: 50000,
  pay_max: 75000,
  pay_currency: 'INR',
  pay_period: 'project' as const,
  openings: 2,
  created_at: new Date().toISOString(),
  production_profiles: {
    id: 'prod-profile-1',
    company_name: 'Starlight VFX',
    bio: 'Animation studio',
    logo_url: null,
    verified: true,
  },
  job_requirements: {
    id: 'req-1',
    job_id: 'job-draft-1',
    skills: ['Blender', 'Maya'],
    roles: ['Lead Animator'],
    experience_level: 'senior',
    language: 'English',
    location: 'Bangalore',
  },
}

const mockPublishedJob = {
  ...mockDraftJob,
  id: 'job-pub-1',
  status: 'published' as const,
}

describe('EditJob page (owner only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-prod-1', email: 'prod@cine.test', role: 'production', profileId: 'prod-profile-1' },
      token: 'jwt-token',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders pre-populated fields and allows draft job to edit title and job type', async () => {
    vi.mocked(jobsApi.getById).mockResolvedValue({
      job: mockDraftJob,
    })

    render(
      <MemoryRouter initialEntries={['/jobs/job-draft-1/edit']}>
        <Routes>
          <Route path="/jobs/:id/edit" element={<EditJob />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Lead Animator')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Original draft description for animator role.')).toBeInTheDocument()
    })

    const titleInput = screen.getByDisplayValue('Lead Animator')
    expect(titleInput).not.toBeDisabled()

    const jobTypeSelect = screen.getByLabelText(/Job type/i)
    expect(jobTypeSelect).not.toBeDisabled()
  })

  it('disables title and job_type when job is published and shows constraint info', async () => {
    vi.mocked(jobsApi.getById).mockResolvedValue({
      job: mockPublishedJob,
    })

    render(
      <MemoryRouter initialEntries={['/jobs/job-pub-1/edit']}>
        <Routes>
          <Route path="/jobs/:id/edit" element={<EditJob />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Published job editing constraints/i)).toBeInTheDocument()
      expect(screen.getByText(/Locked on published jobs/i)).toBeInTheDocument()
    })

    const titleInput = screen.getByDisplayValue('Lead Animator')
    expect(titleInput).toBeDisabled()

    const jobTypeSelect = screen.getByLabelText(/Job type/i)
    expect(jobTypeSelect).toBeDisabled()
  })

  it('denies access if current user is not the job owner', async () => {
    vi.mocked(jobsApi.getById).mockResolvedValue({
      job: {
        ...mockDraftJob,
        production_id: 'other-prod-id',
      },
    })

    render(
      <MemoryRouter initialEntries={['/jobs/job-draft-1/edit']}>
        <Routes>
          <Route path="/jobs/:id/edit" element={<EditJob />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument()
      expect(screen.getByText(/You do not have permission to edit this job post/i)).toBeInTheDocument()
    })
  })
})
