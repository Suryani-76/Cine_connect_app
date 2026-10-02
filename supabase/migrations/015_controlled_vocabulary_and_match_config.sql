-- ============================================================
-- CineConnect – Migration 015: Controlled Vocabulary & Match Engine Config
--
-- ROLLBACK:
--   drop table if exists public.match_recompute_queue cascade;
--   drop table if exists public.match_config_audit_logs cascade;
--   drop table if exists public.match_config cascade;
--   drop table if exists public.skill_aliases cascade;
--   drop table if exists public.cities cascade;
--   drop table if exists public.roles cascade;
--   drop table if exists public.skills cascade;
--   alter table public.users drop constraint if exists users_role_check;
--   alter table public.users add constraint users_role_check check (role in ('talent', 'production'));
-- ============================================================

-- ── 1. Allow 'admin' role in public.users ────────────────────
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('talent', 'production', 'admin'));

-- ── 2. Controlled vocabulary: skills ─────────────────────────
create table if not exists public.skills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  category    text not null default 'General',
  is_verified boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.skills enable row level security;
create policy "skills: public read" on public.skills for select using (true);
create policy "skills: admin write" on public.skills for all using (
  auth.uid() in (select id from public.users where role = 'admin')
);
create index if not exists idx_skills_name on public.skills (name);
create index if not exists idx_skills_category on public.skills (category);

-- ── 3. Controlled vocabulary: roles ──────────────────────────
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  department  text not null default 'General',
  is_verified boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.roles enable row level security;
create policy "roles: public read" on public.roles for select using (true);
create policy "roles: admin write" on public.roles for all using (
  auth.uid() in (select id from public.users where role = 'admin')
);
create index if not exists idx_roles_name on public.roles (name);
create index if not exists idx_roles_department on public.roles (department);

-- ── 4. Controlled vocabulary: cities ─────────────────────────
create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  state       text,
  country     text not null default 'India',
  is_verified boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.cities enable row level security;
create policy "cities: public read" on public.cities for select using (true);
create policy "cities: admin write" on public.cities for all using (
  auth.uid() in (select id from public.users where role = 'admin')
);
create index if not exists idx_cities_name on public.cities (name);

-- ── 5. Controlled vocabulary: skill_aliases ──────────────────
create table if not exists public.skill_aliases (
  id             uuid primary key default gen_random_uuid(),
  alias          text not null unique,
  canonical_name text not null,
  created_at     timestamptz not null default now()
);

alter table public.skill_aliases enable row level security;
create policy "skill_aliases: public read" on public.skill_aliases for select using (true);
create policy "skill_aliases: admin write" on public.skill_aliases for all using (
  auth.uid() in (select id from public.users where role = 'admin')
);
create index if not exists idx_skill_aliases_alias on public.skill_aliases (alias);
create index if not exists idx_skill_aliases_canonical on public.skill_aliases (canonical_name);

-- ── 6. Match Engine Config ───────────────────────────────────
create table if not exists public.match_config (
  id                   uuid primary key default gen_random_uuid(),
  is_active            boolean not null default true,
  skills_match         numeric not null default 30 check (skills_match >= 0 and skills_match <= 100),
  role_match           numeric not null default 20 check (role_match >= 0 and role_match <= 100),
  experience_match     numeric not null default 15 check (experience_match >= 0 and experience_match <= 100),
  language_match       numeric not null default 10 check (language_match >= 0 and language_match <= 100),
  location_proximity   numeric not null default 10 check (location_proximity >= 0 and location_proximity <= 100),
  profile_completeness numeric not null default 10 check (profile_completeness >= 0 and profile_completeness <= 100),
  activity_recency     numeric not null default 5 check (activity_recency >= 0 and activity_recency <= 100),
  updated_by           uuid references auth.users(id) on delete set null,
  updated_at           timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  constraint match_config_weights_sum check (
    (skills_match + role_match + experience_match + language_match + location_proximity + profile_completeness + activity_recency) = 100
  )
);

alter table public.match_config enable row level security;
create policy "match_config: public read" on public.match_config for select using (true);
create policy "match_config: admin write" on public.match_config for all using (
  auth.uid() in (select id from public.users where role = 'admin')
);

-- Seed initial active configuration row
insert into public.match_config (
  is_active, skills_match, role_match, experience_match,
  language_match, location_proximity, profile_completeness, activity_recency
) values (true, 30, 20, 15, 10, 10, 10, 5)
on conflict do nothing;

