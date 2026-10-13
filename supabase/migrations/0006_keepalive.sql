-- 무료 플랜 자동 일시정지 방지용 heartbeat.
-- 읽기 요청만으로는 활동으로 인정되지 않아, GitHub Actions 가 매일 이 함수를
-- 호출해 행 하나를 갱신(쓰기)한다.

create table if not exists public.keepalive (
  id int primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now(),
  ping_count bigint not null default 0
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

-- 테이블은 직접 접근 불가(정책 없음). 아래 함수로만 갱신한다.
alter table public.keepalive enable row level security;

create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.keepalive
     set pinged_at = now(), ping_count = ping_count + 1
   where id = 1
  returning pinged_at;
$$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;
