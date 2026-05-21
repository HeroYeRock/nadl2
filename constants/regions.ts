export interface Region {
  id: string;
  label: string;
  flag: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
  tips: string[];
  popularCities: string[];
}

export const REGIONS: Region[] = [
  {
    id: "all",
    label: "전체",
    flag: "World",
    timezone: "Asia/Seoul",
    currency: "KRW",
    currencySymbol: "KRW",
    tips: [],
    popularCities: ["도쿄", "오사카", "서울", "타이베이", "상하이"],
  },
  {
    id: "kr",
    label: "국내",
    flag: "KR",
    timezone: "Asia/Seoul",
    currency: "KRW",
    currencySymbol: "KRW",
    tips: ["카카오택시/네이버 지도 활용", "T머니 교통카드 편리"],
    popularCities: ["서울", "부산", "제주", "강릉", "전주"],
  },
  {
    id: "jp",
    label: "일본",
    flag: "JP",
    timezone: "Asia/Tokyo",
    currency: "JPY",
    currencySymbol: "JPY",
    tips: ["현금 필수인 가게가 있음", "라스트오더는 보통 마감 30분 전", "스이카 카드로 교통 편리"],
    popularCities: ["도쿄", "오사카", "후쿠오카", "삿포로", "교토"],
  },
  {
    id: "cn",
    label: "중국",
    flag: "CN",
    timezone: "Asia/Shanghai",
    currency: "CNY",
    currencySymbol: "CNY",
    tips: ["위챗페이/알리페이 확인", "VPN 미리 준비", "디디추싱으로 택시 호출"],
    popularCities: ["상하이", "베이징", "칭다오", "광저우", "청두"],
  },
  {
    id: "tw",
    label: "대만",
    flag: "TW",
    timezone: "Asia/Taipei",
    currency: "TWD",
    currencySymbol: "TWD",
    tips: ["이지카드로 교통/편의점 결제", "야시장은 저녁 6시 이후", "카드와 현금 병행 추천"],
    popularCities: ["타이베이", "가오슝", "타이중", "타이난", "화롄"],
  },
  {
    id: "us",
    label: "미국",
    flag: "US",
    timezone: "America/New_York",
    currency: "USD",
    currencySymbol: "USD",
    tips: ["팁 문화는 보통 15~20%", "Uber/Lyft 이동", "식당 예약은 Resy/OpenTable 확인"],
    popularCities: ["뉴욕", "로스앤젤레스", "샌프란시스코", "라스베이거스", "하와이"],
  },
];

export const REGION_MAP = Object.fromEntries(REGIONS.map((region) => [region.id, region])) as Record<string, Region>;
