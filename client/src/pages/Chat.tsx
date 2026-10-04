import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Send,
  CheckCheck,
  MoreVertical,
  Ban,
  Flag,
  X,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  chatApi,
  blocksApi,
  reportsApi,
  ChatMessage,
  ConversationItem,
  ChatReportReason,
} from '../lib/api'

// ── Helpers ───────────────────────────────────────────────────

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Message bubble ────────────────────────────────────────────

function Bubble({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isMine
            ? 'bg-brand text-gray-950 rounded-br-sm'
            : 'bg-surface-overlay text-content-primary rounded-bl-sm border border-surface-border'
        }`}
      >
        {msg.body}
        <span
          className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
            isMine ? 'text-gray-800/60' : 'text-content-muted'
          }`}
        >
          {timeLabel(msg.created_at)}
          {isMine && msg.read && <CheckCheck size={12} className="text-emerald-600" />}
          {isMine && !msg.read && <CheckCheck size={12} className="opacity-40" />}
        </span>
      </div>
    </div>
  )
}

// ── Main Chat Component ───────────────────────────────────────

export default function Chat() {
  const { user, token } = useAuth()
  const userId = user?.id ?? ''
  const [searchParams] = useSearchParams()
  const peerFromUrl = searchParams.get('peer')
  usePageTitle('Messages')

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activePeerId, setActivePeerId] = useState<string | null>(peerFromUrl)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [canMessage, setCanMessage] = useState(true)
  const [permissionReason, setPermissionReason] = useState<string | undefined>()
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedByYou, setBlockedByYou] = useState(false)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // Thread actions
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ChatReportReason>('spam')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [submittingBlock, setSubmittingBlock] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // ── Load Conversations ──────────────────────────────────────
  const loadConversations = useCallback(
    async (showLoading = true) => {
      if (!token) return
      if (showLoading) setLoadingConvs(true)
      try {
        const res = await chatApi.getConversations(token)
        setConversations(res.conversations)
        if (!activePeerId && res.conversations.length > 0 && !peerFromUrl) {
          setActivePeerId(res.conversations[0].peer_id)
        }
      } catch (err: any) {
        console.error('Failed to load conversations:', err.message)
      } finally {
        if (showLoading) setLoadingConvs(false)
      }
    },
    [token, activePeerId, peerFromUrl]
  )

  useEffect(() => {
    loadConversations(true)
  }, [loadConversations])

  // ── Load Messages for Active Peer ───────────────────────────
  const loadMessages = useCallback(
    async (peerId: string, showLoading = true) => {
      if (!token || !peerId) return
      if (showLoading) setLoadingMessages(true)
      try {
        const res = await chatApi.getMessages(token, peerId, { limit: 30 })
        // API returns newest first; reverse for bottom-up chronological order
        setMessages([...res.messages].reverse())
        setNextCursor(res.next_cursor)
        setCanMessage(res.can_message)
        setPermissionReason(res.permission_reason)
        setIsBlocked(res.is_blocked)
        setBlockedByYou(res.blocked_by_you)

        // Mark as read via API
        await chatApi.markRead(token, peerId).catch(() => {})

        // Scroll to bottom after loading initial messages
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        })
      } catch (err: any) {
        console.error('Failed to load messages:', err.message)
      } finally {
        if (showLoading) setLoadingMessages(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (activePeerId) {
      loadMessages(activePeerId, true)
    } else {
      setMessages([])
    }
  }, [activePeerId, loadMessages])

  // ── Realtime Listener (Signal only; never trust payload) ────
  useEffect(() => {
    if (!userId || !token) return

    const channel = supabase
      .channel(`chat-listener:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          // Trigger authoritative fetch from server API
          loadConversations(false)
          if (activePeerId) {
            loadMessages(activePeerId, false)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, token, activePeerId, loadConversations, loadMessages])

  // ── Infinite Scroll Upward ──────────────────────────────────
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop <= 20 && nextCursor && !loadingOlder && token && activePeerId) {
      setLoadingOlder(true)
      const prevScrollHeight = el.scrollHeight

      try {
        const res = await chatApi.getMessages(token, activePeerId, {
          cursor: nextCursor,
          limit: 30,
        })
        const olderChronological = [...res.messages].reverse()
        setMessages((prev) => [...olderChronological, ...prev])
        setNextCursor(res.next_cursor)

        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight
        })
      } catch (err: any) {
        console.error('Failed to load older messages:', err.message)
      } finally {
        setLoadingOlder(false)
      }
    }
  }

  // ── Send Message ────────────────────────────────────────────
  const handleSend = async () => {
    const body = draft.trim()
    if (!body || !activePeerId || !token || sending || !canMessage) return
    setSending(true)

    try {
      const res = await chatApi.sendMessage(token, {
        recipient_id: activePeerId,
        body,
      })
      setDraft('')
      setMessages((prev) => [...prev, res.message])

      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })

      // Update conversations list in background
      loadConversations(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Block / Unblock ─────────────────────────────────────────
  const handleToggleBlock = async () => {
    if (!token || !activePeerId || submittingBlock) return
    setSubmittingBlock(true)
    try {
      if (blockedByYou) {
        await blocksApi.unblock(token, activePeerId)
        setBlockedByYou(false)
        setIsBlocked(false)
        setCanMessage(true)
        setPermissionReason(undefined)
        toast.success('User unblocked')
      } else {
        await blocksApi.block(token, activePeerId)
        setBlockedByYou(true)
        setIsBlocked(true)
        setCanMessage(false)
        setPermissionReason('You have blocked this user')
        toast.success('User blocked')
      }
      setMenuOpen(false)
      loadConversations(false)
    } catch (err: any) {
      toast.error(err.message || 'Block action failed')
    } finally {
      setSubmittingBlock(false)
    }
  }

  // ── Report User ─────────────────────────────────────────────
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !activePeerId || submittingReport) return
    setSubmittingReport(true)
    try {
      await reportsApi.create(token, {
        target_user_id: activePeerId,
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      })
      toast.success('Safety report submitted to moderation')
      setReportModalOpen(false)
      setReportDetails('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report')
    } finally {
      setSubmittingReport(false)
    }
  }

  const activePeer = conversations.find((c) => c.peer_id === activePeerId)

  if (!token) return null

  return (
    <div className="page flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="nav shrink-0">
        <div className="nav-inner">
          <Link to="/home" className="brand-text text-xl font-semibold text-content-primary tracking-tight">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/home" className="nav-link">Home</Link>
            <Link to="/applications" className="nav-link">Applications</Link>
          </nav>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-5xl mx-auto w-full px-6 py-6 gap-4">
        {/* ── Conversation Sidebar ──────────────────────────── */}
        <aside className="w-72 shrink-0 flex flex-col gap-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="section-title text-base">Messages</p>
          </div>

          {loadingConvs && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          )}

          {!loadingConvs && conversations.length === 0 && (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm text-content-tertiary">No conversations yet</p>
            </div>
          )}

          {conversations.map((c) => (
            <button
              key={c.peer_id}
              onClick={() => {
                setActivePeerId(c.peer_id)
                setMenuOpen(false)
              }}
              className={`text-left rounded-xl px-3.5 py-3 transition-colors w-full ${
                activePeerId === c.peer_id
                  ? 'bg-brand/10 border border-brand/30'
                  : 'hover:bg-surface-overlay border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-content-primary truncate">
                  {c.peer_username || 'User'}
                </span>
                {c.unread_count > 0 && (
                  <span className="shrink-0 px-1.5 py-0.5 bg-brand text-gray-950 text-[10px] font-bold rounded-full">
                    {c.unread_count}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-content-tertiary truncate">
                  {c.last_message?.body ?? 'No messages'}
                </p>
                {c.is_blocked && (
                  <span className="text-[10px] text-red-400 font-medium shrink-0">Blocked</span>
                )}
              </div>
            </button>
          ))}
        </aside>

        {/* ── Thread Panel ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col card overflow-hidden relative">
          {!activePeerId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <p className="text-4xl mb-3">💬</p>
              <p className="brand-text text-lg font-semibold text-content-primary mb-1">
                Select a conversation
              </p>
              <p className="text-sm text-content-tertiary">
                Choose from the list on the left to start messaging
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="px-5 py-3.5 border-b border-surface-border shrink-0 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-content-primary text-sm">
                    {activePeer?.peer_username ?? 'Conversation'}
                  </p>
                  <p className="text-[11px] text-content-tertiary capitalize">
                    {activePeer?.peer_role ?? ''}
                  </p>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-secondary"
                    aria-label="Conversation actions"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-1 w-44 rounded-xl card shadow-xl py-1 z-20 border border-surface-border">
                      <button
                        onClick={handleToggleBlock}
                        disabled={submittingBlock}
                        className="w-full text-left px-3 py-2 text-xs text-content-primary hover:bg-surface-overlay flex items-center gap-2"
                      >
                        <Ban size={14} className={blockedByYou ? 'text-amber-500' : 'text-red-500'} />
                        {blockedByYou ? 'Unblock User' : 'Block User'}
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          setReportModalOpen(true)
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-content-primary hover:bg-surface-overlay flex items-center gap-2 text-red-400"
                      >
                        <Flag size={14} />
                        Report User
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-5 py-4"
              >
                {loadingOlder && (
                  <div className="flex justify-center py-2">
                    <Loader2 size={16} className="animate-spin text-brand" />
                  </div>
                )}

                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 size={24} className="animate-spin text-brand" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-content-tertiary mt-8">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  messages.map((m) => (
                    <Bubble key={m.id} msg={m} isMine={m.sender_id === userId} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer or Permission Notice */}
              <div className="shrink-0 p-4 border-t border-surface-border space-y-2">
                {!canMessage ? (
                  <div className="p-3 bg-surface-overlay border border-surface-border rounded-xl text-xs text-content-secondary flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      {permissionReason ??
                        (isBlocked
                          ? 'This conversation is blocked.'
                          : 'You do not have permission to send messages in this conversation.')}
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send)"
                      rows={1}
                      maxLength={2000}
                      disabled={sending}
                      className="input flex-1 resize-none"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!draft.trim() || sending}
                      className="btn-primary p-2.5 flex items-center justify-center shrink-0"
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Report Modal ────────────────────────────────────── */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="card max-w-md w-full p-6 relative border border-surface-border">
            <button
              onClick={() => setReportModalOpen(false)}
              className="absolute top-4 right-4 text-content-tertiary hover:text-content-primary"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="text-red-500" size={20} />
              <h3 className="text-base font-semibold text-content-primary">
                Report Conversation
              </h3>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">
                  Reason for Report
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as ChatReportReason)}
                  className="input w-full"
                >
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="scam">Scam / Fraud</option>
                  <option value="inappropriate">Inappropriate Content</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">
                  Details (Optional, max 1000 characters)
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide context for our moderation team..."
                  maxLength={1000}
                  rows={4}
                  className="input w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {submittingReport && <Loader2 size={14} className="animate-spin" />}
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
