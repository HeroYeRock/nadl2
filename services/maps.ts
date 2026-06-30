import type { Place } from "@/types/trip";

export type TravelMode = "walking" | "transit" | "driving";

/** 국내(한국) 여행이면 네이버 지도를 쓴다. */
export function usesNaverMap(region?: string): boolean {
  return region === "kr";
}

const NAVER_MODE: Record<TravelMode, string> = {
  walking: "walk",
  transit: "transit",
  driving: "car",
};

/** 네이버 지도 장소 검색 URL (이름+주소로 검색). 좌표만 있으면 좌표로. */
function naverPlaceUrl(place: Pick<Place, "lat" | "lng" | "name" | "address">): string {
  const text = `${place.name ?? ""} ${place.address ?? ""}`.trim();
  const query = text ? encodeURIComponent(text) : `${place.lat},${place.lng}`;
  return `https://map.naver.com/p/search/${query}`;
}

/** 네이버 지도 길찾기 URL. 출발=현위치(미지정), 도착=경도,위도,이름. */
function naverDirectionsUrl(
  destination: Pick<Place, "lat" | "lng" | "name">,
  mode: TravelMode,
): string {
  const name = encodeURIComponent(destination.name ?? "도착지");
  return `https://map.naver.com/p/directions/-/${destination.lng},${destination.lat},${name}/-/${NAVER_MODE[mode]}`;
}

export function placeMapsUrl(
  place: Pick<Place, "lat" | "lng" | "placeId" | "name" | "address">,
  region?: string,
): string {
  if (usesNaverMap(region)) return naverPlaceUrl(place);
  const params = new URLSearchParams({
    api: "1",
    query: `${place.lat},${place.lng}`,
  });
  if (place.placeId) params.set("query_place_id", place.placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function directionsUrl(
  destination: Pick<Place, "lat" | "lng" | "placeId" | "name">,
  mode: TravelMode,
  origin?: { lat: number; lng: number } | null,
  region?: string,
): string {
  if (usesNaverMap(region)) return naverDirectionsUrl(destination, mode);
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: mode,
  });
  if (destination.placeId) params.set("destination_place_id", destination.placeId);
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 거리 기반 자동 모드:
 *  - 1km 이하 → walking
 *  - 1km 초과 → transit
 * 현위치가 없으면 transit 을 기본으로.
 */
export function autoMode(
  destination: { lat: number; lng: number },
  origin: { lat: number; lng: number } | null,
): TravelMode {
  if (!origin) return "transit";
  const km = haversineKm(origin, destination);
  return km <= 1 ? "walking" : "transit";
}

export const MODE_LABEL: Record<TravelMode, string> = {
  walking: "도보",
  transit: "대중교통",
  driving: "차량",
};
