-- ==============================================================================
-- CineConnect – Migration 018: RLS Lockdown & Least-Privilege Access Control
-- Run after 017_hotfix_users_role.sql
--
-- PRINCIPLE:
--   The Express backend server (service_role) is the SOLE writer for all data.
--   Clients (anon / authenticated) may SELECT only what Supabase Realtime or public
--   autocomplete needs. All other reads and mutations MUST go through Express API.
--
-- TODO(milestone-4C-2): Direct client INSERT on public.messages is temporarily
-- retained for authenticated users until the Express Chat API is migrated in Milestone 4C-2.
--
-- ROLLBACK INSTRUCTIONS:
--   1. Re-grant privileges:
--      GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, authenticated, anon;
--   2. Recreate default public read / owner policies from migrations 001-006.
--   3. Drop view public.public_profiles;
--   4. Reset default privileges:
--      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
-- ==============================================================================

-- ── 1. Revoke Write Privileges at the Database Privilege Level ──────────────────
-- Disallow direct client INSERT, UPDATE, DELETE across all core business tables.

REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.production_profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.talent_profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.jobs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.job_requirements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.applications FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.saved_jobs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.talent_alerts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.job_views FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_consents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invite_codes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.email_outbox FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_config FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_config_audit_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_recompute_queue FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.skills FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.roles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cities FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.skill_aliases FROM anon, authenticated;

-- Messages: revoke write privileges from anon; allow authenticated INSERT only (4C-2 transition)
REVOKE UPDATE, DELETE ON public.messages FROM anon, authenticated;
REVOKE INSERT ON public.messages FROM anon;
GRANT INSERT ON public.messages TO authenticated;

-- ── 2. Table-Specific Access & SELECT Policies ────────────────────────────────

-- ── A. users & public_profiles view ────────────────────────────
-- Anon cannot select users. Authenticated users can only read their own row.
REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;

DROP POLICY IF EXISTS "users: public read" ON public.users;
DROP POLICY IF EXISTS "users: read own" ON public.users;
DROP POLICY IF EXISTS "users: owner insert" ON public.users;
DROP POLICY IF EXISTS "users: owner update" ON public.users;

CREATE POLICY "users: read own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Public profile view for safe display name resolution (id, username, role). Never email.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
  SELECT id, username, role
  FROM public.users;

REVOKE ALL ON public.public_profiles FROM anon, public;
GRANT SELECT ON public.public_profiles TO authenticated;

-- ── B. talent_profiles & production_profiles ───────────────────
-- Direct client access revoked. Reads and updates are mediated by Express API.
REVOKE ALL ON public.talent_profiles FROM anon, authenticated;
REVOKE ALL ON public.production_profiles FROM anon, authenticated;

DROP POLICY IF EXISTS "talent_profiles: public read" ON public.talent_profiles;
DROP POLICY IF EXISTS "talent_profiles: owner insert" ON public.talent_profiles;
DROP POLICY IF EXISTS "talent_profiles: owner update" ON public.talent_profiles;

DROP POLICY IF EXISTS "production_profiles: public read" ON public.production_profiles;
DROP POLICY IF EXISTS "production_profiles: owner insert" ON public.production_profiles;
DROP POLICY IF EXISTS "production_profiles: owner update" ON public.production_profiles;

-- ── C. jobs & job_requirements ────────────────────────────────
-- Anon cannot select jobs directly (public pages use Express API).
-- Authenticated users see published jobs, plus owners see their own drafts.
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.job_requirements FROM anon;
GRANT SELECT ON public.jobs TO authenticated;
GRANT SELECT ON public.job_requirements TO authenticated;

DROP POLICY IF EXISTS "jobs: public read" ON public.jobs;
DROP POLICY IF EXISTS "jobs: owner insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs: owner update" ON public.jobs;
DROP POLICY IF EXISTS "jobs: authenticated select" ON public.jobs;

CREATE POLICY "jobs: authenticated select"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    OR auth.uid() IN (SELECT user_id FROM public.production_profiles WHERE id = production_id)
  );

DROP POLICY IF EXISTS "job_requirements: public read" ON public.job_requirements;
DROP POLICY IF EXISTS "job_requirements: owner write" ON public.job_requirements;
DROP POLICY IF EXISTS "job_requirements: authenticated select" ON public.job_requirements;

CREATE POLICY "job_requirements: authenticated select"
  ON public.job_requirements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (
          j.status = 'published'
          OR auth.uid() IN (SELECT user_id FROM public.production_profiles WHERE id = j.production_id)
        )
    )
  );

