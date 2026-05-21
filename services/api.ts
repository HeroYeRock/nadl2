import type { Place } from "@/types/trip";
import { fetchPopularity } from "./popularity";
import { supabase } from "./supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  selectionCount?: number;
  badge?: "추천" | "인기";
}

async function invokeGet<T>(
  fnName: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? SUPABASE_ANON_KEY;
    const query = new URLSearchParams(params);
    const url = `${SUPABASE_URL}/functions/v1/${fnName}${query.toString() ? `?${query}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      console.error(`[Nadl2 fn/${fnName}]`, data.error ?? response.status);
      return null;
    }
    return data as T;
  } catch (error) {
    console.error(`[Nadl2 fn/${fnName}] network error`, error);
    return null;
  }
}

async function invokePost<T>(fnName: string, body: object): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(fnName, { body });
    if (error) {
      console.error(`[Nadl2 fn/${fnName}]`, error.message);
      return null;
    }
    return data ?? null;
  } catch (error) {
    console.error(`[Nadl2 fn/${fnName}] network error`, error);
    return null;
  }
}

function photoUrl(photoRef: string): string {
  return `${SUPABASE_URL}/functions/v1/places-photo?ref=${encodeURIComponent(photoRef)}&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;
}

function toPlace(raw: any, fallbackAddress = ""): Place {
  const lat = raw.geometry?.location?.lat ?? 0;
  const lng = raw.geometry?.location?.lng ?? 0;
  const photoRef = raw.photos?.[0]?.photo_reference;
  const insights = raw.insights ?? {};

  return {
    id: `place_${raw.place_id ?? Date.now()}`,
    placeId: raw.place_id,
    name: raw.name,
    address: raw.formatted_address ?? raw.vicinity ?? fallbackAddress,
    lat,
    lng,
    rating: raw.rating,
    userRatingsTotal: raw.user_ratings_total,
    priceLevel: raw.price_level,
    openNow: raw.opening_hours?.open_now,
    category: raw.types?.[0] ?? "place",
    photoUrl: photoRef ? photoUrl(photoRef) : undefined,
    summary: insights.summary || raw.editorial_summary?.overview || undefined,
    recommendedMenus: insights.menus,
    highlights: insights.highlights,
    // 우선 Google Places API (New)의 priceRange 직접 값,
    // 없으면 Groq 추정치 (보통은 undefined)
    priceRange: raw.price_range_text || insights.priceRange,
  };
}

function calcDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const y = (lat2 - lat1) * 111000;
  const x = (lng2 - lng1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
  return Math.round(Math.sqrt(x * x + y * y));
}

export async function searchPlaces(
  query: string,
  location?: { lat: number; lng: number },
): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];

  const params: Record<string, string> = { input: query.trim() };
  if (location) {
    params.location = `${location.lat},${location.lng}`;
    params.radius = "50000";
  }

  const data = await invokeGet<any>("places-autocomplete", params);
  if (!data?.predictions) return [];

  const suggestions: PlaceSuggestion[] = data.predictions.map((prediction: any) => ({
    placeId: prediction.place_id,
    description: prediction.description,
    mainText:
      prediction.structured_formatting?.main_text ??
      prediction.description.split(",")[0],
    secondaryText: prediction.structured_formatting?.secondary_text ?? "",
  }));

  // 인기 정보 머지 + 인기 상단 정렬, 최대 5개
  const popularity = await fetchPopularity(suggestions.map((s) => s.placeId));
  const enriched = suggestions.map((s) => {
    const info = popularity.get(s.placeId);
    return info
      ? { ...s, selectionCount: info.count, badge: info.badge }
      : s;
  });
  enriched.sort((a, b) => (b.selectionCount ?? 0) - (a.selectionCount ?? 0));
  return enriched.slice(0, 5);
}

export async function getPlaceDetail(
  placeId: string,
  options: { withInsights?: boolean } = {},
): Promise<Place | null> {
  const withInsights = options.withInsights !== false;
  const data = await invokeGet<any>("place-detail", {
    place_id: placeId,
    insights: withInsights ? "1" : "0",
  });
  if (!data?.result) return null;
  return toPlace(data.result);
}

export async function getNearbyPlaces(
  lat: number,
  lng: number,
  type: string,
  radius = 1200,
): Promise<Place[]> {
  const data = await invokeGet<any>("places-nearby", {
    location: `${lat},${lng}`,
    type,
    radius: String(radius),
  });
  if (!data?.results) return [];

  return data.results.slice(0, 8).map((result: any) => ({
    ...toPlace(result),
    distanceMeters: calcDistanceMeters(
      lat,
      lng,
      result.geometry.location.lat,
      result.geometry.location.lng,
    ),
  }));
}

export async function textSearchPlaces(
  query: string,
  location?: { lat: number; lng: number },
): Promise<Place[]> {
  const params: Record<string, string> = { query };
  if (location) {
    params.location = `${location.lat},${location.lng}`;
    params.radius = "2500";
  }

  const data = await invokeGet<any>("places-textsearch", params);
  if (!data?.results) return [];

  return data.results.slice(0, 8).map((result: any) => {
    const place = toPlace(result);
    return location
      ? {
          ...place,
          distanceMeters: calcDistanceMeters(
            location.lat,
            location.lng,
            place.lat,
            place.lng,
          ),
        }
      : place;
  });
}

export async function pingServer() {
  const { data } = await supabase.auth.getSession();
  return { status: data.session ? "ok" : "no_session" };
}

export async function askTravelAI(body: object) {
  return invokePost<{ picks?: number[]; reason?: string; raw?: string }>(
    "ai-recommend",
    body,
  );
}
