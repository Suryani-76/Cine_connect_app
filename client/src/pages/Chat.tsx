import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

interface Message {
  id:          string
  sender_id:   string
  recipient_id:string
  body:        string
  read:        boolean
  created_at:  string
}

interface Conversation {
  peer_id:    string
  peer_email: string
  last_body:  string
  last_at:    string
  unread:     number
}

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

function Bubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
        ${isMine
          ? 'bg-brand text-gray-950 rounded-br-sm'
          : 'bg-surface-overlay text-content-primary rounded-bl-sm border border-surface-border'
        }`}>
        {msg.body}
        <span className={`block text-[10px] mt-1 text-right ${isMine ? 'text-gray-800/60' : 'text-content-muted'}`}>
          {timeLabel(msg.created_at)}
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

const Chat = () => {
  const { user, token } = useAuth()
  const userId = user?.id ?? ''
  usePageTitle('Messages')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activePeerId, setActivePeerId]   = useState<string | null>(null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [draft, setDraft]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [loading, setLoading]             = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Load conversations ──────────────────────────────────────
  useEffect(() => {
    if (!userId) return

    const fetchConversations = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, recipient_id, body, read, created_at')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (error || !data) { setLoading(false); return }

      // Build conversation list — one entry per peer
      const peerMap = new Map<string, Conversation>()
      for (const m of data) {
        const peerId = m.sender_id === userId ? m.recipient_id : m.sender_id
        if (!peerMap.has(peerId)) {
          peerMap.set(peerId, {
            peer_id:    peerId,
            peer_email: peerId, // will resolve below
            last_body:  m.body,
            last_at:    m.created_at,
            unread:     !m.read && m.recipient_id === userId ? 1 : 0,
          })
        } else {
          const c = peerMap.get(peerId)!
          if (!m.read && m.recipient_id === userId) c.unread += 1
        }
      }

      // Resolve peer emails
      const peerIds = Array.from(peerMap.keys())
      if (peerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, username')
          .in('id', peerIds)
        users?.forEach(u => {
          const c = peerMap.get(u.id)
          if (c) c.peer_email = u.username ?? u.email
        })
      }

      setConversations(Array.from(peerMap.values()))
      if (!activePeerId && peerMap.size > 0) setActivePeerId(peerMap.keys().next().value ?? null)
      setLoading(false)
    }

    fetchConversations()
  }, [userId])

  // ── Load messages for active peer ──────────────────────────
  useEffect(() => {
    if (!activePeerId || !userId) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${activePeerId}),and(sender_id.eq.${activePeerId},recipient_id.eq.${userId})`)
        .order('created_at', { ascending: true })

      setMessages((data as Message[]) ?? [])

      // Mark unread as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', activePeerId)
        .eq('recipient_id', userId)
        .eq('read', false)
    }

    fetchMessages()
  }, [activePeerId, userId])

  // ── Supabase Realtime subscription for new messages ─────────
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`chat:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          // Append to thread if it's from the active peer
          if (newMsg.sender_id === activePeerId || newMsg.recipient_id === activePeerId) {
            setMessages(prev => [...prev, newMsg])
          }
          // Update conversation list
          setConversations(prev => {
            const peerId = newMsg.sender_id
            const updated = [...prev]
            const idx = updated.findIndex(c => c.peer_id === peerId)
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], last_body: newMsg.body, last_at: newMsg.created_at }
            } else {
              updated.unshift({ peer_id: peerId, peer_email: peerId, last_body: newMsg.body, last_at: newMsg.created_at, unread: 1 })
            }
            return updated
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, activePeerId])

  // ── Auto-scroll ─────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────
  const handleSend = async () => {
    const body = draft.trim()
    if (!body || !activePeerId || sending) return
    setSending(true)
    setDraft('')

    const optimistic: Message = {
      id:           `opt-${Date.now()}`,
      sender_id:    userId,
      recipient_id: activePeerId,
      body,
      read:         false,
      created_at:   new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    const { error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, recipient_id: activePeerId, body })

    if (error) {
      // Roll back optimistic message
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setDraft(body)
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!token) return null

  return (
    <div className="page flex flex-col" style={{ height: '100dvh' }}>
      {/* Nav */}
      <header className="nav shrink-0">
        <div className="nav-inner">
          <Link to="/home" className="brand-text text-xl font-semibold text-content-primary tracking-tight">
            Cine<span className="text-brand">Connect</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/home"         className="nav-link">Home</Link>
            <Link to="/applications" className="nav-link">Applications</Link>
          </nav>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-5xl mx-auto w-full px-6 py-6 gap-4">
        {/* ── Conversation sidebar ──────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col gap-1 overflow-y-auto">
          <p className="section-title text-base mb-3">Messages</p>

          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm text-content-tertiary">No conversations yet</p>
            </div>
          )}

          {conversations.map(c => (
            <button key={c.peer_id}
              onClick={() => setActivePeerId(c.peer_id)}
              className={`text-left rounded-xl px-3 py-3 transition-colors w-full
                ${activePeerId === c.peer_id ? 'bg-brand/10 border border-brand/30' : 'hover:bg-surface-overlay'}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-content-primary truncate">{c.peer_email}</span>
                {c.unread > 0 && (
                  <span className="shrink-0 w-4 h-4 bg-brand text-gray-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                    {c.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-content-tertiary truncate">{c.last_body}</p>
            </button>
          ))}
        </aside>

        {/* ── Thread panel ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col card overflow-hidden">
          {!activePeerId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <p className="text-4xl mb-3">💬</p>
              <p className="brand-text text-lg font-semibold text-content-primary mb-1">Select a conversation</p>
              <p className="text-sm text-content-tertiary">Choose from the list on the left to start messaging</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-3 border-b border-surface-border shrink-0">
                <p className="font-medium text-content-primary text-sm">
                  {conversations.find(c => c.peer_id === activePeerId)?.peer_email ?? activePeerId}
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-content-tertiary mt-8">No messages yet. Say hello!</p>
                )}
                {messages.map(m => (
                  <Bubble key={m.id} msg={m} isMine={m.sender_id === userId} />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="shrink-0 px-4 py-3 border-t border-surface-border flex gap-2 items-end">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  rows={1}
                  className="input flex-1 resize-none"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
                <button onClick={handleSend} disabled={!draft.trim() || sending}
                  className="btn-primary p-2.5 flex items-center justify-center"
                  aria-label="Send message">
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Chat
