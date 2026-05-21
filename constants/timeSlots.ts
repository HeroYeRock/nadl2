export interface TimeSlot {
  id: string;
  label: string;
  icon: string;
  defaultTime: string;
  color: string;
  bgColor: string;
  description: string;
}

export const TIME_SLOTS: TimeSlot[] = [
  {
    id: "morning",
    label: "아침",
    icon: "sunny-outline",
    defaultTime: "08:00",
    color: "#FF9500",
    bgColor: "#FFF3E0",
    description: "아침 식사, 카페, 오전 관광",
  },
  {
    id: "lunch",
    label: "점심",
    icon: "restaurant-outline",
    defaultTime: "12:00",
    color: "#30D158",
    bgColor: "#E8F8EE",
    description: "점심 맛집, 브런치",
  },
  {
    id: "afternoon",
    label: "오후",
    icon: "camera-outline",
    defaultTime: "14:00",
    color: "#0A84FF",
    bgColor: "#E8F0FF",
    description: "관광지, 쇼핑, 카페 디저트",
  },
  {
    id: "tea",
    label: "티타임",
    icon: "cafe-outline",
    defaultTime: "16:00",
    color: "#5856D6",
    bgColor: "#EEEEFA",
    description: "디저트 카페, 가벼운 산책",
  },
  {
    id: "sunset",
    label: "일몰",
    icon: "partly-sunny-outline",
    defaultTime: "17:30",
    color: "#FF6B35",
    bgColor: "#FFF0E8",
    description: "야경 명소, 전망대, 일몰 포인트",
  },
  {
    id: "dinner",
    label: "저녁",
    icon: "wine-outline",
    defaultTime: "19:00",
    color: "#FF3B30",
    bgColor: "#FFE8E8",
    description: "저녁 식사, 이자카야, 레스토랑",
  },
  {
    id: "night",
    label: "밤",
    icon: "moon-outline",
    defaultTime: "21:00",
    color: "#5E5CE6",
    bgColor: "#EEEEFF",
    description: "야경, 바, 야시장",
  },
];

export const SLOT_MAP = Object.fromEntries(TIME_SLOTS.map((slot) => [slot.id, slot])) as Record<string, TimeSlot>;

const CUSTOM_FALLBACK: TimeSlot = {
  id: "custom",
  label: "추가 일정",
  icon: "ellipse-outline",
  defaultTime: "12:00",
  color: "#6E6E73",
  bgColor: "#EFEFF4",
  description: "직접 추가한 일정",
};

export function isCustomSlotId(id: string): boolean {
  return id.startsWith("custom-");
}

export function getSlotInfo(id: string): TimeSlot {
  return SLOT_MAP[id] ?? CUSTOM_FALLBACK;
}
