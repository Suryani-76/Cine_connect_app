import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Search from '../pages/Search'
import * as AuthContext from '../context/AuthContext'
import { talentApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    talentApi: {
      search: vi.fn(),
    },
  }
})

describe('Search Page URL Filter Synchronization (F7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'u-prod',
        email: 'prod@cine.test',
        role: 'production',
        profileId: 'p-1',
      },
      token: 'jwt-auth-token',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('initializes filters from URL search params and queries talentApi.search with them', async () => {
    vi.mocked(talentApi.search).mockResolvedValue({
      talent: [
        {
          id: 'tal-1',
          user_id: 'u-1',
          full_name: 'Pooja Verma',
          role: 'Cinematographer',
          roles: ['Cinematographer', 'Colorist'],
          skills: ['Lighting', 'Color Grading'],
          experience_years: 5,
          location: 'Mumbai',
          language: 'Hindi',
          availability: 'open',
          last_active_at: new Date().toISOString(),
          bio: 'Cinematographer and colorist',
          avatar_url: null,
          portfolio_url: null,
          has_resume: true,
          created_at: new Date().toISOString(),
        } as any,
      ],
    })

    const initialUrl = '/search?role=Cinematographer&location=Mumbai&skills=Lighting,Color+Grading&availability=open&language=Hindi'

    render(
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="/search" element={<Search />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(talentApi.search).toHaveBeenCalledWith(
        {
          role: 'Cinematographer',
          location: 'Mumbai',
          skills: ['Lighting', 'Color Grading'],
          availability: 'open',
          language: 'Hindi',
        },
        'jwt-auth-token'
      )
    })

    // Active filter chips should be visible
    expect(screen.getByText('Role: Cinematographer')).toBeInTheDocument()
    expect(screen.getByText('Location: Mumbai')).toBeInTheDocument()
    expect(screen.getByText('Skill: Lighting')).toBeInTheDocument()
    expect(screen.getByText('Skill: Color Grading')).toBeInTheDocument()

    // Results rendered
    expect(screen.getByText('Pooja Verma')).toBeInTheDocument()
    expect(screen.getByText('Create alert from search')).toBeInTheDocument()
  })

  it('renders Lucide empty state without emoji magnifier when no results match', async () => {
    vi.mocked(talentApi.search).mockResolvedValue({
      talent: [],
    })

    render(
      <MemoryRouter initialEntries={['/search?role=NonexistentRole']}>
        <Routes>
          <Route path="/search" element={<Search />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No talent found')).toBeInTheDocument()
    })

    // No emoji magnifier
    expect(screen.queryByText('🔍')).not.toBeInTheDocument()

    // Clear filters button resets filters
    const clearBtn = screen.getByRole('button', { name: /clear all filters/i })
    expect(clearBtn).toBeInTheDocument()

    fireEvent.click(clearBtn)

    await waitFor(() => {
      expect(talentApi.search).toHaveBeenCalledWith({}, 'jwt-auth-token')
    })
  })
})
