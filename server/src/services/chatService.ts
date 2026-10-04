import { supabase } from '../db/supabase'
import { CallerContext } from '../middleware/callerContext'
import {
  DbMessage,
  DbUserBlock,
  DbChatReport,
  ChatReportReason,
  ChatReportStatus,
  ConversationItem,
} from '../types'
import { recordAuditLog } from './auditService'

export interface CanMessageResult {
  allowed: boolean
  reason?: string
  isBlocked: boolean
  blockedByYou: boolean
  isBlockedByPeer: boolean
}

/**
 * Strips HTML tags and trims whitespace to prevent stored XSS or formatting exploits.
 */
export function stripHtml(input: string): string {
  if (!input) return ''
  return input.replace(/<[^>]*>?/gm, '').trim()
}

/**
 * Evaluates whether a caller can send a message to a recipient based on:
 * 1. Self-messaging prevention
 * 2. User blocks in either direction
 * 3. User account status (active vs suspended)
 * 4. Milestone 4 messaging business rules:
 *    - Production users may message talent (who applied or found via search).
 *    - Talent may message production only if they have an active application to that
 *      production's job, or that production user messaged them first.
 */
export async function canMessageUser(
  caller: CallerContext,
  recipientId: string
): Promise<CanMessageResult> {
  if (caller.userId === recipientId) {
    return {
      allowed: false,
      reason: 'Cannot message yourself',
      isBlocked: false,
      blockedByYou: false,
      isBlockedByPeer: false,
    }
  }

  // 1. Check blocks in either direction
  const { data: blocks } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${caller.userId},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${caller.userId})`
    )

  if (blocks && blocks.length > 0) {
    const blockedByYou = blocks.some((b) => b.blocker_id === caller.userId)
    const isBlockedByPeer = blocks.some((b) => b.blocker_id === recipientId)
    return {
      allowed: false,
      reason: 'Cannot send message: a block exists between these users',
      isBlocked: true,
      blockedByYou,
      isBlockedByPeer,
    }
  }

  // 2. Fetch recipient details
  const { data: recipient, error: recErr } = await supabase
    .from('users')
    .select('id, username, role, suspended_at')
    .eq('id', recipientId)
    .maybeSingle()

  if (recErr || !recipient) {
    return {
      allowed: false,
      reason: 'Recipient user not found',
      isBlocked: false,
      blockedByYou: false,
      isBlockedByPeer: false,
    }
  }

  if (recipient.suspended_at) {
    return {
      allowed: false,
      reason: 'Recipient user account is suspended',
      isBlocked: false,
      blockedByYou: false,
      isBlockedByPeer: false,
    }
  }

  // Admins can message anyone
  if (caller.isAdmin) {
    return {
      allowed: true,
      isBlocked: false,
      blockedByYou: false,
      isBlockedByPeer: false,
    }
  }

  // 3. Sender is Production
  if (caller.role === 'production') {
    if (recipient.role !== 'talent') {
      return {
        allowed: false,
        reason: 'Production users may only message talent accounts',
        isBlocked: false,
        blockedByYou: false,
        isBlockedByPeer: false,
      }
    }
    // Production can message talent found through search or applications
    return {
      allowed: true,
      isBlocked: false,
      blockedByYou: false,
      isBlockedByPeer: false,
    }
  }

  // 4. Sender is Talent
  if (caller.role === 'talent') {
    if (recipient.role !== 'production') {
      return {
        allowed: false,
        reason: 'Talent users may only message production accounts',
        isBlocked: false,
        blockedByYou: false,
        isBlockedByPeer: false,
      }
    }

    // Resolve talentProfileId
    let talentProfileId = caller.talentProfileId
    if (!talentProfileId) {
      const { data: tp } = await supabase
        .from('talent_profiles')
        .select('id')
        .eq('user_id', caller.userId)
        .maybeSingle()
      talentProfileId = tp?.id ?? null
    }

    // Resolve recipient's productionProfileId
    const { data: pp } = await supabase
      .from('production_profiles')
      .select('id')
      .eq('user_id', recipientId)
      .maybeSingle()
    const recipientProductionProfileId = pp?.id ?? null

    // Check Condition A: Talent has applied to any of recipient's jobs
    if (talentProfileId && recipientProductionProfileId) {
      const { data: appData } = await supabase
        .from('applications')
        .select('id, jobs!inner(production_id)')
        .eq('talent_profile_id', talentProfileId)
        .eq('jobs.production_id', recipientProductionProfileId)
        .limit(1)

      if (appData && appData.length > 0) {
        return {
          allowed: true,
          isBlocked: false,
          blockedByYou: false,
          isBlockedByPeer: false,
        }
      }
    }

    // Check Condition B: Production user initiated messaging first
    const { data: priorMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('sender_id', recipientId)
      .eq('recipient_id', caller.userId)
      .limit(1)

    if (priorMsg && priorMsg.length > 0) {
      return {
        allowed: true,
        isBlocked: false,
        blockedByYou: false,
        isBlockedByPeer: false,
      }
    }

    return {
      allowed: false,
      reason:
        'Talent may message a production user only if they have an application to that production\'s job, or that production user messaged them first.',
      isBlocked: false,
      blockedByYou: false,
      isBlockedByPeer: false,
    }
  }

  return {
    allowed: true,
    isBlocked: false,
    blockedByYou: false,
    isBlockedByPeer: false,
  }
}

/**
 * Sends a message with full validation, sanitization, and permission checks.
 */
export async function sendMessage(
  caller: CallerContext,
  recipientId: string,
  rawBody: string
): Promise<DbMessage> {
  const body = stripHtml(rawBody)
  if (!body || body.length === 0) {
    throw Object.assign(new Error('Message body cannot be empty'), { statusCode: 400 })
  }
  if (body.length > 2000) {
    throw Object.assign(new Error('Message body cannot exceed 2000 characters'), { statusCode: 400 })
  }

  const permission = await canMessageUser(caller, recipientId)
  if (!permission.allowed) {
    throw Object.assign(new Error(permission.reason ?? 'Messaging not permitted'), {
      statusCode: 403,
    })
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: caller.userId,
      recipient_id: recipientId,
      body,
      read: false,
    })
    .select('*')
    .single()

  if (error) {
    if (error.message?.includes('block exists')) {
      throw Object.assign(new Error('Cannot send message: a block exists between these users'), {
        statusCode: 403,
      })
    }
    throw Object.assign(new Error(`Failed to send message: ${error.message}`), { statusCode: 500 })
  }

  return data as DbMessage
}

export interface PaginatedConversations {
  conversations: ConversationItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Retrieves paginated conversation threads for the caller.
 */
export async function getConversations(
  caller: CallerContext,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedConversations> {
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(50, Math.max(1, limit))

  // Fetch recent messages where caller is participant to construct conversation items
  const { data: msgs, error } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, read, created_at')
    .or(`sender_id.eq.${caller.userId},recipient_id.eq.${caller.userId}`)
    .order('created_at', { ascending: false })

  if (error) {
    throw Object.assign(new Error(`Failed to fetch conversations: ${error.message}`), {
      statusCode: 500,
    })
  }

  const peerMap = new Map<
    string,
    { last_message: DbMessage; unread_count: number }
  >()

  for (const m of (msgs ?? []) as DbMessage[]) {
    const peerId = m.sender_id === caller.userId ? m.recipient_id : m.sender_id
    if (!peerMap.has(peerId)) {
      peerMap.set(peerId, {
        last_message: m,
        unread_count: !m.read && m.recipient_id === caller.userId ? 1 : 0,
      })
    } else {
      const entry = peerMap.get(peerId)!
      if (!m.read && m.recipient_id === caller.userId) {
        entry.unread_count += 1
      }
    }
  }

  const allPeerIds = Array.from(peerMap.keys())
  const total = allPeerIds.length
  const totalPages = Math.ceil(total / safeLimit) || 1
  const startIdx = (safePage - 1) * safeLimit
  const pagePeerIds = allPeerIds.slice(startIdx, startIdx + safeLimit)

  if (pagePeerIds.length === 0) {
    return {
      conversations: [],
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    }
  }

  // Lookup peer users info
  const { data: usersData } = await supabase
    .from('users')
    .select('id, username, role')
    .in('id', pagePeerIds)

  const userMap = new Map<string, { username: string; role: string }>()
  usersData?.forEach((u) => userMap.set(u.id, { username: u.username, role: u.role }))

  // Lookup blocks for this page
  const { data: blocksData } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${caller.userId},blocked_id.in.(${pagePeerIds.join(',')})),and(blocked_id.eq.${caller.userId},blocker_id.in.(${pagePeerIds.join(',')}))`
    )

  const conversations: ConversationItem[] = []
  for (const peerId of pagePeerIds) {
    const thread = peerMap.get(peerId)!
    const userInfo = userMap.get(peerId) ?? { username: 'Unknown', role: 'unknown' }

    const isBlockedByCaller = blocksData?.some(
      (b) => b.blocker_id === caller.userId && b.blocked_id === peerId
    ) ?? false
    const isBlockedByPeer = blocksData?.some(
      (b) => b.blocker_id === peerId && b.blocked_id === caller.userId
    ) ?? false
    const isBlocked = isBlockedByCaller || isBlockedByPeer

    let canMessage = !isBlocked
    let permissionReason: string | undefined

    if (isBlocked) {
      permissionReason = 'A block exists between these users'
    } else {
      const check = await canMessageUser(caller, peerId)
      canMessage = check.allowed
      permissionReason = check.reason
    }

    conversations.push({
      peer_id: peerId,
      peer_username: userInfo.username,
      peer_role: userInfo.role,
      last_message: thread.last_message,
      unread_count: thread.unread_count,
      is_blocked: isBlocked,
      blocked_by_you: isBlockedByCaller,
      can_message: canMessage,
      permission_reason: permissionReason,
    })
  }

  return {
    conversations,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  }
}

