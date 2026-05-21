import { getSlotInfo } from "@/constants/timeSlots";
import {
  arrivalReadyMinutes,
  departureCutoffMinutes,
  parseHHMM,
} from "@/services/airports";
import type { SlotItem, Trip } from "@/types/trip";

/**
 * 도착·출발 시각에 따라 해당 슬롯을 AI가 채우거나 진행률에 포함해야 하는지.
 * 사용자가 직접 추가한 custom 슬롯은 항상 valid.
 */
export function isSlotInFlightWindow(
  trip: Trip,
  day: number,
  slotOrItem: string | SlotItem,
): boolean {
  const slotId = typeof slotOrItem === "string" ? slotOrItem : slotOrItem.slot;
  const slotTimeFromItem = typeof slotOrItem === "string" ? undefined : slotOrItem.time;
  const slotTime = slotTimeFromItem ?? getSlotInfo(slotId).defaultTime;
  const slotMinutes = parseHHMM(slotTime);

  if (day === 1 && trip.arrivalTime) {
    const ready = arrivalReadyMinutes(trip.arrivalTime, trip.destination);
    if (ready !== null && slotMinutes < ready) return false;
  }

  if (day === trip.duration && trip.departureTime) {
    const cutoff = departureCutoffMinutes(trip.departureTime, trip.destination);
    if (cutoff !== null && slotMinutes > cutoff) return false;
  }

  return true;
}

export function countTripSlots(trip: Trip): { total: number; filled: number } {
  let total = 0;
  let filled = 0;
  for (const dayPlan of trip.days) {
    for (const item of dayPlan.slots) {
      if (!isSlotInFlightWindow(trip, dayPlan.day, item)) continue;
      total += 1;
      if (item.place) filled += 1;
    }
  }
  return { total, filled };
}
