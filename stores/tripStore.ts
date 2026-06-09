import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { TIME_SLOTS } from "@/constants/timeSlots";
import { recordPlaceSelection } from "@/services/popularity";
import { supabase } from "@/services/supabase";
import { createEmptyTrip } from "@/types/trip";
import type { NewTripForm, SlotItem, Trip } from "@/types/trip";

interface TripStore {
  trips: Trip[];
  hydrated: boolean;
  syncing: boolean;
  hydrateLocal: () => Promise<void>;
  syncFromCloud: () => Promise<void>;
  createTrip: (form: NewTripForm) => Promise<Trip>;
  updateTrip: (id: string, patch: Partial<Trip>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  getTrip: (id: string) => Trip | undefined;
  addPlace: (tripId: string, day: number, slot: SlotItem) => Promise<void>;
  removePlace: (tripId: string, day: number, slotId: string) => Promise<void>;
  deleteSlot: (tripId: string, day: number, slotId: string) => Promise<void>;
  setSlotTime: (tripId: string, day: number, slotId: string, time: string) => Promise<void>;
  updateSlot: (tripId: string, day: number, slot: SlotItem) => Promise<void>;
  fillAISlot: (tripId: string, day: number, slot: SlotItem) => Promise<void>;
  clearLocal: () => void;
}

const TRIPS_STORAGE_KEY = "nadl2-trips";

function updateDaySlot(trip: Trip, day: number, slotItem: SlotItem): Trip {
  return {
    ...trip,
    days: trip.days.map((dayPlan) => {
      if (dayPlan.day !== day) return dayPlan;
      const exists = dayPlan.slots.some((slot) => slot.slot === slotItem.slot);
      const slots = exists
        ? dayPlan.slots.map((slot) =>
            slot.slot === slotItem.slot ? slotItem : slot,
          )
        : [...dayPlan.slots, slotItem].sort((a, b) =>
            a.time.localeCompare(b.time),
          );
      return { ...dayPlan, slots };
    }),
    updatedAt: new Date().toISOString(),
  };
}

function readPersistedTrips(value: string | null): Trip[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const trips = parsed?.state?.trips ?? parsed?.trips;
    return Array.isArray(trips) ? trips.map(migrateTrip) : [];
  } catch {
    return [];
  }
}

/**
 * 구 버전 trip에 신규 기본 슬롯(tea 등)이 누락된 경우 자동 보강.
 * 사용자 데이터는 잃지 않고, 누락된 슬롯만 빈 채로 추가.
 */
function migrateTrip(trip: Trip): Trip {
  const defaultIds = new Set(TIME_SLOTS.map((s) => s.id));
  let mutated = false;
  const days = trip.days.map((dayPlan) => {
    const presentIds = new Set(dayPlan.slots.map((s) => s.slot));
    const missing = TIME_SLOTS.filter((s) => !presentIds.has(s.id));
    if (missing.length === 0) return dayPlan;
    mutated = true;
    const newSlots: SlotItem[] = [
      ...dayPlan.slots,
      ...missing.map<SlotItem>((s) => ({ slot: s.id, time: s.defaultTime })),
    ].sort((a, b) => a.time.localeCompare(b.time));
    return { ...dayPlan, slots: newSlots };
  });
  void defaultIds;
  return mutated ? { ...trip, days } : trip;
}

function rowToTrip(row: any): Trip {
  return {
    id: row.id,
    title: row.title,
    region: row.region,
    theme: row.theme,
    duration: row.duration,
    destination: row.destination,
    days: row.days ?? [],
    arrivalTime: row.arrival_time ?? undefined,
    departureTime: row.departure_time ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tripToRow(trip: Trip, userId: string) {
  return {
    id: trip.id,
    user_id: userId,
    title: trip.title,
    region: trip.region,
    theme: trip.theme,
    duration: trip.duration,
    destination: trip.destination,
    days: trip.days,
    arrival_time: trip.arrivalTime ?? null,
    departure_time: trip.departureTime ?? null,
    created_at: trip.createdAt,
    updated_at: trip.updatedAt,
  };
}

async function persistLocal(trips: Trip[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TRIPS_STORAGE_KEY,
      JSON.stringify({ state: { trips }, version: 0 }),
    );
  } catch {}
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function upsertCloud(trip: Trip): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("trips")
    .upsert(tripToRow(trip, userId), { onConflict: "id" });
  if (error) console.error("[Nadl2 cloud/upsert]", error.message);
}

async function deleteCloud(id: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) console.error("[Nadl2 cloud/delete]", error.message);
}