export interface MessagesThreadResult {
  messages: DbMessage[]
  next_cursor: string | null
  can_message: boolean
  permission_reason?: string
  is_blocked: boolean
  blocked_by_you: boolean
}

/**
 * Retrieves cursor-paginated messages for a conversation with a peer, newest first.
 * Max limit is 50.
 */
export async function getMessagesWithUser(
  caller: CallerContext,
  otherUserId: string,
  cursor?: string,
  limit: number = 30
): Promise<MessagesThreadResult> {
  const safeLimit = Math.min(50, Math.max(1, limit))

  let query = supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, read, created_at')
    .or(
      `and(sender_id.eq.${caller.userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${caller.userId})`
    )
    .order('created_at', { ascending: false })
    .limit(safeLimit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    throw Object.assign(new Error(`Failed to fetch messages: ${error.message}`), {
      statusCode: 500,
    })
  }

  const items = (data as DbMessage[]) ?? []
  let nextCursor: string | null = null

  if (items.length > safeLimit) {
    const extra = items.pop()!
    nextCursor = items[items.length - 1]?.created_at ?? extra.created_at
  }

  const check = await canMessageUser(caller, otherUserId)

  return {
    messages: items,
    next_cursor: nextCursor,
    can_message: check.allowed,
    permission_reason: check.reason,
    is_blocked: check.isBlocked,
    blocked_by_you: check.blockedByYou,
  }
}