-- ── 7. Match Config Audit Logs ───────────────────────────────
create table if not exists public.match_config_audit_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  previous_weights jsonb not null,
  new_weights      jsonb not null,
  reason           text,
  created_at       timestamptz not null default now()
);

alter table public.match_config_audit_logs enable row level security;
create policy "match_config_audit_logs: admin read" on public.match_config_audit_logs for select using (
  auth.uid() in (select id from public.users where role = 'admin')
);
create policy "match_config_audit_logs: admin insert" on public.match_config_audit_logs for insert with check (
  auth.uid() in (select id from public.users where role = 'admin')
);
create index if not exists idx_match_config_audit_user on public.match_config_audit_logs(user_id);

-- ── 8. Match Recompute Queue ─────────────────────────────────
create table if not exists public.match_recompute_queue (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid references public.jobs(id) on delete cascade,
  talent_profile_id uuid references public.talent_profiles(id) on delete cascade,
  reason            text not null,
  status            text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts          int not null default 0,
  created_at        timestamptz not null default now(),
  processed_at      timestamptz,
  constraint recompute_target_check check (job_id is not null or talent_profile_id is not null)
);

alter table public.match_recompute_queue enable row level security;
create policy "match_recompute_queue: admin read" on public.match_recompute_queue for select using (
  auth.uid() in (select id from public.users where role = 'admin')
);
create policy "match_recompute_queue: admin write" on public.match_recompute_queue for all using (
  auth.uid() in (select id from public.users where role = 'admin')
);
create index if not exists idx_recompute_queue_job on public.match_recompute_queue(job_id);
create index if not exists idx_recompute_queue_talent on public.match_recompute_queue(talent_profile_id);
create index if not exists idx_recompute_queue_status on public.match_recompute_queue(status, created_at);

-- ── 9. SEEDS ──────────────────────────────────────────────────

-- 9.1 Major Indian film-industry cities
insert into public.cities (name, state, country) values
  ('Mumbai', 'Maharashtra', 'India'),
  ('Hyderabad', 'Telangana', 'India'),
  ('Chennai', 'Tamil Nadu', 'India'),
  ('Bengaluru', 'Karnataka', 'India'),
  ('Kochi', 'Kerala', 'India'),
  ('Kolkata', 'West Bengal', 'India'),
  ('Delhi', 'Delhi NCR', 'India'),
  ('Pune', 'Maharashtra', 'India'),
  ('Thiruvananthapuram', 'Kerala', 'India'),
  ('Jaipur', 'Rajasthan', 'India'),
  ('Lucknow', 'Uttar Pradesh', 'India'),
  ('Ahmedabad', 'Gujarat', 'India'),
  ('Chandigarh', 'Punjab/Haryana', 'India'),
  ('Goa', 'Goa', 'India'),
  ('Visakhapatnam', 'Andhra Pradesh', 'India'),
  ('Guwahati', 'Assam', 'India'),
  ('Bhubaneswar', 'Odisha', 'India'),
  ('Indore', 'Madhya Pradesh', 'India'),
  ('Bhopal', 'Madhya Pradesh', 'India'),
  ('Patna', 'Bihar', 'India'),
  ('Dehradun', 'Uttarakhand', 'India'),
  ('Varanasi', 'Uttar Pradesh', 'India'),
  ('Ranchi', 'Jharkhand', 'India'),
  ('Amritsar', 'Punjab', 'India'),
  ('Remote', null, 'Worldwide')
on conflict (name) do nothing;