export const useTripStore = create<TripStore>()((set, get) => ({
  trips: [],
  hydrated: false,
  syncing: false,

  hydrateLocal: async () => {
    const value = await AsyncStorage.getItem(TRIPS_STORAGE_KEY).catch(() => null);
    const trips = readPersistedTrips(value);
    set({ trips, hydrated: true });
  },

  syncFromCloud: async () => {
    const userId = await currentUserId();
    if (!userId) {
      set({ syncing: false });
      return;
    }

    set({ syncing: true });
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[Nadl2 cloud/list]", error.message);
      set({ syncing: false });
      return;
    }

    const cloudTrips = (data ?? []).map(rowToTrip).map(migrateTrip);
    set({ trips: cloudTrips, syncing: false });
    await persistLocal(cloudTrips);
  },

  createTrip: async (form) => {
    const trip = createEmptyTrip(form);
    set((state) => ({ trips: [trip, ...state.trips] }));
    await persistLocal(get().trips);
    await upsertCloud(trip);
    return trip;
  },

  updateTrip: async (id, patch) => {
    const next = get().trips.map((trip) =>
      trip.id === id
        ? { ...trip, ...patch, updatedAt: new Date().toISOString() }
        : trip,
    );
    set({ trips: next });
    await persistLocal(next);
    const updated = next.find((t) => t.id === id);
    if (updated) await upsertCloud(updated);
  },

  deleteTrip: async (id) => {
    const next = get().trips.filter((trip) => trip.id !== id);
    set({ trips: next });
    await persistLocal(next);
    await deleteCloud(id);
  },

  getTrip: (id) => get().trips.find((trip) => trip.id === id),

  addPlace: async (tripId, day, slotItem) => {
    const next = get().trips.map((trip) =>
      trip.id === tripId ? updateDaySlot(trip, day, slotItem) : trip,
    );
    set({ trips: next });
    await persistLocal(next);
    const updated = next.find((t) => t.id === tripId);
    if (updated) {
      await upsertCloud(updated);
      if (slotItem.place?.placeId) {
        // fire-and-forget; trip 저장 실패와 분리
        recordPlaceSelection({
          placeId: slotItem.place.placeId,
          name: slotItem.place.name,
          address: slotItem.place.address,
          destination: updated.destination,
        });
      }
    }
  },

  removePlace: async (tripId, day, slotId) => {
    const next = get().trips.map((trip) => {
      if (trip.id !== tripId) return trip;
      return {
        ...trip,
        days: trip.days.map((dayPlan) => {
          if (dayPlan.day !== day) return dayPlan;
          return {
            ...dayPlan,
            slots: dayPlan.slots.map((slot) =>
              slot.slot === slotId
                ? { slot: slot.slot, time: slot.time }
                : slot,
            ),
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });
    set({ trips: next });
    await persistLocal(next);
    const updated = next.find((t) => t.id === tripId);
    if (updated) await upsertCloud(updated);
  },

  deleteSlot: async (tripId, day, slotId) => {
    const next = get().trips.map((trip) => {
      if (trip.id !== tripId) return trip;
      return {
        ...trip,
        days: trip.days.map((dayPlan) =>
          dayPlan.day !== day
            ? dayPlan
            : { ...dayPlan, slots: dayPlan.slots.filter((s) => s.slot !== slotId) },
        ),
        updatedAt: new Date().toISOString(),
      };
    });
    set({ trips: next });
    await persistLocal(next);
    const updated = next.find((t) => t.id === tripId);
    if (updated) await upsertCloud(updated);
  },

  setSlotTime: async (tripId, day, slotId, time) => {
    const next = get().trips.map((trip) => {
      if (trip.id !== tripId) return trip;
      return {
        ...trip,
        days: trip.days.map((dayPlan) => {
          if (dayPlan.day !== day) return dayPlan;
          const slots = dayPlan.slots
            .map((s) => (s.slot === slotId ? { ...s, time } : s))
            .sort((a, b) => a.time.localeCompare(b.time));
          return { ...dayPlan, slots };
        }),
        updatedAt: new Date().toISOString(),
      };
    });
    set({ trips: next });
    await persistLocal(next);
    const updated = next.find((t) => t.id === tripId);
    if (updated) await upsertCloud(updated);
  },

  updateSlot: async (tripId, day, slotItem) => {
    const next = get().trips.map((trip) =>
      trip.id === tripId ? updateDaySlot(trip, day, slotItem) : trip,
    );
    set({ trips: next });
    await persistLocal(next);
    const updated = next.find((t) => t.id === tripId);
    if (updated) await upsertCloud(updated);
  },

  fillAISlot: async (tripId, day, slotItem) => {
    await get().addPlace(tripId, day, { ...slotItem, isAIFilled: true });
  },

  clearLocal: () => {
    set({ trips: [] });
    AsyncStorage.removeItem(TRIPS_STORAGE_KEY).catch(() => {});
  },
}));

// 앱 시작 시 한 번 로컬 캐시 hydrate
useTripStore.getState().hydrateLocal();
