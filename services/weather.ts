/**
 * 날씨 조회. Open-Meteo (무료, API 키 불필요, CORS 허용) 를 사용한다.
 * - 미래 16일 이내: 예보 (forecast API)
 * - 지난 날짜: 실측 기록 (forecast API 의 과거 92일 + archive API)
 * - 16일 너머 미래: 예보가 없으므로 "평년값"(최근 N년 같은 날짜 평균) 으로 채운다.
 * 좌표는 trip 의 장소에서, 없으면 목적지 이름을 지오코딩해 구한다.
 */

import { parseYMD } from "@/services/dates";
import type { DayWeather, Trip } from "@/types/trip";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
// Open-Meteo 표준 일별 예보는 최대 16일. 그 너머는 평년값으로 대체.
const FORECAST_MAX_DAYS = 16;
const CLIMATE_YEARS = 5;

export interface Coords {
  lat: number;
  lng: number;
}

/** 오늘 기준 날짜 차이(일). 양수면 미래, 음수면 과거. */
function dayDiff(ymd: string, todayYMD: string): number {
  return Math.round((parseYMD(ymd).getTime() - parseYMD(todayYMD).getTime()) / 86400000);
}

// 도시명 → 좌표 캐시 (세션 동안 중복 호출 방지)
const geocodeCache = new Map<string, Coords | null>();

