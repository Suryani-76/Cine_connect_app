import { useState, useRef, useEffect, ReactNode } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  Film,
  LayoutDashboard,
  Briefcase,
  FileText,
  Search,
  BellRing,
  MessageCircle,
  Bookmark,
  Settings,
  Shield,
  User,
  LogOut,
  Menu,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { productionApi, talentApi } from '../lib/api'
import { Avatar } from './ui/Avatar'
import { Sheet, SheetTrigger, SheetContent } from './ui/Sheet'
import { NotificationBell } from './NotificationBell'
import { PublicFooter } from './PublicFooter'
import { OfflineBanner } from './OfflineBanner'
import { ErrorBoundary } from './ErrorBoundary'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export function AppShell() {
  const { user } = useAuth()
  const location = useLocation()
  const isAuthRoute = [
    '/login',
    '/register',
    '/verify',
    '/reset-password',
    '/create-profile',
  ].includes(location.pathname)

  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
        <OfflineBanner />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      {/* ── Accessible Skip to Content Link ── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-surface focus:rounded-sm focus:shadow-floating focus:outline-none text-14 font-semibold"
      >
        Skip to content
      </a>

      {/* ── Offline Banner ── */}
      <OfflineBanner />

      {/* ── Conditional App Shell ── */}
      {user ? <SignedInShell /> : <PublicShell />}
    </div>
  )
}

// ── Signed-in Shell (Desktop Left Rail + Mobile Bottom Bar) ────

