-- Run this entire script in Supabase Dashboard > SQL Editor.
-- Personal dashboard: require Supabase Auth, with per-user row and object access.

create extension if not exists pgcrypto;

create table if not exists public.run_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  session_type text not null default 'Easy run',
  distance_km numeric(8,2) not null default 0 check (distance_km >= 0),
  duration_minutes numeric(8,2) not null default 0 check (duration_minutes >= 0),
  effort smallint check (effort between 1 and 10),
  source text not null default 'Manual / Strava screenshot',
  remarks text not null default '',
  screenshot_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists run_sessions_user_date_idx
  on public.run_sessions(user_id, session_date desc);

alter table public.run_sessions enable row level security;
grant select, insert, update, delete on public.run_sessions to authenticated;

drop policy if exists "Users can read own sessions" on public.run_sessions;
create policy "Users can read own sessions" on public.run_sessions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own sessions" on public.run_sessions;
create policy "Users can create own sessions" on public.run_sessions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own sessions" on public.run_sessions;
create policy "Users can update own sessions" on public.run_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own sessions" on public.run_sessions;
create policy "Users can delete own sessions" on public.run_sessions
  for delete to authenticated using (auth.uid() = user_id);

-- Private image bucket. Upload size/type restrictions are also enforced here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-screenshots','activity-screenshots',false,8388608,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false, file_size_limit=8388608,
  allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "Own activity images read" on storage.objects;
create policy "Own activity images read" on storage.objects
 for select to authenticated using (
   bucket_id='activity-screenshots' and (storage.foldername(name))[1]=auth.uid()::text
 );
drop policy if exists "Own activity images insert" on storage.objects;
create policy "Own activity images insert" on storage.objects
 for insert to authenticated with check (
   bucket_id='activity-screenshots' and (storage.foldername(name))[1]=auth.uid()::text
 );
drop policy if exists "Own activity images delete" on storage.objects;
create policy "Own activity images delete" on storage.objects
 for delete to authenticated using (
   bucket_id='activity-screenshots' and (storage.foldername(name))[1]=auth.uid()::text
 );
