import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../pages/Landing'
import * as AuthContext from '../context/AuthContext'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

describe('Landing page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders hero, headline, and primary call-to-actions for anonymous users', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    expect(screen.getByText(/Where Filmmakers and Artists/i)).toBeInTheDocument()
    expect(screen.getByText(/Collaborate & Create/i)).toBeInTheDocument()
    expect(screen.getByText(/Join as Talent/i)).toBeInTheDocument()
    expect(screen.getByText(/Hire Crew & Cast/i)).toBeInTheDocument()
  })

  it('renders how it works sections for both sides', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    expect(screen.getByText(/For Production Houses & Studios/i)).toBeInTheDocument()
    expect(screen.getByText(/For Actors, Technicians & Crew/i)).toBeInTheDocument()
    expect(screen.getByText(/Build Your Verified Film Credit Profile/i)).toBeInTheDocument()
    expect(screen.getByText(/Post Detailed Roles with Requirements/i)).toBeInTheDocument()
  })

  it('renders features and footer legal links', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    )

    expect(screen.getByText(/7-Signal Match Engine/i)).toBeInTheDocument()
    expect(screen.getByText(/Verified Film Credits/i)).toBeInTheDocument()
    expect(screen.getByText(/Privacy Policy/i)).toBeInTheDocument()
    expect(screen.getByText(/Terms of Service/i)).toBeInTheDocument()
  })
})
