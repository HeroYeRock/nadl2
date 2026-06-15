import { useEffect } from "react";
import { ymdFromToday } from "@/services/dates";
import { fetchDaysWeather, resolveTripCoords } from "@/services/weather";
import { useTripStore } from "@/stores/tripStore";
import type { Trip } from "@/types/trip";

// 예보는 자주 바뀌므로 3시간마다 갱신. 지난 날짜(확정 기록)는 한 번 받으면 다시 안 받는다.
const FORECAST_STALE_MS = 3 * 60 * 60 * 1000;

/**
 * trip 의 각 날짜 날씨를 백그라운드로 받아 trip.days[].weather 에 저장한다.
 * - 미래/오늘: 예보를 받아 갱신 (오래되면 다시)
 * - 지난 날짜: 실측 기록을 한 번 받아 저장하면 그대로 보존 (예보 기간이 지나도 조회 가능)
 * 저장은 updateTrip 을 통해 로컬+클라우드(+공유 스냅샷)에 반영된다.
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

      const need = trip!.days
        .filter((d) => {
          if (!d.date) return false;
          const w = d.weather;
          const isPast = d.date < today;
          if (isPast) return !w?.isHistorical; // 확정 기록이 이미 있으면 건너뜀
          // 오늘/미래: 받은 적 없거나 오래된 예보면 갱신
          return !w || now - new Date(w.fetchedAt).getTime() > FORECAST_STALE_MS;
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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, dateSig, updateTrip]);
}
