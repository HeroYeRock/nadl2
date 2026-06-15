import { TIME_SLOTS } from "@/constants/timeSlots";

export type RegionId = "all" | "kr" | "jp" | "cn" | "tw" | "us";
export type ThemeId = "food" | "sightseeing" | "nature" | "activity";
/** 기본 7개 + custom-* (사용자가 직접 추가) */
export type SlotId = "morning" | "lunch" | "afternoon" | "tea" | "sunset" | "dinner" | "night";

export interface Place {
  id: string;
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  isAIRecommended?: boolean;
  distanceMeters?: number;
  openNow?: boolean;
  priceLevel?: 1 | 2 | 3 | 4;
  /** 한 줄 요약 (식당/관광지 공통) */
  summary?: string;
  /** 식당·카페 추천 메뉴 (최대 3개) */
  recommendedMenus?: string[];
  /** 관광지 주요 볼거리 (최대 3개) */
  highlights?: string[];
  /** 1인 평균 가격대 표현 (예: "1500~3000엔") */
  priceRange?: string;
  /** enrich (Google New API + Groq) 시도한 시각. 한 번 시도하면 재시도하지 않음. */
  enrichedAt?: string;
}

export interface SlotItem {
  /** "morning" | "lunch" | ... | "tea" | "night" | "custom-<n>" */
  slot: string;
  time: string;
  place?: Place;
  isAIFilled?: boolean;
  /** 사용자가 임의로 추가한 슬롯의 표시 라벨 (선택) */
  customLabel?: string;
  note?: string;
  durationMin?: number;
}

export interface DayWeather {
  /** WMO 기상 코드 */
  code: number;
  /** 최고기온 (℃, 반올림) */
  tempMax: number;
  /** 최저기온 (℃, 반올림) */
  tempMin: number;
  /** 강수 확률 % (예보에만 있음) */
  precipProb?: number;
  /** 강수량 mm */
  precipMm?: number;
  /** 받아온 시각 (ISO) */
  fetchedAt: string;
  /** 지난 날짜의 실측(확정) 기록이면 true, 미래 예보면 false */
  isHistorical: boolean;
  /** 16일 예보 범위를 넘어 평년값(최근 N년 평균)으로 채운 추정치면 true */
  isClimate?: boolean;
}

export interface DayPlan {
  day: number;
  date: string;
  slots: SlotItem[];
  /** 그날의 날씨. 지난 날짜는 실측 기록으로 한 번 저장하면 계속 보존된다. */
  weather?: DayWeather;
}

export interface Trip {
  id: string;
  title: string;
  region: RegionId;
  theme: ThemeId;
  duration: number;
  destination: string;
  days: DayPlan[];
  /** 도착일 비행기 도착 시각, "HH:MM" (현지). day 1 기준. */
  arrivalTime?: string;
  /** 출발일 비행기 출발 시각, "HH:MM" (현지). 마지막 day 기준. */
  departureTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIRecommendation {
  slot: SlotId;
  day: number;
  candidates: Place[];
  reason: string;
}

export interface NewTripForm {
  region: RegionId;
  destination: string;
  theme: ThemeId;
  duration: number;
  startDate: string;
  arrivalTime?: string;
  departureTime?: string;
}

function makeTripId(): string {
  const c: any = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback (RFC4122 v4-ish)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createEmptyTrip(form: NewTripForm): Trip {
  const now = new Date().toISOString();
  const start = new Date(form.startDate);

  return {
    id: makeTripId(),
    title: `${form.destination} 여행`,
    region: form.region,
    theme: form.theme,
    duration: form.duration,
    destination: form.destination,
    days: Array.from({ length: form.duration }, (_, dayIndex) => {
      const date = new Date(start.getTime() + dayIndex * 86400000);
      return {
        day: dayIndex + 1,
        date: date.toISOString().split("T")[0],
        slots: TIME_SLOTS.map((slot) => ({
          slot: slot.id as SlotId,
          time: slot.defaultTime,
        })),
      };
    }),
    arrivalTime: form.arrivalTime,
    departureTime: form.departureTime,
    createdAt: now,
    updatedAt: now,
  };
}