/**
 * Marks messages in a conversation as read.
 */
export async function markConversationRead(
  caller: CallerContext,
  otherUserId: string
): Promise<{ success: boolean; count: number }> {
  const { data, error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', otherUserId)
    .eq('recipient_id', caller.userId)
    .eq('read', false)
    .select('id')

  if (error) {
    throw Object.assign(new Error(`Failed to mark messages as read: ${error.message}`), {
      statusCode: 500,
    })
  }

  return {
    success: true,
    count: data?.length ?? 0,
  }
}

/**
 * Blocks a user.
 */
export async function blockUser(
  callerId: string,
  blockedId: string
): Promise<DbUserBlock> {
  if (callerId === blockedId) {
    throw Object.assign(new Error('Cannot block yourself'), { statusCode: 400 })
  }

  const { data, error } = await supabase
    .from('user_blocks')
    .insert({
      blocker_id: callerId,
      blocked_id: blockedId,
    })
    .select('*')
    .single()

  if (error) {
    // Unique violation means already blocked
    if (error.code === '23505') {
      return {
        blocker_id: callerId,
        blocked_id: blockedId,
        created_at: new Date().toISOString(),
      }
    }
    throw Object.assign(new Error(`Failed to block user: ${error.message}`), { statusCode: 500 })
  }

  return data as DbUserBlock
}

/**
 * Unblocks a user.
 */
export async function unblockUser(
  callerId: string,
  userId: string
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', callerId)
    .eq('blocked_id', userId)

  if (error) {
    throw Object.assign(new Error(`Failed to unblock user: ${error.message}`), { statusCode: 500 })
  }

  return { success: true }
}

/**
 * Lists all users blocked by the caller.
 */
export async function getBlockedUsers(
  callerId: string
): Promise<Array<{ blocked_id: string; username: string; created_at: string }>> {
  const { data: blocks, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', callerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw Object.assign(new Error(`Failed to fetch blocked users: ${error.message}`), {
      statusCode: 500,
    })
  }

  if (!blocks || blocks.length === 0) return []

  const userIds = blocks.map((b) => b.blocked_id)
  const { data: users } = await supabase
    .from('users')
    .select('id, username')
    .in('id', userIds)

  const usernameMap = new Map<string, string>()
  users?.forEach((u) => usernameMap.set(u.id, u.username))

  return blocks.map((b) => ({
    blocked_id: b.blocked_id,
    username: usernameMap.get(b.blocked_id) ?? 'Unknown',
    created_at: b.created_at,
  }))
}

