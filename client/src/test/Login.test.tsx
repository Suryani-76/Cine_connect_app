import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../pages/Login'
import { supabase } from '../lib/supabase'

// ── Mocks ─────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual as object, useNavigate: () => mockNavigate }
})

const mockSetSession = vi.fn()
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ setSession: mockSetSession }),
}))

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  productionApi: {
    getMyProfile: vi.fn().mockResolvedValue({ profile: null }),
  },
  talentApi: {
    getMyProfile: vi.fn().mockResolvedValue({ profile: null }),
  },
}))

// ── Helper ────────────────────────────────────────────────────

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )

// ── Tests ─────────────────────────────────────────────────────

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the sign in heading', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the CineConnect brand', () => {
    renderLogin()
    expect(screen.getAllByText('Connect')[0]).toBeInTheDocument()
  })

  it('shows email validation error when submitted empty', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
  })

  it('shows invalid email error for bad format', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email address/i), 'notanemail')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    })
  })

  it('shows password required error when only email is filled', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email address/i), 'test@test.com')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    renderLogin()
    const passwordInput = screen.getByLabelText(/^password$/i)
    expect(passwordInput).toHaveAttribute('type', 'password')
    const toggleBtn = screen.getByLabelText(/show password/i)
    await userEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByLabelText(/hide password/i))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('has a link to the register page', () => {
    renderLogin()
    const link = screen.getByRole('link', { name: /create one/i })
    expect(link).toHaveAttribute('href', '/register')
  })

  it('disables submit button while loading', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email address/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123')
    const btn = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(btn)
    expect(btn).toBeDisabled()
  })

  it('shows plain error message on invalid credentials without exposing whether email exists', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email address/i), 'wrong@test.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpassword')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText('Email or password is wrong.')).toBeInTheDocument()
    })
  })

  it('redirects to /create-profile when account has no profile yet', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: {
        session: { access_token: 'fake-token', refresh_token: 'fake-refresh' } as any,
        user: { id: 'user-123', email: 'noprofile@test.com' } as any,
      },
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'production' }, error: null }),
    } as any)

    renderLogin()
    await userEvent.type(screen.getByLabelText(/email address/i), 'noprofile@test.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/create-profile', { replace: true })
    })
  })
})
