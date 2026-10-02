import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.'
    )
  }
}

/**
 * Supabase admin client using the service role key.
 * Use only on the server — never expose this key to the client.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
