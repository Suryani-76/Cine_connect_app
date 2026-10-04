import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BrowseJobs from '../pages/BrowseJobs'
import * as AuthContext from '../context/AuthContext'
import { jobsApi, savedJobsApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    jobsApi: {
      list: vi.fn(),
    },
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

const mockJobs = [
  {
    id: 'job-1',
    production_id: 'prod-1',
    title: 'Director of Photography',
    description: 'Looking for experienced DP with RED or Arri experience.',
    status: 'published' as const,
    job_type: 'freelance' as const,
    pay_min: 15000,
    pay_max: 25000,
    pay_currency: 'INR',
    pay_period: 'day' as const,
    created_at: new Date().toISOString(),
    production_profiles: {
      id: 'prod-1',
      company_name: 'Studio North',
      bio: 'Leading film studio',
      logo_url: null,
      verified: true,
    },
    job_requirements: {
      id: 'req-1',
      job_id: 'job-1',
      skills: ['Lighting', 'RED Camera'],
      roles: ['Director of Photography'],
      experience_level: 'senior',
      language: 'Hindi',
      location: 'Mumbai',
    },
  },
]

describe('BrowseJobs page', () => {
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
    vi.mocked(savedJobsApi.list).mockResolvedValue({ saved: [] })
  })

  it('renders search input, filter controls, and fetched job cards', async () => {
    vi.mocked(jobsApi.list).mockResolvedValue({
      jobs: mockJobs,
      total: 1,
      page: 1,
      limit: 12,
    })

    render(
      <MemoryRouter>
        <BrowseJobs />
      </MemoryRouter>
    )

    expect(screen.getByPlaceholderText(/search by role, title, keywords/i)).toBeInTheDocument()
    expect(screen.getByText(/All Types/i)).toBeInTheDocument()
    expect(screen.getByText(/All Experience/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/Director of Photography/i)).toBeInTheDocument()
      expect(screen.getByText(/Studio North/i)).toBeInTheDocument()
      expect(screen.getByText(/RED Camera/i)).toBeInTheDocument()
    })
  })

  it('renders empty state when no jobs match criteria', async () => {
    vi.mocked(jobsApi.list).mockResolvedValue({
      jobs: [],
      total: 0,
      page: 1,
      limit: 12,
    })

    render(
      <MemoryRouter>
        <BrowseJobs />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No listings found/i)).toBeInTheDocument()
    })
  })

  it('renders error state and retries on failure', async () => {
    vi.mocked(jobsApi.list).mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <BrowseJobs />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      expect(screen.getByText(/Try Again/i)).toBeInTheDocument()
    })

    vi.mocked(jobsApi.list).mockResolvedValueOnce({
      jobs: mockJobs,
      total: 1,
      page: 1,
      limit: 12,
    })

    const retryBtn = screen.getByRole('button', { name: /Try Again/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText(/Director of Photography/i)).toBeInTheDocument()
    })
  })
})
