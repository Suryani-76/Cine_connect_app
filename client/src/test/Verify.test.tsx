import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Verify from '../pages/Verify'
import { authApi } from '../lib/api'

// ── Mocks ─────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  authApi: {
    verify: vi.fn().mockResolvedValue({
      message: 'Email verified',
      access_token: 'fake-jwt',
      refresh_token: 'fake-refresh',
      user: { id: 'u1', email: 'director@film.test', role: 'production' },
    }),
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      resend: vi.fn().mockResolvedValue({ error: null }),
    },
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

// ── Helper ────────────────────────────────────────────────────

const renderVerify = (state = { email: 'director@film.test', role: 'production' }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/verify', state }]}>
      <Verify />
    </MemoryRouter>
  )

// ── Tests ─────────────────────────────────────────────────────

describe('Verify page (OTP)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders verify heading and six OTP boxes', () => {
    renderVerify()
    expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument()
    const digitBoxes = [1, 2, 3, 4, 5, 6].map((i) =>
      screen.getByRole('textbox', { name: `Digit ${i}` })
    )
    expect(digitBoxes).toHaveLength(6)
  })

  it('submit button is disabled until all 6 digits are entered', async () => {
    renderVerify()
    const submitBtn = screen.getByRole('button', { name: /verify email/i })
    expect(submitBtn).toBeDisabled()

    // Enter only 3 digits
    await userEvent.type(screen.getByRole('textbox', { name: 'Digit 1' }), '1')
    await userEvent.type(screen.getByRole('textbox', { name: 'Digit 2' }), '2')
    await userEvent.type(screen.getByRole('textbox', { name: 'Digit 3' }), '3')
    expect(submitBtn).toBeDisabled()
  })

  it('typing a digit auto-advances focus to next input', async () => {
    renderVerify()
    const digit1 = screen.getByRole('textbox', { name: 'Digit 1' })
    const digit2 = screen.getByRole('textbox', { name: 'Digit 2' })

    await userEvent.type(digit1, '4')
    expect(digit1).toHaveValue('4')
    expect(digit2).toHaveFocus()
  })

  it('pasting a 6-digit code fills all inputs and enables submit', async () => {
    renderVerify()
    const digit1 = screen.getByRole('textbox', { name: 'Digit 1' })

    fireEvent.paste(digit1, {
      clipboardData: {
        getData: () => '123456',
      },
    })

    for (let i = 1; i <= 6; i++) {
      expect(screen.getByRole('textbox', { name: `Digit ${i}` })).toHaveValue(String(i))
    }
    const submitBtn = screen.getByRole('button', { name: /verify email/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it('displays specific error text on invalid or expired code', async () => {
    vi.mocked(authApi.verify).mockRejectedValueOnce(new Error('Invalid token'))
    renderVerify()
    const digit1 = screen.getByRole('textbox', { name: 'Digit 1' })

    fireEvent.paste(digit1, {
      clipboardData: {
        getData: () => '999999',
      },
    })

    const submitBtn = screen.getByRole('button', { name: /verify email/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(
        screen.getByText('That code is wrong or expired. Request a new one.')
      ).toBeInTheDocument()
    })
  })

  it('shows resend countdown timer', () => {
    renderVerify()
    expect(screen.getByText(/resend code in/i)).toBeInTheDocument()
  })

  it('successfully verifies and navigates to /create-profile', async () => {
    renderVerify()
    const digit1 = screen.getByRole('textbox', { name: 'Digit 1' })

    fireEvent.paste(digit1, {
      clipboardData: {
        getData: () => '654321',
      },
    })

    const submitBtn = screen.getByRole('button', { name: /verify email/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(authApi.verify).toHaveBeenCalledWith({
        email: 'director@film.test',
        otp: '654321',
      })
      expect(mockSetSession).toHaveBeenCalledWith(
        'fake-jwt',
        'fake-refresh',
        expect.objectContaining({
          id: 'u1',
          email: 'director@film.test',
          role: 'production',
        })
      )
      expect(mockNavigate).toHaveBeenCalledWith('/create-profile', {
        state: { user_id: 'u1', role: 'production' },
      })
    })
  })
})
