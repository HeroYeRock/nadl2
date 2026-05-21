/**
 * 도시별 day-area 템플릿.
 * 대형 여행사·크리에이터 일정에서 자주 묶이는 권역을 일자별로 다르게 매핑.
 * AI 추천 첫 슬롯이 매번 같은 결과로 수렴하는 걸 막아준다.
 */
export interface DayArea {
  /** Google Places textSearch 에 쓸 검색어 */
  query: string;
  /** UI/프롬프트에 노출할 라벨 */
  label: string;
}

const TEMPLATES: Record<string, DayArea[]> = {
  // 일본
  "도쿄": [
    { query: "도쿄 신주쿠 가부키쵸", label: "신주쿠" },
    { query: "도쿄 아사쿠사 우에노", label: "아사쿠사 / 우에노" },
    { query: "도쿄 시부야 하라주쿠 오모테산도", label: "시부야 / 하라주쿠" },
    { query: "도쿄 긴자 츠키지", label: "긴자 / 츠키지" },
    { query: "도쿄 오다이바 도쿄타워", label: "오다이바 / 도쿄타워" },
    { query: "도쿄 키치죠지 시모키타자와", label: "키치죠지 / 시모키타자와" },
    { query: "도쿄 닛포리 야네센", label: "닛포리 / 야네센" },
  ],
  "오사카": [
    { query: "오사카 도톤보리 난바", label: "도톤보리 / 난바" },
    { query: "오사카 우메다 키타", label: "우메다 / 키타" },
    { query: "오사카성 텐노지 신세카이", label: "오사카성 / 텐노지" },
    { query: "유니버설 스튜디오 재팬", label: "USJ" },
    { query: "오사카 아메리카무라 호리에", label: "아메리카무라 / 호리에" },
  ],
  "교토": [
    { query: "교토 기온 하나미코지", label: "기온" },
    { query: "교토 아라시야마 사가노", label: "아라시야마" },
    { query: "교토 후시미이나리 토후쿠지", label: "후시미이나리" },
    { query: "교토 긴카쿠지 철학의길 난젠지", label: "긴카쿠지 / 철학의길" },
    { query: "교토 니시키시장 카라스마", label: "니시키시장" },
  ],
  "후쿠오카": [
    { query: "후쿠오카 하카타 캐널시티", label: "하카타" },
    { query: "후쿠오카 텐진 다이묘", label: "텐진 / 다이묘" },
    { query: "후쿠오카 시사이드 모모치", label: "시사이드 / 모모치" },
    { query: "야나가와 다자이후", label: "다자이후 / 야나가와" },
  ],
  "삿포로": [
    { query: "삿포로 스스키노 타누키코지", label: "스스키노" },
    { query: "삿포로 오도리공원 시계탑", label: "오도리공원" },
    { query: "오타루 운하", label: "오타루" },
    { query: "삿포로 모이와산 후카이도신궁", label: "모이와산" },
  ],
  "오키나와": [
    { query: "나하 국제거리 슈리성", label: "나하 국제거리" },
    { query: "오키나와 추라우미 수족관 미야자키", label: "추라우미 수족관" },
    { query: "오키나와 아메리칸빌리지 차탄", label: "아메리칸빌리지" },
  ],

  // 한국
  "서울": [
    { query: "서울 명동 남산타워", label: "명동 / 남산" },
    { query: "서울 홍대 합정 망원", label: "홍대 / 합정" },
    { query: "서울 강남 가로수길 신사동", label: "강남 / 가로수길" },
    { query: "서울 종로 인사동 북촌 경복궁", label: "종로 / 북촌" },
    { query: "서울 이태원 한남동 압구정", label: "이태원 / 한남" },
    { query: "서울 성수 뚝섬 서울숲", label: "성수 / 서울숲" },
    { query: "서울 잠실 송파 롯데월드", label: "잠실 / 송파" },
  ],
  "부산": [
    { query: "부산 해운대 해리단길", label: "해운대" },
    { query: "부산 광안리 민락동", label: "광안리" },
    { query: "부산 남포동 자갈치 BIFF", label: "남포동 / 자갈치" },
    { query: "부산 감천문화마을 송도", label: "감천문화마을 / 송도" },
    { query: "부산 서면 전포동", label: "서면 / 전포동" },
  ],
  "제주": [
    { query: "제주 시내 동문시장", label: "제주시" },
    { query: "성산일출봉 우도", label: "성산 / 우도" },
    { query: "한라산 어리목 영실", label: "한라산" },
    { query: "서귀포 중문 천지연폭포", label: "서귀포 / 중문" },
    { query: "협재 곽지 애월", label: "협재 / 애월" },
  ],

  // 대만
  "타이베이": [
    { query: "타이베이 시먼딩 중정기념당", label: "시먼딩 / 중정기념당" },
    { query: "타이베이 스린 야시장 사대야시장", label: "스린 / 사대" },
    { query: "지우펀 스펀 핑시", label: "지우펀 / 스펀" },
    { query: "타이베이 융캉제 동문시장", label: "융캉제 / 동문" },
    { query: "타이베이 단수이 베이터우", label: "단수이 / 베이터우" },
    { query: "타이베이 화산창의문화원구 신의구", label: "신의 / 화산" },
  ],
  "가오슝": [
    { query: "가오슝 류허 야시장 신쥐장", label: "류허 야시장" },
    { query: "가오슝 시즈완 치진섬", label: "시즈완 / 치진" },
    { query: "가오슝 보얼 예술특구 위안두지", label: "보얼 / 위안두지" },
  ],

  // 미국
  "뉴욕": [
    { query: "뉴욕 맨해튼 미드타운 타임스스퀘어", label: "미드타운 / 타임스스퀘어" },
    { query: "뉴욕 소호 그리니치빌리지", label: "소호 / 빌리지" },
    { query: "뉴욕 브루클린 윌리엄스버그 DUMBO", label: "브루클린 / DUMBO" },
    { query: "뉴욕 센트럴파크 어퍼이스트", label: "센트럴파크 / 어퍼이스트" },
    { query: "뉴욕 첼시 하이라인 미트패킹", label: "첼시 / 하이라인" },
  ],
  "LA": [
    { query: "산타모니카 베니스비치", label: "산타모니카" },
    { query: "할리우드 멜로즈 비버리힐스", label: "할리우드 / 비버리힐스" },
    { query: "다운타운 LA 아트디스트릭트", label: "다운타운 / 아트디스트릭트" },
    { query: "디즈니랜드 애너하임", label: "디즈니랜드" },
  ],
  "샌프란시스코": [
    { query: "샌프란시스코 피셔맨즈워프 알카트라즈", label: "피셔맨즈워프" },
    { query: "샌프란시스코 미션 카스트로", label: "미션 / 카스트로" },
    { query: "샌프란시스코 골든게이트 프레시디오", label: "골든게이트" },
  ],

  // 중국
  "상하이": [
    { query: "상하이 외탄 와이탄 난징동루", label: "와이탄 / 난징동루" },
    { query: "상하이 신톈디 톈쯔팡", label: "신톈디 / 톈쯔팡" },
    { query: "상하이 위위안 라오제", label: "위위안 / 라오제" },
    { query: "상하이 디즈니랜드 푸동", label: "디즈니랜드 / 푸동" },
  ],
  "베이징": [
    { query: "베이징 천안문 자금성", label: "천안문 / 자금성" },
    { query: "베이징 만리장성 빠다링", label: "만리장성" },
    { query: "베이징 왕푸징 후통", label: "왕푸징 / 후통" },
    { query: "베이징 798 예술구 산리툰", label: "798 예술구 / 산리툰" },
  ],
};

function findKey(destination: string): string | null {
  const normalized = destination.trim();
  for (const key of Object.keys(TEMPLATES)) {
    if (normalized.includes(key)) return key;
  }
  return null;
}

export function getDayArea(destination: string, day: number): DayArea | null {
  const key = findKey(destination);
  if (!key) return null;
  const list = TEMPLATES[key];
  return list[(day - 1) % list.length];
}

export function hasTemplate(destination: string): boolean {
  return findKey(destination) !== null;
}
