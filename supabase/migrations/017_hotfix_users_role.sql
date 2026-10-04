-- ============================================================
-- CineConnect – Migration 017: Hotfix Users Role & Privilege Escalation
-- Run after 016_compliance_and_launch_readiness.sql
--
-- ROLLBACK:
--   drop trigger if exists trg_protect_users_role_and_identity on public.users;
--   drop function if exists public.protect_users_role_and_identity();
--   drop policy if exists "users: owner insert" on public.users;
--   create policy "users: owner insert" on public.users for insert with check (auth.uid() = id);
--   drop policy if exists "users: owner update" on public.users;
--   create policy "users: owner update" on public.users for update using (auth.uid() = id);
-- ============================================================

-- ── 1. Recreate users INSERT policy ───────────────────────────
-- Restrict direct PostgREST inserts to own id and valid non-admin roles ('production', 'talent').
drop policy if exists "users: owner insert" on public.users;
create policy "users: owner insert"
  on public.users for insert
  with check (
    auth.uid() = id and role in ('production', 'talent')
  );

-- ── 2. Recreate users UPDATE policy ───────────────────────────
-- A user may only update their own row.
drop policy if exists "users: owner update" on public.users;
create policy "users: owner update"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 3. BEFORE UPDATE Trigger: Prevent Privilege Escalation & Identity Changes ──
-- Ensures that neither role, id, nor email can be updated by regular authenticated users.
-- Only the service_role key (used by administrative server functions) or database superusers
-- can modify these columns.
create or replace function public.protect_users_role_and_identity()
returns trigger
language plpgsql
security definer
as $$
declare
  v_jwt_role text;
begin
  -- Resolve caller JWT role: check auth.role(), request.jwt.claim.role, or request.jwt.claims
  begin
    v_jwt_role := coalesce(
      auth.role(),
      nullif(current_setting('request.jwt.claim.role', true), '')
    );
  exception when others then
    v_jwt_role := null;
  end;

  -- Block any non-service_role from altering id, email, or role
  if (
    NEW.role is distinct from OLD.role or
    NEW.id is distinct from OLD.id or
    NEW.email is distinct from OLD.email
  ) then
    if coalesce(v_jwt_role, '') <> 'service_role'
       and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Unauthorized: modifying id, email, or role is not permitted for caller role %', coalesce(v_jwt_role, 'authenticated');
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_users_role_and_identity on public.users;
create trigger trg_protect_users_role_and_identity
  before update on public.users
  for each row
  execute function public.protect_users_role_and_identity();

-- ── Compatibility Confirmation: Migration 009 Trigger ──────────
-- Migration 009's trigger `trg_create_public_user` executes `after insert on auth.users`
-- via `public.handle_new_auth_user()` which is declared `SECURITY DEFINER`.
-- 1. It performs an INSERT (not UPDATE), so `trg_protect_users_role_and_identity` will not fire.
-- 2. It runs with the privileges of its creator (`postgres`), bypassing RLS.
-- 3. Its implementation enforces `role IN ('talent', 'production')` (defaulting to 'talent'),
--    satisfying the new "users: owner insert" CHECK constraint.
-- Conclusion: Migration 009 auto-creation continues to operate correctly.
