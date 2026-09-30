-- ============================================================
-- CineConnect – Extend Applications for full pipeline
-- Run after 003_talent_applications.sql
-- ============================================================

-- Drop the old 3-value check constraint and replace with 5-value pipeline
alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('applied', 'shortlisted', 'interview', 'hired', 'rejected'));

-- Migrate any existing 'pending' rows to 'applied'
update public.applications
  set status = 'applied'
  where status = 'pending';

-- Update default to 'applied'
alter table public.applications
  alter column status set default 'applied';

-- Add match_score column (nullable – populated server-side, not stored by default)
alter table public.applications
  add column if not exists match_score numeric;

-- Add applied_at column (mirrors created_at for new rows; back-fill for existing)
alter table public.applications
  add column if not exists applied_at timestamptz not null default now();

update public.applications
  set applied_at = created_at
  where applied_at = now();
