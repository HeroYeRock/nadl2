import { REGION_MAP } from "@/constants/regions";
import { SLOT_MAP } from "@/constants/timeSlots";
import { askTravelAI, getNearbyPlaces, textSearchPlaces } from "@/services/api";
import { getDayArea } from "@/services/itineraryTemplates";
import { isSlotInFlightWindow } from "@/services/tripHelpers";
import type { AIRecommendation, Place, SlotId, Trip } from "@/types/trip";

const SLOT_TYPES: Record<SlotId, string[]> = {
  morning: ["cafe", "bakery"],
  lunch: ["restaurant"],
  afternoon: ["tourist_attraction", "cafe", "shopping_mall"],
  tea: ["cafe", "bakery", "shopping_mall"],
  sunset: ["tourist_attraction", "park"],
  dinner: ["restaurant", "bar"],
  night: ["bar", "night_club", "tourist_attraction"],
};

const SLOT_KEYWORDS: Record<SlotId, string> = {
  morning: "아침 카페 브런치",
  lunch: "점심 맛집 레스토랑",
  afternoon: "카페 디저트 관광지 쇼핑",
  tea: "디저트 카페 베이커리 쇼핑",
  sunset: "전망대 야경 일몰 명소",
  dinner: "저녁 맛집 이자카야 레스토랑",
  night: "야경 바 야시장 산책",
};

const KNOWN_SLOTS = new Set<string>(Object.keys(SLOT_TYPES));

export function findEmptySlots(trip: Trip): { day: number; slot: SlotId }[] {
  const empty: { day: number; slot: SlotId }[] = [];

  for (const dayPlan of trip.days) {
    for (const slot of dayPlan.slots) {
      if (!KNOWN_SLOTS.has(slot.slot)) continue;
      if (!slot.place && isSlotInFlightWindow(trip, dayPlan.day, slot)) {
        empty.push({ day: dayPlan.day, slot: slot.slot as SlotId });
      }
    }
  }

  return empty;
}


function getAnchorPlace(trip: Trip, day: number): Place | undefined {
  const dayPlan = trip.days.find((plan) => plan.day === day);
  return dayPlan?.slots.find((slot) => slot.place)?.place;
}

function getUsedPlaceIds(trip: Trip): Set<string> {
  const ids = new Set<string>();
  for (const dayPlan of trip.days) {
    for (const slot of dayPlan.slots) {
      if (slot.place?.placeId) ids.add(slot.place.placeId);
    }
  }
  return ids;
}

function uniquePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = place.placeId || place.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 여행 일정에 어울리지 않는 장소(숙박·편의·비관광 시설)는 후보에서 제외한다.
// (Google 텍스트/주변 검색에 호텔·편의점·주유소 등이 섞여 들어오는 경우가 있어 방어적으로 거른다)
const EXCLUDED_CATEGORIES = new Set([
  // 숙박
  "lodging", "hotel", "motel", "resort_hotel", "extended_stay_hotel",
  "bed_and_breakfast", "guest_house", "hostel", "campground", "rv_park",
  // 생활 편의/비관광 시설
  "convenience_store", "gas_station", "parking", "atm", "bank",
  "car_rental", "car_repair", "car_dealer", "car_wash",
  "post_office", "hospital", "pharmacy", "drugstore", "doctor",
  "storage", "moving_company", "real_estate_agency", "apartment_complex",
]);
// 카테고리가 어긋나도 이름으로 한 번 더 거른다 (명확한 표현만)
const EXCLUDED_NAME =
  /호텔|모텔|리조트|펜션|게스트\s?하우스|hotel|motel|resort|hostel|guesthouse|ホテル|旅館|편의점|GS25|세븐일레븐|이마트24|미니스톱|주유소|충전소|주차장|약국/i;

function isExcludedPlace(place: Place): boolean {
  if (place.category && EXCLUDED_CATEGORIES.has(place.category)) return true;
  return EXCLUDED_NAME.test(place.name ?? "");
}

