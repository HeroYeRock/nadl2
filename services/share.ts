import AsyncStorage from "@react-native-async-storage/async-storage";
import LZString from "lz-string";
import { supabase } from "@/services/supabase";
import type { DayPlan, Place, SlotItem, Trip } from "@/types/trip";

/**
 * 공유 링크용 trip 스냅샷 인코딩/디코딩 + 동기화.
 *
 * 기본 방식: 스냅샷을 Supabase `shared_trips` 에 저장하고 짧은 코드로 조회한다.
 *   → https://.../share?id=aB3kF9Qz
 * 폴백 방식: 저장 실패(오프라인 등) 시 데이터를 압축해 URL 해시(#)에 담는다.
 *   → https://.../share#d=<압축 데이터> (길지만 서버 없이 동작)
 *
 * 동기화: trip 별 공유 코드를 로컬에 매핑해 두고(`nadl2-share-map`),
 *   일정을 수정하면 같은 코드의 스냅샷을 덮어써 공유 링크도 최신 상태를 유지한다.
 *
 * 용량 절감을 위해 표시에 꼭 필요한 필드만 짧은 키로 직렬화한다.
 */

interface SlimPlace {
  n: string; // name
  ad?: string; // address
  la: number; // lat
  ln: number; // lng
  ra?: number; // rating
  rt?: number; // userRatingsTotal
  pi?: string; // placeId
  su?: string; // summary
  rm?: string[]; // recommendedMenus
  hl?: string[]; // highlights
  pr?: string; // priceRange
  pl?: 1 | 2 | 3 | 4; // priceLevel
}

interface SlimSlot {
  sl: string; // slot id
  ti: string; // time
  cl?: string; // customLabel
  p?: SlimPlace; // place
}

interface SlimDay {
  n: number; // day number
  dt: string; // date
  s: SlimSlot[]; // slots
}

interface SlimTrip {
  t: string; // title
  r: string; // region
  ds: string; // destination
  du: number; // duration
  a?: string; // arrivalTime
  dp?: string; // departureTime
  d: SlimDay[]; // days
}

function slimPlace(place: Place): SlimPlace {
  const out: SlimPlace = { n: place.name, la: place.lat, ln: place.lng };
  if (place.address) out.ad = place.address;
  if (place.rating) out.ra = place.rating;
  if (place.userRatingsTotal) out.rt = place.userRatingsTotal;
  if (place.placeId) out.pi = place.placeId;
  if (place.summary) out.su = place.summary;
  if (place.recommendedMenus?.length) out.rm = place.recommendedMenus;
  if (place.highlights?.length) out.hl = place.highlights;
  if (place.priceRange) out.pr = place.priceRange;
  if (place.priceLevel) out.pl = place.priceLevel;
  return out;
}

function fatPlace(s: SlimPlace): Place {
  return {
    id: s.pi ?? `${s.la},${s.ln}`,
    placeId: s.pi ?? "",
    name: s.n,
    address: s.ad ?? "",
    lat: s.la,
    lng: s.ln,
    category: "point_of_interest",
    rating: s.ra,
    userRatingsTotal: s.rt,
    summary: s.su,
    recommendedMenus: s.rm,
    highlights: s.hl,
    priceRange: s.pr,
    priceLevel: s.pl,
  };
}

function tripToSlim(trip: Trip): SlimTrip {
  return {
    t: trip.title,
    r: trip.region,
    ds: trip.destination,
    du: trip.duration,
    a: trip.arrivalTime,
    dp: trip.departureTime,
    d: trip.days.map((day) => ({
      n: day.day,
      dt: day.date,
      s: day.slots.map((slot) => {
        const out: SlimSlot = { sl: slot.slot, ti: slot.time };
        if (slot.customLabel) out.cl = slot.customLabel;
        if (slot.place) out.p = slimPlace(slot.place);
        return out;
      }),
    })),
  };
}

