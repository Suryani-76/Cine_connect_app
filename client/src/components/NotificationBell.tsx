import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { notificationsApi, AppNotification } from '../lib/api'

const TYPE_META: Record<string, { icon: string }> = {
  new_application:   { icon: '📋' },
  new_message:       { icon: '💬' },
  high_match_talent: { icon: '⭐' },
}

function NotifRow({ notif, onRead }: { notif: AppNotification; onRead: (id: string) => void }) {
  const meta    = TYPE_META[notif.type] ?? { icon: '🔔' }
  const payload = notif.payload as Record<string, string>
  const summary =
    notif.type === 'new_application'
      ? `${payload.talent_name ?? 'Someone'} applied for "${payload.job_title ?? 'a job'}"`
      : notif.type === 'new_message'
      ? `${payload.sender_name ?? 'Someone'} sent you a message`
      : notif.type === 'high_match_talent'
      ? `${payload.talent_name ?? 'Talent'} scored ${payload.match_score ?? ''}% on "${payload.job_title ?? 'a job'}"`
      : 'You have a new notification'

  const timeAgo = (() => {
    const diff = Date.now() - new Date(notif.created_at).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  })()

  return (
    <button onClick={() => !notif.read && onRead(notif.id)}
      className={`w-full text-left px-4 py-3 flex items-start gap-3
        hover:bg-surface-section transition-colors
        ${notif.read ? 'opacity-60' : ''}`}>
      <span className="text-base mt-0.5 shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-snug ${notif.read ? 'text-content-secondary' : 'text-content-primary'}`}>
          {summary}
        </p>
        <p className="text-[11px] text-content-tertiary mt-0.5">{timeAgo}</p>
      </div>
      {!notif.read && <span className="shrink-0 w-2 h-2 rounded-full bg-brand mt-1" />}
    </button>
  )
}

export function NotificationBell({ userId, token }: { userId: string; token: string }) {
  const [open, setOpen]     = useState(false)
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchCount = useCallback(() => {
    if (!userId || !token) return
    notificationsApi.unreadCount(userId, token).then(r => setUnread(r.count)).catch(() => {})
  }, [userId, token])

  useEffect(() => { fetchCount() }, [fetchCount])

  // Realtime
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification
          setUnread(prev => prev + 1)
          setNotifs(prev => prev.length > 0 ? [n, ...prev] : prev)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    notificationsApi.list(userId, token)
      .then(r => { setNotifs(r.notifications); setUnread(r.unread_count) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, userId, token])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id, token)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead(userId, token)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch {}
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
        className="relative p-2 rounded-lg text-content-secondary hover:text-brand hover:bg-brand/5 transition-all">
        <Bell size={20} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
            bg-brand text-white text-[10px] font-bold rounded-full
            flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-surface-border rounded-xl shadow-card-md z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <span className="text-sm font-bold text-content-heading">Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAllRead}
                className="text-xs text-brand font-semibold hover:text-brand-dark transition-colors">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-surface-border">
            {loading && (
              <div className="py-6 text-center">
                <div className="w-5 h-5 border-2 border-surface-border border-t-brand rounded-full animate-spin mx-auto" />
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm text-content-tertiary">No notifications yet</p>
              </div>
            )}
            {!loading && notifs.map(n => <NotifRow key={n.id} notif={n} onRead={handleRead} />)}
          </div>

          {notifs.length > 0 && (
            <div className="border-t border-surface-border px-4 py-2.5 text-center">
              <span className="text-xs text-content-tertiary">
                {notifs.length} notification{notifs.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