-- 9.2 ~60 Film Roles
insert into public.roles (name, department) values
  ('Director', 'Directing'),
  ('Co-Director', 'Directing'),
  ('Associate Director', 'Directing'),
  ('First Assistant Director (1st AD)', 'Directing'),
  ('Second Assistant Director (2nd AD)', 'Directing'),
  ('Script Supervisor / Continuity', 'Directing'),
  ('Screenwriter', 'Writing'),
  ('Dialogue Writer', 'Writing'),
  ('Story Writer', 'Writing'),
  ('Casting Director', 'Casting'),
  ('Casting Associate', 'Casting'),
  ('Producer', 'Production'),
  ('Executive Producer', 'Production'),
  ('Line Producer', 'Production'),
  ('Production Manager', 'Production'),
  ('Production Coordinator', 'Production'),
  ('Production Assistant', 'Production'),
  ('Location Manager', 'Production'),
  ('Cinematographer', 'Camera'),
  ('Camera Operator', 'Camera'),
  ('First Assistant Camera (1st AC / Focus Puller)', 'Camera'),
  ('Second Assistant Camera (2nd AC)', 'Camera'),
  ('Drone Operator', 'Camera'),
  ('Steadicam Operator', 'Camera'),
  ('Digital Imaging Technician (DIT)', 'Camera'),
  ('Gaffer', 'Lighting'),
  ('Best Boy Electric', 'Lighting'),
  ('Lighting Technician', 'Lighting'),
  ('Key Grip', 'Grip'),
  ('Best Boy Grip', 'Grip'),
  ('Dolly Grip', 'Grip'),
  ('Production Designer', 'Art Department'),
  ('Art Director', 'Art Department'),
  ('Set Decorator', 'Art Department'),
  ('Prop Master', 'Art Department'),
  ('Lead Scenic Artist', 'Art Department'),
  ('Costume Designer', 'Wardrobe'),
  ('Wardrobe Supervisor', 'Wardrobe'),
  ('Key Makeup Artist', 'Hair & Makeup'),
  ('Hair Stylist', 'Hair & Makeup'),
  ('SFX Makeup Artist', 'Hair & Makeup'),
  ('Lead Actor', 'Acting'),
  ('Supporting Actor', 'Acting'),
  ('Voice Actor', 'Acting'),
  ('Stunt Coordinator', 'Stunts'),
  ('Stunt Performer', 'Stunts'),
  ('Stunt Double', 'Stunts'),
  ('Editor', 'Post-Production'),
  ('Assistant Editor', 'Post-Production'),
  ('Colorist', 'Post-Production'),
  ('Post-Production Supervisor', 'Post-Production'),
  ('Sound Designer', 'Sound'),
  ('Production Sound Mixer', 'Sound'),
  ('Boom Operator', 'Sound'),
  ('ADR Supervisor', 'Sound'),
  ('Foley Artist', 'Sound'),
  ('Re-recording Mixer', 'Sound'),
  ('Music Director / Composer', 'Music'),
  ('Background Score Composer', 'Music'),
  ('Visual Effects (VFX) Supervisor', 'VFX'),
  ('Lead VFX Compositor', 'VFX'),
  ('3D Animator', 'Animation'),
  ('Motion Graphics Designer', 'Post-Production')
on conflict (name) do nothing;

