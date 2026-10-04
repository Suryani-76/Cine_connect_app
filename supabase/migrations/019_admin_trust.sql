-- ==============================================================================
-- CineConnect – Migration 019: Admin Trust & Audit Logging
-- Run after 018_rls_lockdown.sql
--
-- PRINCIPLE:
--   Admin authorization is determined exclusively by the public.admins table.
--   Ad-hoc role checks (users.role = 'admin') and shared secret headers
--   are deprecated and replaced with dedicated trust & audit models.
--
-- ROLLBACK INSTRUCTIONS:
--   1. Drop audit and admin tables:
--      DROP TABLE IF EXISTS public.audit_log CASCADE;
--      DROP TABLE IF EXISTS public.admins CASCADE;
--   2. Drop added columns:
--      ALTER TABLE public.users DROP COLUMN IF EXISTS suspended_at;
--      ALTER TABLE public.production_profiles DROP COLUMN IF EXISTS verified_by;
--      ALTER TABLE public.production_profiles DROP COLUMN IF EXISTS verified_at;
--      ALTER TABLE public.production_profiles DROP COLUMN IF EXISTS verified;
--   3. Revert match_config policy to role-check if needed:
--      CREATE POLICY "match_config: admin select" ON public.match_config
--        FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
-- ==============================================================================

-- ── 1. Create Admins Table ───────────────────────────────────────────────────
-- Holds explicit, audited admin grants. No direct client access.
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── 2. Create Audit Log Table ────────────────────────────────────────────────
-- Centralized audit trail for all admin actions and compliance events.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient querying by target and action
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- ── 3. Add Columns to users and production_profiles ──────────────────────────

-- Users: suspension timestamp for immediate session / route revoking
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz DEFAULT NULL;

-- Production Profiles: verification status and audit metadata
ALTER TABLE public.production_profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.production_profiles
  ADD COLUMN IF NOT EXISTS verified_at timestamptz DEFAULT NULL;

ALTER TABLE public.production_profiles
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

-- ── 4. Row-Level Security: Zero Client Access for admins and audit_log ────────

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from anon and authenticated (service_role only)
REVOKE ALL ON public.admins FROM anon, authenticated;
REVOKE ALL ON public.audit_log FROM anon, authenticated;

-- Ensure match_config read policy validates against admins table instead of users.role
DROP POLICY IF EXISTS "match_config: admin select" ON public.match_config;

CREATE POLICY "match_config: admin select"
  ON public.match_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    )
  );
