-- ============================================================
-- CineConnect – Talent Profiles + Applications
-- Run after 002_jobs_schema.sql
-- ============================================================

-- ── talent_profiles ──────────────────────────────────────────
create table if not exists public.talent_profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  full_name          text,
  bio                text,
  role               text,                         -- primary role/title
  skills             text[]        not null default '{}',
  experience_years   int           not null default 0,
  language           text,
  location           text,
  avatar_url         text,
  portfolio_url      text,
  last_active_at     timestamptz   not null default now(),
  created_at         timestamptz   not null default now(),
  constraint talent_profiles_user_id_unique unique (user_id)
);

alter table public.talent_profiles enable row level security;

create policy "talent_profiles: public read"
  on public.talent_profiles for select using (true);

create policy "talent_profiles: owner insert"
  on public.talent_profiles for insert
  with check (auth.uid() = user_id);

create policy "talent_profiles: owner update"
  on public.talent_profiles for update
  using (auth.uid() = user_id);

-- ── applications ─────────────────────────────────────────────
create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references public.jobs(id) on delete cascade,
  talent_profile_id uuid not null references public.talent_profiles(id) on delete cascade,
  cover_note        text,
  status            text not null default 'pending'
                        check (status in ('pending','shortlisted','rejected')),
  created_at        timestamptz not null default now(),
  constraint applications_job_talent_unique unique (job_id, talent_profile_id)
);

alter table public.applications enable row level security;

-- Production house can read applications for their jobs
create policy "applications: production read"
  on public.applications for select
  using (
    job_id in (
      select j.id from public.jobs j
      join public.production_profiles pp on pp.id = j.production_id
      where pp.user_id = auth.uid()
    )
  );

-- Talent can read their own applications
create policy "applications: talent read own"
  on public.applications for select
  using (
    talent_profile_id in (
      select id from public.talent_profiles where user_id = auth.uid()
    )
  );

-- Talent can apply (insert)
create policy "applications: talent insert"
  on public.applications for insert
  with check (
    talent_profile_id in (
      select id from public.talent_profiles where user_id = auth.uid()
    )
  );

-- Production house can update status (shortlist / reject)
create policy "applications: production update"
  on public.applications for update
  using (
    job_id in (
      select j.id from public.jobs j
      join public.production_profiles pp on pp.id = j.production_id
      where pp.user_id = auth.uid()
    )
  );
