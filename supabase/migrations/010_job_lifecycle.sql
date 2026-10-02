-- ============================================================
-- CineConnect – Job and Application Lifecycle
-- Run after 009_auto_create_public_user.sql
--
-- ROLLBACK:
--   drop trigger if exists trg_jobs_updated_at on public.jobs;
--   drop function if exists public.handle_updated_at();
--   alter table public.jobs
--     drop constraint if exists jobs_pay_min_max_check,
--     drop constraint if exists jobs_dates_check,
--     drop column if exists job_type,
--     drop column if exists pay_min,
--     drop column if exists pay_max,
--     drop column if exists pay_currency,
--     drop column if exists pay_period,
--     drop column if exists start_date,
--     drop column if exists end_date,
--     drop column if exists openings,
--     drop column if exists deadline,
--     drop column if exists updated_at;
--   alter table public.applications
--     drop column if exists interview_at;
--   alter table public.applications
--     drop constraint if exists applications_status_check;
--   alter table public.applications
--     add constraint applications_status_check
--     check (status in ('applied', 'shortlisted', 'interview', 'hired', 'rejected'));
--   alter table public.notifications
--     drop constraint if exists notifications_type_check;
--   alter table public.notifications
--     add constraint notifications_type_check
--     check (type in ('new_application', 'new_message', 'high_match_talent'));
-- ============================================================

-- ── 1. Extend jobs table ──────────────────────────────────────
alter table public.jobs
  add column if not exists job_type text check (job_type in ('freelance', 'contract', 'full_time', 'part_time')) default 'freelance',
  add column if not exists pay_min numeric,
  add column if not exists pay_max numeric,
  add column if not exists pay_currency text not null default 'INR',
  add column if not exists pay_period text check (pay_period in ('hour', 'day', 'week', 'month', 'project')) default 'project',
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists openings int not null default 1 check (openings >= 1),
  add column if not exists deadline timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Add range checks if not present
alter table public.jobs
  drop constraint if exists jobs_pay_min_max_check;
alter table public.jobs
  add constraint jobs_pay_min_max_check
  check (pay_min is null or pay_max is null or pay_min <= pay_max);

alter table public.jobs
  drop constraint if exists jobs_dates_check;
alter table public.jobs
  add constraint jobs_dates_check
  check (start_date is null or end_date is null or start_date <= end_date);

-- Trigger to maintain jobs.updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function public.handle_updated_at();

-- ── 2. Extend applications table ──────────────────────────────
-- Extend status check with 'withdrawn'
alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('applied', 'shortlisted', 'interview', 'hired', 'rejected', 'withdrawn'));

-- Add interview_at
alter table public.applications
  add column if not exists interview_at timestamptz;

-- ── 3. Extend notifications type check ────────────────────────
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_application',
    'new_message',
    'high_match_talent',
    'job_closed'
  ));

-- ── 4. Update status change trigger to include interview_at ───
create or replace function public.notify_application_status_change()
returns trigger language plpgsql security definer as $$
declare
  v_talent_user_id uuid;
  v_job_title      text;
  v_company_name   text;
begin
  -- Only fire on meaningful pipeline advances
  if NEW.status not in ('shortlisted', 'interview', 'hired', 'rejected') then
    return NEW;
  end if;
  if OLD.status = NEW.status then
    return NEW;
  end if;

  -- Resolve talent user_id
  select tp.user_id into v_talent_user_id
    from public.talent_profiles tp
   where tp.id = NEW.talent_profile_id;

  -- Resolve job title + company
  select j.title, pp.company_name
    into v_job_title, v_company_name
    from public.jobs j
    join public.production_profiles pp on pp.id = j.production_id
   where j.id = NEW.job_id;

  -- Insert notification for talent
  insert into public.notifications (user_id, type, payload)
  values (
    v_talent_user_id,
    'new_application',   -- reuse existing type; match_type distinguishes it
    jsonb_build_object(
      'application_id', NEW.id,
      'job_id',         NEW.job_id,
      'job_title',      v_job_title,
      'company_name',   v_company_name,
      'new_status',     NEW.status,
      'match_type',     'status_change',
      'interview_at',   NEW.interview_at
    )
  );

  return NEW;
end;
$$;
