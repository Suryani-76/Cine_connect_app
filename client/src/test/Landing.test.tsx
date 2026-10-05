import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Landing from '../pages/Landing'
import * as AuthContext from '../context/AuthContext'

describe('Landing page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no reduced motion
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it('renders completely without API backend (static fallback and product content)', () => {
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
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    )

    // Section 1: Hero
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Hire film crew that fits the job, not just the title.'
    )
    expect(screen.getByText(/scores cast and crew against every production requirement/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Post a job/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Find film work/i })[0]).toBeInTheDocument()

    // Hero live miniature
    expect(screen.getByTestId('live-miniature')).toBeInTheDocument()
    expect(screen.getByText('12-day feature shoot, Mumbai')).toBeInTheDocument()
    expect(screen.getByText('Candidate #4108')).toBeInTheDocument()

    // Section 2: How matching works & 7 signals
    expect(screen.getByRole('heading', { name: /How matching works/i })).toBeInTheDocument()
    expect(screen.getByText('Skills match')).toBeInTheDocument()
    expect(screen.getByText('Role match')).toBeInTheDocument()
    expect(screen.getByText('Experience match')).toBeInTheDocument()
    expect(screen.getByText('Language fluency')).toBeInTheDocument()
    expect(screen.getByText('Location proximity')).toBeInTheDocument()
    expect(screen.getByText('Profile completeness')).toBeInTheDocument()
    expect(screen.getByText('Activity recency')).toBeInTheDocument()

    // Section 3: For production offices and For crew and cast
    expect(screen.getByRole('heading', { name: 'For production offices' })).toBeInTheDocument()
    expect(screen.getByText(/Filter crew by verified film credits rather than unverified resumes/i)).toBeInTheDocument()
    expect(screen.getByText(/Evaluate applicant fit instantly with 7-signal match scores/i)).toBeInTheDocument()
    expect(screen.getByText(/Initiate secure direct contact and contract discussions/i)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'For crew and cast' })).toBeInTheDocument()
    expect(screen.getByText(/Showcase validated credits and showreels in a single profile/i)).toBeInTheDocument()
    expect(screen.getByText(/See how closely your experience matches any job before you spend time applying/i)).toBeInTheDocument()
    expect(screen.getByText(/Receive direct interview and audition requests from verified studio productions/i)).toBeInTheDocument()

    // Section 4: Roles we cover
    expect(screen.getByRole('heading', { name: /Roles we cover/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cinematographer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sound Designer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editor' })).toBeInTheDocument()

    // Section 5: Trust and verification
    expect(screen.getByRole('heading', { name: /Trust and verification/i })).toBeInTheDocument()
    expect(screen.getByText(/Export or delete your data any time/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Verified studio badge' })).toBeInTheDocument()

    // Section 6: Final CTA and Public Footer
    expect(
      screen.getByRole('heading', { name: /Ready to assemble your crew or book your next film production\?/i })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Privacy Policy/i })[0]).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Terms of Service/i })).toBeInTheDocument()
  })

  it('handles reduced-motion path by rendering settled rank order immediately', () => {
    // Mock prefers-reduced-motion = true
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

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
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    )

    // In reduced motion, candidate #4108 (score 94) should be ranked #1 immediately
    const row1 = screen.getByTestId('candidate-row-c1')
    expect(row1).toHaveTextContent('#1')
    expect(row1).toHaveTextContent('Candidate #4108')
    expect(row1).toHaveTextContent('94')

    const row2 = screen.getByTestId('candidate-row-c2')
    expect(row2).toHaveTextContent('#2')
    expect(row2).toHaveTextContent('Candidate #2915')
    expect(row2).toHaveTextContent('86')

    const row3 = screen.getByTestId('candidate-row-c3')
    expect(row3).toHaveTextContent('#3')
    expect(row3).toHaveTextContent('Candidate #7032')
    expect(row3).toHaveTextContent('72')
  })

  it('contains valid and correct CTA links throughout all sections', () => {
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
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    )

    // Primary buttons
    const postJobLinks = screen.getAllByRole('link', { name: /Post a job/i })
    expect(postJobLinks[0]).toHaveAttribute('href', '/register?role=production')

    const findWorkLinks = screen.getAllByRole('link', { name: /Find film work/i })
    expect(findWorkLinks[0]).toHaveAttribute('href', '/register?role=talent')

    // Section 3 registration text links
    expect(screen.getByRole('link', { name: /Register as a production office/i })).toHaveAttribute(
      'href',
      '/register?role=production'
    )
    expect(screen.getByRole('link', { name: /Register as crew or cast/i })).toHaveAttribute(
      'href',
      '/register?role=talent'
    )

    // Section 4 role search link
    const cinematographerLink = screen.getByRole('link', { name: 'Cinematographer' })
    expect(cinematographerLink).toHaveAttribute('href', '/jobs?q=Cinematographer')

    // Section 5 Privacy policy link
    const privacyLinks = screen.getAllByRole('link', { name: /Privacy Policy/i })
    expect(privacyLinks[0]).toHaveAttribute('href', '/privacy')
  })

  it('redirects signed-in users directly to /home', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'usr-1', email: 'director@studio.com', role: 'production' } as any,
      token: 'valid-token',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<div>Home Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText(/Hire film crew that fits the job/i)).not.toBeInTheDocument()
    expect(screen.getByText('Home Dashboard Page')).toBeInTheDocument()
  })
})
