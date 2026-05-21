/**
 * 도시별 기본 공항 + 시내 이동 예상 시간(분).
 * 출입국·짐 찾기·교통수단 평균 기준의 대략값. 정확한 ETA 가 아니라
 * "AI 가 일정을 짤 때 도착/출발 슬롯을 비워둘지" 결정용 휴리스틱.
 */
export interface AirportInfo {
  airport: string;
  /** 공항 ↔ 도심 평균 이동 시간 (분) */
  transitMinutes: number;
}

const AIRPORTS: Record<string, AirportInfo> = {
  // 일본
  "도쿄": { airport: "나리타/하네다", transitMinutes: 90 },
  "오사카": { airport: "간사이", transitMinutes: 60 },
  "교토": { airport: "간사이", transitMinutes: 90 },
  "후쿠오카": { airport: "후쿠오카", transitMinutes: 20 },
  "삿포로": { airport: "신치토세", transitMinutes: 50 },
  "오키나와": { airport: "나하", transitMinutes: 30 },
  "나하": { airport: "나하", transitMinutes: 30 },

  // 한국
  "서울": { airport: "인천", transitMinutes: 70 },
  "부산": { airport: "김해", transitMinutes: 30 },
  "제주": { airport: "제주", transitMinutes: 25 },

  // 대만
  "타이베이": { airport: "타오위안", transitMinutes: 50 },
  "가오슝": { airport: "가오슝", transitMinutes: 30 },

  // 미국
  "뉴욕": { airport: "JFK", transitMinutes: 60 },
  "LA": { airport: "LAX", transitMinutes: 50 },
  "샌프란시스코": { airport: "SFO", transitMinutes: 45 },

  // 중국
  "상하이": { airport: "푸동", transitMinutes: 60 },
  "베이징": { airport: "수도/다싱", transitMinutes: 60 },
};

export function getAirportInfo(destination: string): AirportInfo {
  const normalized = destination.trim();
  for (const key of Object.keys(AIRPORTS)) {
    if (normalized.includes(key)) return AIRPORTS[key];
  }
  return { airport: "공항", transitMinutes: 60 };
}

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatMinutes(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 도착일에 호텔 도착이 끝나는 시각 (분 단위, 자정 기준).
 * arrivalTime + transit + 30분(짐, 입국 등 버퍼).
 */
export function arrivalReadyMinutes(
  arrivalHHMM: string | undefined,
  destination: string,
): number | null {
  if (!arrivalHHMM) return null;
  const info = getAirportInfo(destination);
  return parseHHMM(arrivalHHMM) + info.transitMinutes + 30;
}

/**
 * 출발일에 더 이상 일정을 잡으면 안 되는 시각 (분 단위).
 * departureTime - transit - 120분(체크인 2시간 권장 버퍼).
 */
export function departureCutoffMinutes(
  departureHHMM: string | undefined,
  destination: string,
): number | null {
  if (!departureHHMM) return null;
  const info = getAirportInfo(destination);
  return parseHHMM(departureHHMM) - info.transitMinutes - 120;
}
