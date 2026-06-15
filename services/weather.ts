/**
 * 날씨 조회. Open-Meteo (무료, API 키 불필요, CORS 허용) 를 사용한다.
 * - 미래/오늘: 예보 (forecast API, 최대 16일)
 * - 지난 날짜: 실측 기록 (forecast API 의 과거 92일 + archive API)
 * 좌표는 trip 의 장소에서, 없으면 목적지 이름을 지오코딩해 구한다.
 */

import { parseYMD } from "@/services/dates";
import type { DayWeather, Trip } from "@/types/trip";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

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

async function fetchRange(
  baseUrl: string,
  coords: Coords,
  start: string,
  end: string,
  todayYMD: string,
  forecast: boolean,
  out: Record<string, DayWeather>,
): Promise<void> {
  const daily = forecast
    ? "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum"
    : "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum";
  const url =
    `${baseUrl}?latitude=${coords.lat}&longitude=${coords.lng}` +
    `&daily=${daily}&timezone=auto&start_date=${start}&end_date=${end}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const json = (await res.json()) as DailyResponse;
    const times = json.daily?.time ?? [];
    const now = new Date().toISOString();
    for (let i = 0; i < times.length; i++) {
      const date = times[i];
      const code = json.daily?.weather_code?.[i];
      const tmax = json.daily?.temperature_2m_max?.[i];
      const tmin = json.daily?.temperature_2m_min?.[i];
      if (code == null || tmax == null || tmin == null) continue;
      const prob = json.daily?.precipitation_probability_max?.[i];
      const mm = json.daily?.precipitation_sum?.[i];
      out[date] = {
        code,
        tempMax: Math.round(tmax),
        tempMin: Math.round(tmin),
        precipProb: prob == null ? undefined : prob,
        precipMm: mm == null ? undefined : Math.round(mm * 10) / 10,
        fetchedAt: now,
        // 오늘 이전 날짜는 실측(확정) 기록으로 본다 — 예보 엔드포인트로 받아도 과거값은 측정치.
        isHistorical: dayDiff(date, todayYMD) < 0,
      };
    }
  } catch {
    /* 네트워크 실패 시 조용히 무시 */
  }
}

/**
 * 여러 날짜의 날씨를 받아 { "YYYY-MM-DD": DayWeather } 로 반환.
 * - 오늘±(과거 92일~미래 16일): forecast API
 * - 92일 넘게 지난 날짜: archive API
 * - 16일 넘는 미래: 예보 불가 → 건너뜀
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
    return diff >= -92 && diff <= 16;
  });
  const oldPast = valid.filter((d) => dayDiff(d, todayYMD) < -92);

  await Promise.all([
    recent.length
      ? fetchRange(FORECAST_URL, coords, recent[0], recent[recent.length - 1], todayYMD, true, out)
      : Promise.resolve(),
    oldPast.length
      ? fetchRange(ARCHIVE_URL, coords, oldPast[0], oldPast[oldPast.length - 1], todayYMD, false, out)
      : Promise.resolve(),
  ]);

  return out;
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
