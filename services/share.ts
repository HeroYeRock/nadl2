import LZString from "lz-string";
import { supabase } from "@/services/supabase";
import type { Place, SlotItem, Trip } from "@/types/trip";

/**
 * 공유 링크용 trip 스냅샷 인코딩/디코딩.
 *
 * 기본 방식: 스냅샷을 Supabase `shared_trips` 에 저장하고 짧은 코드로 조회한다.
 *   → https://.../share?id=aB3kF9Qz
 * 폴백 방식: 저장 실패(오프라인 등) 시 데이터를 압축해 URL 해시(#)에 담는다.
 *   → https://.../share#d=<압축 데이터> (길지만 서버 없이 동작)
 *
 * 용량 절감을 위해 표시에 꼭 필요한 필드만 짧은 키로 직렬화한다.
 */

interface SlimPlace {
  n: string; // name
  ad?: string; // address
  la: number; // lat
  ln: number; // lng
  ra?: number; // rating
  pi?: string; // placeId
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
  if (place.placeId) out.pi = place.placeId;
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

// 같은 일정을 연속으로 공유할 때 중복 row 생성 방지 (trip.id:updatedAt → 짧은 URL)
const shortUrlCache = new Map<string, string>();

/**
 * 짧은 공유 URL 생성. 스냅샷을 Supabase 에 저장하고 코드만 담은 URL 을 돌려준다.
 * 저장에 실패하면 기존 방식의 긴 해시 URL 로 폴백한다.
 */
export async function createShareUrl(origin: string, trip: Trip): Promise<string> {
  const cacheKey = `${trip.id}:${trip.updatedAt}`;
  const cached = shortUrlCache.get(cacheKey);
  if (cached) return cached;

  const data = tripToSlim(trip);
  // id 충돌(unique violation) 시 새 id 로 재시도
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomShareId();
    const { error } = await supabase.from("shared_trips").insert({ id, data });
    if (!error) {
      const url = `${origin}/share?id=${id}`;
      shortUrlCache.set(cacheKey, url);
      return url;
    }
    if (error.code !== "23505") {
      console.warn("[Nadl2 share]", error.message);
      break;
    }
  }
  return buildShareUrl(origin, trip);
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
