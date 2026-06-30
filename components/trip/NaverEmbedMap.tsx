import type { Place, SlotItem } from "@/types/trip";

interface Props {
  places: Place[];
  selectedSlot?: SlotItem | null;
  destination?: string;
}

// 네이버 임베드 지도는 웹 전용(Web Dynamic Map JS SDK). 네이티브에서는 EmbedMap 이
// 웹에서만 이 컴포넌트로 분기하므로, 네이티브 번들에는 빈 스텁만 들어간다.
export function NaverEmbedMap(_props: Props): null {
  return null;
}
