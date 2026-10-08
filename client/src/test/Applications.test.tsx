import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Applications from '../pages/Applications'
import * as AuthContext from '../context/AuthContext'
import { applicationsApi, jobsApi, talentApi } from '../lib/api'

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
    applicationsApi: {
      forJob: vi.fn(),
      updateStatus: vi.fn(),
      matchBreakdown: vi.fn(),
    },
    talentApi: {
      getProfile: vi.fn(),
      getResumeSignedUrl: vi.fn(),
    },
  }
})

vi.mock('../components/PageHeader', () => ({
  PageHeader: ({ title, description, action }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {action}
    </div>
  ),
}))

const mockJobs = [
  {
    id: 'job-1',
    production_id: 'prod-1',
    title: 'Lead Cinematographer',
    description: 'Feature film shooting in Mumbai',
    status: 'published' as const,
    openings: 2,
    created_at: new Date().toISOString(),
  },
]

const mockApplications = [
  {
    id: 'app-1',
    job_id: 'job-1',
    talent_profile_id: 'talent-1',
    cover_note: 'Passionate DP with ARRI experience',
    status: 'applied' as const,
    match_score: 95,
    matching_skills: ['ARRI Alexa', 'Lighting'],
    missing_skills: [],
    reasons: { skills_match: 'Matched 2 of 2 required skills' },
    summary_reasons: ['Strong camera gear match', 'Over 7 years experience'],
    score_breakdown: {
      skills_match: 30,
      role_match: 20,
      experience_match: 15,
      language_match: 10,
      location_proximity: 10,
      profile_completeness: 5,
      activity_recency: 5,
    },
    applied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    talent_profiles: {
      id: 'talent-1',
      user_id: 'usr-1',
      full_name: 'Priya Sharma',
      bio: 'Award-winning DP',
      role: 'Cinematographer',
      skills: ['ARRI Alexa', 'Lighting'],
      experience_years: 8,
      language: 'Hindi',
      location: 'Mumbai',
      avatar_url: null,
      portfolio_url: 'https://priyasharma.film',
      showreel_url: 'https://vimeo.com/123456',
      availability: 'open' as const,
      has_resume: true,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'app-2',
    job_id: 'job-1',
    talent_profile_id: 'talent-2',
    cover_note: 'Operator ready to shoot',
    status: 'shortlisted' as const,
    match_score: 85,
    matching_skills: ['Steadicam'],
    missing_skills: ['ARRI Alexa'],
    summary_reasons: ['Great camera skills'],
    score_breakdown: {
      skills_match: 20,
      role_match: 20,
      experience_match: 15,
      language_match: 10,
      location_proximity: 10,
      profile_completeness: 5,
      activity_recency: 5,
    },
    applied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    talent_profiles: {
      id: 'talent-2',
      user_id: 'usr-2',
      full_name: 'Rahul Verma',
      bio: 'Steadicam operator',
      role: 'Camera Operator',
      skills: ['Steadicam'],
      experience_years: 5,
      language: 'Hindi',
      location: 'Mumbai',
      avatar_url: null,
      portfolio_url: null,
      showreel_url: null,
      availability: 'within_2_weeks' as const,
      has_resume: false,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'app-3',
    job_id: 'job-1',
    talent_profile_id: 'talent-3',
    cover_note: 'Experienced with gaffer work',
    status: 'interview' as const,
    match_score: 80,
    matching_skills: ['Lighting Design'],
    missing_skills: [],
    summary_reasons: ['Lighting expertise'],
    score_breakdown: {
      skills_match: 20,
      role_match: 15,
      experience_match: 15,
      language_match: 10,
      location_proximity: 10,
      profile_completeness: 5,
      activity_recency: 5,
    },
    applied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    talent_profiles: {
      id: 'talent-3',
      user_id: 'usr-3',
      full_name: 'Amit Kumar',
      bio: 'Gaffer and lighting tech',
      role: 'Gaffer',
      skills: ['Lighting Design'],
      experience_years: 6,
      language: 'Hindi',
      location: 'Delhi',
      avatar_url: null,
      portfolio_url: null,
      showreel_url: null,
      availability: 'busy' as const,
      has_resume: true,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'app-4',
    job_id: 'job-1',
    talent_profile_id: 'talent-4',
    cover_note: 'Hired talent',
    status: 'hired' as const,
    match_score: 92,
    matching_skills: ['ARRI Alexa', 'Cooke Lenses'],
    missing_skills: [],
    summary_reasons: ['Top tier match'],
    score_breakdown: {
      skills_match: 28,
      role_match: 20,
      experience_match: 15,
      language_match: 10,
      location_proximity: 10,
      profile_completeness: 5,
      activity_recency: 4,
    },
    applied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    talent_profiles: {
      id: 'talent-4',
      user_id: 'usr-4',
      full_name: 'Sneha Patel',
      bio: 'Cinematographer',
      role: 'Cinematographer',
      skills: ['ARRI Alexa'],
      experience_years: 9,
      language: 'English',
      location: 'Mumbai',
      avatar_url: null,
      portfolio_url: null,
      showreel_url: null,
      availability: 'open' as const,
      has_resume: true,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'app-5',
    job_id: 'job-1',
    talent_profile_id: 'talent-5',
    cover_note: 'Rejected profile',
    status: 'rejected' as const,
    match_score: 45,
    matching_skills: [],
    missing_skills: ['ARRI Alexa'],
    summary_reasons: ['Low skills match'],
    score_breakdown: {
      skills_match: 10,
      role_match: 10,
      experience_match: 10,
      language_match: 5,
      location_proximity: 5,
      profile_completeness: 5,
      activity_recency: 0,
    },
    applied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    talent_profiles: {
      id: 'talent-5',
      user_id: 'usr-5',
      full_name: 'Vikram Das',
      bio: 'Sound technician',
      role: 'Sound Mixer',
      skills: [],
      experience_years: 2,
      language: 'Hindi',
      location: 'Kolkata',
      avatar_url: null,
      portfolio_url: null,
      showreel_url: null,
      availability: 'unavailable' as const,
      has_resume: false,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  },
]

describe('Applications / Applicants Page (F6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      token: 'mock-token',
      user: {
        id: 'usr-prod',
        email: 'studio@cineconnect.test',
        role: 'production',
        profileId: 'prod-1',
      },
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      loading: false,
    } as any)

    vi.mocked(jobsApi.list).mockResolvedValue({ jobs: mockJobs } as any)
    vi.mocked(applicationsApi.forJob).mockResolvedValue({
      applications: mockApplications,
    } as any)
    vi.mocked(applicationsApi.updateStatus).mockResolvedValue({
      application: mockApplications[0],
    } as any)
    vi.mocked(applicationsApi.matchBreakdown).mockResolvedValue({
      total: 95,
      signals: {} as any,
      matching_skills: ['ARRI Alexa', 'Lighting'],
      missing_skills: [],
      summary_reasons: ['Strong match'],
    } as any)
    vi.mocked(talentApi.getProfile).mockResolvedValue({
      profile: {
        ...mockApplications[0].talent_profiles,
        credits: [
          {
            project_title: 'Dharma Feature',
            role: 'DP',
            year: 2024,
            production_company: 'Dharma',
          },
        ],
      },
    } as any)
    vi.mocked(talentApi.getResumeSignedUrl).mockResolvedValue({
      signed_url: 'https://example.com/resume.pdf',
      expires_in: 3600,
    })
  })

  it('renders stage grouping with Applied, Shortlisted, Interview, Hired and Closed', async () => {
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    })

    // Check pipeline stage columns
    expect(screen.getAllByText(/^Applied$/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/^Shortlisted$/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/^Interview$/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/^Hired$/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Closed \(1\)/i)[0]).toBeInTheDocument()

    // Candidates in their respective stages
    expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument()
    expect(screen.getByText('Amit Kumar')).toBeInTheDocument()
    expect(screen.getByText('Sneha Patel')).toBeInTheDocument()
  })

  it('sorts candidates by match score descending', async () => {
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    })

    // Priya (95) has rank #1
    expect(screen.getAllByText('#1')[0]).toBeInTheDocument()
  })

  it('requires confirmation dialog for Hire with specific role-filled notice', async () => {
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    })

    // Find Priya's Actions menu button
    const actionButtons = screen.getAllByRole('button', { name: /actions/i })
    fireEvent.click(actionButtons[0])

    // Click Hire
    const hireItem = screen.getByRole('menuitem', { name: /hire/i })
    fireEvent.click(hireItem)

    // Verify modal appeared with the exact required notice
    expect(
      screen.getByText(/Others will be told the role is filled when all openings are hired/i)
    ).toBeInTheDocument()

    // Confirm hire
    const confirmHireBtn = screen.getByRole('button', { name: /^Confirm hire$/i })
    fireEvent.click(confirmHireBtn)

    await waitFor(() => {
      expect(applicationsApi.updateStatus).toHaveBeenCalledWith(
        'app-1',
        'hired',
        'mock-token',
        undefined
      )
    })
  })

  it('requires confirmation dialog for Reject and updates status', async () => {
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    })

    const actionButtons = screen.getAllByRole('button', { name: /actions/i })
    fireEvent.click(actionButtons[0])

    const rejectItem = screen.getByRole('menuitem', { name: /reject/i })
    fireEvent.click(rejectItem)

    expect(screen.getByRole('heading', { name: /^Reject applicant$/i })).toBeInTheDocument()
    expect(screen.getByText(/They will be moved to the closed pipeline/i)).toBeInTheDocument()

    const confirmRejectBtn = screen.getByRole('button', { name: /^Reject applicant$/i })
    fireEvent.click(confirmRejectBtn)

    await waitFor(() => {
      expect(applicationsApi.updateStatus).toHaveBeenCalledWith(
        'app-1',
        'rejected',
        'mock-token',
        undefined
      )
    })
  })

  it('enforces comparison selection limits (2 to 4 applicants)', async () => {
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox', { name: /select/i })
    expect(checkboxes.length).toBeGreaterThanOrEqual(4)

    // Select 1
    fireEvent.click(checkboxes[0])
    expect(screen.queryByRole('button', { name: /compare candidates/i })).not.toBeInTheDocument()

    // Select 2
    fireEvent.click(checkboxes[1])
    expect(screen.getByRole('button', { name: /compare candidates/i })).toBeInTheDocument()

    // Select 3 & 4
    fireEvent.click(checkboxes[2])
    fireEvent.click(checkboxes[3])
    expect(screen.getByText(/4 applicants selected/i)).toBeInTheDocument()

    // Open comparison
    const compareBtn = screen.getByRole('button', { name: /compare candidates/i })
    fireEvent.click(compareBtn)

    // Verify comparison sheet opened
    await waitFor(() => {
      expect(screen.getByText(/Candidate comparison/i)).toBeInTheDocument()
    })
  })

  it('supports keyboard operation of action menus (open and Escape to close)', async () => {
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    })

    const actionButtons = screen.getAllByRole('button', { name: /actions/i })
    const firstMenuBtn = actionButtons[0]

    // Open menu
    fireEvent.click(firstMenuBtn)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens detail drawer with cover note and full breakdown on row click', async () => {
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma')[0]).toBeInTheDocument()
    })

    // Click candidate card
    fireEvent.click(screen.getAllByText('Priya Sharma')[0])

    await waitFor(() => {
      expect(screen.getByText('Applicant details')).toBeInTheDocument()
      expect(screen.getByText('Passionate DP with ARRI experience')).toBeInTheDocument()
      expect(screen.getByText('Match evaluation')).toBeInTheDocument()
    })
  })
})
