import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SavedJobs from '../pages/SavedJobs'
import * as AuthContext from '../context/AuthContext'
import { savedJobsApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    savedJobsApi: {
      list: vi.fn(),
      save: vi.fn(),
      unsave: vi.fn(),
    },
  }
})

vi.mock('../components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

const mockSavedItem = {
  id: 'save-1',
  job_id: 'job-1',
  created_at: new Date().toISOString(),
  jobs: {
    id: 'job-1',
    production_id: 'prod-1',
    title: 'Sound Recordist',
    description: 'Location sound recording for indie feature.',
    status: 'published' as const,
    job_type: 'contract' as const,
    created_at: new Date().toISOString(),
    production_profiles: {
      id: 'prod-1',
      company_name: 'Metro Films',
      bio: 'Production house',
      logo_url: null,
      verified: true,
    },
    job_requirements: {
      id: 'req-1',
      job_id: 'job-1',
      skills: ['Boom Mic', 'Sound Devices'],
      roles: ['Sound Recordist'],
      experience_level: 'mid',
      language: 'English',
      location: 'Goa',
    },
  },
}

describe('SavedJobs page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'talent@cine.test', role: 'talent', profileId: 'talent-1' },
      token: 'jwt-token',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders saved jobs list with studio name and link to job', async () => {
    vi.mocked(savedJobsApi.list).mockResolvedValue({
      saved: [mockSavedItem],
    })

    render(
      <MemoryRouter>
        <SavedJobs />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Sound Recordist/i)).toBeInTheDocument()
      expect(screen.getByText(/Metro Films/i)).toBeInTheDocument()
      expect(screen.getByText(/Goa/i)).toBeInTheDocument()
      expect(screen.getByText(/View Role/i)).toBeInTheDocument()
    })
  })

  it('renders empty state when user has no saved jobs', async () => {
    vi.mocked(savedJobsApi.list).mockResolvedValue({
      saved: [],
    })

    render(
      <MemoryRouter>
        <SavedJobs />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No saved jobs yet/i)).toBeInTheDocument()
      expect(screen.getByText(/Explore Open Positions/i)).toBeInTheDocument()
    })
  })

  it('removes a saved job when clicking remove', async () => {
    vi.mocked(savedJobsApi.list).mockResolvedValue({
      saved: [mockSavedItem],
    })
    vi.mocked(savedJobsApi.unsave).mockResolvedValue({ ok: true })

    render(
      <MemoryRouter>
        <SavedJobs />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Sound Recordist/i)).toBeInTheDocument()
    })

    const removeBtn = screen.getByRole('button', { name: /Remove/i })
    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(savedJobsApi.unsave).toHaveBeenCalledWith('job-1', 'jwt-token')
      expect(screen.queryByText(/Sound Recordist/i)).not.toBeInTheDocument()
    })
  })

  it('renders error state on API failure', async () => {
    vi.mocked(savedJobsApi.list).mockRejectedValue(new Error('Failed to fetch bookmarks'))

    render(
      <MemoryRouter>
        <SavedJobs />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch bookmarks/i)).toBeInTheDocument()
      expect(screen.getByText(/Try Again/i)).toBeInTheDocument()
    })
  })
})
