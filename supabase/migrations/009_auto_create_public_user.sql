-- ============================================================
-- CineConnect – Auto-create public.users on auth.users insert
-- Run after 008_fix_notification_types.sql
--
-- ROLLBACK:
--   drop trigger if exists trg_create_public_user on auth.users;
--   drop function if exists public.handle_new_auth_user();
-- ============================================================

-- TRIGGER: fires after every new auth.users row is inserted.
-- Reads username and role from raw_user_meta_data (set during signUp).
-- Validates role against the CHECK constraint before inserting.
-- Uses SECURITY DEFINER with explicit search_path to prevent hijacking.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_role     text;
begin
  v_username := NEW.raw_user_meta_data ->> 'username';
  v_role     := NEW.raw_user_meta_data ->> 'role';

  -- Validate role; default to 'talent' if missing/invalid
  if v_role not in ('talent', 'production') then
    v_role := 'talent';
  end if;

  -- username defaults to email prefix if metadata missing
  if v_username is null or v_username = '' then
    v_username := split_part(NEW.email, '@', 1);
  end if;

  -- Insert; ignore if row already exists (idempotent)
  insert into public.users (id, email, username, role)
  values (NEW.id, NEW.email, v_username, v_role)
  on conflict (id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_create_public_user on auth.users;
create trigger trg_create_public_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ── Backfill: detect orphaned auth.users with no public.users row ──
-- Run manually after applying this migration if you have existing users:
--
-- insert into public.users (id, email, username, role)
-- select
--   au.id,
--   au.email,
--   coalesce(au.raw_user_meta_data->>'username', split_part(au.email,'@',1)),
--   coalesce(
--     nullif(au.raw_user_meta_data->>'role',''),
--     'talent'
--   )
-- from auth.users au
-- left join public.users pu on pu.id = au.id
-- where pu.id is null;
