-- ============================================================
-- CineConnect – Email notification trigger for pipeline changes
-- Run after 006_analytics_saved_alerts.sql
--
-- This trigger fires when an application status changes to
-- 'shortlisted', 'interview', or 'hired' and inserts a
-- notification row for the talent (which the realtime channel
-- delivers instantly).  Actual email delivery is handled by
-- Supabase's built-in email integration:
--   Dashboard → Database → Webhooks → create a webhook on
--   the notifications table INSERT event pointing to a
--   Supabase Edge Function or external email API.
-- ============================================================

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
      'match_type',     'status_change'
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_application_status_change on public.applications;
create trigger trg_application_status_change
  after update of status on public.applications
  for each row execute function public.notify_application_status_change();