function slimToTrip(slim: SlimTrip): Trip | null {
  if (!slim || !Array.isArray(slim.d)) return null;
  const now = new Date().toISOString();
  return {
    id: "shared",
    title: slim.t,
    region: slim.r as Trip["region"],
    theme: "food",
    duration: slim.du,
    destination: slim.ds,
    arrivalTime: slim.a,
    departureTime: slim.dp,
    days: slim.d.map((day) => ({
      day: day.n,
      date: day.dt,
      slots: (day.s ?? []).map<SlotItem>((slot) => ({
        slot: slot.sl,
        time: slot.ti,
        customLabel: slot.cl,
        place: slot.p ? fatPlace(slot.p) : undefined,
      })),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 주소 문자열에서 대표 지역(구/시/군) 토큰 하나를 뽑는다.
 * 한국어 주소를 우선 처리하고("도쿄도 시부야구 …" → "시부야구"),
 * 안 되면 영문 주소("Shibuya City", "Chiyoda-ku")를 폴백으로 본다.
 */
function extractArea(address?: string): string | undefined {
  if (!address) return undefined;
  const tokens = address.split(/[\s,]+/).filter(Boolean);
  // 구 → 시 → 군 순으로 가장 구체적인 행정구역을 찾는다.
  for (const suffix of ["구", "시", "군"]) {
    const hit = tokens.find((t) => t.length >= 2 && new RegExp(`[가-힣]${suffix}$`).test(t));
    if (hit) return hit;
  }
  const en = address.match(/([A-Za-z]+)(?:\s+City|[- ]ku|[- ]shi|[- ]gun)\b/i);
  return en ? en[1] : undefined;
}

/** 하루치 슬롯에서 방문 지역들을 모아 "시부야구/신주쿠구 일대" 라벨을 만든다. */
function dayAreaLabel(day: DayPlan, fallbackDestination: string): string {
  const areas: string[] = [];
  let hasPlace = false;
  for (const slot of day.slots) {
    if (!slot.place) continue;
    hasPlace = true;
    const area = extractArea(slot.place.address);
    if (area && !areas.includes(area)) areas.push(area);
  }
  if (areas.length === 0) return hasPlace ? `${fallbackDestination} 일대` : "일정 미정";
  const shown = areas.slice(0, 4).join("/");
  return areas.length > 4 ? `${shown} 외 일대` : `${shown} 일대`;
}

export interface ScheduleRow {
  day: number;
  /** "YYYY-MM-DD" (스냅샷에 날짜가 없으면 빈 문자열) */
  date: string;
  /** "시부야구/신주쿠구 일대" 처럼 그날 동선을 요약한 라벨 */
  areaLabel: string;
}

/**
 * 날짜별 동선 요약 행. 공유 메시지 텍스트(buildScheduleText)와
 * 공유 페이지의 전체 일정표가 같은 데이터를 쓰도록 한 곳에서 만든다.
 * 지역 라벨은 그날 장소들의 주소에서 자동 추출한다.
 */
export function buildScheduleRows(trip: Trip): ScheduleRow[] {
  return [...trip.days]
    .sort((a, b) => a.day - b.day)
    .map((day) => ({
      day: day.day,
      date: day.date,
      areaLabel: dayAreaLabel(day, trip.destination),
    }));
}

/**
 * 공유 메시지에 함께 붙일 일정 요약 텍스트.
 * "🗓️ 제목 · N박 M일 / N일차 - 지역 일대" 형태로 날짜별 동선을 한눈에 보여준다.
 * 링크(URL)는 포함하지 않는다 — 호출 측에서 메시지 맨 끝 단독 줄에 붙이거나
 * 별도 url 필드로 전달해, 링크가 깨지거나 받는 쪽 ID 추출이 어긋나지 않게 한다.
 */
export function buildScheduleText(trip: Trip): string {
  const nights = trip.duration - 1;
  const durationLabel = nights >= 1 ? `${nights}박 ${trip.duration}일` : "당일";
  const lines: string[] = [`🗓️ ${trip.title} · ${durationLabel}`];
  for (const row of buildScheduleRows(trip)) {
    lines.push(`${row.day}일차 - ${row.areaLabel}`);
  }
  return lines.join("\n");
}

export function encodeTripToShare(trip: Trip): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(tripToSlim(trip)));
}

export function decodeTripFromShare(encoded: string): Trip | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return slimToTrip(JSON.parse(json) as SlimTrip);
  } catch {
    return null;
  }
}

/** 폴백용 긴 공유 URL (데이터 전체를 해시에 포함) */
export function buildShareUrl(origin: string, trip: Trip): string {
  return `${origin}/share#d=${encodeTripToShare(trip)}`;
}

// 헷갈리기 쉬운 문자(0/O, 1/l/I) 를 뺀 base58 알파벳
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const ID_LENGTH = 8;

function randomShareId(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

// trip.id → 공유 코드 매핑. 일정 수정 시 같은 코드의 스냅샷을 갱신하기 위함.
const SHARE_MAP_KEY = "nadl2-share-map";

async function loadShareMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SHARE_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function rememberShareId(tripId: string, shareId: string): Promise<void> {
  try {
    const map = await loadShareMap();
    map[tripId] = shareId;
    await AsyncStorage.setItem(SHARE_MAP_KEY, JSON.stringify(map));
  } catch {}
}

/** 이 trip 이 이미 공유된 적이 있으면 그 공유 코드를 반환 */
export async function getShareIdForTrip(tripId: string): Promise<string | null> {
  const map = await loadShareMap();
  return map[tripId] ?? null;
}

/**
 * 짧은 공유 URL 생성. 스냅샷을 Supabase 에 저장하고 코드만 담은 URL 을 돌려준다.
 * 이미 공유한 trip 이면 같은 코드의 스냅샷을 최신 데이터로 덮어쓴다(=재공유 시 동기화).
 * 저장에 실패하면 기존 방식의 긴 해시 URL 로 폴백한다.
 */
export async function createShareUrl(origin: string, trip: Trip): Promise<string> {
  const data = tripToSlim(trip);
  const now = new Date().toISOString();

  const existing = await getShareIdForTrip(trip.id);
  if (existing) {
    const { error } = await supabase
      .from("shared_trips")
      .upsert({ id: existing, data, updated_at: now });
    if (!error) return `${origin}/share?id=${existing}`;
    console.warn("[Nadl2 share]", error.message);
    // 덮어쓰기 실패 시 새 코드 생성으로 폴백
  }

  // id 충돌(unique violation) 시 새 id 로 재시도
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomShareId();
    const { error } = await supabase.from("shared_trips").insert({ id, data });
    if (!error) {
      await rememberShareId(trip.id, id);
      return `${origin}/share?id=${id}`;
    }
    if (error.code !== "23505") {
      console.warn("[Nadl2 share]", error.message);
      break;
    }
  }
  return buildShareUrl(origin, trip);
}

/**
 * 일정이 수정되면 호출. 이 trip 을 공유한 적이 있을 때만 공유 스냅샷을 최신화한다.
 * 공유한 적 없으면 아무 작업도 하지 않는다(네트워크 호출 없음).
 */
export async function syncSharedTrip(trip: Trip): Promise<void> {
  const id = await getShareIdForTrip(trip.id);
  if (!id) return;
  const { error } = await supabase
    .from("shared_trips")
    .update({ data: tripToSlim(trip), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.warn("[Nadl2 share/sync]", error.message);
}

/** 짧은 코드로 공유 스냅샷 조회 */
export async function fetchSharedTrip(id: string): Promise<Trip | null> {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return null;
  const { data, error } = await supabase
    .from("shared_trips")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return slimToTrip(data.data as SlimTrip);
  } catch {
    return null;
  }
}
