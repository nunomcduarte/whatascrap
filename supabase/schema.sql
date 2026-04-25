-- WhatAScrap multi-tenant PKM schema
-- Apply via Supabase SQL Editor:
--   https://supabase.com/dashboard/project/ersxycejccetnkfmvbpn/sql/new
-- Idempotent: safe to re-run.

-- ============================================================
-- Tables (each row owned by a Supabase auth user)
-- ============================================================

create table if not exists public.categories (
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  parent     text,
  color      text,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

create table if not exists public.videos (
  user_id     uuid not null references auth.users(id) on delete cascade,
  youtube_id  text not null,
  title       text not null,
  channel     text not null,
  upload_date date,
  url         text not null,
  transcript  text not null,
  category    text,
  scraped_at  timestamptz not null default now(),
  primary key (user_id, youtube_id)
);

create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null,
  status       text not null,
  source_url   text,
  title        text,
  category     text,
  total        integer not null default 0,
  completed    integer not null default 0,
  failed       integer not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

create table if not exists public.job_items (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  video_id   text,
  url        text not null,
  title      text,
  status     text not null,
  attempts   integer not null default 0,
  error      text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Indexes (RLS lookups need user_id-prefixed indexes)
-- ============================================================

create index if not exists videos_user_scraped_idx
  on public.videos (user_id, scraped_at desc);

create index if not exists videos_user_category_idx
  on public.videos (user_id, category)
  where category is not null;

create index if not exists categories_user_created_idx
  on public.categories (user_id, created_at);

create index if not exists jobs_user_status_idx
  on public.jobs (user_id, status, created_at desc);

create index if not exists job_items_job_status_idx
  on public.job_items (job_id, status);

create index if not exists job_items_user_idx
  on public.job_items (user_id);

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.videos     enable row level security;
alter table public.categories enable row level security;
alter table public.jobs       enable row level security;
alter table public.job_items  enable row level security;

alter table public.videos     force row level security;
alter table public.categories force row level security;
alter table public.jobs       force row level security;
alter table public.job_items  force row level security;

-- (select auth.uid()) wraps the function so Postgres caches its result
-- per query — orders of magnitude faster than calling per-row.

drop policy if exists videos_owner on public.videos;
create policy videos_owner on public.videos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists categories_owner on public.categories;
create policy categories_owner on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists jobs_owner on public.jobs;
create policy jobs_owner on public.jobs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists job_items_owner on public.job_items;
create policy job_items_owner on public.job_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
