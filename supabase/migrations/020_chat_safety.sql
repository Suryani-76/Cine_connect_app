-- ==============================================================================
-- CineConnect – Migration 020: Chat Safety, User Blocks, and Reports
-- Run after 019_admin_trust.sql
--
-- PRINCIPLE:
--   Messaging is moved behind the Express API with server-enforced safety.
--   Direct client access to blocks and reports is revoked.
--   A database trigger provides defense-in-depth against messaging blocked users.
--
-- ROLLBACK INSTRUCTIONS:
--   1. Drop triggers and trigger functions:
--      DROP TRIGGER IF EXISTS trg_check_message_block ON public.messages;
--      DROP FUNCTION IF EXISTS public.check_message_block();
--   2. Drop tables:
--      DROP TABLE IF EXISTS public.chat_reports CASCADE;
--      DROP TABLE IF EXISTS public.user_blocks CASCADE;
--   3. Drop indexes:
--      DROP INDEX IF EXISTS idx_messages_sender_recipient_created;
--      DROP INDEX IF EXISTS idx_messages_recipient_sender_created;
-- ==============================================================================

-- ── 1. Create User Blocks Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

-- ── 2. Create Chat Reports Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'scam', 'inappropriate', 'other')),
  details text CHECK (details IS NULL OR char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz DEFAULT NULL,
  resolution_notes text DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_reports_status ON public.chat_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reports_target ON public.chat_reports(target_user_id);

-- ── 3. High-Performance Messages Indexes ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_created
  ON public.messages(sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender_created
  ON public.messages(recipient_id, sender_id, created_at DESC);

-- ── 4. RLS Lockdown: Service Role Only for Blocks and Reports ─────────────────
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_blocks FROM anon, authenticated;
REVOKE ALL ON public.chat_reports FROM anon, authenticated;

-- ── 5. Database Trigger: Block Enforcement on Messages ────────────────────────
-- Second line of defense even if message insertion is attempted directly
CREATE OR REPLACE FUNCTION public.check_message_block()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = NEW.sender_id AND blocked_id = NEW.recipient_id)
       OR (blocker_id = NEW.recipient_id AND blocked_id = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'Cannot send message: a block exists between these users'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_message_block ON public.messages;
CREATE TRIGGER trg_check_message_block
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_message_block();
