-- 공유 일정 스냅샷: 짧은 코드(id)로 조회하는 보기 전용 데이터.
-- 공유 링크를 URL 해시 대신 `/share?id=<code>` 형태로 짧게 만들기 위한 테이블.

create table if not exists public.shared_trips (
  id text primary key check (id ~ '^[A-Za-z0-9]{6,16}$'),
  data jsonb not null check (pg_column_size(data) <= 65536),
  created_at timestamptz not null default now()
);

alter table public.shared_trips enable row level security;

-- 링크를 아는 누구나 조회 가능 (로그인 불필요)
drop policy if exists "shared_trips_select_all" on public.shared_trips;
create policy "shared_trips_select_all"
  on public.shared_trips for select
  using (true);

-- 공유 링크 생성은 누구나 가능. 스냅샷은 수정/삭제 정책이 없어 불변.
drop policy if exists "shared_trips_insert_all" on public.shared_trips;
create policy "shared_trips_insert_all"
  on public.shared_trips for insert
  with check (true);
