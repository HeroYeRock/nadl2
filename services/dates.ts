/**
 * 날짜 유틸. 모든 변환을 로컬 타임존 기준으로 처리해
 * `new Date("2026-06-15")` 가 UTC 로 파싱되며 생기는 하루 밀림을 피한다.
 */

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** Date → "YYYY-MM-DD" (로컬 기준) */
export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → Date (로컬 자정). 값이 없거나 형식이 틀리면 오늘. */
export function parseYMD(value?: string): Date {
  if (value) {
    const [y, m, d] = value.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 오늘부터 offset 일 뒤의 "YYYY-MM-DD" (로컬 기준) */
export function ymdFromToday(offsetDays = 0): string {
  const now = new Date();
  return toYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays));
}

/** "6/15 (월)" */
export function formatShortKo(value?: string): string {
  if (!value) return "";
  const d = parseYMD(value);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS_KO[d.getDay()]})`;
}

/** "2026년 6월 15일 (월)" */
export function formatLongKo(value?: string): string {
  if (!value) return "";
  const d = parseYMD(value);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS_KO[d.getDay()]})`;
}

/**
 * 출발일(startYMD)을 기준으로 day 1, 2, 3 … 의 날짜를 다시 매긴다.
 * 슬롯 등 나머지 필드는 그대로 두고 date 만 갱신한다.
 */
export function rebuildDayDates<T extends { day: number; date: string }>(
  days: T[],
  startYMD: string,
): T[] {
  const start = parseYMD(startYMD);
  return [...days]
    .sort((a, b) => a.day - b.day)
    .map((d, i) => ({
      ...d,
      date: toYMD(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)),
    }));
}
