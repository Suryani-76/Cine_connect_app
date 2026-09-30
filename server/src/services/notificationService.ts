import { supabase } from '../db/supabase'
import { DbNotification, NotificationType } from '../types'

// ── List ──────────────────────────────────────────────────────

export interface ListNotificationsFilter {
  user_id: string
  unread_only?: boolean
  limit?: number
}

export async function listNotifications(
  filter: ListNotificationsFilter
): Promise<DbNotification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', filter.user_id)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 50)

  if (filter.unread_only) {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return (data ?? []) as DbNotification[]
}

// ── Unread count ──────────────────────────────────────────────

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return count ?? 0
}

// ── Mark read ─────────────────────────────────────────────────

export async function markNotificationRead(
  notificationId: string
): Promise<DbNotification> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  if (!data) {
    throw Object.assign(new Error('Notification not found'), { statusCode: 404 })
  }

  return data as DbNotification
}

// ── Mark all read ─────────────────────────────────────────────

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }
}

// ── Create (server-side helper, used outside DB triggers) ─────

export async function createNotification(input: {
  user_id: string
  type: NotificationType
  payload: Record<string, unknown>
}): Promise<DbNotification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.user_id,
      type:    input.type,
      payload: input.payload,
    })
    .select()
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  return data as DbNotification
}