export interface CreateReportInput {
  target_user_id: string
  message_id?: string
  reason: ChatReportReason
  details?: string
}

/**
 * Submits a chat safety report.
 */
export async function createReport(
  reporterId: string,
  input: CreateReportInput
): Promise<DbChatReport> {
  if (reporterId === input.target_user_id) {
    throw Object.assign(new Error('Cannot report yourself'), { statusCode: 400 })
  }

  const validReasons: ChatReportReason[] = [
    'spam',
    'harassment',
    'scam',
    'inappropriate',
    'other',
  ]
  if (!validReasons.includes(input.reason)) {
    throw Object.assign(new Error('Invalid report reason'), { statusCode: 400 })
  }

  const details = input.details ? stripHtml(input.details) : null
  if (details && details.length > 1000) {
    throw Object.assign(new Error('Report details must be at most 1000 characters'), {
      statusCode: 400,
    })
  }

  const { data, error } = await supabase
    .from('chat_reports')
    .insert({
      reporter_id: reporterId,
      target_user_id: input.target_user_id,
      message_id: input.message_id ?? null,
      reason: input.reason,
      details,
      status: 'open',
    })
    .select('*')
    .single()

  if (error) {
    throw Object.assign(new Error(`Failed to create report: ${error.message}`), { statusCode: 500 })
  }

  return data as DbChatReport
}

export interface AdminReportItem extends DbChatReport {
  reporter_username?: string
  reporter_email?: string
  target_username?: string
  target_email?: string
  message_body?: string | null
}

export interface PaginatedAdminReports {
  reports: AdminReportItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Retrieves paginated chat reports for the admin queue.
 */
export async function getAdminReports(
  status?: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedAdminReports> {
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(100, Math.max(1, limit))
  const from = (safePage - 1) * safeLimit
  const to = from + safeLimit - 1

  let query = supabase
    .from('chat_reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    throw Object.assign(new Error(`Failed to fetch chat reports: ${error.message}`), {
      statusCode: 500,
    })
  }

  const reports = (data as DbChatReport[]) ?? []
  const userIds = Array.from(
    new Set([...reports.map((r) => r.reporter_id), ...reports.map((r) => r.target_user_id)])
  )

  const userMap = new Map<string, { username: string; email: string }>()
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, username, email')
      .in('id', userIds)
    users?.forEach((u) => userMap.set(u.id, { username: u.username, email: u.email }))
  }

  const messageIds = reports.map((r) => r.message_id).filter(Boolean) as string[]
  const messageMap = new Map<string, string>()
  if (messageIds.length > 0) {
    const { data: messages } = await supabase
      .from('messages')
      .select('id, body')
      .in('id', messageIds)
    messages?.forEach((m) => messageMap.set(m.id, m.body))
  }

  const enrichedReports: AdminReportItem[] = reports.map((r) => {
    const rep = userMap.get(r.reporter_id)
    const tgt = userMap.get(r.target_user_id)
    return {
      ...r,
      reporter_username: rep?.username,
      reporter_email: rep?.email,
      target_username: tgt?.username,
      target_email: tgt?.email,
      message_body: r.message_id ? messageMap.get(r.message_id) ?? null : null,
    }
  })

  const total = count ?? 0
  const totalPages = Math.ceil(total / safeLimit) || 1

  return {
    reports: enrichedReports,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  }
}

/**
 * Updates a chat report's status and notes, logging the action to audit_log.
 */
export async function updateAdminReport(
  adminId: string,
  reportId: string,
  status: ChatReportStatus,
  resolutionNotes?: string
): Promise<DbChatReport> {
  const { data, error } = await supabase
    .from('chat_reports')
    .update({
      status,
      resolution_notes: resolutionNotes ? stripHtml(resolutionNotes) : null,
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select('*')
    .single()

  if (error || !data) {
    throw Object.assign(new Error(`Failed to update report: ${error?.message ?? 'Report not found'}`), {
      statusCode: error ? 500 : 404,
    })
  }

  // Record audit log
  await recordAuditLog({
    actor_id: adminId,
    action: 'chat_report_update',
    target_type: 'chat_report',
    target_id: reportId,
    details: {
      status,
      resolution_notes: resolutionNotes ?? null,
    },
  })

  return data as DbChatReport
}
