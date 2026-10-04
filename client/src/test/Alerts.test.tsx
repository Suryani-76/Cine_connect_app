import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Alerts from '../pages/Alerts'
import * as AuthContext from '../context/AuthContext'
import { talentAlertsApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    talentAlertsApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

const mockAlert = {
  id: 'alert-1',
  user_id: 'user-prod-1',
  label: 'Mumbai Cinematographers',
  skills: ['Lighting', 'Gimbal'],
  role: 'Cinematographer',
  location: 'Mumbai',
  language: 'Hindi',
  active: true,
  created_at: new Date().toISOString(),
}

describe('Alerts page (production)', () => {
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

  it('renders alerts list with status badges and criteria pills', async () => {
    vi.mocked(talentAlertsApi.list).mockResolvedValue({
      alerts: [mockAlert],
    })

    render(
      <MemoryRouter>
        <Alerts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Mumbai Cinematographers')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Cinematographer')).toBeInTheDocument()
      expect(screen.getByText('Mumbai')).toBeInTheDocument()
    })
  })

  it('renders empty state when no alerts exist', async () => {
    vi.mocked(talentAlertsApi.list).mockResolvedValue({
      alerts: [],
    })

    render(
      <MemoryRouter>
        <Alerts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No talent alerts yet/i)).toBeInTheDocument()
      expect(screen.getByText(/Create your first alert/i)).toBeInTheDocument()
    })
  })

  it('toggles active status using talentAlertsApi.update', async () => {
    vi.mocked(talentAlertsApi.list).mockResolvedValue({
      alerts: [mockAlert],
    })
    vi.mocked(talentAlertsApi.update).mockResolvedValue({
      alert: { ...mockAlert, active: false },
    })

    render(
      <MemoryRouter>
        <Alerts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Mumbai Cinematographers')).toBeInTheDocument()
    })

    const pauseBtn = screen.getByRole('button', { name: /Pause/i })
    fireEvent.click(pauseBtn)

    await waitFor(() => {
      expect(talentAlertsApi.update).toHaveBeenCalledWith('alert-1', { active: false }, 'jwt-token')
      expect(screen.getByText('Paused')).toBeInTheDocument()
    })
  })

  it('deletes an alert after confirmation', async () => {
    window.confirm = vi.fn().mockReturnValue(true)
    vi.mocked(talentAlertsApi.list).mockResolvedValue({
      alerts: [mockAlert],
    })
    vi.mocked(talentAlertsApi.delete).mockResolvedValue({ ok: true })

    render(
      <MemoryRouter>
        <Alerts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Mumbai Cinematographers')).toBeInTheDocument()
    })

    const deleteBtn = screen.getByTitle(/Delete alert/i)
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(talentAlertsApi.delete).toHaveBeenCalledWith('alert-1', 'jwt-token')
      expect(screen.queryByText('Mumbai Cinematographers')).not.toBeInTheDocument()
    })
  })

  it('opens modal and creates a new alert', async () => {
    vi.mocked(talentAlertsApi.list).mockResolvedValue({
      alerts: [],
    })
    const newAlert = {
      id: 'alert-2',
      user_id: 'user-prod-1',
      label: 'Kerala Editors',
      skills: ['Premiere Pro'],
      role: 'Editor',
      location: 'Kochi',
      language: 'Malayalam',
      active: true,
      created_at: new Date().toISOString(),
    }
    vi.mocked(talentAlertsApi.create).mockResolvedValue({
      alert: newAlert,
    })

    render(
      <MemoryRouter>
        <Alerts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Create your first alert/i)).toBeInTheDocument()
    })

    // Click create button
    const openBtn = screen.getByText(/Create your first alert/i)
    fireEvent.click(openBtn)

    // Form appears
    expect(screen.getByText('Create Talent Alert')).toBeInTheDocument()

    const labelInput = screen.getByPlaceholderText(/e.g. Senior Cinematographers in Mumbai/i)
    fireEvent.change(labelInput, { target: { value: 'Kerala Editors' } })

    const submitBtn = screen.getByRole('button', { name: /Save Alert/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(talentAlertsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Kerala Editors' }),
        'jwt-token'
      )
      expect(screen.getByText('Kerala Editors')).toBeInTheDocument()
    })
  })
})
