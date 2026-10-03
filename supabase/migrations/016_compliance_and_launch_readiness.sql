-- ============================================================
-- CineConnect – Migration 016: Compliance, Consent, Invites & Launch Hardening
--
-- ROLLBACK:
--   drop index if exists public.idx_talent_profiles_role_active;
--   drop index if exists public.idx_applications_job_status;
--   drop index if exists public.idx_applications_talent_status;
--   drop index if exists public.idx_jobs_published_created;
--   drop table if exists public.email_outbox cascade;
--   drop table if exists public.invite_codes cascade;
--   drop table if exists public.user_consents cascade;
-- ============================================================

-- ── 1. User Consents (DPDP Act 2023 & GDPR Compliance) ─────────
create table if not exists public.user_consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  terms_version   text not null default 'v1.0',
  privacy_version text not null default 'v1.0',
  cookie_consent  boolean not null default false,
  ip_address      text,
  user_agent      text,
  consented_at    timestamptz not null default now()
);

alter table public.user_consents enable row level security;

create policy "user_consents: owner read"
  on public.user_consents for select
  using (auth.uid() = user_id);

create policy "user_consents: owner insert"
  on public.user_consents for insert
  with check (auth.uid() = user_id);

create index if not exists idx_user_consents_user_id
  on public.user_consents (user_id);

create index if not exists idx_user_consents_consented_at
  on public.user_consents (consented_at desc);


-- ── 2. Invite Codes (Invite-Only Soft Launch Tooling) ──────────
create table if not exists public.invite_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  role        text not null default 'any' check (role in ('talent', 'production', 'any')),
  max_uses    int not null default 1,
  uses_count  int not null default 0,
  created_by  uuid references public.users(id) on delete set null,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

create policy "invite_codes: public read active"
  on public.invite_codes for select
  using (
    (expires_at is null or expires_at > now()) and
    uses_count < max_uses
  );

create policy "invite_codes: admin manage"
  on public.invite_codes for all
  using (
    auth.uid() in (select id from public.users where role = 'admin')
  );

create index if not exists idx_invite_codes_code
  on public.invite_codes (code);


-- ── 3. Email Outbox & Deliverability Queue ─────────────────────
create table if not exists public.email_outbox (
  id              uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  subject         text not null,
  template_name   text not null,
  payload         jsonb not null default '{}',
  status          text not null default 'pending'
                    check (status in ('pending', 'sent', 'failed')),
  attempts        int not null default 0,
  max_attempts    int not null default 3,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.email_outbox enable row level security;

create policy "email_outbox: admin read"
  on public.email_outbox for select
  using (
    auth.uid() in (select id from public.users where role = 'admin')
  );

create index if not exists idx_email_outbox_status_created
  on public.email_outbox (status, created_at asc);

create index if not exists idx_email_outbox_created_at
  on public.email_outbox (created_at desc);


-- ── 4. High-Performance Composite Indexes (Load Test Hardening) 
create index if not exists idx_jobs_published_created
  on public.jobs (status, created_at desc)
  where status = 'published';

create index if not exists idx_applications_talent_status
  on public.applications (talent_profile_id, status);

create index if not exists idx_applications_job_status
  on public.applications (job_id, status);

create index if not exists idx_talent_profiles_role_active
  on public.talent_profiles (role, last_active_at desc);
