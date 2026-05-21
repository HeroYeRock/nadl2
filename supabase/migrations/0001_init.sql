-- Nadl2 initial schema
-- Run this in Supabase SQL Editor (or via `supabase db push`).

-- 1. profiles: auth.users 1:1 보강 테이블
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 신규 가입 시 profile 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. trips: 여행 일정 (days 는 jsonb 로 통째 저장)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  region text not null,
  theme text not null,
  duration integer not null check (duration > 0 and duration <= 30),
  destination text not null,
  days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips(user_id);
create index if not exists trips_updated_at_idx on public.trips(updated_at desc);

alter table public.trips enable row level security;

drop policy if exists "trips_select_own" on public.trips;
create policy "trips_select_own"
  on public.trips for select
  using (auth.uid() = user_id);

drop policy if exists "trips_insert_own" on public.trips;
create policy "trips_insert_own"
  on public.trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "trips_update_own" on public.trips;
create policy "trips_update_own"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "trips_delete_own" on public.trips;
create policy "trips_delete_own"
  on public.trips for delete
  using (auth.uid() = user_id);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_touch_updated_at on public.trips;
create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
