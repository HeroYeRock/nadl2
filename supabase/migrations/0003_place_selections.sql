-- 사용자가 일정에 추가한 장소 기록 → 추후 인기/추천 배지 노출용
create table if not exists public.place_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id text not null,
  place_name text not null,
  place_address text,
  destination text,
  selected_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists place_selections_place_id_idx on public.place_selections(place_id);
create index if not exists place_selections_user_id_idx on public.place_selections(user_id);

alter table public.place_selections enable row level security;

drop policy if exists "selections_read_all" on public.place_selections;
create policy "selections_read_all"
  on public.place_selections for select
  to authenticated
  using (true);

drop policy if exists "selections_insert_own" on public.place_selections;
create policy "selections_insert_own"
  on public.place_selections for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "selections_update_own" on public.place_selections;
create policy "selections_update_own"
  on public.place_selections for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 집계 view (place_id 별 distinct user count)
create or replace view public.place_popularity as
  select
    place_id,
    max(place_name) as name,
    max(place_address) as address,
    count(distinct user_id)::integer as selection_count,
    max(selected_at) as last_selected_at
  from public.place_selections
  group by place_id;

grant select on public.place_popularity to authenticated;
