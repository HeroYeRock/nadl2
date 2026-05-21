import { useEffect } from "react";
import { getPlaceDetail } from "@/services/api";
import { useTripStore } from "@/stores/tripStore";
import type { Trip } from "@/types/trip";

/**
 * 여행에 포함된 장소 중 insight (summary/menus/highlights/priceRange) 가 없는 것들을
 * 백그라운드에서 순차 enrich. Supabase 에 저장되어 다음에 열 때는 캐시됨.
 */
export function useEnrichTripPlaces(trip?: Trip) {
  const addPlace = useTripStore((s) => s.addPlace);

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    const enrichedIds = new Set<string>();

    async function enrich() {
      while (!cancelled) {
        const latest = useTripStore.getState().trips.find((t) => t.id === trip!.id);
        if (!latest) return;

        let target:
          | { day: number; slot: any; placeId: string }
          | null = null;

        for (const dayPlan of latest.days) {
          for (const slotItem of dayPlan.slots) {
            const place = slotItem.place;
            if (!place || !place.placeId) continue;
            if (enrichedIds.has(place.placeId)) continue;
            // 이미 한 번이라도 enrich 시도한 장소는 스킵
            if (place.enrichedAt) continue;
            target = { day: dayPlan.day, slot: slotItem, placeId: place.placeId };
            break;
          }
          if (target) break;
        }

        if (!target) return;
        enrichedIds.add(target.placeId);

        const enriched = await getPlaceDetail(target.placeId, { withInsights: true });
        if (cancelled) continue;

        const original = target.slot.place;
        const now = new Date().toISOString();

        if (!enriched) {
          // 조회 실패해도 enrichedAt 마킹 → 다음 진입 시 무한 재시도 방지
          await addPlace(latest.id, target.day, {
            ...target.slot,
            place: { ...original, enrichedAt: now },
          });
          continue;
        }

        // 기존 slot 의 place 를 enrich. 위치/사진 등은 enrich 결과로 덮어쓰되,
        // AI 추천 플래그, 거리 등 클라이언트 메타는 보존.
        await addPlace(latest.id, target.day, {
          ...target.slot,
          place: {
            ...enriched,
            id: original.id,
            isAIRecommended: original.isAIRecommended,
            distanceMeters: original.distanceMeters,
            enrichedAt: now,
          },
        });
      }
    }

    enrich();
    return () => {
      cancelled = true;
    };
  }, [trip?.id, addPlace]);
}
