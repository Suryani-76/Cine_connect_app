import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home'
import * as AuthContext from '../context/AuthContext'
import {
  jobsApi,
  applicationsApi,
  dashboardApi,
  savedJobsApi,
  talentApi,
} from '../lib/api'

// Mock supabase channel to prevent socket issues
vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: vi.fn(),
  },
}))

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    dashboardApi: {
      stats: vi.fn(),
    },
    jobsApi: {
      list: vi.fn(),
      listPublished: vi.fn(),
      close: vi.fn(),
    },
    applicationsApi: {
      forJob: vi.fn(),
      myApplications: vi.fn(),
      withdraw: vi.fn(),
    },
    savedJobsApi: {
      list: vi.fn(),
    },
    talentApi: {
      search: vi.fn(),
      getMyProfile: vi.fn(),
    },
  }
})

describe('Home Page (Dashboards)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─────────────────────────────────────────────────────────────
  // 1. Production Role Dashboard
  // ─────────────────────────────────────────────────────────────
  describe('Production Dashboard', () => {
    const mockJobs = [
      {
        id: 'job-1',
        production_id: 'prod-1',
        title: 'Lead Cinematographer',
        description: 'Feature film shooting in Mumbai',
        status: 'published' as const,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // closing in 3 days
        created_at: new Date().toISOString(),
        production_profiles: {
          id: 'prod-1',
          company_name: 'Studio Nova',
          bio: null,
          logo_url: null,
        },
        job_requirements: {
          id: 'req-1',
          job_id: 'job-1',
          skills: ['Arri Alexa', 'Lighting'],
          roles: ['Cinematographer'],
          experience_level: 'senior',
          language: 'Hindi',
          location: 'Mumbai',
        },
      },
      {
        id: 'job-2',
        production_id: 'prod-1',
        title: 'Production Assistant',
        description: 'Entry level set PA',
        status: 'draft' as const,
        deadline: null,
        created_at: new Date().toISOString(),
        production_profiles: {
          id: 'prod-1',
          company_name: 'Studio Nova',
          bio: null,
          logo_url: null,
        },
        job_requirements: {
          id: 'req-2',
          job_id: 'job-2',
          skills: ['Coordination'],
          roles: ['Production Assistant'],
          experience_level: 'entry',
          language: 'English',
          location: 'Mumbai',
        },
      },
    ]

    const mockApplicationsForJob1 = [
      {
        id: 'app-1',
        job_id: 'job-1',
        talent_profile_id: 'talent-1',
        status: 'applied' as const,
        match_score: 91,
        applied_at: new Date().toISOString(),
      },
      {
        id: 'app-2',
        job_id: 'job-1',
        talent_profile_id: 'talent-2',
        status: 'interview' as const,
        match_score: 85,
        applied_at: new Date().toISOString(),
      },
    ]

    const mockTalent = [
      {
        id: 'talent-1',
        full_name: 'Aarav Sharma',
        role: 'Cinematographer',
        location: 'Mumbai',
        skills: ['Arri Alexa', 'Gaffer'],
        bio: 'Award winning DOP with 10 years experience.',
        verified: true,
      },
    ]

    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-prod',
          email: 'producer@studio.com',
          role: 'production',
          profileId: 'prod-1',
          company_name: 'Studio Nova',
        },
        token: 'test-token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(dashboardApi.stats).mockResolvedValue({
        stats: {
          active_jobs: 1,
          new_applications: 1,
          recommended_talent: 4,
          unread_notifications: 3,
        },
      })

      vi.mocked(jobsApi.list).mockResolvedValue({
        jobs: mockJobs,
        total: 2,
      })

      vi.mocked(applicationsApi.forJob).mockImplementation(async (jobId) => {
        if (jobId === 'job-1') {
          return { applications: mockApplicationsForJob1 } as any
        }
        return { applications: [] } as any
      })

      vi.mocked(talentApi.search).mockResolvedValue({
        talent: mockTalent as any,
      })
    })

    it('renders page header with exactly one "New job" button', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { name: /production dashboard/i })).toBeInTheDocument()
      const newJobButtons = screen.getAllByRole('button', { name: /new job/i })
      expect(newJobButtons).toHaveLength(1)
    })

    it('replaces 4 stat cards with a single line of actionable summary numbers', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/dashboard metrics summary/i)).toBeInTheDocument()
      })

      const summary = screen.getByLabelText(/dashboard metrics summary/i)
      // Contains active jobs, new applicants, talent matches, notifications as links when count > 0
      expect(within(summary).getByRole('link', { name: /active jobs?/i })).toHaveAttribute('href', '/jobs')
      expect(within(summary).getByRole('link', { name: /new applicants?/i })).toHaveAttribute('href', '/applications')
      expect(within(summary).getByRole('link', { name: /talent matches/i })).toHaveAttribute('href', '/search')
      expect(within(summary).getByRole('link', { name: /notifications/i })).toHaveAttribute('href', '/notifications')

      // Confirm no ALL-CAPS card labels
      expect(screen.queryByText('ACTIVE JOBS')).not.toBeInTheDocument()
      expect(screen.queryByText('NEW APPLICANTS')).not.toBeInTheDocument()
    })

    it('renders "Needs attention" actionable rows for applicants and closing jobs', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /needs attention/i })).toBeInTheDocument()
      })

      expect(screen.getByText(/1 new applicant waiting for review/i)).toBeInTheDocument()
      expect(screen.getByText(/1 interview scheduled this week/i)).toBeInTheDocument()
      expect(screen.getByText(/1 job post closing soon/i)).toBeInTheDocument()
    })

    it('renders My jobs as a DataTable and shows "No applicants yet" when applicant count is 0', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my jobs/i })).toBeInTheDocument()
      })

      // Check table column headers
      expect(screen.getByRole('columnheader', { name: /job title/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /applicants/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /best match/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /deadline/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument()

      // Job 1 has 2 applicants with best match score 91
      expect(screen.getAllByText('Lead Cinematographer').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByLabelText(/match score 91 out of 100/i).length).toBeGreaterThanOrEqual(1)

      // Job 2 has 0 applicants -> strictly shows "No applicants yet"
      expect(screen.getAllByText('Production Assistant').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('No applicants yet').length).toBeGreaterThan(0)
    })

    it('renders status filter with separate count elements and filters list', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('tablist', { name: /filter jobs by status/i })).toBeInTheDocument()
      })

      // Distinct count buttons
      const allTab = screen.getByRole('tab', { name: /all/i })
      const draftsTab = screen.getByRole('tab', { name: /drafts/i })
      const publishedTab = screen.getByRole('tab', { name: /published/i })

      expect(allTab).toHaveTextContent('2')
      expect(draftsTab).toHaveTextContent('1')
      expect(publishedTab).toHaveTextContent('1')

      // Click drafts tab
      fireEvent.click(draftsTab)
      expect(screen.getAllByText('Production Assistant').length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText('Lead Cinematographer')).not.toBeInTheDocument()
    })

    it('renders Recommended talent as compact rows with match scores', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /recommended talent/i })).toBeInTheDocument()
      })

      const talentSection = screen.getByRole('heading', { name: /recommended talent/i }).closest('section')!
      expect(within(talentSection).getByText('Aarav Sharma')).toBeInTheDocument()
      expect(within(talentSection).getByText(/cinematographer/i)).toBeInTheDocument()
    })

    it('renders mobile job cards with "No deadline" fallback and matching label styling', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByText('Production Assistant').length).toBeGreaterThanOrEqual(1)
      })

      // Production Assistant has deadline: null, so mobile card renders "No deadline"
      expect(screen.getAllByText('No deadline').length).toBeGreaterThanOrEqual(1)
      // Must not display "Deadline: No deadline"
      expect(screen.queryByText(/Deadline:\s*No deadline/i)).not.toBeInTheDocument()

      // Best match label styling
      const bestMatchLabels = screen.getAllByText('Best match')
      expect(bestMatchLabels[0]).toHaveClass('text-12')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. Talent Role Dashboard
  // ─────────────────────────────────────────────────────────────
  describe('Talent Dashboard', () => {
    const mockProfile = {
      id: 'talent-1',
      user_id: 'user-talent',
      full_name: 'Priya Patel',
      role: 'Production Designer',
      location: 'Mumbai',
      skills: ['Art Direction', 'Set Design', 'Props'],
      bio: '', // incomplete bio
      showreel_url: null,
      portfolio_url: null,
    }

    const mockMyApps = [
      {
        id: 'app-active',
        job_id: 'job-10',
        talent_profile_id: 'talent-1',
        cover_note: 'Excited about this project',
        status: 'shortlisted' as const,
        match_score: 88,
        applied_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        jobs: {
          id: 'job-10',
          title: 'Senior Art Director',
          description: 'Period drama set in 1920s',
          status: 'published',
          created_at: new Date().toISOString(),
          production_profiles: {
            id: 'prod-2',
            company_name: 'Dharma Studios',
            logo_url: null,
            verified: true,
          },
          job_requirements: {
            skills: ['Art Direction'],
            roles: ['Art Director'],
            experience_level: 'senior',
            language: 'Hindi',
            location: 'Mumbai',
          },
        },
      },
      {
        id: 'app-rejected',
        job_id: 'job-11',
        talent_profile_id: 'talent-1',
        cover_note: '',
        status: 'rejected' as const,
        match_score: 72,
        applied_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        jobs: {
          id: 'job-11',
          title: 'Props Master',
          description: 'Sci-fi short film',
          status: 'published',
          created_at: new Date().toISOString(),
          production_profiles: {
            id: 'prod-3',
            company_name: 'Indie Wave',
            logo_url: null,
            verified: false,
          },
          job_requirements: null,
        },
      },
      {
        id: 'app-withdrawn',
        job_id: 'job-12',
        talent_profile_id: 'talent-1',
        cover_note: '',
        status: 'withdrawn' as const,
        match_score: 65,
        applied_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        jobs: {
          id: 'job-12',
          title: 'Set Decorator',
          description: 'Commercial shoot',
          status: 'published',
          created_at: new Date().toISOString(),
          production_profiles: {
            id: 'prod-4',
            company_name: 'Commercial Works',
            logo_url: null,
          },
          job_requirements: null,
        },
      },
    ]

    const mockRecommendedJobs = [
      {
        id: 'rec-1',
        production_id: 'prod-10',
        title: 'Lead Costume Designer',
        description: 'Historical period production in Rajasthan.',
        status: 'published' as const,
        created_at: new Date().toISOString(),
        match_score: 87,
        production_profiles: {
          id: 'prod-10',
          company_name: 'Heritage Films',
          bio: 'Feature productions',
          logo_url: null,
        },
        job_requirements: {
          id: 'req-10',
          job_id: 'rec-1',
          skills: ['Costume', 'Textiles'],
          roles: ['Costume Designer'],
          experience_level: 'mid',
          language: 'Hindi',
          location: 'Jaipur',
        },
      },
    ]

    const mockSavedJobs = [
      {
        id: 'saved-1',
        job_id: 'rec-1',
        created_at: new Date().toISOString(),
        jobs: {
          id: 'rec-1',
          production_id: 'prod-10',
          title: 'Lead Costume Designer',
          description: 'Historical period production in Rajasthan.',
          status: 'published' as const,
          created_at: new Date().toISOString(),
          production_profiles: {
            id: 'prod-10',
            company_name: 'Heritage Films',
            bio: 'Feature productions',
            logo_url: null,
          },
          job_requirements: {
            id: 'req-10',
            job_id: 'rec-1',
            skills: ['Costume'],
            roles: ['Costume Designer'],
            experience_level: 'mid',
            language: 'Hindi',
            location: 'Jaipur',
          },
        },
      },
    ]

    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-talent',
          email: 'talent@cineconnect.test',
          role: 'talent',
          profileId: 'talent-1',
        },
        token: 'talent-token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(talentApi.getMyProfile).mockResolvedValue({
        profile: mockProfile as any,
      })

      vi.mocked(applicationsApi.myApplications).mockResolvedValue({
        applications: mockMyApps as any,
      })

      vi.mocked(jobsApi.listPublished).mockResolvedValue({
        jobs: mockRecommendedJobs as any,
      })

      vi.mocked(savedJobsApi.list).mockResolvedValue({
        saved: mockSavedJobs as any,
      })
    })

    it('renders profile completeness card with missing prompt', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/complete your profile to see matches/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/next: write a brief professional bio/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /complete profile/i })).toBeInTheDocument()
    })

    it('renders My applications with 4-step status stepper for active application', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my applications/i })).toBeInTheDocument()
      })

      expect(screen.getByText('Senior Art Director')).toBeInTheDocument()
      const stepper = screen.getByLabelText(/application progress: shortlisted/i)
      expect(stepper).toBeInTheDocument()
      expect(within(stepper).getByText('Applied')).toBeInTheDocument()
      expect(within(stepper).getByText('Shortlisted')).toBeInTheDocument()
      expect(within(stepper).getByText('Interview')).toBeInTheDocument()
      expect(within(stepper).getByText('Hired')).toBeInTheDocument()
    })

    it('renders rejected and withdrawn as distinct end-state badges (not a fifth stepper step)', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Props Master')).toBeInTheDocument()
      })

      // Rejected end state
      expect(screen.getByText('Application not selected')).toBeInTheDocument()

      // Withdrawn end state
      expect(screen.getByText('Withdrawn')).toBeInTheDocument()
    })

    it('renders recommended jobs with LightMeter score preview', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /recommended jobs/i })).toBeInTheDocument()
      })

      const recSection = screen.getByRole('heading', { name: /recommended jobs/i }).closest('section')!
      expect(within(recSection).getByText('Lead Costume Designer')).toBeInTheDocument()
      expect(within(recSection).getByLabelText(/match score 87 out of 100/i)).toBeInTheDocument()
    })

    it('renders saved jobs section', async () => {
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /saved jobs/i })).toBeInTheDocument()
      })

      const savedSection = screen.getByRole('heading', { name: /saved jobs/i }).closest('section')!
      expect(within(savedSection).getByText('Lead Costume Designer')).toBeInTheDocument()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. Empty States
  // ─────────────────────────────────────────────────────────────
  describe('Empty States', () => {
    it('renders production empty state: "No jobs posted yet" with "Post your first job" CTA', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-prod',
          email: 'producer@studio.com',
          role: 'production',
          profileId: 'prod-empty',
        },
        token: 'token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(dashboardApi.stats).mockResolvedValue({
        stats: {
          active_jobs: 0,
          new_applications: 0,
          recommended_talent: 0,
          unread_notifications: 0,
        },
      })
      vi.mocked(jobsApi.list).mockResolvedValue({ jobs: [], total: 0 })
      vi.mocked(talentApi.search).mockResolvedValue({ talent: [] })

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/no jobs posted yet/i)).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /post your first job/i })).toBeInTheDocument()

      // When counts are 0, numbers are plain text (not links)
      const summary = screen.getByLabelText(/dashboard metrics summary/i)
      expect(within(summary).queryByRole('link')).not.toBeInTheDocument()

      // Needs attention empty state shows stacked message and link
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /manage postings/i })).toBeInTheDocument()
    })

    it('renders talent empty state: "No applications yet" with "Browse open jobs" CTA', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-talent',
          email: 'talent@studio.com',
          role: 'talent',
          profileId: 'talent-empty',
        },
        token: 'token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(talentApi.getMyProfile).mockResolvedValue({
        profile: {
          id: 'talent-empty',
          user_id: 'user-talent',
          full_name: 'New Talent',
          role: 'Director',
          location: 'Delhi',
          skills: ['Directing', 'Script', 'Casting'],
          bio: '15 years directing award winning documentaries.',
          showreel_url: 'https://vimeo.com/123',
          portfolio_url: null,
        } as any,
      })
      vi.mocked(applicationsApi.myApplications).mockResolvedValue({ applications: [] })
      vi.mocked(jobsApi.listPublished).mockResolvedValue({ jobs: [] })
      vi.mocked(savedJobsApi.list).mockResolvedValue({ saved: [] })

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/no applications yet/i)).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /browse open jobs/i })).toBeInTheDocument()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. Error States with Retry
  // ─────────────────────────────────────────────────────────────
  describe('Error States with Retry', () => {
    it('renders per-section error state in production dashboard with working retry', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-prod',
          email: 'producer@studio.com',
          role: 'production',
          profileId: 'prod-err',
        },
        token: 'token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(dashboardApi.stats).mockRejectedValue(new Error('Network failure'))
      vi.mocked(jobsApi.list).mockRejectedValue(new Error('Server error loading jobs'))
      vi.mocked(talentApi.search).mockRejectedValue(new Error('Failed to load recommended talent'))

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Server error loading jobs')).toBeInTheDocument()
      })

      const retryButtons = screen.getAllByRole('button', { name: /try again/i })
      expect(retryButtons.length).toBeGreaterThan(0)

      // Test retry action
      vi.mocked(jobsApi.list).mockResolvedValueOnce({ jobs: [], total: 0 })
      fireEvent.click(retryButtons[0])
      expect(jobsApi.list).toHaveBeenCalled()
    })

    it('renders per-section error state in talent dashboard with working retry', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-talent',
          email: 'talent@studio.com',
          role: 'talent',
          profileId: 'talent-err',
        },
        token: 'token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(talentApi.getMyProfile).mockResolvedValue({ profile: null as any })
      vi.mocked(applicationsApi.myApplications).mockRejectedValue(new Error('Could not fetch apps'))
      vi.mocked(jobsApi.listPublished).mockRejectedValue(new Error('Jobs unavailable'))
      vi.mocked(savedJobsApi.list).mockRejectedValue(new Error('Saved unavailable'))

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Could not fetch apps')).toBeInTheDocument()
      })

      const retryButtons = screen.getAllByRole('button', { name: /try again/i })
      expect(retryButtons.length).toBeGreaterThan(0)

      vi.mocked(applicationsApi.myApplications).mockResolvedValueOnce({ applications: [] })
      fireEvent.click(retryButtons[0])
      expect(applicationsApi.myApplications).toHaveBeenCalled()
    })
  })
})
