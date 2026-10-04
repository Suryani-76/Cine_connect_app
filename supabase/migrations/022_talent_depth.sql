-- ==============================================================================
-- CineConnect – Migration 022: Talent Depth, Credits, Showreel, Availability, and Resumes
-- Run after 021_revoke_message_insert.sql
--
-- PRINCIPLE:
--   Milestone M3: Extends talent profiles with multiple roles, showreel URLs,
--   availability statuses, private resume document references, and credits history.
--   Enforces service-role only access on talent_credits with cascading deletes.
--
-- ROLLBACK INSTRUCTIONS:
--   DROP TABLE IF EXISTS public.talent_credits CASCADE;
--   DROP INDEX IF EXISTS idx_talent_profiles_roles;
--   ALTER TABLE public.talent_profiles
--     DROP COLUMN IF EXISTS resume_path,
--     DROP COLUMN IF EXISTS availability,
--     DROP COLUMN IF EXISTS showreel_url,
--     DROP COLUMN IF EXISTS roles;
-- ==============================================================================

-- ── 1. Extend talent_profiles schema ──────────────────────────────────────────

-- Multiple roles array
ALTER TABLE public.talent_profiles
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';

-- Backfill roles array from singular primary role where present
UPDATE public.talent_profiles
SET roles = ARRAY[role]
WHERE role IS NOT NULL AND (roles IS NULL OR roles = '{}');

-- Showreel video URL (YouTube / Vimeo)
ALTER TABLE public.talent_profiles
  ADD COLUMN IF NOT EXISTS showreel_url text;

-- Availability status ('open', 'busy', 'unavailable')
ALTER TABLE public.talent_profiles
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'open'
  CHECK (availability IN ('open', 'busy', 'unavailable'));

-- Private resume document path in storage
ALTER TABLE public.talent_profiles
  ADD COLUMN IF NOT EXISTS resume_path text;

-- GIN index for fast role overlap queries
CREATE INDEX IF NOT EXISTS idx_talent_profiles_roles
  ON public.talent_profiles USING GIN (roles);

-- ── 2. Create talent_credits table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.talent_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_profile_id uuid NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  project_title text NOT NULL,
  role text NOT NULL,
  year integer CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
  production_company text,
  description text,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_credits_profile
  ON public.talent_credits(talent_profile_id, created_at DESC);

-- ── 3. RLS Lockdown: Service Role Only for Credits ───────────────────────────

ALTER TABLE public.talent_credits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.talent_credits FROM anon, authenticated;

-- ── 4. Tighten Storage Policies ──────────────────────────────────────────────
-- Avatars: Public read of image files only. Direct client writes forbidden.
-- Resumes: Private bucket. Zero direct client read or write.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- Ensure client write is revoked
    DROP POLICY IF EXISTS "avatars: client insert" ON storage.objects;
    DROP POLICY IF EXISTS "avatars: client update" ON storage.objects;
    DROP POLICY IF EXISTS "avatars: client delete" ON storage.objects;

    DROP POLICY IF EXISTS "resumes: client select" ON storage.objects;
    DROP POLICY IF EXISTS "resumes: client insert" ON storage.objects;
    DROP POLICY IF EXISTS "resumes: client update" ON storage.objects;
    DROP POLICY IF EXISTS "resumes: client delete" ON storage.objects;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
