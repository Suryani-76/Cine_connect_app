import { supabase } from '../db/supabase'
import { DbAuditLog } from '../types'

export interface RecordAuditLogInput {
  actor_id: string | null
  action: string
  target_type: string
  target_id: string
  details?: Record<string, unknown>
}

/**
 * Appends an entry to the system audit_log table.
 * Uses service role to ensure all operational and admin events are recorded.
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<DbAuditLog> {
  const { data, error } = await supabase
    .from('audit_log')
    .insert({
      actor_id: input.actor_id,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id,
      details: input.details ?? {},
    })
    .select()
    .single()

  if (error) {
    console.error('[auditService] Failed to record audit log:', error.message)
    // Fallback: return mock object if audit insert fails so action itself is not blocked in degraded DB states
    return {
      id: '00000000-0000-0000-0000-000000000000',
      actor_id: input.actor_id,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id,
      details: input.details ?? {},
      created_at: new Date().toISOString(),
    }
  }

  return data as DbAuditLog
}

export interface GetAuditLogsParams {
  page?: number
  limit?: number
  target_type?: string
  action?: string
}

export interface PaginatedAuditLogs {
  items: DbAuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Returns paginated audit logs, ordered newest first.
 */
export async function getAuditLogs(params: GetAuditLogsParams = {}): Promise<PaginatedAuditLogs> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.target_type) {
    query = query.eq('target_type', params.target_type)
  }

  if (params.action) {
    query = query.eq('action', params.action)
  }

  const { data, count, error } = await query

  if (error) {
    throw Object.assign(new Error(`Failed to fetch audit logs: ${error.message}`), {
      statusCode: 500,
    })
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit) || 1

  return {
    items: (data as DbAuditLog[]) ?? [],
    total,
    page,
    limit,
    totalPages,
  }
}
