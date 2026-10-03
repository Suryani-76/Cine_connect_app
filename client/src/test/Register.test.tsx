import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '../pages/Register'

// ── Mocks ─────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  authApi: {
    register: vi.fn().mockResolvedValue({ message: 'ok', user: { id: '1', email: 'test@test.com', username: 'testuser', role: 'production' } }),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual as object, useNavigate: () => mockNavigate }
})

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

// ── Helper ────────────────────────────────────────────────────

const renderRegister = () =>
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )

// ── Tests ─────────────────────────────────────────────────────

describe('Register page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the create account heading', () => {
    renderRegister()
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })

  it('renders role selector with Production and Talent options', () => {
    renderRegister()
    expect(screen.getByRole('button', { name: /production house/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /talent/i })).toBeInTheDocument()
  })

  it('renders all form fields', () => {
    renderRegister()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('shows email required error on empty submit', async () => {
    renderRegister()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
  })

  it('shows username too short error', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/username/i), 'ab')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/min. 3 characters/i)).toBeInTheDocument()
    })
  })

  it('shows password mismatch error', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'differentpassword')
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument()
    })
  })

  it('shows password too short error', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/^password$/i), 'short')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short')
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/min. 8 characters/i)).toBeInTheDocument()
    })
  })

  it('shows consent required error if not checked', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/you must agree to the terms/i)).toBeInTheDocument()
    })
  })

  it('renders links to terms and privacy policies', () => {
    renderRegister()
    const termsLink = screen.getAllByRole('link', { name: /terms of service/i })[0]
    const privacyLink = screen.getAllByRole('link', { name: /privacy policy/i })[0]
    expect(termsLink).toHaveAttribute('href', '/terms')
    expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  it('navigates to /verify on successful registration', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123')
    await userEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/verify', expect.objectContaining({
        state: expect.objectContaining({ email: 'test@test.com' }),
      }))
    })
  })

  it('has a link to the login page', () => {
    renderRegister()
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('Production House role button is selected by default', () => {
    renderRegister()
    const prodBtn = screen.getByRole('button', { name: /production house/i })
    expect(prodBtn.className).toContain('border-brand')
  })

  it('Talent role button becomes selected when clicked', async () => {
    renderRegister()
    const talentBtn = screen.getByRole('button', { name: /talent/i })
    await userEvent.click(talentBtn)
    expect(talentBtn.className).toContain('border-brand')
  })
})
