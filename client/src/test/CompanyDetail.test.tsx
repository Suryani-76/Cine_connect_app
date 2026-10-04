import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CompanyDetail from '../pages/CompanyDetail'
import * as AuthContext from '../context/AuthContext'
import { productionApi, jobsApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    productionApi: {
      getProfile: vi.fn(),
    },
    jobsApi: {
      list: vi.fn(),
    },
  }
})

const mockCompanyProfile = {
  id: 'prod-profile-10',
  user_id: 'user-prod-10',
  company_name: 'Mythic Cine Works',
  bio: 'Award-winning narrative and feature film studio based in Hyderabad.',
  production_details: 'Equipped with Sony FX6 and Arri Alexa Mini LF packages.',
  logo_url: null,
  verified: true,
  created_at: '2023-01-15T00:00:00Z',
  users: {
    username: 'mythiccine',
  },
}

const mockStudioJob = {
  id: 'job-10',
  production_id: 'prod-profile-10',
  title: 'Costume Designer',
  description: 'Period drama feature seeking head costume designer.',
  status: 'published' as const,
  job_type: 'contract' as const,
  pay_min: 40000,
  pay_max: 60000,
  pay_currency: 'INR',
  pay_period: 'project' as const,
  created_at: new Date().toISOString(),
  production_profiles: {
    id: 'prod-profile-10',
    company_name: 'Mythic Cine Works',
    bio: 'Award-winning narrative studio',
    logo_url: null,
    verified: true,
  },
  job_requirements: {
    id: 'req-10',
    job_id: 'job-10',
    skills: ['Period Costumes', 'Styling'],
    roles: ['Costume Designer'],
    experience_level: 'senior',
    language: 'Telugu',
    location: 'Hyderabad',
  },
}

describe('CompanyDetail page (public studio profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders company details, verified badge, bio, and published jobs', async () => {
    vi.mocked(productionApi.getProfile).mockResolvedValue({
      profile: mockCompanyProfile,
    })
    vi.mocked(jobsApi.list).mockResolvedValue({
      jobs: [mockStudioJob],
      total: 1,
      page: 1,
      limit: 10,
    })

    render(
      <MemoryRouter initialEntries={['/company/prod-profile-10']}>
        <Routes>
          <Route path="/company/:id" element={<CompanyDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Mythic Cine Works')).toBeInTheDocument()
      expect(screen.getByText(/Verified Production House/i)).toBeInTheDocument()
      expect(screen.getByText(/Award-winning narrative/i)).toBeInTheDocument()
      expect(screen.getByText('Costume Designer')).toBeInTheDocument()
      expect(screen.getByText(/View Role/i)).toBeInTheDocument()
    })
  })

  it('renders empty jobs state when company has no active listings', async () => {
    vi.mocked(productionApi.getProfile).mockResolvedValue({
      profile: mockCompanyProfile,
    })
    vi.mocked(jobsApi.list).mockResolvedValue({
      jobs: [],
      total: 0,
      page: 1,
      limit: 10,
    })

    render(
      <MemoryRouter initialEntries={['/company/prod-profile-10']}>
        <Routes>
          <Route path="/company/:id" element={<CompanyDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No active job posts/i)).toBeInTheDocument()
    })
  })

  it('renders error state when studio profile is not found', async () => {
    vi.mocked(productionApi.getProfile).mockRejectedValue(new Error('Studio not found'))

    render(
      <MemoryRouter initialEntries={['/company/non-existent']}>
        <Routes>
          <Route path="/company/:id" element={<CompanyDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Studio Not Found/i })).toBeInTheDocument()
      expect(screen.getByText(/Browse Opportunities/i)).toBeInTheDocument()
    })
  })
})
