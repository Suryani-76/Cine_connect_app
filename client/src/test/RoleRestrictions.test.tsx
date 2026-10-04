import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import * as AuthContext from '../context/AuthContext'

describe('Role Restrictions via ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated users to /login', () => {
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
      <MemoryRouter initialEntries={['/protected-target']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected-target"
            element={
              <ProtectedRoute>
                <div>Secret Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument()
  })

  it('redirects talent role trying to access production-only route to /home', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'talent@cine.test', role: 'talent', profileId: 't-1' },
      token: 'valid-jwt',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/alerts']}>
        <Routes>
          <Route path="/home" element={<div>Home Dashboard</div>} />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute allowedRoles={['production']}>
                <div>Production Alerts</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Home Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Production Alerts')).not.toBeInTheDocument()
  })

  it('redirects production role trying to access talent-only route to /home', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-2', email: 'prod@cine.test', role: 'production', profileId: 'p-1' },
      token: 'valid-jwt',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/saved-jobs']}>
        <Routes>
          <Route path="/home" element={<div>Home Dashboard</div>} />
          <Route
            path="/saved-jobs"
            element={
              <ProtectedRoute allowedRoles={['talent']}>
                <div>Talent Bookmarks</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Home Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Talent Bookmarks')).not.toBeInTheDocument()
  })

  it('renders protected content when role matches allowed role', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-3', email: 'prod@cine.test', role: 'production', profileId: 'p-1' },
      token: 'valid-jwt',
      loading: false,
      isAuthenticated: true,
      setSession: vi.fn(),
      setProfileId: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/alerts']}>
        <Routes>
          <Route path="/home" element={<div>Home Dashboard</div>} />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute allowedRoles={['production']}>
                <div>Production Alerts</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Production Alerts')).toBeInTheDocument()
  })
})
