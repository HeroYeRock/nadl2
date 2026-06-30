import { Platform } from "react-native";
import type { Place } from "@/types/trip";

export type TravelMode = "walking" | "transit" | "driving";

/** 국내(한국) 여행이면 네이버 지도를 쓴다. */
export function usesNaverMap(region?: string): boolean {
  return region === "kr";
}

/**
 * 한국 주소에서 짧은 지역 토큰(동/리/읍/면/구/시/군) 하나를 뽑는다.
 * 전체 주소를 그대로 검색하면 네이버에서 "없는 지역"이 나오므로, 이름 옆에 붙일
 * 간단한 지역만 추린다. 못 찾으면 빈 문자열.
 */
function shortAreaFromAddress(address?: string): string {
  if (!address) return "";
  const tokens = address.split(/[\s,]+/).filter(Boolean);
  for (const suffix of ["동", "리", "읍", "면", "구", "시", "군"]) {
    const hit = tokens.find((t) => t.length >= 2 && new RegExp(`[가-힣]+${suffix}$`).test(t));
    if (hit) return hit;
  }
  return "";
}

/**
 * 네이버 지도 장소 검색 URL.
 * 이름 + 짧은 지역(예: "본스치킨 세화리")으로 검색해 정확히 매칭되게 한다.
 * (전체 주소를 붙이면 네이버가 인식하지 못함)
 */
export function naverPlaceUrl(place: Pick<Place, "lat" | "lng" | "name" | "address">): string {
  const name = (place.name ?? "").trim();
  const area = shortAreaFromAddress(place.address);
  const text = [name, area].filter(Boolean).join(" ").trim();
  const query = text ? encodeURIComponent(text) : `${place.lat},${place.lng}`;
  return `https://map.naver.com/p/search/${query}`;
}

/**
 * 네이버 지도 길찾기.
 * - 네이티브: nmap 길찾기 딥링크(앱 설치 시 turn-by-turn).
 * - 웹: 안정적으로 동작하는 장소 검색(네이버 '길찾기' 버튼 노출).
 *   좌표 기반 웹 길찾기 URL 은 네이버가 투영좌표/place id 를 요구해 불안정하므로 쓰지 않는다.
 */
function naverDirectionsUrl(
  destination: Pick<Place, "lat" | "lng" | "name" | "address">,
  mode: TravelMode,
): string {
  if (Platform.OS !== "web") {
    const m = mode === "walking" ? "walk" : mode === "driving" ? "car" : "public";
    const name = encodeURIComponent(destination.name ?? "도착지");
    return `nmap://route/${m}?dlat=${destination.lat}&dlng=${destination.lng}&dname=${name}&appname=com.caosjhj.nadl2`;
  }
  return naverPlaceUrl(destination);
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
  destination: Pick<Place, "lat" | "lng" | "placeId" | "name" | "address">,
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