/** 도시/지역 이름을 좌표로 변환 (Open-Meteo geocoding) */
export async function geocodePlace(name: string): Promise<Coords | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;
  try {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=1&language=ko&format=json`;
    const res = await fetch(url);
    const json = await res.json();
    const hit = json?.results?.[0];
    const coords: Coords | null =
      hit && typeof hit.latitude === "number" && typeof hit.longitude === "number"
        ? { lat: hit.latitude, lng: hit.longitude }
        : null;
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

/** trip 의 대표 좌표: 첫 장소 좌표 우선, 없으면 목적지 지오코딩. */
export async function resolveTripCoords(trip: Trip): Promise<Coords | null> {
  for (const day of trip.days) {
    for (const slot of day.slots) {
      const p = slot.place;
      if (p && typeof p.lat === "number" && typeof p.lng === "number" && (p.lat || p.lng)) {
        return { lat: p.lat, lng: p.lng };
      }
    }
  }
  return geocodePlace(trip.destination);
}

interface DailyResponse {
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
}

interface RawDay {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
  prob?: number;
  precip?: number;
}

/** 한 번의 daily 호출 → 파싱된 일자 배열. 실패 시 빈 배열. */
async function fetchDailyRaw(
  baseUrl: string,
  coords: Coords,
  start: string,
  end: string,
  withProb: boolean,
): Promise<RawDay[]> {
  const daily = withProb
    ? "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum"
    : "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum";
  const url =
    `${baseUrl}?latitude=${coords.lat}&longitude=${coords.lng}` +
    `&daily=${daily}&timezone=auto&start_date=${start}&end_date=${end}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as DailyResponse;
    const times = json.daily?.time ?? [];
    const rows: RawDay[] = [];
    for (let i = 0; i < times.length; i++) {
      const code = json.daily?.weather_code?.[i];
      const tmax = json.daily?.temperature_2m_max?.[i];
      const tmin = json.daily?.temperature_2m_min?.[i];
      if (code == null || tmax == null || tmin == null) continue;
      const prob = json.daily?.precipitation_probability_max?.[i];
      const precip = json.daily?.precipitation_sum?.[i];
      rows.push({
        date: times[i],
        code,
        tmax,
        tmin,
        prob: prob == null ? undefined : prob,
        precip: precip == null ? undefined : precip,
      });
    }
    return rows;
  } catch {
    return [];
  }
}

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** 가장 자주 나온 기상 코드 (평년값 대표 날씨) */
function modeCode(codes: number[]): number {
  const counts = new Map<number, number>();
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best = codes[0];
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

/** forecast/archive 결과 행들을 DayWeather 로 변환해 out 에 채운다. */
function writeRows(rows: RawDay[], todayYMD: string, out: Record<string, DayWeather>): void {
  const now = new Date().toISOString();
  for (const r of rows) {
    out[r.date] = {
      code: r.code,
      tempMax: Math.round(r.tmax),
      tempMin: Math.round(r.tmin),
      precipProb: r.prob,
      precipMm: r.precip == null ? undefined : Math.round(r.precip * 10) / 10,
      fetchedAt: now,
      isHistorical: dayDiff(r.date, todayYMD) < 0,
    };
  }
}

/**
 * 16일 너머 미래 날짜: 최근 CLIMATE_YEARS 년의 같은 월/일 데이터를 평균해 평년값을 만든다.
 * 강수확률은 "과거 그 날짜에 비가 온 해의 비율" 로 계산한다.
 */
async function fetchClimateNormals(
  coords: Coords,
  dates: string[],
  out: Record<string, DayWeather>,
): Promise<void> {
  const sorted = [...dates].sort();
  const startMD = sorted[0].slice(5); // "MM-DD"
  const endMD = sorted[sorted.length - 1].slice(5);
  if (endMD < startMD) return; // 연말~연초에 걸치면 평년 계산 생략 (드묾)
  const baseYear = Number(sorted[0].slice(0, 4));

  const mmddToDate = new Map<string, string>();
  const acc = new Map<string, { max: number[]; min: number[]; precip: number[]; codes: number[] }>();
  for (const d of sorted) {
    mmddToDate.set(d.slice(5), d);
    acc.set(d, { max: [], min: [], precip: [], codes: [] });
  }

  const years = Array.from({ length: CLIMATE_YEARS }, (_, i) => baseYear - 1 - i);
  const perYear = await Promise.all(
    years.map((yr) => fetchDailyRaw(ARCHIVE_URL, coords, `${yr}-${startMD}`, `${yr}-${endMD}`, false)),
  );

  for (const rows of perYear) {
    for (const row of rows) {
      const target = mmddToDate.get(row.date.slice(5));
      if (!target) continue;
      const a = acc.get(target)!;
      a.codes.push(row.code);
      a.max.push(row.tmax);
      a.min.push(row.tmin);
      if (row.precip != null) a.precip.push(row.precip);
    }
  }

  const now = new Date().toISOString();
  for (const [date, a] of acc) {
    if (a.max.length === 0) continue;
    const rainyYears = a.precip.filter((p) => p >= 1).length;
    out[date] = {
      code: modeCode(a.codes),
      tempMax: Math.round(avg(a.max)),
      tempMin: Math.round(avg(a.min)),
      precipProb: a.precip.length ? Math.round((rainyYears / a.precip.length) * 100) : undefined,
      precipMm: a.precip.length ? Math.round(avg(a.precip) * 10) / 10 : undefined,
      fetchedAt: now,
      isHistorical: false,
      isClimate: true,
    };
  }
}

/**
 * 여러 날짜의 날씨를 받아 { "YYYY-MM-DD": DayWeather } 로 반환.
 * - 과거 92일 ~ 미래 16일: forecast API (지난 날짜는 실측 기록)
 * - 92일 넘게 지난 날짜: archive API
 * - 16일 넘는 미래: 평년값(최근 N년 평균)
 */
export async function fetchDaysWeather(
  coords: Coords,
  dates: string[],
  todayYMD: string,
): Promise<Record<string, DayWeather>> {
  const out: Record<string, DayWeather> = {};
  const valid = dates.filter(Boolean).sort();
  if (valid.length === 0) return out;

  const recent = valid.filter((d) => {
    const diff = dayDiff(d, todayYMD);
    return diff >= -92 && diff <= FORECAST_MAX_DAYS;
  });
  const oldPast = valid.filter((d) => dayDiff(d, todayYMD) < -92);
  const farFuture = valid.filter((d) => dayDiff(d, todayYMD) > FORECAST_MAX_DAYS);

  await Promise.all([
    recent.length
      ? fetchDailyRaw(FORECAST_URL, coords, recent[0], recent[recent.length - 1], true).then((r) =>
          writeRows(r, todayYMD, out),
        )
      : Promise.resolve(),
    oldPast.length
      ? fetchDailyRaw(ARCHIVE_URL, coords, oldPast[0], oldPast[oldPast.length - 1], false).then((r) =>
          writeRows(r, todayYMD, out),
        )
      : Promise.resolve(),
    farFuture.length ? fetchClimateNormals(coords, farFuture, out) : Promise.resolve(),
  ]);

  return out;
}

/** 날씨 출처 라벨: 지난 날짜는 "기록", 평년 추정은 "평년", 그 외 "예보". */
export function weatherSourceLabel(w: DayWeather): string {
  if (w.isHistorical) return "기록";
  if (w.isClimate) return "평년";
  return "예보";
}

/** 강수확률·강수량·평년 안내를 한 줄로. 없으면 빈 문자열. */
export function weatherDetailLine(w: DayWeather): string {
  const parts: string[] = [];
  if (w.precipProb != null) parts.push(`강수확률 ${w.precipProb}%`);
  if (w.precipMm) parts.push(`강수량 ${w.precipMm}mm`);
  if (w.isClimate) parts.push(`최근 ${CLIMATE_YEARS}년 평균`);
  return parts.join(" · ");
}

/** WMO 기상 코드 → 이모지 + 한국어 라벨 */
export function describeWeather(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "맑음" };
  if (code === 1) return { emoji: "🌤️", label: "대체로 맑음" };
  if (code === 2) return { emoji: "⛅", label: "구름 조금" };
  if (code === 3) return { emoji: "☁️", label: "흐림" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "안개" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "이슬비" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "비" };
  if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "눈" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "소나기" };
  if (code === 85 || code === 86) return { emoji: "🌨️", label: "소나기눈" };
  if (code >= 95) return { emoji: "⛈️", label: "뇌우" };
  return { emoji: "🌡️", label: "—" };
}
