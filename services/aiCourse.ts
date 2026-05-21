import type { Course } from "@/components/home/CourseCard";
import { SLOT_MAP } from "@/constants/timeSlots";
import { recommendForSlot } from "@/services/ai";
import { isSlotInFlightWindow } from "@/services/tripHelpers";
import { useTripStore } from "@/stores/tripStore";
import type { RegionId, SlotId, ThemeId } from "@/types/trip";

export interface CourseProgress {
  total: number;
  filled: number;
  currentLabel?: string;
}

/**
 * AI 추천 코스 카드를 누르면 호출.
 * - 빈 trip 을 만들고
 * - 각 슬롯을 순차적으로 AI 가 채움
 * - onProgress 콜백으로 진행률 보고
 * 채워진 trip id 를 반환.
 */
export async function generateCourseTrip(
  course: Course,
  startDate: string,
  options: { arrivalTime?: string; departureTime?: string } = {},
  onProgress?: (p: CourseProgress) => void,
): Promise<string | null> {
  const store = useTripStore.getState();

  const trip = await store.createTrip({
    region: course.region as RegionId,
    destination: course.destination,
    theme: course.theme as ThemeId,
    duration: course.duration,
    startDate,
    arrivalTime: options.arrivalTime,
    departureTime: options.departureTime,
  });

  const queue: { day: number; slot: SlotId }[] = [];
  for (const dayPlan of trip.days) {
    for (const item of dayPlan.slots) {
      if (item.slot.startsWith("custom-")) continue;
      if (isSlotInFlightWindow(trip, dayPlan.day, item)) {
        queue.push({ day: dayPlan.day, slot: item.slot as SlotId });
      }
    }
  }

  const total = queue.length;
  let filled = 0;
  onProgress?.({ total, filled });

  for (const { day, slot } of queue) {
    // 매번 최신 trip 으로 anchor 사용 (방금 채운 장소가 다음 슬롯 추천에 영향)
    const latest = useTripStore.getState().trips.find((t) => t.id === trip.id);
    if (!latest) break;

    const slotInfo = SLOT_MAP[slot];
    onProgress?.({ total, filled, currentLabel: `${day}일차 ${slotInfo.label}` });

    try {
      const rec = await recommendForSlot(latest, day, slot);
      const place = rec?.candidates[0];
      if (place) {
        await useTripStore.getState().fillAISlot(trip.id, day, {
          slot,
          time: slotInfo.defaultTime,
          place,
          isAIFilled: true,
        });
      }
    } catch {
      // 한 슬롯이 실패해도 다음 슬롯 진행
    }

    filled += 1;
    onProgress?.({ total, filled });
  }

  return trip.id;
}
