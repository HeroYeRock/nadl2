import type { Place } from "@/types/trip";

export type TravelMode = "walking" | "transit" | "driving";

export function placeMapsUrl(place: Pick<Place, "lat" | "lng" | "placeId" | "name">): string {
  const params = new URLSearchParams({
    api: "1",
    query: `${place.lat},${place.lng}`,
  });
  if (place.placeId) params.set("query_place_id", place.placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function directionsUrl(
  destination: Pick<Place, "lat" | "lng" | "placeId">,
  mode: TravelMode,
  origin?: { lat: number; lng: number } | null,
): string {
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
