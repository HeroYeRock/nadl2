import { useMemo } from "react";
import { countTripSlots } from "@/services/tripHelpers";
import { useTripStore } from "@/stores/tripStore";

export function useTrip(id?: string | string[]) {
  const tripId = Array.isArray(id) ? id[0] : id;
  const trip = useTripStore((state) => state.trips.find((item) => item.id === tripId));
  const removePlace = useTripStore((state) => state.removePlace);
  const deleteSlot = useTripStore((state) => state.deleteSlot);
  const setSlotTime = useTripStore((state) => state.setSlotTime);

  const stats = useMemo(() => {
    if (!trip) return { totalSlots: 0, filledSlots: 0, progress: 0 };
    const { total, filled } = countTripSlots(trip);
    return {
      totalSlots: total,
      filledSlots: filled,
      progress: total ? filled / total : 0,
    };
  }, [trip]);

  return {
    trip,
    stats,
    removePlace,
    deleteSlot,
    setSlotTime,
  };
}
