-- ============================================================
-- CineConnect – Jobs Schema
-- Run after 001_initial_schema.sql
-- ============================================================

-- ── jobs ─────────────────────────────────────────────────────
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.production_profiles(id) on delete cascade,
  title         text not null,
  description   text not null,
  status        text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at    timestamptz not null default now()
);

alter table public.jobs enable row level security;

-- Anyone can read published jobs
create policy "jobs: public read published"
  on public.jobs for select
  using (status = 'published');

-- Production owner can read all their own jobs (including drafts)
create policy "jobs: owner read all"
  on public.jobs for select
  using (
    production_id in (
      select id from public.production_profiles where user_id = auth.uid()
    )
  );

-- Production owner can insert jobs
create policy "jobs: owner insert"
  on public.jobs for insert
  with check (
    production_id in (
      select id from public.production_profiles where user_id = auth.uid()
    )
  );

-- Production owner can update their jobs
create policy "jobs: owner update"
  on public.jobs for update
  using (
    production_id in (
      select id from public.production_profiles where user_id = auth.uid()
    )
  );

-- ── job_requirements ─────────────────────────────────────────
create table if not exists public.job_requirements (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.jobs(id) on delete cascade,
  skills           text[] not null default '{}',
  roles            text[] not null default '{}',
  experience_level text,
  language         text,
  location         text,
  constraint job_requirements_job_id_unique unique (job_id)
);

alter table public.job_requirements enable row level security;

-- Anyone can read requirements for published jobs
create policy "job_requirements: public read"
  on public.job_requirements for select
  using (
    job_id in (select id from public.jobs where status = 'published')
  );

-- Owner can read requirements for all their jobs
create policy "job_requirements: owner read"
  on public.job_requirements for select
  using (
    job_id in (
      select j.id from public.jobs j
      join public.production_profiles pp on pp.id = j.production_id
      where pp.user_id = auth.uid()
    )
  );

-- Owner can insert/update requirements
create policy "job_requirements: owner insert"
  on public.job_requirements for insert
  with check (
    job_id in (
      select j.id from public.jobs j
      join public.production_profiles pp on pp.id = j.production_id
      where pp.user_id = auth.uid()
    )
  );

create policy "job_requirements: owner update"
  on public.job_requirements for update
  using (
    job_id in (
      select j.id from public.jobs j
      join public.production_profiles pp on pp.id = j.production_id
      where pp.user_id = auth.uid()
    )
  );
