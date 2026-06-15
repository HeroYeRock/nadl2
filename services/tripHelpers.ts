import { getSlotInfo, TIME_SLOTS } from "@/constants/timeSlots";
import {
  arrivalReadyMinutes,
  departureCutoffMinutes,
  parseHHMM,
} from "@/services/airports";
import { rebuildDayDates } from "@/services/dates";
import type { DayPlan, SlotItem, Trip } from "@/types/trip";

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

/**
 * 새 출발일/기간에 맞춰 day 목록을 다시 만든다.
 * - 기존 day(=같은 day 번호)의 슬롯·장소는 그대로 유지
 * - 늘어난 날은 기본 슬롯으로 채워 추가
 * - 줄어든 날은 잘라냄
 * 마지막에 출발일 기준으로 모든 날짜를 다시 매긴다.
 */
export function resizeTripDays(
  existing: DayPlan[],
  startYMD: string,
  duration: number,
): DayPlan[] {
  const byDay = new Map(existing.map((d) => [d.day, d]));
  const days: DayPlan[] = [];
  for (let i = 0; i < duration; i++) {
    const dayNum = i + 1;
    days.push(
      byDay.get(dayNum) ?? {
        day: dayNum,
        date: "",
        slots: TIME_SLOTS.map<SlotItem>((s) => ({ slot: s.id, time: s.defaultTime })),
      },
    );
  }
  return rebuildDayDates(days, startYMD);
}

/** 기간이 duration 으로 줄 때 사라지는 날들 중 장소가 들어있는 날 (확인용) */
export function droppedDaysWithPlaces(existing: DayPlan[], duration: number): DayPlan[] {
  return existing.filter((d) => d.day > duration && d.slots.some((s) => s.place));
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
