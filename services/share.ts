import LZString from "lz-string";
import type { Place, SlotItem, Trip } from "@/types/trip";

/**
 * 공유 링크용 trip 스냅샷 인코딩/디코딩.
 * 로그인·DB 없이 보기 위해 trip 데이터를 압축해 URL 해시(#)에 담는다.
 * 해시는 서버로 전송되지 않으므로 URL 길이 제한이 사실상 없다.
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

export function encodeTripToShare(trip: Trip): string {
  const slim: SlimTrip = {
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
  return LZString.compressToEncodedURIComponent(JSON.stringify(slim));
}

export function decodeTripFromShare(encoded: string): Trip | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const slim = JSON.parse(json) as SlimTrip;
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
  } catch {
    return null;
  }
}

/** 공유 가능한 절대 URL 생성 (웹 전용; origin 필요) */
export function buildShareUrl(origin: string, trip: Trip): string {
  return `${origin}/share#d=${encodeTripToShare(trip)}`;
}
