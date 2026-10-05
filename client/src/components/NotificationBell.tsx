import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { notificationsApi, AppNotification } from '../lib/api'

const TYPE_META: Record<string, { icon: string }> = {
  new_application:   { icon: '📋' },
  new_message:       { icon: '💬' },
  high_match_talent: { icon: '⭐' },
}

function NotifRow({ notif, onRead, onNavigate }: { notif: AppNotification; onRead: (id: string) => void; onNavigate: (url: string) => void }) {
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

  // Determine navigation target based on type + payload
  const getTarget = (): string | null => {
    if (notif.type === 'new_application' && payload.job_id) {
      return `/applications?job_id=${payload.job_id}`
    }
    if (notif.type === 'high_match_talent' && payload.job_id) {
      return `/applications?job_id=${payload.job_id}`
    }
    if (notif.type === 'new_message' && payload.sender_id) {
      return `/chat?peer=${payload.sender_id}`
    }
    return null
  }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(notif.created_at).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  })()

  const handleClick = () => {
    if (!notif.read) onRead(notif.id)
    const target = getTarget()
    if (target) onNavigate(target)
  }

  return (
    <button onClick={handleClick}
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

export interface NotificationBellProps {
  userId: string
  token: string
  showLabel?: boolean
  dropdownPlacement?: 'bottom-right' | 'right-top' | 'right-bottom' | 'bottom-left' | 'top-right'
  className?: string
}

export function NotificationBell({
  userId,
  token,
  showLabel = false,
  dropdownPlacement = 'bottom-right',
  className = '',
}: NotificationBellProps) {
  const navigate    = useNavigate()
  const [open, setOpen]     = useState(false)
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchCount = useCallback(() => {
    if (!token) return
    notificationsApi.unreadCount(token).then(r => setUnread(r.count)).catch(() => {})
  }, [userId, token])

  useEffect(() => { fetchCount() }, [fetchCount])

  // Realtime
  useEffect(() => {
    if (!userId) return
    const channelId = `notifications:${userId}:${Math.random().toString(36).slice(2, 9)}`
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel(channelId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as AppNotification
            setUnread(prev => prev + 1)
            setNotifs(prev => prev.length > 0 ? [n, ...prev] : prev)
          })
        .subscribe()
    } catch {}

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {}
      }
    }
  }, [userId])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    notificationsApi.list(token)
      .then(r => { setNotifs(r.notifications); setUnread(r.unread_count) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, userId, token])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
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
      await notificationsApi.markAllRead(token)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch {}
  }

  const placementClasses = {
    'bottom-right': 'right-0 mt-2',
    'bottom-left': 'left-0 mt-2',
    'right-top': 'left-full top-0 ml-2',
    'right-bottom': 'left-full bottom-0 ml-2',
    'top-right': 'right-0 bottom-full mb-2',
  }[dropdownPlacement]

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {showLabel ? (
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
          aria-expanded={open}
          className="w-full flex items-center justify-between px-3 py-2 rounded-sm text-14 font-medium text-muted hover:text-ink hover:bg-paper/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <div className="flex items-center gap-3">
            <Bell size={18} aria-hidden="true" />
            <span>Notifications</span>
          </div>
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-tungsten text-ink text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
          aria-expanded={open}
          className="relative p-2 rounded-sm text-muted hover:text-ink hover:bg-paper/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-tungsten text-ink text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className={`absolute ${placementClasses} w-80 bg-surface border border-line rounded-modal shadow-floating z-50 overflow-hidden text-ink animate-in fade-in-50 duration-150`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface">
            <span className="text-14 font-bold text-ink">Notifications</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-12 text-muted hover:text-ink font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {loading && (
              <div className="py-6 text-center">
                <div className="w-5 h-5 border-2 border-line border-t-tungsten rounded-full animate-spin mx-auto" />
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div className="px-4 py-8 text-center text-muted">
                <p className="text-22 mb-2">🔔</p>
                <p className="text-12">No notifications yet</p>
              </div>
            )}
            {!loading && notifs.map(n => (
              <NotifRow
                key={n.id}
                notif={n}
                onRead={handleRead}
                onNavigate={(url) => { setOpen(false); navigate(url) }}
              />
            ))}
          </div>

          {notifs.length > 0 && (
            <div className="border-t border-line px-4 py-2 text-center bg-paper/40">
              <span className="text-12 text-muted font-mono tnum">
                {notifs.length} notification{notifs.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
