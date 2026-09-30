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
  id:           string
  email:        string
  role:         UserRole
  /** production_id or talent_profile_id depending on role */
  profileId:    string | null
}

interface AuthState {
  user:       AuthUser | null
  token:      string | null
  loading:    boolean
}

interface AuthContextValue extends AuthState {
  /** Call after OTP verify to bootstrap the session */
  setSession: (token: string, refreshToken: string, user: AuthUser) => void
  /** Store the profile id once it's created during onboarding */
  setProfileId: (id: string) => void
  logout: () => Promise<void>
  isAuthenticated: boolean
}

// ── Storage helpers ───────────────────────────────────────────

const KEYS = {
  token:        'cc_access_token',
  refresh:      'cc_refresh_token',
  userId:       'cc_user_id',
  userEmail:    'cc_user_email',
  userRole:     'cc_user_role',
  profileId:    'cc_profile_id',
} as const

function persist(user: AuthUser, token: string, refreshToken: string) {
  sessionStorage.setItem(KEYS.token,     token)
  sessionStorage.setItem(KEYS.refresh,   refreshToken)
  sessionStorage.setItem(KEYS.userId,    user.id)
  sessionStorage.setItem(KEYS.userEmail, user.email)
  sessionStorage.setItem(KEYS.userRole,  user.role)
  if (user.profileId) sessionStorage.setItem(KEYS.profileId, user.profileId)
}

function clearStorage() {
  Object.values(KEYS).forEach(k => sessionStorage.removeItem(k))
  // Also clear old keys from before AuthContext refactor
  ;['access_token','refresh_token','user_id','production_id'].forEach(k =>
    sessionStorage.removeItem(k)
  )
}

function loadFromStorage(): { user: AuthUser | null; token: string | null } {
  const token     = sessionStorage.getItem(KEYS.token)
  const id        = sessionStorage.getItem(KEYS.userId)
  const email     = sessionStorage.getItem(KEYS.userEmail)
  const role      = sessionStorage.getItem(KEYS.userRole) as UserRole | null
  const profileId = sessionStorage.getItem(KEYS.profileId)

  // Migrate old key names if present (one-time migration)
  const legacyToken     = sessionStorage.getItem('access_token')
  const legacyUserId    = sessionStorage.getItem('user_id')
  const legacyProfileId = sessionStorage.getItem('production_id')

  const resolvedToken     = token     ?? legacyToken
  const resolvedId        = id        ?? legacyUserId
  const resolvedProfileId = profileId ?? legacyProfileId

  if (!resolvedToken || !resolvedId || !email || !role) return { user: null, token: null }

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

  // Refresh Supabase session when token is close to expiry
  useEffect(() => {
    if (!state.token) return

    const refresh = async () => {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) return
      const newToken = data.session.access_token
      const newRefresh = data.session.refresh_token
      sessionStorage.setItem(KEYS.token,   newToken)
      sessionStorage.setItem(KEYS.refresh, newRefresh)
      setState(prev => ({ ...prev, token: newToken }))
    }

    // Refresh once now if token exists, then every 50 min
    refresh()
    const id = setInterval(refresh, 50 * 60 * 1000)
    return () => clearInterval(id)
  }, [state.token])

  const setSession = useCallback(
    (token: string, refreshToken: string, user: AuthUser) => {
      persist(user, token, refreshToken)
      setState({ user, token, loading: false })
    },
    []
  )

  const setProfileId = useCallback((id: string) => {
    sessionStorage.setItem(KEYS.profileId, id)
    setState(prev =>
      prev.user ? { ...prev, user: { ...prev.user, profileId: id } } : prev
    )
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {/* ignore */})
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

// ── Hook ──────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
