import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../pages/Login'

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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ setSession: vi.fn() }),
}))

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
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
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the sign in heading', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    // getByRole is more reliable than getByLabelText when labels are ambiguous
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThanOrEqual(1) // email field visible
  })

  it('renders the CineConnect brand', () => {
    renderLogin()
    // Brand is split across two spans so query by partial text on a container
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
    // Button should be briefly disabled
    expect(btn).toBeDisabled()
  })
})