function SignedInShell({ children }: { children?: ReactNode }) {
  const { user, token, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Close profile popup when clicking outside or pressing Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  const role = user?.role || 'talent'
  const isAdmin = role === 'admin'

  // Studio name for production users, display name for talent users (or fallback to email)
  const [accountName, setAccountName] = useState<string>(() => {
    return (
      user?.company_name ||
      localStorage.getItem('cc_company_name') ||
      localStorage.getItem('cc_full_name') ||
      ''
    )
  })

  useEffect(() => {
    if (user?.company_name) {
      setAccountName(user.company_name)
      return
    }
    const cached = localStorage.getItem('cc_company_name') || localStorage.getItem('cc_full_name')
    if (cached) {
      setAccountName(cached)
      return
    }
    if (role === 'production' && token) {
      productionApi
        .getMyProfile(token)
        .then((res) => {
          if (res?.profile?.company_name) {
            setAccountName(res.profile.company_name)
            localStorage.setItem('cc_company_name', res.profile.company_name)
          }
        })
        .catch(() => {})
    } else if (role === 'talent' && token) {
      talentApi
        .getMyProfile(token)
        .then((res) => {
          if (res?.profile?.full_name) {
            setAccountName(res.profile.full_name)
            localStorage.setItem('cc_full_name', res.profile.full_name)
          }
        })
        .catch(() => {})
    }
  }, [role, token, user?.company_name])

  // Studio name or display name; fallback to email if neither exists
  const accountLabel = accountName.trim() || user?.email || 'User'

  // ── Role-aware links ──────────────────────────────────────────
  // Production: Home, Jobs, Applicants, Talent search, Alerts, Messages
  // Talent: Home, Browse jobs, My applications, Saved, Messages
  // Both: Settings. Admin only for admins.
  const desktopLinks: NavItem[] =
    role === 'production'
      ? [
          { label: 'Home',          href: '/home',         icon: LayoutDashboard },
          { label: 'Jobs',          href: '/jobs',         icon: Briefcase },
          { label: 'Applicants',    href: '/applications', icon: FileText },
          { label: 'Talent search', href: '/search',       icon: Search },
          { label: 'Alerts',        href: '/alerts',       icon: BellRing },
          { label: 'Messages',      href: '/chat',         icon: MessageCircle },
          { label: 'Settings',      href: '/settings',     icon: Settings },
          ...(isAdmin ? [{ label: 'Admin', href: '/admin', icon: Shield }] : []),
        ]
      : [
          { label: 'Home',            href: '/home',         icon: LayoutDashboard },
          { label: 'Browse jobs',     href: '/jobs',         icon: Briefcase },
          { label: 'My applications', href: '/applications', icon: FileText },
          { label: 'Saved',           href: '/saved-jobs',   icon: Bookmark },
          { label: 'Messages',        href: '/chat',         icon: MessageCircle },
          { label: 'Settings',        href: '/settings',     icon: Settings },
          ...(isAdmin ? [{ label: 'Admin', href: '/admin', icon: Shield }] : []),
        ]

  // Mobile bottom tab bar links (4 most important + More)
  const mobilePrimaryLinks: NavItem[] =
    role === 'production'
      ? [
          { label: 'Home',       href: '/home',         icon: LayoutDashboard },
          { label: 'Jobs',       href: '/jobs',         icon: Briefcase },
          { label: 'Applicants', href: '/applications', icon: FileText },
          { label: 'Messages',   href: '/chat',         icon: MessageCircle },
        ]
      : [
          { label: 'Home',         href: '/home',         icon: LayoutDashboard },
          { label: 'Jobs',         href: '/jobs',         icon: Briefcase },
          { label: 'Applications', href: '/applications', icon: FileText },
          { label: 'Saved',        href: '/saved-jobs',   icon: Bookmark },
        ]

  const isLinkActive = (href: string) => {
    if (href === '/home') return location.pathname === '/home'
    if (href === '/jobs') return location.pathname === '/jobs' || location.pathname.startsWith('/jobs/')
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  const handleSignOut = async () => {
    setProfileMenuOpen(false)
    setMoreSheetOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen">
      {/* ── Left Rail on md and up ──────────────────────────── */}
      <aside
        aria-label="Main Navigation"
        className="hidden md:flex flex-col w-60 fixed inset-y-0 left-0 z-30 bg-surface border-r border-line select-none"
      >
        {/* Logo at top */}
        <div className="h-14 px-4 border-b border-line flex items-center justify-between">
          <Link
            to="/home"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-sm"
          >
            <div className="w-6 h-6 rounded-sm bg-tungsten flex items-center justify-center text-ink shrink-0">
              <Film size={14} />
            </div>
            <span className="brand-text text-18 font-bold tracking-tight text-ink">
              CINECONNECT
            </span>
          </Link>
        </div>

        {/* Role-aware Navigation links */}
        <nav aria-label="Rail Links" className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {desktopLinks.map((item) => {
            const active = isLinkActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-sm text-14 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                  active
                    ? 'font-semibold text-ink bg-paper before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-ink before:rounded-r'
                    : 'font-normal text-muted hover:text-ink hover:bg-paper/60'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}

          {/* Notifications in Rail with visible label & badge */}
          {user?.id && token && (
            <div className="pt-2 mt-2 border-t border-line/60">
              <NotificationBell
                userId={user.id}
                token={token}
                showLabel={true}
                dropdownPlacement="right-top"
              />
            </div>
          )}
        </nav>

        {/* Profile menu at bottom */}
        <div ref={profileMenuRef} className="p-3 border-t border-line mt-auto relative">
          {profileMenuOpen && (
            <div
              role="menu"
              aria-label="User Profile Menu"
              className="absolute bottom-full left-3 right-3 mb-2 bg-surface border border-line rounded-modal shadow-floating py-1.5 z-50 animate-in fade-in-50 duration-150"
            >
              {user?.email && (
                <div className="px-3 py-1.5 border-b border-line mb-1">
                  <p className="text-11 text-muted font-normal">Signed in as</p>
                  <p className="text-12 font-medium text-ink truncate">{user.email}</p>
                </div>
              )}
              <Link
                to="/profile"
                role="menuitem"
                onClick={() => setProfileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-14 text-ink hover:bg-paper transition-colors focus-visible:outline-none focus-visible:bg-paper"
              >
                <User size={16} className="text-muted" />
                <span>Profile</span>
              </Link>
              <Link
                to="/settings"
                role="menuitem"
                onClick={() => setProfileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-14 text-ink hover:bg-paper transition-colors focus-visible:outline-none focus-visible:bg-paper"
              >
                <Settings size={16} className="text-muted" />
                <span>Settings</span>
              </Link>
              <div className="border-t border-line my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-14 text-status-error hover:bg-status-error/10 transition-colors text-left focus-visible:outline-none focus-visible:bg-status-error/10"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            aria-label="Open profile menu"
            title={user?.email || undefined}
            className="w-full flex items-center gap-2.5 p-2 rounded-sm hover:bg-paper/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <Avatar fallback={accountLabel} size="sm" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-14 font-medium text-ink truncate leading-tight">
                {accountLabel}
              </p>
              <p className="text-12 text-muted capitalize leading-none mt-0.5">
                {role}
              </p>
            </div>
            <ChevronUp
              size={14}
              className={`text-muted transition-transform duration-150 ${profileMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar (Compact Branding & Notifications) ── */}
      <header className="flex md:hidden sticky top-0 z-30 h-14 bg-surface/95 backdrop-blur border-b border-line px-4 items-center justify-between">
        <Link to="/home" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-tungsten flex items-center justify-center text-ink shrink-0">
            <Film size={14} />
          </div>
          <span className="brand-text text-18 font-bold tracking-tight text-ink">
            CINECONNECT
          </span>
        </Link>
        {user?.id && token && (
          <NotificationBell
            userId={user.id}
            token={token}
            dropdownPlacement="bottom-right"
          />
        )}
      </header>

      {/* ── Mobile Bottom Tab Bar with More Sheet ──────────── */}
      <nav
        aria-label="Mobile Navigation"
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] items-center justify-around px-2 select-none"
      >
        {mobilePrimaryLinks.map((item) => {
          const active = isLinkActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 text-12 transition-colors ${
                active
                  ? 'font-semibold text-ink before:absolute before:top-0 before:left-3 before:right-3 before:h-0.5 before:bg-ink before:rounded-full'
                  : 'font-normal text-muted hover:text-ink'
              }`}
            >
              <Icon size={18} />
              <span className="text-[11px] leading-tight mt-0.5">{item.label}</span>
            </Link>
          )
        })}

        {/* "More" Trigger Sheet */}
        <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open more options"
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-12 text-muted hover:text-ink transition-colors"
            >
              <Menu size={18} />
              <span className="text-[11px] leading-tight mt-0.5">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" title="Navigation & Settings">
            <div className="py-2 space-y-4">
              {/* User Identity card */}
              <div className="flex items-center gap-3 p-3 bg-paper rounded-sm border border-line">
                <Avatar fallback={accountLabel} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-14 text-ink truncate">{accountLabel}</p>
                  <p className="text-12 text-muted capitalize">{role}</p>
                  {user?.email && (
                    <p className="text-12 text-muted/80 truncate mt-0.5">{user.email}</p>
                  )}
                </div>
              </div>

              {/* Secondary navigation items */}
              <div className="divide-y divide-line border border-line rounded-sm bg-surface overflow-hidden">
                {role === 'production' && (
                  <>
                    <Link
                      to="/search"
                      onClick={() => setMoreSheetOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-14 text-ink hover:bg-paper transition-colors"
                    >
                      <Search size={18} className="text-muted" />
                      <span>Talent search</span>
                    </Link>
                    <Link
                      to="/alerts"
                      onClick={() => setMoreSheetOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-14 text-ink hover:bg-paper transition-colors"
                    >
                      <BellRing size={18} className="text-muted" />
                      <span>Alerts</span>
                    </Link>
                  </>
                )}
                {role === 'talent' && (
                  <Link
                    to="/chat"
                    onClick={() => setMoreSheetOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-14 text-ink hover:bg-paper transition-colors"
                  >
                    <MessageCircle size={18} className="text-muted" />
                    <span>Messages</span>
                  </Link>
                )}
                <Link
                  to="/profile"
                  onClick={() => setMoreSheetOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-14 text-ink hover:bg-paper transition-colors"
                >
                  <User size={18} className="text-muted" />
                  <span>Profile</span>
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setMoreSheetOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-14 text-ink hover:bg-paper transition-colors"
                >
                  <Settings size={18} className="text-muted" />
                  <span>Settings</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMoreSheetOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-14 text-ink hover:bg-paper transition-colors"
                  >
                    <Shield size={18} className="text-muted" />
                    <span>Admin</span>
                  </Link>
                )}
              </div>

              {/* Sign out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-3 text-14 font-semibold text-status-error border border-line rounded-sm hover:bg-status-error/10 transition-colors"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      {/* ── Main Work Area ──────────────────────────────────── */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 md:pl-60 min-h-screen pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-8 bg-paper focus:outline-none"
      >
        <ErrorBoundary>
          {children || <Outlet />}
        </ErrorBoundary>
      </main>
    </div>
  )
}

// ── Public Layout (Simple Top Bar + Legal Footer) ─────────────

function PublicShell({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <div className="flex-1 flex flex-col min-h-screen justify-between">
      {/* ── Simple Top Bar ── */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-sm"
          >
            <div className="w-6 h-6 rounded-sm bg-tungsten flex items-center justify-center text-ink shrink-0">
              <Film size={14} />
            </div>
            <span className="brand-text text-18 font-bold tracking-tight text-ink">
              CINECONNECT
            </span>
          </Link>

          <nav aria-label="Public Links" className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/jobs"
              className="hidden sm:inline-block text-14 font-medium text-muted hover:text-ink transition-colors"
            >
              Browse jobs
            </Link>
            <Link
              to="/login"
              className="text-14 font-medium text-muted hover:text-ink transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="btn-primary text-14 py-1.5 px-3 inline-flex items-center justify-center font-semibold"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Main Public Content ── */}
      <main id="main-content" tabIndex={-1} className="flex-1 bg-paper focus:outline-none">
        <ErrorBoundary>
          {children || <Outlet />}
        </ErrorBoundary>
      </main>

      {/* ── Public Footer with Legal Links ── */}
      {!isLanding && <PublicFooter />}
    </div>
  )
}