-- ── D. invite_codes ────────────────────────────────────────────
-- Completely private. Codes are checked by Express auth service only.
REVOKE ALL ON public.invite_codes FROM anon, authenticated;
DROP POLICY IF EXISTS "invite_codes: read active" ON public.invite_codes;
DROP POLICY IF EXISTS "invite_codes: public read" ON public.invite_codes;

-- ── E. match_config & internals ────────────────────────────────
-- Internal algorithm config. Visible only to database admins.
REVOKE ALL ON public.match_config FROM anon;
GRANT SELECT ON public.match_config TO authenticated;

DROP POLICY IF EXISTS "match_config: public read" ON public.match_config;
DROP POLICY IF EXISTS "match_config: admin select" ON public.match_config;

CREATE POLICY "match_config: admin select"
  ON public.match_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

REVOKE ALL ON public.match_config_audit_logs FROM anon, authenticated;
REVOKE ALL ON public.match_recompute_queue FROM anon, authenticated;
REVOKE ALL ON public.email_outbox FROM anon, authenticated;
REVOKE ALL ON public.job_views FROM anon, authenticated;
REVOKE ALL ON public.user_consents FROM anon, authenticated;

-- ── F. notifications & messages (Realtime Support) ─────────────
REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notifications: owner read" ON public.notifications;
DROP POLICY IF EXISTS "notifications: system insert" ON public.notifications;

CREATE POLICY "notifications: owner read"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.messages FROM anon;
GRANT SELECT, INSERT ON public.messages TO authenticated;

DROP POLICY IF EXISTS "messages: participant read" ON public.messages;
DROP POLICY IF EXISTS "messages: authenticated select" ON public.messages;
DROP POLICY IF EXISTS "messages: sender insert" ON public.messages;

CREATE POLICY "messages: participant read"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "messages: sender insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- ── G. applications (Realtime Support) ─────────────────────────
REVOKE ALL ON public.applications FROM anon;
GRANT SELECT ON public.applications TO authenticated;

DROP POLICY IF EXISTS "applications: talent select" ON public.applications;
DROP POLICY IF EXISTS "applications: talent insert" ON public.applications;
DROP POLICY IF EXISTS "applications: realtime select" ON public.applications;

CREATE POLICY "applications: realtime select"
  ON public.applications FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM public.talent_profiles WHERE id = talent_profile_id)
    OR auth.uid() IN (
      SELECT pp.user_id
      FROM public.jobs j
      JOIN public.production_profiles pp ON pp.id = j.production_id
      WHERE j.id = job_id
    )
  );

-- ── H. Controlled Vocabulary Tables (Autocomplete) ─────────────
-- Public read allowed for search/autocomplete; mutations strictly revoked.
GRANT SELECT ON public.skills TO anon, authenticated;
GRANT SELECT ON public.roles TO anon, authenticated;
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT SELECT ON public.skill_aliases TO anon, authenticated;

-- ── 3. Alter Default Privileges for Future Tables ──────────────
-- Guarantees any future table created in public schema does not leak grants to anon or authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ── 4. Storage Bucket Policies ─────────────────────────────────
-- avatars: Public read of image files only. Direct client writes forbidden.
-- resumes: Private bucket. Direct client reads/writes forbidden (managed via backend in 4C-3).

DO $$
BEGIN
  -- Ensure buckets exist with correct visibility
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

  INSERT INTO storage.buckets (id, name, public)
  VALUES ('resumes', 'resumes', false)
  ON CONFLICT (id) DO UPDATE SET public = false;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if storage schema is not present in local test harness
  NULL;
END $$;

-- Storage object policies (guarded against environments without storage.objects)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- Avatars: Allow public read only for image types
    DROP POLICY IF EXISTS "avatars: public image read" ON storage.objects;
    CREATE POLICY "avatars: public image read"
      ON storage.objects FOR SELECT
      TO public
      USING (
        bucket_id = 'avatars'
        AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
      );

    -- Revoke direct writes from clients
    DROP POLICY IF EXISTS "avatars: client insert" ON storage.objects;
    DROP POLICY IF EXISTS "avatars: client update" ON storage.objects;
    DROP POLICY IF EXISTS "avatars: client delete" ON storage.objects;

    -- Resumes: Completely private from direct client access
    DROP POLICY IF EXISTS "resumes: client select" ON storage.objects;
    DROP POLICY IF EXISTS "resumes: client insert" ON storage.objects;
    DROP POLICY IF EXISTS "resumes: client update" ON storage.objects;
    DROP POLICY IF EXISTS "resumes: client delete" ON storage.objects;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
