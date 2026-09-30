-- ============================================================
-- CineConnect – Initial Schema
-- Run this in the Supabase SQL editor (or via supabase db push)
-- ============================================================

-- ── users ────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  username    text not null unique,
  role        text not null check (role in ('talent', 'production')),
  created_at  timestamptz not null default now()
);

-- Row-level security
alter table public.users enable row level security;

-- Anyone can read any user row (public profiles)
create policy "users: public read"
  on public.users for select
  using (true);

-- A user may only insert/update their own row
create policy "users: owner insert"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users: owner update"
  on public.users for update
  using (auth.uid() = id);

-- ── production_profiles ──────────────────────────────────────
create table if not exists public.production_profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  company_name       text not null,
  bio                text,
  production_details text,
  logo_url           text,
  created_at         timestamptz not null default now(),
  constraint production_profiles_user_id_unique unique (user_id)
);

alter table public.production_profiles enable row level security;

-- Anyone can read production profiles
create policy "production_profiles: public read"
  on public.production_profiles for select
  using (true);

-- Only the owning user can insert/update their profile
create policy "production_profiles: owner insert"
  on public.production_profiles for insert
  with check (
    auth.uid() = user_id
  );

create policy "production_profiles: owner update"
  on public.production_profiles for update
  using (auth.uid() = user_id);
