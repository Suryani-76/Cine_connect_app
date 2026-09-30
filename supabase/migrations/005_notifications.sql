-- ============================================================
-- CineConnect – Notifications
-- Run after 004_applications_pipeline.sql
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  type       text        not null,           -- 'new_application' | 'new_message' | 'high_match_talent'
  payload    jsonb       not null default '{}',
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications: owner read"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications: owner update"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Service-role inserts are unrestricted (used by triggers via the admin client).

-- ── Index for fast unread-count queries ───────────────────────
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read)
  where read = false;

-- ── Trigger 1: new application ────────────────────────────────
-- When a row is inserted into applications, notify the production
-- house owner that someone applied to their job.
create or replace function public.notify_new_application()
returns trigger language plpgsql security definer as $$
declare
  v_production_user_id uuid;
  v_job_title          text;
  v_talent_name        text;
begin
  -- Resolve the production house owner's user_id
  select pp.user_id, j.title
    into v_production_user_id, v_job_title
    from public.jobs j
    join public.production_profiles pp on pp.id = j.production_id
   where j.id = NEW.job_id;

  -- Resolve talent display name
  select coalesce(full_name, 'A talent')
    into v_talent_name
    from public.talent_profiles
   where id = NEW.talent_profile_id;

  insert into public.notifications (user_id, type, payload)
  values (
    v_production_user_id,
    'new_application',
    jsonb_build_object(
      'application_id', NEW.id,
      'job_id',         NEW.job_id,
      'job_title',      v_job_title,
      'talent_name',    v_talent_name
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_application on public.applications;
create trigger trg_notify_new_application
  after insert on public.applications
  for each row execute function public.notify_new_application();

-- ── Trigger 2: new message ────────────────────────────────────
-- Assumes a messages table with (id, sender_id, recipient_id, body).
-- Creates the table if it does not exist yet so the trigger compiles.
create table if not exists public.messages (
  id           uuid        primary key default gen_random_uuid(),
  sender_id    uuid        not null references public.users(id) on delete cascade,
  recipient_id uuid        not null references public.users(id) on delete cascade,
  body         text        not null,
  read         boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "messages: participants read"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "messages: sender insert"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "messages: recipient update"
  on public.messages for update
  using (auth.uid() = recipient_id);

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer as $$
declare
  v_sender_name text;
begin
  select coalesce(username, 'Someone')
    into v_sender_name
    from public.users
   where id = NEW.sender_id;

  insert into public.notifications (user_id, type, payload)
  values (
    NEW.recipient_id,
    'new_message',
    jsonb_build_object(
      'message_id',   NEW.id,
      'sender_id',    NEW.sender_id,
      'sender_name',  v_sender_name,
      'preview',      left(NEW.body, 120)
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- ── Trigger 3: high-match talent on new application ───────────
-- Reuses the applications insert trigger; fires a second notification
-- (type = 'high_match_talent') when match_score >= 75.
create or replace function public.notify_high_match_talent()
returns trigger language plpgsql security definer as $$
declare
  v_production_user_id uuid;
  v_job_title          text;
  v_talent_name        text;
begin
  -- Only fire when a match score has been stored and is high
  if NEW.match_score is null or NEW.match_score < 75 then
    return NEW;
  end if;

  select pp.user_id, j.title
    into v_production_user_id, v_job_title
    from public.jobs j
    join public.production_profiles pp on pp.id = j.production_id
   where j.id = NEW.job_id;

  select coalesce(full_name, 'A talent')
    into v_talent_name
    from public.talent_profiles
   where id = NEW.talent_profile_id;

  insert into public.notifications (user_id, type, payload)
  values (
    v_production_user_id,
    'high_match_talent',
    jsonb_build_object(
      'application_id', NEW.id,
      'job_id',         NEW.job_id,
      'job_title',      v_job_title,
      'talent_name',    v_talent_name,
      'match_score',    NEW.match_score
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_high_match on public.applications;
create trigger trg_notify_high_match
  after insert on public.applications
  for each row execute function public.notify_high_match_talent();