-- 9.3 ~150 Film Skills across all departments
insert into public.skills (name, category) values
  -- Camera & Lighting
  ('Cinematography', 'Camera'),
  ('35mm Film Handling', 'Camera'),
  ('Anamorphic Lenses', 'Camera'),
  ('Gimbal Operation', 'Camera'),
  ('Steadicam Operation', 'Camera'),
  ('Drone Cinematography', 'Camera'),
  ('Focus Pulling', 'Camera'),
  ('Camera Rigging', 'Camera'),
  ('High-Speed Camera (Phantom)', 'Camera'),
  ('Underwater Cinematography', 'Camera'),
  ('Aerial Filming', 'Camera'),
  ('Multi-Camera Setup', 'Camera'),
  ('Digital Imaging Technician (DIT)', 'Camera'),
  ('Arri Alexa Workflow', 'Camera'),
  ('Red Digital Cinema', 'Camera'),
  ('Sony Venice / FX9', 'Camera'),
  ('Blackmagic URSA', 'Camera'),
  ('Lighting Design', 'Lighting'),
  ('Three-Point Lighting', 'Lighting'),
  ('Low-Key Lighting', 'Lighting'),
  ('Day-for-Night Shooting', 'Lighting'),
  ('Color Temperature Balancing', 'Lighting'),
  ('LED Volume Lighting', 'Lighting'),
  ('Grip & Rigging', 'Grip'),
  ('Dolly Track Operation', 'Grip'),
  ('Jib & Crane Operation', 'Grip'),
  ('Car Mount Rigging', 'Grip'),

  -- Sound & Audio
  ('Location Sound Recording', 'Sound'),
  ('Boom Operation', 'Sound'),
  ('Sync Sound', 'Sound'),
  ('Sound Design', 'Sound'),
  ('Foley Recording', 'Sound'),
  ('Foley Editing', 'Sound'),
  ('ADR (Automated Dialogue Replacement)', 'Sound'),
  ('Sound Mixing', 'Sound'),
  ('Re-recording Mixing', 'Sound'),
  ('5.1/7.1 Surround Sound', 'Sound'),
  ('Dolby Atmos Mixing', 'Sound'),
  ('Audio Restoration', 'Sound'),
  ('Sound Effects (SFX) Design', 'Sound'),
  ('Field Recording', 'Sound'),
  ('Microphone Placement & Selection', 'Sound'),
  ('Wireless Lavaliers Handling', 'Sound'),
  ('Pro Tools', 'Sound'),
  ('Nuendo', 'Sound'),
  ('iZotope RX Audio Repair', 'Sound'),
  ('Music Production', 'Music'),
  ('Film Scoring', 'Music'),
  ('Orchestration', 'Music'),
  ('Audio Mastering', 'Music'),

  -- Editing & Post-Production
  ('Linear & Non-Linear Editing', 'Post-Production'),
  ('Offline Editing', 'Post-Production'),
  ('Online Editing', 'Post-Production'),
  ('Assembly Editing', 'Post-Production'),
  ('Rough Cut Delivery', 'Post-Production'),
  ('Final Cut Finishing', 'Post-Production'),
  ('DaVinci Resolve', 'Post-Production'),
  ('Adobe Premiere Pro', 'Post-Production'),
  ('Final Cut Pro', 'Post-Production'),
  ('Avid Media Composer', 'Post-Production'),
  ('Color Grading', 'Post-Production'),
  ('Color Correction', 'Post-Production'),
  ('ACES Color Workflow', 'Post-Production'),
  ('LUT Creation', 'Post-Production'),
  ('Video Transcoding', 'Post-Production'),
  ('Subtitling & Closed Captioning', 'Post-Production'),
  ('Proxy Workflow', 'Post-Production'),
  ('Multi-Cam Sync', 'Post-Production'),
  ('DCP Mastering', 'Post-Production'),
  ('HDR Mastering (Dolby Vision)', 'Post-Production'),
  ('Tape & Digital Archiving', 'Post-Production'),

  -- Visual Effects (VFX) & Animation
  ('Visual Effects (VFX) Supervision', 'VFX'),
  ('CGI Modeling', 'VFX'),
  ('Compositing', 'VFX'),
  ('Rotoscoping', 'VFX'),
  ('Chroma Keying (Green/Blue Screen)', 'VFX'),
  ('Matchmoving', 'VFX'),
  ('3D Tracking', 'VFX'),
  ('Maya', 'VFX'),
  ('Blender', 'VFX'),
  ('Houdini', 'VFX'),
  ('Nuke', 'VFX'),
  ('Adobe After Effects', 'VFX'),
  ('Unreal Engine Virtual Production', 'VFX'),
  ('In-Camera VFX (ICVFX)', 'VFX'),
  ('Matte Painting', 'VFX'),
  ('Particle & Dynamics FX', 'VFX'),
  ('Motion Graphics', 'VFX'),
  ('Character Animation', 'Animation'),
  ('3D Rigging', 'Animation'),
  ('Texturing & Shading', 'VFX'),
  ('Deep Compositing', 'VFX'),
  ('Wire Removal & Clean Plate Generation', 'VFX'),

  -- Direction & Writing
  ('Scriptwriting', 'Writing'),
  ('Screenplay Formatting', 'Writing'),
  ('Screenplay Doctoring', 'Writing'),
  ('Dialogue Writing', 'Writing'),
  ('Storyboarding', 'Directing'),
  ('Shot Listing', 'Directing'),
  ('Scene Breakdown', 'Directing'),
  ('Actor Direction', 'Directing'),
  ('Rehearsal Coordination', 'Directing'),
  ('Blocking & Staging', 'Directing'),
  ('Continuity Supervision', 'Directing'),
  ('Script Supervision', 'Directing'),
  ('Pitch Deck Creation', 'Writing'),
  ('Treatment Writing', 'Writing'),
  ('Story Development', 'Writing'),
  ('Voiceover Direction', 'Directing'),
  ('Intimacy Coordination', 'Directing'),
  ('Action Sequence Choreography', 'Directing'),

  -- Production & Management
  ('Line Producing', 'Production'),
  ('Production Management', 'Production'),
  ('Budgeting & Scheduling', 'Production'),
  ('Movie Magic Scheduling', 'Production'),
  ('Movie Magic Budgeting', 'Production'),
  ('Casting Direction', 'Casting'),
  ('Audition Management', 'Casting'),
  ('Location Scouting', 'Production'),
  ('Location Management', 'Production'),
  ('Production Coordination', 'Production'),
  ('Call Sheet Generation', 'Production'),
  ('Permit Clearance', 'Production'),
  ('Union Compliance', 'Production'),
  ('Crew Hiring & Contracts', 'Production'),
  ('Transportation Logistics', 'Production'),
  ('Equipment Logistics & Rental', 'Production'),
  ('Vendor Negotiation', 'Production'),
  ('Post-Production Supervision', 'Production'),
  ('Film Distribution Strategy', 'Production'),
  ('Film Festival Submissions', 'Production'),

  -- Art, Set, Costume & Makeup
  ('Production Design', 'Art Department'),
  ('Set Construction', 'Art Department'),
  ('Set Decoration', 'Art Department'),
  ('Prop Master & Fabrication', 'Art Department'),
  ('Costume Design', 'Wardrobe'),
  ('Wardrobe Management', 'Wardrobe'),
  ('Period Costume Research', 'Wardrobe'),
  ('Special Effects (SFX) Makeup', 'Hair & Makeup'),
  ('Prosthetics Application', 'Hair & Makeup'),
  ('Character Makeup', 'Hair & Makeup'),
  ('Hair Styling & Wigs', 'Hair & Makeup'),
  ('Concept Art & Illustration', 'Art Department'),
  ('Scenic Painting', 'Art Department'),

  -- Acting & Stunts
  ('Method Acting', 'Acting'),
  ('Voice Acting & Dubbing', 'Acting'),
  ('Screen Combat', 'Stunts'),
  ('Stunt Rigging', 'Stunts'),
  ('Wirework Stunts', 'Stunts'),
  ('Precision Driving', 'Stunts'),
  ('Horse Riding for Screen', 'Stunts'),
  ('Improvisational Acting', 'Acting'),
  ('Stage Combat', 'Stunts'),
  ('Martial Arts for Film', 'Stunts')
