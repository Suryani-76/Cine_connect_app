import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  BadgeCheck,
  FileText,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { PageHeader } from '../components/PageHeader'
import {
  authApi,
  adminApi,
  AdminUserItem,
  AdminProductionItem,
  AdminAuditLogItem,
  ChatReportItem,
  ChatReportStatus,
} from '../lib/api'
import { VerifiedBadge } from '../components/VerifiedBadge'

type TabType = 'users' | 'verification' | 'reports' | 'audit'

export default function Admin() {
  usePageTitle('Admin Control Center')
  const { token } = useAuth()

  // Guard state
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>('users')

  // ── Tab 1: Users State ──────────────────────────────────────
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)

  // ── Tab 2: Verification State ───────────────────────────────
  const [productions, setProductions] = useState<AdminProductionItem[]>([])
  const [prodLoading, setProdLoading] = useState(false)
  const [prodFilter, setProdFilter] = useState<'all' | 'unverified' | 'verified'>('all')
  const [prodPage, setProdPage] = useState(1)
  const [prodTotalPages, setProdTotalPages] = useState(1)

  // ── Tab 3: Audit Log State ──────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)

  // ── Tab 4: Reports Queue State ──────────────────────────────
  const [reports, setReports] = useState<ChatReportItem[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsFilter, setReportsFilter] = useState<'all' | 'open' | 'reviewed' | 'actioned'>('open')
  const [reportsPage, setReportsPage] = useState(1)
  const [reportsTotalPages, setReportsTotalPages] = useState(1)
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null)
  const [resolutionNoteInput, setResolutionNoteInput] = useState<{ [key: string]: string }>({})

  // ── 1. Admin Guard: Verify Real-Time Admin Status from Server ──
  useEffect(() => {
    let mounted = true
    const checkAdminStatus = async () => {
      if (!token) {
        if (mounted) {
          setIsAdmin(false)
          setCheckingAuth(false)
        }
        return
      }

      try {
        const res = await authApi.me(token)
        if (mounted) {
          setIsAdmin(res.user?.is_admin === true)
          setCheckingAuth(false)
        }
      } catch {
        if (mounted) {
          setIsAdmin(false)
          setCheckingAuth(false)
        }
      }
    }

    checkAdminStatus()
    return () => {
      mounted = false
    }
  }, [token])

  // ── 2. Data Fetching Methods ────────────────────────────────
  const loadUsers = useCallback(async () => {
    if (!token) return
    setUsersLoading(true)
    try {
      const res = await adminApi.listUsers(token, {
        search: userSearch,
        page: usersPage,
        limit: 15,
      })
      setUsers(res.users)
      setUsersTotalPages(res.totalPages)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }, [token, userSearch, usersPage])

  const loadProductions = useCallback(async () => {
    if (!token) return
    setProdLoading(true)
    try {
      const res = await adminApi.listProductions(token, {
        status: prodFilter,
        page: prodPage,
        limit: 15,
      })
      setProductions(res.productions)
      setProdTotalPages(res.totalPages)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load production profiles')
    } finally {
      setProdLoading(false)
    }
  }, [token, prodFilter, prodPage])

  const loadAuditLogs = useCallback(async () => {
    if (!token) return
    setAuditLoading(true)
    try {
      const res = await adminApi.getAuditLogs(token, {
        page: auditPage,
        limit: 20,
      })
      setAuditLogs(res.items)
      setAuditTotalPages(res.totalPages)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setAuditLoading(false)
    }
  }, [token, auditPage])

  const loadReports = useCallback(async () => {
    if (!token) return
    setReportsLoading(true)
    try {
      const res = await adminApi.listReports(token, {
        status: reportsFilter,
        page: reportsPage,
        limit: 10,
      })
      setReports(res.reports)
      setReportsTotalPages(res.totalPages)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setReportsLoading(false)
    }
  }, [token, reportsFilter, reportsPage])

  // Load data when active tab or pagination changes
  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'users') loadUsers()
      else if (activeTab === 'verification') loadProductions()
      else if (activeTab === 'reports') loadReports()
      else if (activeTab === 'audit') loadAuditLogs()
    }
  }, [isAdmin, activeTab, loadUsers, loadProductions, loadReports, loadAuditLogs])

  // ── 3. Actions ──────────────────────────────────────────────
  const handleSuspend = async (userId: string, currentSuspended: boolean) => {
    if (!token) return
    if (!currentSuspended) {
      const reason = window.prompt('Enter reason for suspension (optional):')
      if (reason === null) return // cancelled
      try {
        await adminApi.suspendUser(userId, token, reason || undefined)
        toast.success('User suspended successfully')
        loadUsers()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Suspension failed')
      }
    } else {
      if (!window.confirm('Are you sure you want to lift this suspension?')) return
      try {
        await adminApi.unsuspendUser(userId, token)
        toast.success('User suspension lifted')
        loadUsers()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Unsuspension failed')
      }
    }
  }

  const handleVerify = async (prodId: string, currentVerified: boolean) => {
    if (!token) return
    if (!currentVerified) {
      try {
        await adminApi.verifyProduction(prodId, token)
        toast.success('Production company verified')
        loadProductions()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Verification failed')
      }
    } else {
      if (!window.confirm('Revoke verified badge for this company?')) return
      try {
        await adminApi.unverifyProduction(prodId, token)
        toast.success('Verification revoked')
        loadProductions()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Revocation failed')
      }
    }
  }

  const handleUpdateReport = async (reportId: string, status: ChatReportStatus) => {
    if (!token) return
    setUpdatingReportId(reportId)
    try {
      await adminApi.updateReport(token, reportId, {
        status,
        resolution_notes: resolutionNoteInput[reportId] || undefined,
      })
      toast.success(`Report status updated to ${status}`)
      loadReports()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update report')
    } finally {
      setUpdatingReportId(null)
    }
  }

  // ── 4. Guard Screens ────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-surface-border border-t-brand rounded-full animate-spin" />
        <p className="text-sm text-content-muted">Verifying administrative authorization...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-surface-card border border-red-200 dark:border-red-900/40 rounded-2xl p-8 text-center shadow-lg">
          <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-600 dark:text-red-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-content-heading mb-2">403 — Access Denied</h1>
          <p className="text-sm text-content-muted mb-6">
            Administrator privileges are required to access this control center. Your identity is verified from the server-side database.
          </p>
          <Link
            to="/home"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white font-medium hover:bg-brand-hover transition-colors"
          >
            <ArrowLeft size={16} /> Return to Home
          </Link>
        </div>
      </div>
    )
  }

  // ── 5. Main Admin Control Center ─────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Admin Trust Center"
        description="Security, verification, and trust operations"
        action={
          <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-ink text-surface">
            Verified Admin
          </span>
        }
      />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-surface-border">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'users'
                ? 'border-brand text-brand'
                : 'border-transparent text-content-muted hover:text-content-heading'
            }`}
          >
            <Users size={16} />
            <span>Users & Suspension</span>
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'verification'
                ? 'border-brand text-brand'
                : 'border-transparent text-content-muted hover:text-content-heading'
            }`}
          >
            <BadgeCheck size={16} />
            <span>Verification Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'reports'
                ? 'border-brand text-brand'
                : 'border-transparent text-content-muted hover:text-content-heading'
            }`}
          >
            <ShieldAlert size={16} />
            <span>Reports Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-brand text-brand'
                : 'border-transparent text-content-muted hover:text-content-heading'
            }`}
          >
            <FileText size={16} />
            <span>Audit Trail</span>
          </button>
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        {/* ── Tab 1: Users & Suspension ── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-content-heading">Platform Users</h2>
                <p className="text-sm text-content-muted">
                  Search accounts and immediately suspend or restore access.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setUsersPage(1)
                    }}
                    placeholder="Search email or username..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-border bg-white dark:bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                  />
                </div>
                <button
                  onClick={loadUsers}
                  disabled={usersLoading}
                  className="p-2 rounded-xl border border-surface-border text-content-muted hover:text-content-heading bg-white dark:bg-surface-card"
                  title="Refresh"
                >
                  <RefreshCw size={16} className={usersLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-base border-b border-surface-border text-xs text-content-muted uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">User</th>
                      <th className="px-6 py-3 font-semibold">Role</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Registered</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-content-muted">
                          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading users...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-content-muted">
                          No users matched your query.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isSuspended = !!u.suspended_at
                        return (
                          <tr key={u.id} className="hover:bg-surface-base/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-content-heading">{u.username}</p>
                              <p className="text-xs text-content-muted">{u.email}</p>
                            </td>
                            <td className="px-6 py-4 capitalize">{u.role}</td>
                            <td className="px-6 py-4">
                              {isSuspended ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                                  <XCircle size={12} /> Suspended
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  <CheckCircle2 size={12} /> Active
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-content-muted">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleSuspend(u.id, isSuspended)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  isSuspended
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300'
                                }`}
                              >
                                {isSuspended ? 'Unsuspend' : 'Suspend'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {usersTotalPages > 1 && (
                <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between text-xs text-content-muted">
                  <span>Page {usersPage} of {usersTotalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      disabled={usersPage <= 1}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                      disabled={usersPage >= usersTotalPages}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Verification Queue ── */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-content-heading">Production Verification Queue</h2>
                <p className="text-sm text-content-muted">
                  Review production entities and award official verified badge credentials.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl border border-surface-border p-1 bg-white dark:bg-surface-card text-xs">
                  <button
                    onClick={() => { setProdFilter('all'); setProdPage(1) }}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      prodFilter === 'all' ? 'bg-brand text-white' : 'text-content-muted hover:text-content-heading'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => { setProdFilter('unverified'); setProdPage(1) }}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      prodFilter === 'unverified' ? 'bg-brand text-white' : 'text-content-muted hover:text-content-heading'
                    }`}
                  >
                    Unverified
                  </button>
                  <button
                    onClick={() => { setProdFilter('verified'); setProdPage(1) }}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      prodFilter === 'verified' ? 'bg-brand text-white' : 'text-content-muted hover:text-content-heading'
                    }`}
                  >
                    Verified
                  </button>
                </div>

                <button
                  onClick={loadProductions}
                  disabled={prodLoading}
                  className="p-2 rounded-xl border border-surface-border text-content-muted hover:text-content-heading bg-white dark:bg-surface-card"
                  title="Refresh"
                >
                  <RefreshCw size={16} className={prodLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-base border-b border-surface-border text-xs text-content-muted uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Company</th>
                      <th className="px-6 py-3 font-semibold">Bio / Overview</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Joined</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {prodLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-content-muted">
                          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading companies...
                        </td>
                      </tr>
                    ) : productions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-content-muted">
                          No production profiles found in this queue.
                        </td>
                      </tr>
                    ) : (
                      productions.map((p) => (
                        <tr key={p.id} className="hover:bg-surface-base/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-content-heading">{p.company_name}</p>
                              {p.verified && <VerifiedBadge />}
                            </div>
                            <p className="text-xs text-content-muted">ID: {p.id.slice(0, 8)}...</p>
                          </td>
                          <td className="px-6 py-4 max-w-xs truncate text-xs text-content-muted">
                            {p.bio || 'No bio provided'}
                          </td>
                          <td className="px-6 py-4">
                            {p.verified ? (
                              <span className="text-xs text-emerald-600 font-medium">
                                Verified {p.verified_at ? new Date(p.verified_at).toLocaleDateString() : ''}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">Pending Review</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-content-muted">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleVerify(p.id, p.verified)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                p.verified
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {p.verified ? 'Revoke Verification' : 'Verify Company'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {prodTotalPages > 1 && (
                <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between text-xs text-content-muted">
                  <span>Page {prodPage} of {prodTotalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setProdPage(p => Math.max(1, p - 1))}
                      disabled={prodPage <= 1}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setProdPage(p => Math.min(prodTotalPages, p + 1))}
                      disabled={prodPage >= prodTotalPages}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Chat Reports Queue ── */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-content-heading">Chat Safety Reports Queue</h2>
                <p className="text-xs text-content-muted">
                  Review reported conversations, moderation flags, and take enforcement actions
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={reportsFilter}
                  onChange={(e) => {
                    setReportsFilter(e.target.value as any)
                    setReportsPage(1)
                  }}
                  className="px-3 py-2 text-xs rounded-xl border border-surface-border bg-white dark:bg-surface-card text-content-heading"
                >
                  <option value="open">Open Reports</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="actioned">Actioned</option>
                  <option value="all">All Reports</option>
                </select>

                <button
                  onClick={loadReports}
                  disabled={reportsLoading}
                  className="p-2 rounded-xl border border-surface-border text-content-muted hover:text-content-heading bg-white dark:bg-surface-card"
                  title="Refresh"
                >
                  <RefreshCw size={16} className={reportsLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-base border-b border-surface-border text-xs text-content-muted uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Date & Reason</th>
                      <th className="px-6 py-3 font-semibold">Target User</th>
                      <th className="px-6 py-3 font-semibold">Reporter</th>
                      <th className="px-6 py-3 font-semibold">Details / Snippet</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {reportsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-content-muted">
                          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading reports...
                        </td>
                      </tr>
                    ) : reports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-content-muted">
                          No safety reports matching current filter.
                        </td>
                      </tr>
                    ) : (
                      reports.map((r) => (
                        <tr key={r.id} className="hover:bg-surface-base/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider mb-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                              {r.reason}
                            </span>
                            <p className="text-xs text-content-muted">
                              {new Date(r.created_at).toLocaleString()}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-content-heading">
                              {r.target_username ?? r.target_user_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-content-muted">{r.target_email ?? ''}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-content-heading">
                              {r.reporter_username ?? r.reporter_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-content-muted">{r.reporter_email ?? ''}</p>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            {r.message_body && (
                              <p className="text-xs text-content-heading italic mb-1 border-l-2 border-brand/40 pl-2">
                                "{r.message_body}"
                              </p>
                            )}
                            <p className="text-xs text-content-muted truncate">
                              {r.details || 'No additional details'}
                            </p>
                            {r.resolution_notes && (
                              <p className="text-[11px] text-brand mt-1 font-mono">
                                Note: {r.resolution_notes}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                r.status === 'open'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                  : r.status === 'reviewed'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end gap-2">
                              <input
                                type="text"
                                placeholder="Resolution note..."
                                value={resolutionNoteInput[r.id] ?? ''}
                                onChange={(e) =>
                                  setResolutionNoteInput((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value,
                                  }))
                                }
                                className="px-2 py-1 text-xs border border-surface-border rounded-lg bg-surface-base w-40"
                              />
                              <div className="flex items-center gap-1.5">
                                {r.status !== 'reviewed' && (
                                  <button
                                    onClick={() => handleUpdateReport(r.id, 'reviewed')}
                                    disabled={updatingReportId === r.id}
                                    className="px-2.5 py-1 text-xs rounded-lg border border-blue-300 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  >
                                    Review
                                  </button>
                                )}
                                {r.status !== 'actioned' && (
                                  <button
                                    onClick={() => handleUpdateReport(r.id, 'actioned')}
                                    disabled={updatingReportId === r.id}
                                    className="px-2.5 py-1 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                  >
                                    Action
                                  </button>
                                )}
                                {r.status !== 'open' && (
                                  <button
                                    onClick={() => handleUpdateReport(r.id, 'open')}
                                    disabled={updatingReportId === r.id}
                                    className="px-2 py-1 text-xs text-content-muted hover:text-content-heading"
                                  >
                                    Re-open
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {reportsTotalPages > 1 && (
                <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between text-xs text-content-muted">
                  <span>Page {reportsPage} of {reportsTotalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                      disabled={reportsPage <= 1}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setReportsPage((p) => Math.min(reportsTotalPages, p + 1))}
                      disabled={reportsPage >= reportsTotalPages}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 3: Audit Trail ── */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-content-heading">System Audit Log</h2>
                <p className="text-sm text-content-muted">
                  Immutable record of administrative interventions, verifications, and algorithm updates.
                </p>
              </div>

              <button
                onClick={loadAuditLogs}
                disabled={auditLoading}
                className="p-2 rounded-xl border border-surface-border text-content-muted hover:text-content-heading bg-white dark:bg-surface-card"
                title="Refresh"
              >
                <RefreshCw size={16} className={auditLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-base border-b border-surface-border text-xs text-content-muted uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Timestamp</th>
                      <th className="px-6 py-3 font-semibold">Action</th>
                      <th className="px-6 py-3 font-semibold">Target</th>
                      <th className="px-6 py-3 font-semibold">Actor</th>
                      <th className="px-6 py-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border font-mono text-xs">
                    {auditLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-content-muted font-sans">
                          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading audit records...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-content-muted font-sans">
                          No audit entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((entry) => (
                        <tr key={entry.id} className="hover:bg-surface-base/50 transition-colors">
                          <td className="px-6 py-4 text-content-muted whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-semibold text-content-heading">
                            {entry.action}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-brand font-medium">{entry.target_type}</span>: {entry.target_id.slice(0, 10)}...
                          </td>
                          <td className="px-6 py-4 text-content-muted">
                            {entry.actor_id ? entry.actor_id.slice(0, 8) + '...' : 'system/script'}
                          </td>
                          <td className="px-6 py-4 text-content-muted max-w-sm truncate">
                            {JSON.stringify(entry.details)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {auditTotalPages > 1 && (
                <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between text-xs text-content-muted font-sans">
                  <span>Page {auditPage} of {auditTotalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      disabled={auditPage <= 1}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                      disabled={auditPage >= auditTotalPages}
                      className="p-1.5 rounded border border-surface-border disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
