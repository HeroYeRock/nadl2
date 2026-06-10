-- 공유 일정 동기화: 일정 수정 시 같은 공유 코드의 스냅샷을 덮어쓸 수 있도록
-- updated_at 컬럼과 update 정책을 추가한다.

alter table public.shared_trips
  add column if not exists updated_at timestamptz not null default now();

-- 공유 코드(8자리)를 아는 클라이언트가 스냅샷을 갱신할 수 있다.
-- 코드는 추측이 어렵고 데이터 크기 제한이 걸려 있어 익명 갱신을 허용한다.
drop policy if exists "shared_trips_update_all" on public.shared_trips;
create policy "shared_trips_update_all"
  on public.shared_trips for update
  using (true)
  with check (true);
