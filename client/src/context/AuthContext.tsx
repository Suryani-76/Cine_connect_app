import {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'

export type UserRole = 'production' | 'talent' | 'admin'

export interface AuthUser {
  id:        string
  email:     string
  role:      UserRole
  profileId: string | null
  company_name?: string | null
}

interface AuthState {
  user:    AuthUser | null
  token:   string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  setSession:   (token: string, refreshToken: string, user: AuthUser) => void
  setProfileId: (id: string) => void
  logout:       () => Promise<void>
  isAuthenticated: boolean
}

// ── localStorage helpers ──────────────────────────────────────

const KEYS = {
  token:       'cc_access_token',
  refresh:     'cc_refresh_token',
  userId:      'cc_user_id',
  userEmail:   'cc_user_email',
  userRole:    'cc_user_role',
  profileId:   'cc_profile_id',
  companyName: 'cc_company_name',
} as const

const store = localStorage

function persist(user: AuthUser, token: string, refreshToken: string) {
  store.setItem(KEYS.token,     token)
  store.setItem(KEYS.refresh,   refreshToken)
  store.setItem(KEYS.userId,    user.id)
  store.setItem(KEYS.userEmail, user.email)
  store.setItem(KEYS.userRole,  user.role)
  if (user.profileId) store.setItem(KEYS.profileId, user.profileId)
  if (user.company_name) store.setItem(KEYS.companyName, user.company_name)
}

function clearStorage() {
  Object.values(KEYS).forEach(k => store.removeItem(k))
  ;['access_token','refresh_token','user_id','production_id',
    'cc_access_token','cc_refresh_token','cc_user_id',
    'cc_user_email','cc_user_role','cc_profile_id','cc_company_name',
  ].forEach(k => sessionStorage.removeItem(k))
}

function loadFromStorage(): { user: AuthUser | null; token: string | null } {
  const get = (key: string) => store.getItem(key) ?? sessionStorage.getItem(key) ?? null

  const token     = get(KEYS.token)     ?? get('access_token')
  const id        = get(KEYS.userId)    ?? get('user_id')
  const email     = get(KEYS.userEmail)
  const role        = get(KEYS.userRole)  as UserRole | null
  const profileId   = get(KEYS.profileId) ?? get('production_id')
  const companyName = get(KEYS.companyName)

  if (!token || !id || !email || !role) return { user: null, token: null }

  // Migrate legacy sessionStorage keys to localStorage
  if (!store.getItem(KEYS.token) && token) {
    store.setItem(KEYS.token,       token)
    if (id)          store.setItem(KEYS.userId,      id)
    if (email)       store.setItem(KEYS.userEmail,   email)
    if (role)        store.setItem(KEYS.userRole,    role)
    if (profileId)   store.setItem(KEYS.profileId,   profileId)
    if (companyName) store.setItem(KEYS.companyName, companyName)
  }

  return { token, user: { id, email, role, profileId: profileId ?? null, company_name: companyName ?? null } }
}

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const { user, token } = loadFromStorage()
    return { user, token, loading: true }
  })

  // ── Subscribe to Supabase auth events (replaces 50-min interval) ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          clearStorage()
          setState({ user: null, token: null, loading: false })
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (!session) return
          const newToken   = session.access_token
          const newRefresh = session.refresh_token

          store.setItem(KEYS.token,   newToken)
          store.setItem(KEYS.refresh, newRefresh)

          setState(prev => ({
            ...prev,
            token:   newToken,
            loading: false,
            user: prev.user
              ? { ...prev.user }
              : null,
          }))
          return
        }

        if (event === 'PASSWORD_RECOVERY') {
          // Let the ResetPassword page handle this
          setState(prev => ({ ...prev, loading: false }))
          return
        }

        setState(prev => ({ ...prev, loading: false }))
      }
    )

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        store.setItem(KEYS.token,   data.session.access_token)
        store.setItem(KEYS.refresh, data.session.refresh_token)
        setState(prev => ({
          ...prev,
          token:   data.session!.access_token,
          loading: false,
        }))
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
      setSession, setProfileId, logout,
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