async function collectCandidates(trip: Trip, day: number, slot: SlotId): Promise<Place[]> {
  const anchor = getAnchorPlace(trip, day);
  const region = REGION_MAP[trip.region]?.label ?? "";
  const used = getUsedPlaceIds(trip);
  const dayArea = getDayArea(trip.destination, day);
  const areaQuery = dayArea?.query ?? trip.destination;

  let raw: Place[] = [];

  if (anchor) {
    // 같은 날에 이미 채워진 장소가 있으면 그 주변으로
    const nearby = await Promise.all(
      SLOT_TYPES[slot].map((type) => getNearbyPlaces(anchor.lat, anchor.lng, type, 1400)),
    );
    const text = await textSearchPlaces(
      `${areaQuery} ${SLOT_KEYWORDS[slot]}`,
      { lat: anchor.lat, lng: anchor.lng },
    );
    raw = [...nearby.flat(), ...text];
  } else if (dayArea) {
    // 첫 슬롯이고 도시 템플릿이 있으면, 그날의 권역을 시드로 사용
    const seedResults = await textSearchPlaces(dayArea.query);
    const seed = seedResults[0];
    if (seed) {
      const nearby = await Promise.all(
        SLOT_TYPES[slot].map((type) => getNearbyPlaces(seed.lat, seed.lng, type, 1400)),
      );
      const text = await textSearchPlaces(
        `${dayArea.query} ${SLOT_KEYWORDS[slot]}`,
        { lat: seed.lat, lng: seed.lng },
      );
      raw = [...nearby.flat(), ...text];
    } else {
      raw = await textSearchPlaces(`${dayArea.query} ${SLOT_KEYWORDS[slot]}`);
    }
  } else {
    // 템플릿 없는 도시는 기존 fallback
    const keyword = `${trip.destination} ${region} ${SLOT_KEYWORDS[slot]}`.trim();
    raw = await textSearchPlaces(keyword);
  }

  // 비관광 시설(숙박·편의점·주유소 등) 제외 + 여행 전체에서 이미 쓴 장소 제외(일자 간 중복 방지)
  const filtered = uniquePlaces(raw).filter(
    (p) => !isExcludedPlace(p) && (!p.placeId || !used.has(p.placeId)),
  );

  return filtered.slice(0, 10);
}

async function rankWithGroq(
  trip: Trip,
  day: number,
  slot: SlotId,
  candidates: Place[],
): Promise<{ picks: number[]; reason: string }> {
  const slotInfo = SLOT_MAP[slot];
  const regionInfo = REGION_MAP[trip.region];
  const dayPlan = trip.days.find((plan) => plan.day === day);
  const dayArea = getDayArea(trip.destination, day);
  const filledPlaces = dayPlan?.slots
    .filter((item) => item.place)
    .map((item) => `${item.time} ${item.place?.name}`)
    .join(", ");

  // Groq 가 일자 간 중복을 피하도록 trip 전체에서 이미 쓴 장소도 알려줌
  const usedNames = Array.from(
    new Set(
      trip.days.flatMap((d) =>
        d.slots
          .filter((s) => s.place && s.place.placeId)
          .map((s) => s.place!.name),
      ),
    ),
  ).join(", ");

  const result = await askTravelAI({
    destination: trip.destination,
    region: regionInfo?.label ?? trip.region,
    theme: trip.theme,
    day,
    day_area: dayArea?.label,
    slot,
    slot_label: slotInfo.label,
    slot_time: slotInfo.defaultTime,
    slot_desc: slotInfo.description,
    filled_places: filledPlaces || "아직 없음",
    used_places_in_trip: usedNames || "없음",
    candidates: candidates.map((place, index) => ({
      index,
      name: place.name,
      category: place.category,
      rating: place.rating,
      distanceMeters: place.distanceMeters,
      openNow: place.openNow,
    })),
  });

  if (!result) {
    return { picks: [0, 1, 2], reason: "현재 일정과 가까운 후보를 우선으로 추천했어요." };
  }

  const picks = normalizePickIndexes(result.picks, candidates.length);

  return {
    picks: picks.length ? picks : [0, 1, 2],
    reason: result.reason ?? "동선과 시간대에 맞는 후보를 골랐어요.",
  };
}

function normalizePickIndexes(value: unknown, maxLength: number): number[] {
  const rawItems = Array.isArray(value) ? value : [value];
  const indexes = rawItems.flatMap((item) => {
    if (typeof item === "number") return [item];
    if (typeof item !== "string") return [];

    const trimmed = item.trim();
    if (/^\d+$/.test(trimmed) && trimmed.length > 1) {
      return trimmed.split("").map(Number);
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? [parsed] : [];
  });

  return [...new Set(indexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < maxLength)
    .slice(0, 5);
}

export async function recommendForSlot(
  trip: Trip,
  day: number,
  slot: SlotId,
): Promise<AIRecommendation | null> {
  const candidates = await collectCandidates(trip, day, slot);
  if (!candidates.length) return null;

  const ranked = await rankWithGroq(trip, day, slot, candidates);
  const picks = ranked.picks
    .map((index) => candidates[index])
    .filter(Boolean)
    .slice(0, 5)
    .map((place) => ({ ...place, isAIRecommended: true }));

  return {
    day,
    slot,
    candidates: picks.length ? picks : candidates.slice(0, 5),
    reason: ranked.reason,
  };
}

export async function recommendNextEmptySlot(trip: Trip): Promise<AIRecommendation | null> {
  const [next] = findEmptySlots(trip);
  if (!next) return null;
  return recommendForSlot(trip, next.day, next.slot);
}
