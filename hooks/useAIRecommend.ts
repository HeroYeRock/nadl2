import { useState } from "react";
import { recommendForSlot, recommendNextEmptySlot } from "@/services/ai";
import { useTripStore } from "@/stores/tripStore";
import type { AIRecommendation, Place, SlotId, Trip } from "@/types/trip";
import { SLOT_MAP } from "@/constants/timeSlots";

export function useAIRecommend(trip?: Trip) {
  const fillAISlot = useTripStore((state) => state.fillAISlot);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(day?: number, slot?: SlotId) {
    if (!trip) return null;
    setIsLoading(true);
    setError(null);

    try {
      const result = day && slot ? await recommendForSlot(trip, day, slot) : await recommendNextEmptySlot(trip);
      if (!result) {
        setError("추천할 후보를 찾지 못했어요. 먼저 기준이 될 장소를 하나 추가해보세요.");
      }
      setRecommendation(result);
      return result;
    } catch (err) {
      setError("AI 추천을 불러오지 못했어요. 서버 설정을 확인해주세요.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  function accept(place: Place) {
    if (!trip || !recommendation) return;
    const slotInfo = SLOT_MAP[recommendation.slot];
    fillAISlot(trip.id, recommendation.day, {
      slot: recommendation.slot,
      time: slotInfo.defaultTime,
      place,
      isAIFilled: true,
    });
    setRecommendation(null);
  }

  return {
    recommendation,
    isLoading,
    error,
    run,
    accept,
    dismiss: () => setRecommendation(null),
  };
}
