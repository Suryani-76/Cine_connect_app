import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { talentApi, accountApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import Search from '../pages/Search'
import * as AuthContext from '../context/AuthContext'

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}))

describe('Search and Authenticated Request Helper', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('talentApi.search Authorization header', () => {
    it('attaches explicit Bearer token when provided', async () => {
      let capturedHeaders: Record<string, string> | undefined
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>
        return new Response(JSON.stringify({ talent: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const res = await talentApi.search({ role: 'Cinematographer' }, 'explicit-jwt-token')

      expect(res).toEqual({ talent: [] })
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(capturedHeaders).toBeDefined()
      expect(capturedHeaders!['Authorization']).toBe('Bearer explicit-jwt-token')
    })

    it('auto-resolves session token via supabase.auth.getSession when token is omitted', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            access_token: 'supabase-session-token',
            refresh_token: 'supabase-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: 'u1' } as any,
          },
        },
        error: null,
      })

      let capturedHeaders: Record<string, string> | undefined
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>
        return new Response(JSON.stringify({ talent: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const res = await talentApi.search({ skills: ['Editing'] })

      expect(res).toEqual({ talent: [] })
      expect(supabase.auth.getSession).toHaveBeenCalled()
      expect(capturedHeaders!['Authorization']).toBe('Bearer supabase-session-token')
    })

    it('falls back to cc_access_token in localStorage when supabase session is empty', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })
      localStorage.setItem('cc_access_token', 'local-storage-jwt-token')

      let capturedHeaders: Record<string, string> | undefined
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>
        return new Response(JSON.stringify({ talent: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const res = await talentApi.search({})

      expect(res).toEqual({ talent: [] })
      expect(capturedHeaders!['Authorization']).toBe('Bearer local-storage-jwt-token')
    })

    it('retries once on 401 with refreshed token', async () => {
      let callCount = 0
      const capturedTokens: string[] = []

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            access_token: 'expired-token',
            refresh_token: 'stored-refresh-token',
            expires_in: 0,
            token_type: 'bearer',
            user: { id: 'u1' } as any,
          },
        },
        error: null,
      })

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: {
          session: {
            access_token: 'fresh-new-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: 'u1' } as any,
          },
          user: { id: 'u1' } as any,
        },
        error: null,
      })

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        callCount++
        const headers = init.headers as Record<string, string>
        if (headers['Authorization']) {
          capturedTokens.push(headers['Authorization'])
        }

        if (callCount === 1) {
          return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ talent: [{ id: 't1', full_name: 'Test Actor' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const res = await talentApi.search({ role: 'Actor' })

      expect(res.talent).toHaveLength(1)
      expect(callCount).toBe(2)
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
      expect(capturedTokens).toEqual(['Bearer expired-token', 'Bearer fresh-new-token'])
      expect(localStorage.getItem('cc_access_token')).toBe('fresh-new-token')
    })
  })

  describe('Search Page component', () => {
    it('executes talent search with Bearer token from AuthContext and displays results', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: { id: 'u-prod', email: 'prod@cine.test', role: 'production', profileId: 'p-1' },
        token: 'auth-context-token',
        loading: false,
        isAuthenticated: true,
        setSession: vi.fn(),
        setProfileId: vi.fn(),
        logout: vi.fn(),
      })

      let capturedAuthHeader: string | undefined
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const headers = init.headers as Record<string, string>
        capturedAuthHeader = headers['Authorization']
        return new Response(
          JSON.stringify({
            talent: [
              {
                id: 'tal-1',
                full_name: 'Mira Rajput',
                role: 'Director of Photography',
                availability: 'open',
                last_active_at: new Date().toISOString(),
                skills: ['Lighting', 'Color Grading'],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })

      render(
        <MemoryRouter>
          <Search />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Mira Rajput')).toBeInTheDocument()
      })

      expect(capturedAuthHeader).toBe('Bearer auth-context-token')
    })
  })

  describe('Migrated upload and export calls in api.ts', () => {
    it('uploadAvatar routes through request and includes Authorization header', async () => {
      let capturedHeaders: Record<string, string> | undefined
      let capturedBody: any
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>
        capturedBody = init.body
        return new Response(JSON.stringify({ avatar_url: 'https://cdn.test/avatar.png' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' })
      const res = await talentApi.uploadAvatar(file, 'avatar-token')

      expect(res.avatar_url).toBe('https://cdn.test/avatar.png')
      expect(capturedHeaders!['Authorization']).toBe('Bearer avatar-token')
      expect(capturedHeaders!['Content-Type']).toBeUndefined() // Browser sets multipart boundary
      expect(capturedBody).toBeInstanceOf(FormData)
    })

    it('accountApi.exportData routes through request and includes Authorization header', async () => {
      let capturedHeaders: Record<string, string> | undefined
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>
        return new Response(new Blob(['{"user_id": "u1"}'], { type: 'application/json' }), {
          status: 200,
        })
      })

      const blob = await accountApi.exportData('export-token')
      expect(blob).toBeInstanceOf(Blob)
      expect(capturedHeaders!['Authorization']).toBe('Bearer export-token')
    })
  })
})