on conflict (name) do nothing;

-- 9.4 Skill & Role Aliases
insert into public.skill_aliases (alias, canonical_name) values
  ('DoP', 'Cinematographer'),
  ('DOP', 'Cinematographer'),
  ('Director of Photography', 'Cinematographer'),
  ('DIT', 'Digital Imaging Technician (DIT)'),
  ('Colourist', 'Colorist'),
  ('Color Grading', 'Color Grading'),
  ('Colour Grading', 'Color Grading'),
  ('Color Correction', 'Color Correction'),
  ('Colour Correction', 'Color Correction'),
  ('AD', 'Assistant Director'),
  ('1st AD', 'First Assistant Director (1st AD)'),
  ('2nd AD', 'Second Assistant Director (2nd AD)'),
  ('Sync Sound', 'Sync Sound'),
  ('Sound Recordist', 'Production Sound Mixer'),
  ('Boom Op', 'Boom Operator'),
  ('Focus Puller', 'First Assistant Camera (1st AC / Focus Puller)'),
  ('1st AC', 'First Assistant Camera (1st AC / Focus Puller)'),
  ('2nd AC', 'Second Assistant Camera (2nd AC)'),
  ('Audio Mixing', 'Sound Mixing'),
  ('Re-recording Mixer', 'Re-recording Mixing'),
  ('Foley', 'Foley Recording'),
  ('ADR', 'ADR (Automated Dialogue Replacement)'),
  ('DaVinci', 'DaVinci Resolve'),
  ('Premiere', 'Adobe Premiere Pro'),
  ('Premiere Pro', 'Adobe Premiere Pro'),
  ('FCP', 'Final Cut Pro'),
  ('Avid', 'Avid Media Composer'),
  ('After Effects', 'Adobe After Effects'),
  ('AE', 'Adobe After Effects'),
  ('Pro Tools', 'Pro Tools'),
  ('ProTools', 'Pro Tools'),
  ('Drone', 'Drone Cinematography'),
  ('Steadicam', 'Steadicam Operation'),
  ('Gimbal', 'Gimbal Operation'),
  ('VFX', 'Visual Effects (VFX) Supervision'),
  ('SFX', 'Sound Effects (SFX) Design'),
  ('CGI', 'CGI Modeling'),
  ('Script Writing', 'Scriptwriting'),
  ('Screenplay', 'Scriptwriting'),
  ('Rotoscoping', 'Rotoscoping'),
  ('Roto', 'Rotoscoping'),
  ('Green Screen', 'Chroma Keying (Green/Blue Screen)'),
  ('Chroma Key', 'Chroma Keying (Green/Blue Screen)'),
  ('Virtual Production', 'Unreal Engine Virtual Production'),
  ('Dubbing', 'Voice Acting & Dubbing'),
  ('Lighting', 'Lighting Design')
on conflict (alias) do nothing;
