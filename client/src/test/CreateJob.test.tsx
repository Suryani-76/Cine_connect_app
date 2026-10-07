import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CreateJob from '../pages/CreateJob'
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
      create: vi.fn(),
      update: vi.fn(),
      setRequirements: vi.fn(),
      publish: vi.fn(),
    },
    vocabApi: {
      roles: vi.fn().mockResolvedValue({ roles: [{ name: 'Gaffer', department: 'Lighting' }] }),
      skills: vi.fn().mockResolvedValue({ skills: [{ name: 'Lighting Design', category: 'Lighting' }] }),
      cities: vi.fn().mockResolvedValue({ cities: [{ name: 'Mumbai' }] }),
    },
  }
})

describe('CreateJob page wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-prod-1', email: 'studio@cine.test', role: 'production', profileId: 'prod-profile-1' },
      token: 'jwt-prod-token',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders stepper and live talent preview panel', () => {
    render(
      <MemoryRouter>
        <CreateJob />
      </MemoryRouter>
    )

    expect(screen.getByText('Job details')).toBeInTheDocument()
    expect(screen.getByText('Requirements')).toBeInTheDocument()
    expect(screen.getByText('Review & publish')).toBeInTheDocument()
    expect(screen.getByText('Talent view preview')).toBeInTheDocument()
    expect(screen.getByText('Applicant match meter preview')).toBeInTheDocument()
  })

  it('validates fields on blur and shows inline error messages', async () => {
    render(
      <MemoryRouter>
        <CreateJob />
      </MemoryRouter>
    )

    const titleInput = screen.getByLabelText(/Job title/i)
    fireEvent.focus(titleInput)
    fireEvent.change(titleInput, { target: { value: 'AB' } }) // Less than 3 chars
    fireEvent.blur(titleInput)

    expect(screen.getByText('Must be at least 3 characters')).toBeInTheDocument()

    // Correct the title
    fireEvent.change(titleInput, { target: { value: 'Lighting Gaffer' } })
    fireEvent.blur(titleInput)

    expect(screen.queryByText('Must be at least 3 characters')).not.toBeInTheDocument()
  })

  it('updates live preview as the user types', () => {
    render(
      <MemoryRouter>
        <CreateJob />
      </MemoryRouter>
    )

    const titleInput = screen.getByLabelText(/Job title/i)
    fireEvent.change(titleInput, { target: { value: 'Key Grip Specialist' } })

    expect(screen.getByRole('heading', { level: 3, name: 'Key Grip Specialist' })).toBeInTheDocument()
  })

  it('completes the 3-step wizard and publishes with "Publish job" button', async () => {
    vi.mocked(jobsApi.create).mockResolvedValue({
      job: { id: 'job-new-1', title: 'Steadicam Operator' } as any,
    })
    vi.mocked(jobsApi.setRequirements).mockResolvedValue({} as any)
    vi.mocked(jobsApi.publish).mockResolvedValue({} as any)

    render(
      <MemoryRouter>
        <CreateJob />
      </MemoryRouter>
    )

    // Step 1: Fill details
    fireEvent.change(screen.getByLabelText(/Job title/i), {
      target: { value: 'Steadicam Operator' },
    })
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Need an experienced steadicam operator for a 5-day action feature shoot.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Next: Requirements/i }))

    await waitFor(() => {
      expect(jobsApi.create).toHaveBeenCalled()
      expect(screen.getByText('Required roles')).toBeInTheDocument()
    })

    // Step 2: Next to review
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Publish job$/i })).toBeInTheDocument()
    })

    // Step 3: Publish
    fireEvent.click(screen.getByRole('button', { name: /^Publish job$/i }))

    await waitFor(() => {
      expect(jobsApi.publish).toHaveBeenCalledWith('job-new-1', 'jwt-prod-token')
    })
  })
})
