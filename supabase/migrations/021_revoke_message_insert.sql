-- ==============================================================================
-- CineConnect – Migration 021: Revoke Direct Client Message Write Access
-- Run after 020_chat_safety.sql
--
-- PRINCIPLE:
--   Milestone M4: Chat writes (INSERT, UPDATE) have moved entirely behind the
--   Express API service layer where safety, validation, rate limiting, and
--   permission checks are enforced.
--   Direct client writes through PostgREST are now permanently revoked.
--   Direct SELECT remains granted to authenticated for Realtime event delivery.
--
-- ROLLBACK INSTRUCTIONS:
--   GRANT INSERT ON public.messages TO authenticated;
--   CREATE POLICY "messages: sender insert"
--     ON public.messages FOR INSERT
--     TO authenticated
--     WITH CHECK (auth.uid() = sender_id);
-- ==============================================================================

-- ── 1. Revoke write privileges on messages from client roles ──────────────────
REVOKE INSERT, UPDATE, DELETE ON public.messages FROM anon, authenticated;

-- ── 2. Drop direct client INSERT & UPDATE policies on messages ───────────────
DROP POLICY IF EXISTS "messages: sender insert" ON public.messages;
DROP POLICY IF EXISTS "messages: recipient update" ON public.messages;

-- ── 3. Confirm SELECT privilege & participant policy for Realtime ─────────────
GRANT SELECT ON public.messages TO authenticated;

DROP POLICY IF EXISTS "messages: participant read" ON public.messages;
CREATE POLICY "messages: participant read"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
