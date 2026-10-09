import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Profile, getShowreelEmbedUrl, calculateProfileStrength } from '../pages/Profile'
import * as AuthContext from '../context/AuthContext'
import { talentApi, productionApi } from '../lib/api'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    talentApi: {
      getMyProfile: vi.fn(),
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      uploadAvatar: vi.fn(),
      uploadResume: vi.fn(),
      deleteResume: vi.fn(),
      getResumeSignedUrl: vi.fn(),
      addCredit: vi.fn(),
      updateCredit: vi.fn(),
      deleteCredit: vi.fn(),
    },
    productionApi: {
      getProfile: vi.fn(),
    },
  }
})

const mockTalentProfile = {
  id: 'tal-1',
  user_id: 'user-talent-1',
  full_name: 'Pooja Verma',
  bio: 'Cinematographer and camera operator specializing in narrative and indie cinema.',
  role: 'Cinematographer',
  roles: ['Cinematographer', 'Colorist'],
  skills: ['Arri Alexa', 'Lighting', 'Color Grading'],
  experience_years: 6,
  language: 'Hindi, English',
  location: 'Mumbai',
  avatar_url: null,
  portfolio_url: 'https://poojaverma.test',
  showreel_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  availability: 'open' as const,
  has_resume: true,
  credits: [
    {
      id: 'cr-1',
      talent_profile_id: 'tal-1',
      project_title: 'Monsoon Light',
      role: 'Director of Photography',
      year: 2024,
      production_company: 'Indie Wave',
      link: 'https://film.test/monsoon',
      description: 'Feature film shot on location',
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
}

describe('Talent Profile Redesign (F7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Showreel and Profile Strength helpers', () => {
    it('correctly converts YouTube and Vimeo URLs to embed URLs', () => {
      expect(getShowreelEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        host: 'YouTube',
      })

      expect(getShowreelEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        host: 'YouTube',
      })

      expect(getShowreelEmbedUrl('https://vimeo.com/76979871')).toEqual({
        embedUrl: 'https://player.vimeo.com/video/76979871',
        host: 'Vimeo',
      })

      // Invalid host or malformed URL
      expect(getShowreelEmbedUrl('https://tiktok.com/@video/123')).toBeNull()
      expect(getShowreelEmbedUrl('not a url')).toBeNull()
    })

    it('calculates profile strength and identifies top missing recommendation', () => {
      const incomplete = {
        type: 'talent' as const,
        full_name: 'New Artist',
        bio: null,
        role: null,
        skills: [],
        experience_years: 0,
        language: null,
        location: null,
        avatar_url: null,
        portfolio_url: null,
      }

      const resIncomplete = calculateProfileStrength(incomplete)
      expect(resIncomplete.score).toBeLessThan(50)
      expect(resIncomplete.topMissingRecommendation).toContain('Add skills (+30 pts)')

      const complete = {
        ...incomplete,
        role: 'Cinematographer',
        skills: ['Camera', 'Lighting', 'Optics'],
        experience_years: 5,
        location: 'Mumbai',
        language: 'Hindi',
        bio: 'Professional cinematographer with over 5 years of industry experience on features.',
        has_resume: true,
        showreel_url: 'https://youtube.com/watch?v=123',
        credits: [{ id: '1', project_title: 'Film', role: 'DP' } as any],
      }

      const resComplete = calculateProfileStrength(complete)
      expect(resComplete.score).toBe(100)
      expect(resComplete.topMissingRecommendation).toBeNull()
    })
  })

  describe('Owner rendering (/profile or /profile/:id when own profile)', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-talent-1',
          email: 'pooja@cine.test',
          role: 'talent',
          profileId: 'tal-1',
        },
        token: 'owner-token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(talentApi.getMyProfile).mockResolvedValue({
        profile: mockTalentProfile as any,
      })
      vi.mocked(talentApi.getProfile).mockResolvedValue({
        profile: mockTalentProfile as any,
      })
    })

    it('renders profile strength meter, edit button, and private contact info to owner', async () => {
      render(
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Pooja Verma')).toBeInTheDocument()
      })

      // Owner sees Profile Strength meter
      expect(screen.getByRole('heading', { name: /profile strength/i })).toBeInTheDocument()

      // Owner sees Edit profile button
      expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument()

      // Owner sees their private account email
      expect(screen.getByText('pooja@cine.test')).toBeInTheDocument()

      // Owner does NOT see "Message" button (can't message themselves)
      expect(screen.queryByTestId('message-btn')).not.toBeInTheDocument()

      // Credits table rendered
      expect(screen.getByText('Monsoon Light')).toBeInTheDocument()
      expect(screen.getByText('Director of Photography')).toBeInTheDocument()
      expect(screen.getByText('2024')).toBeInTheDocument()
    })
  })

  describe('Production viewer rendering (/profile/:id)', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-prod-99',
          email: 'producer@studio.test',
          role: 'production',
          profileId: 'prod-99',
        },
        token: 'prod-token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(productionApi.getProfile).mockRejectedValue(new Error('Not production'))
      vi.mocked(talentApi.getProfile).mockResolvedValue({
        profile: mockTalentProfile as any,
      })
    })

    it('renders Message button and resume download, but hides strength meter and private email', async () => {
      render(
        <MemoryRouter initialEntries={['/profile/tal-1']}>
          <Routes>
            <Route path="/profile/:id" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Pooja Verma')).toBeInTheDocument()
      })

      // Production viewer sees Message button
      expect(screen.getByTestId('message-btn')).toBeInTheDocument()

      // Production viewer does NOT see Profile strength meter
      expect(screen.queryByRole('heading', { name: /profile strength/i })).not.toBeInTheDocument()

      // Production viewer does NOT see "Edit profile" button
      expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument()

      // Production viewer does NOT see private email
      expect(screen.queryByText('pooja@cine.test')).not.toBeInTheDocument()
      expect(screen.queryByText(/account email:/i)).not.toBeInTheDocument()

      // Production viewer has access to Resume section
      expect(screen.getByRole('heading', { name: /resume and curriculum vitae/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /view resume/i })).toBeInTheDocument()
    })
  })

  describe('Other talent viewer rendering (/profile/:id)', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-other-talent',
          email: 'other@talent.test',
          role: 'talent',
          profileId: 'tal-other',
        },
        token: 'talent-token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(productionApi.getProfile).mockRejectedValue(new Error('Not production'))
      vi.mocked(talentApi.getProfile).mockResolvedValue({
        profile: mockTalentProfile as any,
      })
    })

    it('hides Message button, strength meter, private email, and resume section from other talent', async () => {
      render(
        <MemoryRouter initialEntries={['/profile/tal-1']}>
          <Routes>
            <Route path="/profile/:id" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Pooja Verma')).toBeInTheDocument()
      })

      // Other talent cannot message
      expect(screen.queryByTestId('message-btn')).not.toBeInTheDocument()

      // Other talent cannot see strength meter
      expect(screen.queryByRole('heading', { name: /profile strength/i })).not.toBeInTheDocument()

      // Other talent cannot see private email
      expect(screen.queryByText('pooja@cine.test')).not.toBeInTheDocument()

      // Other talent cannot see resume section
      expect(screen.queryByRole('heading', { name: /resume and curriculum vitae/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /view resume/i })).not.toBeInTheDocument()
    })
  })

  describe('Showreel click-to-load behavior', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-talent-1',
          email: 'pooja@cine.test',
          role: 'talent',
          profileId: 'tal-1',
        },
        token: 'owner-token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      vi.mocked(talentApi.getMyProfile).mockResolvedValue({
        profile: mockTalentProfile as any,
      })
    })

    it('renders click-to-load card initially without mounting iframe, then loads iframe on click', async () => {
      render(
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Pooja Verma')).toBeInTheDocument()
      })

      // Click to load poster is rendered
      const clickToLoad = screen.getByTestId('showreel-click-to-load')
      expect(clickToLoad).toBeInTheDocument()
      expect(screen.getByText(/watch showreel on youtube/i)).toBeInTheDocument()

      // iframe is not yet rendered
      expect(screen.queryByTestId('showreel-iframe')).not.toBeInTheDocument()

      // Click the poster
      fireEvent.click(clickToLoad)

      // Now the iframe is mounted with correct embed URL
      const iframe = screen.getByTestId('showreel-iframe')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    })
  })
})
