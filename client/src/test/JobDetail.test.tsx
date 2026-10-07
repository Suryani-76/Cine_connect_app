import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import JobDetail from '../pages/JobDetail'
import * as AuthContext from '../context/AuthContext'
import { jobsApi, applicationsApi, savedJobsApi, talentApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    jobsApi: {
      getById: vi.fn(),
      myMatch: vi.fn(),
    },
    applicationsApi: {
      apply: vi.fn(),
    },
    savedJobsApi: {
      list: vi.fn(),
      save: vi.fn(),
      unsave: vi.fn(),
    },
    talentApi: {
      getMyProfile: vi.fn(),
    },
    jobAnalyticsApi: {
      recordView: vi.fn().mockResolvedValue({}),
    },
  }
})

const mockJob = {
  id: 'job-101',
  production_id: 'prod-101',
  title: 'Colourist',
  description: 'Experienced colourist needed for indie feature film grade on DaVinci Resolve.',
  status: 'published' as const,
  job_type: 'contract' as const,
  pay_min: 30000,
  pay_max: 45000,
  pay_currency: 'INR',
  pay_period: 'project' as const,
  openings: 1,
  deadline: null, // Test "No deadline"
  start_date: '2026-11-01',
  end_date: '2026-11-15',
  created_at: new Date().toISOString(),
  production_profiles: {
    id: 'prod-101',
    company_name: 'Prism Post Studio',
    bio: 'Premier post facility in Mumbai',
    logo_url: null,
    verified: true,
  },
  job_requirements: {
    id: 'req-101',
    job_id: 'job-101',
    skills: ['DaVinci Resolve', 'ACES Workflow', 'Film Emulation'],
    roles: ['Colourist'],
    experience_level: 'senior',
    language: 'English',
    location: 'Mumbai',
  },
}

const mockMatchBreakdown = {
  total: 82,
  weight_table: {},
  signals: {
    skills_match: { score: 24, weight: 30, weighted: 24, reason: '2 of 3 skills matched' },
    role_match: { score: 20, weight: 20, weighted: 20, reason: 'Exact role match' },
    experience_match: { score: 15, weight: 15, weighted: 15 },
    language_match: { score: 10, weight: 10, weighted: 10 },
    location_proximity: { score: 10, weight: 10, weighted: 10 },
    profile_completeness: { score: 8, weight: 10, weighted: 8 },
    activity_recency: { score: 5, weight: 5, weighted: 5 },
  },
  matching_skills: ['DaVinci Resolve', 'ACES Workflow'],
  missing_skills: ['Film Emulation'],
  summary_reasons: ['Missing 1 of 3 skills: Film Emulation'],
}

describe('JobDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-talent-1', email: 'talent@cine.test', role: 'talent', profileId: 'talent-profile-1' },
      token: 'jwt-talent-token',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(savedJobsApi.list).mockResolvedValue({ saved: [] })
    vi.mocked(talentApi.getMyProfile).mockResolvedValue({
      profile: {
        id: 'talent-profile-1',
        skills: ['DaVinci Resolve', 'ACES Workflow'],
      } as any,
    })
  })

  it('renders 2-column layout with Source Serif description, studio, and "No deadline" when deadline is null', async () => {
    vi.mocked(jobsApi.getById).mockResolvedValue({ job: mockJob })
    vi.mocked(jobsApi.myMatch).mockResolvedValue(mockMatchBreakdown)

    render(
      <MemoryRouter initialEntries={['/jobs/job-101']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('About the role')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Prism Post Studio').length).toBeGreaterThan(0)
    expect(screen.getByText(/Experienced colourist needed for indie feature film grade/i)).toBeInTheDocument()
    expect(screen.getByText('No deadline')).toBeInTheDocument()
  })

  it('marks present and missing skills for signed-in talent', async () => {
    vi.mocked(jobsApi.getById).mockResolvedValue({ job: mockJob })
    vi.mocked(jobsApi.myMatch).mockResolvedValue(mockMatchBreakdown)

    render(
      <MemoryRouter initialEntries={['/jobs/job-101']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      // Matching skills have "Present in your profile"
      expect(screen.getAllByText('Present in your profile').length).toBeGreaterThan(0)
      // Missing skill has "Missing from your profile"
      expect(screen.getByText('Missing from your profile')).toBeInTheDocument()
      expect(screen.getByText('Film Emulation')).toBeInTheDocument()
    })
  })

  it('displays Score Preview as full LightMeter with reasons on the right panel', async () => {
    vi.mocked(jobsApi.getById).mockResolvedValue({ job: mockJob })
    vi.mocked(jobsApi.myMatch).mockResolvedValue(mockMatchBreakdown)

    render(
      <MemoryRouter initialEntries={['/jobs/job-101']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Score preview')).toBeInTheDocument()
      expect(screen.getByText('82')).toBeInTheDocument()
      expect(screen.getByText(/Missing 1 of 3 skills: Film Emulation/i)).toBeInTheDocument()
    })
  })

  it('opens Apply modal with score preview and confirms application with "Send application" button', async () => {
    vi.mocked(jobsApi.getById).mockResolvedValue({ job: mockJob })
    vi.mocked(jobsApi.myMatch).mockResolvedValue(mockMatchBreakdown)
    vi.mocked(applicationsApi.apply).mockResolvedValue({ application: { id: 'app-1' } as any })

    render(
      <MemoryRouter initialEntries={['/jobs/job-101']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Apply now$/i })[0]).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /^Apply now$/i })[0])

    // Modal dialog is open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Introduce yourself and explain why your experience fits/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send application' })).toBeInTheDocument()

    // Type cover note and submit
    fireEvent.change(screen.getByPlaceholderText(/Introduce yourself/i), {
      target: { value: 'Excited about the indie feature color palette.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send application' }))

    await waitFor(() => {
      expect(applicationsApi.apply).toHaveBeenCalledWith(
        {
          job_id: 'job-101',
          cover_note: 'Excited about the indie feature color palette.',
        },
        'jwt-talent-token'
      )
      expect(screen.getAllByText('Application submitted').length).toBeGreaterThan(0)
    })
  })
})
