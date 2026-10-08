alter table public.saved_jobs
  add column if not exists created_at timestamptz not null default now();
