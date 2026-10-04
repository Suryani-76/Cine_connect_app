import { supabase } from '../../db/supabase'
import { DbEmailOutbox } from '../../types'

export interface EnqueueEmailInput {
  recipient_email: string
  user_id?: string | null
  template_name: string
  subject: string
  payload?: Record<string, unknown>
}

/**
 * Enqueues an email into public.email_outbox for asynchronous processing.
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<DbEmailOutbox> {
  const { data, error } = await supabase
    .from('email_outbox')
    .insert({
      recipient_email: input.recipient_email,
      user_id: input.user_id ?? null,
      template_name: input.template_name,
      subject: input.subject,
      payload: input.payload ?? {},
      status: 'pending',
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw Object.assign(new Error(`Failed to enqueue email: ${error.message}`), { statusCode: 500 })
  }

  return data as DbEmailOutbox
}
