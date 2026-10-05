import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { PageHeader } from '../components/PageHeader'
import { ErrorBoundary } from '../components/ErrorBoundary'
import * as AuthContext from '../context/AuthContext'

// Mock supabase channel to prevent realtime socket warnings during tests
vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: vi.fn(),
  },
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual as object,
    notificationsApi: {
      unreadCount: vi.fn().mockResolvedValue({ count: 2 }),
      list: vi.fn().mockResolvedValue({
        notifications: [
          {
            id: 'notif-1',
            user_id: 'user-1',
            type: 'new_message',
            payload: { sender_name: 'Director John' },
            read: false,
            created_at: new Date().toISOString(),
          },
        ],
        unread_count: 1,
      }),
      markRead: vi.fn().mockResolvedValue({ success: true }),
      markAllRead: vi.fn().mockResolvedValue({ success: true }),
    },
  }
})

function renderWithAuth(
  role: 'production' | 'talent' | 'admin' | null,
  initialRoute = '/home'
) {
  const user = role
    ? {
        id: `user-${role}`,
        email: `${role}@cineconnect.test`,
        role,
        profileId: `profile-${role}`,
      }
    : null

  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user,
    token: user ? 'mock-token-xyz' : null,
    loading: false,
    isAuthenticated: Boolean(user),
    setSession: vi.fn(),
    setProfileId: vi.fn(),
    logout: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/home" element={<div data-testid="page-home">Home Content</div>} />
          <Route path="/jobs" element={<div data-testid="page-jobs">Jobs Content</div>} />
          <Route path="/applications" element={<div data-testid="page-applications">Applications Content</div>} />
          <Route path="/search" element={<div data-testid="page-search">Search Content</div>} />
          <Route path="/saved-jobs" element={<div data-testid="page-saved">Saved Content</div>} />
          <Route path="/chat" element={<div data-testid="page-chat">Messages Content</div>} />
          <Route path="/settings" element={<div data-testid="page-settings">Settings Content</div>} />
          <Route path="/admin" element={<div data-testid="page-admin">Admin Content</div>} />
          <Route path="/login" element={<div data-testid="page-login">Login Content</div>} />
          <Route path="/" element={<div data-testid="page-landing">Landing Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Role-Aware Link Visibility (Desktop Rail)', () => {
    it('renders production links correctly: Home, Jobs, Applicants, Talent search, Messages, Settings', () => {
      renderWithAuth('production')

      const railNav = screen.getByRole('navigation', { name: /Rail Links/i })
      expect(railNav).toBeInTheDocument()

      // Production links must be visible in rail
      expect(within(railNav).getByRole('link', { name: /^Home$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Jobs$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Applicants$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Talent search$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Messages$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Settings$/i })).toBeInTheDocument()

      // Talent-specific or admin links should NOT be in the rail for production
      expect(within(railNav).queryByRole('link', { name: /^Browse jobs$/i })).not.toBeInTheDocument()
      expect(within(railNav).queryByRole('link', { name: /^My applications$/i })).not.toBeInTheDocument()
      expect(within(railNav).queryByRole('link', { name: /^Saved$/i })).not.toBeInTheDocument()
      expect(within(railNav).queryByRole('link', { name: /^Admin$/i })).not.toBeInTheDocument()
    })

    it('renders talent links correctly: Home, Browse jobs, My applications, Saved, Messages, Settings', () => {
      renderWithAuth('talent')

      const railNav = screen.getByRole('navigation', { name: /Rail Links/i })
      expect(railNav).toBeInTheDocument()

      // Talent links must be visible in rail
      expect(within(railNav).getByRole('link', { name: /^Home$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Browse jobs$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^My applications$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Saved$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Messages$/i })).toBeInTheDocument()
      expect(within(railNav).getByRole('link', { name: /^Settings$/i })).toBeInTheDocument()

      // Production-specific or admin links should NOT be in the rail for talent
      expect(within(railNav).queryByRole('link', { name: /^Applicants$/i })).not.toBeInTheDocument()
      expect(within(railNav).queryByRole('link', { name: /^Talent search$/i })).not.toBeInTheDocument()
      expect(within(railNav).queryByRole('link', { name: /^Admin$/i })).not.toBeInTheDocument()
    })

    it('shows Admin link exclusively when user has admin role', () => {
      renderWithAuth('admin')

      const railNav = screen.getByRole('navigation', { name: /Rail Links/i })
      expect(within(railNav).getByRole('link', { name: /^Admin$/i })).toBeInTheDocument()
    })

    it('displays NotificationBell in the rail with visible label and unread badge', async () => {
      renderWithAuth('production')

      const railNav = screen.getByRole('navigation', { name: /Rail Links/i })
      const notifButton = within(railNav).getByRole('button', { name: /Notifications/i })
      expect(notifButton).toBeInTheDocument()
      expect(screen.getByText('Notifications')).toBeInTheDocument()

      await waitFor(() => {
        expect(within(railNav).getByText('2')).toBeInTheDocument()
      })
    })

    it('displays profile trigger menu at the bottom of the rail', async () => {
      renderWithAuth('production')

      const profileBtn = screen.getByRole('button', { name: /Open profile menu/i })
      expect(profileBtn).toBeInTheDocument()
      expect(screen.getByText('production@cineconnect.test')).toBeInTheDocument()

      // Open profile menu
      fireEvent.click(profileBtn)
      expect(screen.getByRole('menu', { name: /User Profile Menu/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /Sign out/i })).toBeInTheDocument()
    })
  })

  describe('2. Mobile Bottom Tab Bar & "More" Sheet', () => {
    it('renders the mobile navigation bar with primary links and safe-area height', () => {
      renderWithAuth('production')

      const mobileNav = screen.getByRole('navigation', { name: /Mobile Navigation/i })
      expect(mobileNav).toBeInTheDocument()
      expect(mobileNav.className).toContain('h-[calc(3.5rem+env(safe-area-inset-bottom,0px))]')

      // Primary links in mobile nav
      expect(within(mobileNav).getByRole('link', { name: /^Home$/i })).toBeInTheDocument()
      expect(within(mobileNav).getByRole('link', { name: /^Jobs$/i })).toBeInTheDocument()
      expect(within(mobileNav).getByRole('link', { name: /^Applicants$/i })).toBeInTheDocument()

      // Mobile nav has the "More" options button
      const moreBtn = screen.getByRole('button', { name: /Open more options/i })
      expect(moreBtn).toBeInTheDocument()
    })

    it('adds bottom padding to main content equal to bar height plus safe-area inset', () => {
      renderWithAuth('production')

      const main = screen.getByRole('main')
      expect(main.className).toContain('pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]')
    })

    it('renders the full wordmark "CINECONNECT" in Ink with amber only in the icon square', () => {
      renderWithAuth('production')

      const wordmarks = screen.getAllByText('CINECONNECT')
      expect(wordmarks.length).toBeGreaterThan(0)
      for (const wordmark of wordmarks) {
        expect(wordmark).toHaveClass('text-ink')
        // Wordmark should not have amber/tungsten text
        expect(wordmark).not.toHaveClass('text-tungsten')
      }
    })

    it('opens the More sheet when clicking the More trigger button', async () => {
      renderWithAuth('production')

      const moreBtn = screen.getByRole('button', { name: /Open more options/i })
      fireEvent.click(moreBtn)

      // The Sheet opens with Secondary navigation options and Sign out
      await waitFor(() => {
        expect(screen.getByText('Navigation & Settings')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Sign out/i })).toBeInTheDocument()
      })
    })
  })

  describe('3. Accessibility & Keyboard Navigation of the Rail', () => {
    it('provides a Skip-to-content link that targets the main landmark', () => {
      renderWithAuth('production')

      const skipLink = screen.getByRole('link', { name: /Skip to content/i })
      expect(skipLink).toBeInTheDocument()
      expect(skipLink).toHaveAttribute('href', '#main-content')

      const main = screen.getByRole('main')
      expect(main).toHaveAttribute('id', 'main-content')
    })

    it('marks the active route with a non-colour indicator using aria-current="page"', () => {
      renderWithAuth('production', '/home')

      const railNav = screen.getByRole('navigation', { name: /Rail Links/i })
      const homeLink = within(railNav).getByRole('link', { name: /^Home$/i })
      expect(homeLink).toHaveAttribute('aria-current', 'page')

      const jobsLink = within(railNav).getByRole('link', { name: /^Jobs$/i })
      expect(jobsLink).not.toHaveAttribute('aria-current')
    })

    it('allows closing profile menu using Escape key', async () => {
      renderWithAuth('production')

      const profileBtn = screen.getByRole('button', { name: /Open profile menu/i })
      fireEvent.click(profileBtn)
      expect(screen.getByRole('menu', { name: /User Profile Menu/i })).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('menu', { name: /User Profile Menu/i })).not.toBeInTheDocument()
    })
  })

  describe('4. Public Layout (Anonymous Users)', () => {
    it('renders simple top bar and public footer for anonymous users', () => {
      renderWithAuth(null, '/login')

      // Public nav bar links
      expect(screen.getByRole('link', { name: /Browse jobs/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Sign in/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Create account/i })).toBeInTheDocument()

      // Legal footer
      expect(screen.getByRole('link', { name: /Privacy Policy/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Terms of Service/i })).toBeInTheDocument()
    })
  })

  describe('5. PageHeader Component', () => {
    it('renders single h1, optional description, action, and accessible breadcrumbs', () => {
      render(
        <MemoryRouter>
          <PageHeader
            title="Director of Photography"
            description="Leading camera unit role in Mumbai"
            action={<button>Apply now</button>}
            breadcrumbs={[
              { label: 'Jobs', href: '/jobs' },
              { label: 'Director of Photography' },
            ]}
          />
        </MemoryRouter>
      )

      // Single h1
      const headings = screen.getAllByRole('heading', { level: 1 })
      expect(headings).toHaveLength(1)
      expect(headings[0]).toHaveTextContent('Director of Photography')

      // Description
      expect(screen.getByText('Leading camera unit role in Mumbai')).toBeInTheDocument()

      // Action button on right
      expect(screen.getByRole('button', { name: /Apply now/i })).toBeInTheDocument()

      // Breadcrumb landmark with aria-current="page" on the active item
      const breadcrumbsNav = screen.getByRole('navigation', { name: /Breadcrumbs/i })
      expect(breadcrumbsNav).toBeInTheDocument()
      expect(screen.getByText('Director of Photography', { selector: 'span[aria-current="page"]' })).toBeInTheDocument()
    })
  })

  describe('6. ErrorBoundary Recovery', () => {
    function Bomb(): JSX.Element {
      throw new Error('Critical explosion in component render')
    }

    it('catches render errors and renders plain recovery UI with retry button', () => {
      // Temporarily silence console.error during expected throw
      const originalConsoleError = console.error
      console.error = vi.fn()

      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/This page could not be displayed/i)).toBeInTheDocument()
      expect(screen.getByText(/Critical explosion in component render/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()

      console.error = originalConsoleError
    })
  })
})
