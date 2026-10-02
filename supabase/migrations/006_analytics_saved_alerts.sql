-- ============================================================
-- CineConnect – Job Views, Saved Jobs, Talent Alerts
-- Run after 005_notifications.sql
-- ============================================================

-- ── job_views ─────────────────────────────────────────────────
-- Tracks unique views per job per user (one row per job+viewer pair)
create table if not exists public.job_views (
  id         uuid        primary key default gen_random_uuid(),
  job_id     uuid        not null references public.jobs(id) on delete cascade,
  viewer_id  uuid        references public.users(id) on delete set null,
  viewed_at  timestamptz not null default now(),
  constraint job_views_unique unique (job_id, viewer_id)
);

alter table public.job_views enable row level security;

create policy "job_views: anyone can insert"
  on public.job_views for insert with check (true);

create policy "job_views: production owner read"
  on public.job_views for select using (
    job_id in (
      select j.id from public.jobs j
      join public.production_profiles pp on pp.id = j.production_id
      where pp.user_id = auth.uid()
    )
  );

-- Fast view-count index
create index if not exists job_views_job_id_idx on public.job_views (job_id);

-- ── saved_jobs ────────────────────────────────────────────────
create table if not exists public.saved_jobs (
  id                uuid        primary key default gen_random_uuid(),
  job_id            uuid        not null references public.jobs(id) on delete cascade,
  talent_profile_id uuid        not null references public.talent_profiles(id) on delete cascade,
  saved_at          timestamptz not null default now(),
  constraint saved_jobs_unique unique (job_id, talent_profile_id)
);

alter table public.saved_jobs enable row level security;

create policy "saved_jobs: owner read"
  on public.saved_jobs for select
  using (
    talent_profile_id in (
      select id from public.talent_profiles where user_id = auth.uid()
    )
  );

create policy "saved_jobs: owner insert"
  on public.saved_jobs for insert with check (
    talent_profile_id in (
      select id from public.talent_profiles where user_id = auth.uid()
    )
  );

create policy "saved_jobs: owner delete"
  on public.saved_jobs for delete using (
    talent_profile_id in (
      select id from public.talent_profiles where user_id = auth.uid()
    )
  );

-- ── talent_alerts ─────────────────────────────────────────────
-- Stores saved search filters that trigger notifications when a
-- matching talent profile is created.
create table if not exists public.talent_alerts (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.users(id) on delete cascade,
  label         text        not null,
  skills        text[]      not null default '{}',
  role          text,
  location      text,
  language      text,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

alter table public.talent_alerts enable row level security;

create policy "talent_alerts: owner all"
  on public.talent_alerts for all using (auth.uid() = user_id);

-- ── Trigger: notify production houses when a matching talent joins ──
create or replace function public.notify_talent_alert()
returns trigger language plpgsql security definer as $$
declare
  alert  record;
  skills_overlap boolean;
begin
  -- For each active alert, check if the new talent profile matches
  for alert in
    select ta.*, u.id as owner_user_id
    from public.talent_alerts ta
    join public.users u on u.id = ta.user_id
    where ta.active = true
  loop
    -- Check skills overlap
    skills_overlap := (
      array_length(alert.skills, 1) is null
      or alert.skills && NEW.skills
    );

    -- Check role match (ilike)
    if alert.role is not null then
      if NEW.role is null or lower(NEW.role) not like '%' || lower(alert.role) || '%' then
        continue;
      end if;
    end if;

    -- Check location
    if alert.location is not null then
      if NEW.location is null or lower(NEW.location) not like '%' || lower(alert.location) || '%' then
        continue;
      end if;
    end if;

    -- Check language
    if alert.language is not null then
      if NEW.language is null or lower(NEW.language) != lower(alert.language) then
        continue;
      end if;
    end if;

    if not skills_overlap then continue; end if;

    -- Fire notification
    insert into public.notifications (user_id, type, payload)
    values (
      alert.owner_user_id,
      'new_application',
      jsonb_build_object(
        'alert_id',    alert.id,
        'alert_label', alert.label,
        'talent_name', coalesce(NEW.full_name, 'A talent'),
        'talent_role', NEW.role,
        'match_type',  'talent_alert'
      )
    );
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_talent_alert on public.talent_profiles;
create trigger trg_talent_alert
  after insert on public.talent_profiles
  for each row execute function public.notify_talent_alert();
