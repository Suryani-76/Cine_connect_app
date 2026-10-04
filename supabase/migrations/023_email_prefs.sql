-- 023_email_prefs.sql
-- Milestone M5: Notification Preferences, Outbox Worker Support & Resend Deliverability
--
-- Schema additions:
-- 1. notification_preferences (per-type booleans, digest frequency, unsubscribe token)
-- 2. email_outbox updates (status in 'pending','sent','failed','dead', attempts, next_attempt_at, last_error)
-- 3. Atomic claim function using FOR UPDATE SKIP LOCKED
-- 4. RLS lockdowns (service role access only)

-- ── 1. Notification Preferences Table ─────────────────────────
create table if not exists public.notification_preferences (
  user_id             uuid primary key references public.users(id) on delete cascade,
  new_application     boolean not null default true,
  status_change       boolean not null default true,
  new_message         boolean not null default true,
  job_closed          boolean not null default true,
  talent_alert_match  boolean not null default true,
  digest_frequency    text not null default 'daily'
                        check (digest_frequency in ('off', 'daily', 'weekly')),
  unsubscribe_token   uuid not null default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists idx_notification_preferences_unsub_token
  on public.notification_preferences (unsubscribe_token);

create index if not exists idx_notification_preferences_digest
  on public.notification_preferences (digest_frequency)
  where digest_frequency != 'off';

-- ── 2. Auto-Provision Trigger for Users ───────────────────────
create or replace function public.handle_new_user_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auto_notification_preferences on public.users;
create trigger trg_auto_notification_preferences
  after insert on public.users
  for each row
  execute function public.handle_new_user_notification_preferences();

-- Backfill existing users
insert into public.notification_preferences (user_id)
select id from public.users
on conflict (user_id) do nothing;

-- ── 3. Email Outbox Updates ───────────────────────────────────
alter table public.email_outbox
  add column if not exists attempts int not null default 0;

alter table public.email_outbox
  add column if not exists next_attempt_at timestamptz not null default now();

alter table public.email_outbox
  add column if not exists last_error text;

alter table public.email_outbox
  add column if not exists user_id uuid references public.users(id) on delete set null;

-- Update status check constraint to include 'dead'
alter table public.email_outbox
  drop constraint if exists email_outbox_status_check;

alter table public.email_outbox
  add constraint email_outbox_status_check
  check (status in ('pending', 'sent', 'failed', 'dead'));

alter table public.email_outbox
  alter column max_attempts set default 5;
update public.email_outbox set max_attempts = 5 where max_attempts = 3;

create index if not exists idx_email_outbox_worker_claim
  on public.email_outbox (status, next_attempt_at asc)
  where status in ('pending', 'failed');

-- ── 4. Atomic Outbox Batch Claim Function ─────────────────────
-- Uses FOR UPDATE SKIP LOCKED to prevent duplicate processing by concurrent workers
create or replace function public.claim_email_outbox_batch(batch_size int default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.email_outbox
    where status in ('pending', 'failed')
      and attempts < 5
      and (next_attempt_at is null or next_attempt_at <= now())
    order by next_attempt_at asc, created_at asc
    limit batch_size
    for update skip locked
  )
  update public.email_outbox o
  set attempts = o.attempts + 1,
      updated_at = now()
  from claimed
  where o.id = claimed.id
  returning o.*;
end;
$$;

-- ── 5. RLS Lockdown ───────────────────────────────────────────
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;

-- Ensure email_outbox is fully revoked from anon & authenticated
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
