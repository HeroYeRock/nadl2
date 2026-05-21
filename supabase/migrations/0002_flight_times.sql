-- 비행기 도착/출발 시각 컬럼 추가
-- "HH:MM" 형식 (현지 시각). 도착일은 trip.start_date 의 day 1, 출발일은 마지막 일자로 간주.

alter table public.trips
  add column if not exists arrival_time text,
  add column if not exists departure_time text;
