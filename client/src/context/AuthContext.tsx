import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────

export type UserRole = 'production' | 'talent'

export interface AuthUser {
  id:        string
  email:     string
  role:      UserRole
  profileId: string | null
}

interface AuthState {
  user:    AuthUser | null
  token:   string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  setSession:  (token: string, refreshToken: string, user: AuthUser) => void
  setProfileId:(id: string) => void
  logout:      () => Promise<void>
  isAuthenticated: boolean
}

// ── Storage helpers (localStorage so sessions survive tab close) ──

const KEYS = {
  token:     'cc_access_token',
  refresh:   'cc_refresh_token',
  userId:    'cc_user_id',
  userEmail: 'cc_user_email',
  userRole:  'cc_user_role',
  profileId: 'cc_profile_id',
} as const

const store = localStorage   // single swap point — change to sessionStorage here if needed

function persist(user: AuthUser, token: string, refreshToken: string) {
  store.setItem(KEYS.token,     token)
  store.setItem(KEYS.refresh,   refreshToken)
  store.setItem(KEYS.userId,    user.id)
  store.setItem(KEYS.userEmail, user.email)
  store.setItem(KEYS.userRole,  user.role)
  if (user.profileId) store.setItem(KEYS.profileId, user.profileId)
}

function clearStorage() {
  Object.values(KEYS).forEach(k => store.removeItem(k))
  // Clear legacy sessionStorage keys too (one-time migration)
  ;['access_token','refresh_token','user_id','production_id',
    'cc_access_token','cc_refresh_token','cc_user_id',
    'cc_user_email','cc_user_role','cc_profile_id',
  ].forEach(k => sessionStorage.removeItem(k))
}

function loadFromStorage(): { user: AuthUser | null; token: string | null } {
  // Try localStorage first, then fall back to sessionStorage (migration path)
  const get = (key: string) =>
    store.getItem(key) ?? sessionStorage.getItem(key) ?? null

  const token     = get(KEYS.token)
  const id        = get(KEYS.userId)
  const email     = get(KEYS.userEmail)
  const role      = get(KEYS.userRole) as UserRole | null
  const profileId = get(KEYS.profileId)

  // Also check old key names for one-time migration
  const resolvedToken     = token ?? get('access_token')
  const resolvedId        = id    ?? get('user_id')
  const resolvedProfileId = profileId ?? get('production_id')

  if (!resolvedToken || !resolvedId || !email || !role) return { user: null, token: null }

  // If we migrated from sessionStorage, re-persist to localStorage
  if (!token && resolvedToken) {
    store.setItem(KEYS.token, resolvedToken)
    if (resolvedId)        store.setItem(KEYS.userId,    resolvedId)
    if (email)             store.setItem(KEYS.userEmail, email)
    if (role)              store.setItem(KEYS.userRole,  role)
    if (resolvedProfileId) store.setItem(KEYS.profileId, resolvedProfileId)
  }

  return {
    token: resolvedToken,
    user: {
      id:        resolvedId,
      email,
      role,
      profileId: resolvedProfileId ?? null,
    },
  }
}

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const { user, token } = loadFromStorage()
    return { user, token, loading: false }
  })

  // Refresh Supabase JWT before it expires (runs every 50 min)
  useEffect(() => {
    if (!state.token) return

    const refresh = async () => {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) return
      const newToken   = data.session.access_token
      const newRefresh = data.session.refresh_token
      store.setItem(KEYS.token,   newToken)
      store.setItem(KEYS.refresh, newRefresh)
      setState(prev => ({ ...prev, token: newToken }))
    }

    refresh()
    const id = setInterval(refresh, 50 * 60 * 1000)
    return () => clearInterval(id)
  }, [state.token])

  const setSession = useCallback(
    (token: string, refreshToken: string, user: AuthUser) => {
      persist(user, token, refreshToken)
      setState({ user, token, loading: false })
    }, []
  )

  const setProfileId = useCallback((id: string) => {
    store.setItem(KEYS.profileId, id)
    setState(prev =>
      prev.user ? { ...prev, user: { ...prev.user, profileId: id } } : prev
    )
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    clearStorage()
    setState({ user: null, token: null, loading: false })
  }, [])

  return (
    <AuthContext.Provider value={{
      ...state,
      setSession,
      setProfileId,
      logout,
      isAuthenticated: !!state.token && !!state.user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
