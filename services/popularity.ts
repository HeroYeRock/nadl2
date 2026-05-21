import { supabase } from "@/services/supabase";

export interface PopularityInfo {
  placeId: string;
  count: number;
  badge?: "추천" | "인기";
}

export const POPULARITY_THRESHOLDS = {
  recommended: 3, // 3+ 명이 선택 → "추천"
  popular: 15, // 15+ 명이 선택 → "인기"
};

export function badgeFor(count: number): "추천" | "인기" | undefined {
  if (count >= POPULARITY_THRESHOLDS.popular) return "인기";
  if (count >= POPULARITY_THRESHOLDS.recommended) return "추천";
  return undefined;
}

/**
 * 여러 placeId 의 인기도를 한 번에 조회.
 */
export async function fetchPopularity(
  placeIds: string[],
): Promise<Map<string, PopularityInfo>> {
  const out = new Map<string, PopularityInfo>();
  if (placeIds.length === 0) return out;

  const unique = Array.from(new Set(placeIds.filter(Boolean)));
  const { data, error } = await supabase
    .from("place_popularity")
    .select("place_id, selection_count")
    .in("place_id", unique);

  if (error) {
    console.error("[popularity] list error", error.message);
    return out;
  }

  for (const row of data ?? []) {
    const count = row.selection_count ?? 0;
    if (count > 0) {
      out.set(row.place_id, {
        placeId: row.place_id,
        count,
        badge: badgeFor(count),
      });
    }
  }
  return out;
}

/**
 * 장소 선택 기록. 같은 사용자가 다시 추가하면 timestamp 만 갱신.
 * 실패해도 trip 저장은 진행되어야 하므로 silent fail.
 */
export async function recordPlaceSelection(input: {
  placeId: string;
  name: string;
  address?: string;
  destination?: string;
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;

    const { error } = await supabase
      .from("place_selections")
      .upsert(
        {
          user_id: userId,
          place_id: input.placeId,
          place_name: input.name,
          place_address: input.address ?? null,
          destination: input.destination ?? null,
          selected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,place_id" },
      );

    if (error) {
      console.error("[popularity] upsert error", error.message);
    }
  } catch (error) {
    console.error("[popularity] unexpected", error);
  }
}
