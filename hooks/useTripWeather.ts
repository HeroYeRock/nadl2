import { useEffect } from "react";
import { AppState } from "react-native";
import { parseYMD, ymdFromToday } from "@/services/dates";
import { fetchDaysWeather, resolveTripCoords } from "@/services/weather";
import { useTripStore } from "@/stores/tripStore";
import type { Trip } from "@/types/trip";

// 예보는 자주 바뀌므로 3시간마다 갱신. 지난 날짜(확정 기록)는 한 번 받으면 다시 안 받는다.
const FORECAST_STALE_MS = 3 * 60 * 60 * 1000;
// 예보 제공 범위: 오늘 + 15일(총 16일). 그 너머는 평년값(미정)으로 채운다.
const FORECAST_MAX_DAYS = 15;

/**
 * trip 의 각 날짜 날씨를 백그라운드로 받아 trip.days[].weather 에 저장한다.
 * - 미래/오늘: 예보를 받아 갱신 (오래되면 다시)
 * - 지난 날짜: 실측 기록을 한 번 받아 저장하면 그대로 보존
 * - 평년값(미정)은 날짜가 예보 범위로 들어오면 실제 예보로 자동 교체
 * 화면 진입 시 + 앱이 다시 활성화될 때마다 재평가하므로 하루 단위로 예보가 갱신된다.
 */
export function useTripWeather(trip?: Trip) {
  const updateTrip = useTripStore((s) => s.updateTrip);
  // 날짜가 바뀌면 다시 받도록 시그니처를 의존성에 넣는다.
  const dateSig = trip?.days.map((d) => d.date).join(",");

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;

    async function run() {
      const today = ymdFromToday();
      const now = Date.now();
      const todayMs = parseYMD(today).getTime();

      const need = trip!.days
        .filter((d) => {
          if (!d.date) return false;
          const w = d.weather;
          const isPast = d.date < today;
          if (isPast) return !w?.isHistorical; // 확정 기록이 이미 있으면 건너뜀
          if (!w) return true; // 오늘/미래: 받은 적 없으면 받기
          // 평년값이었는데 이제 예보 범위(오늘+15일)에 들어왔으면 실제 예보로 교체
          const diffDays = Math.round((parseYMD(d.date).getTime() - todayMs) / 86400000);
          if (w.isClimate && diffDays <= FORECAST_MAX_DAYS) return true;
          // 오래된 예보면 갱신
          return now - new Date(w.fetchedAt).getTime() > FORECAST_STALE_MS;
        })
        .map((d) => d.date);

      if (need.length === 0 || cancelled) return;

      const coords = await resolveTripCoords(trip!);
      if (!coords || cancelled) return;

      const map = await fetchDaysWeather(coords, need, today);
      if (cancelled || Object.keys(map).length === 0) return;

      // 쓰기 직전 최신 상태 기준으로 병합 (그동안의 편집 보존)
      const latest = useTripStore.getState().trips.find((t) => t.id === trip!.id);
      if (!latest) return;
      let changed = false;
      const days = latest.days.map((d) => {
        const w = map[d.date];
        if (!w) return d;
        changed = true;
        return { ...d, weather: w };
      });
      if (changed) await updateTrip(latest.id, { days });
    }

    run();
    // 앱이 다시 활성화될 때(다음 날 재방문 등)마다 재평가 → 하루 단위로 예보 갱신
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, dateSig, updateTrip]);
}
