import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmbedMap } from "@/components/trip/EmbedMap";
import { PlaceInsights } from "@/components/trip/PlaceInsights";
import { Colors } from "@/constants/colors";
import { REGION_MAP } from "@/constants/regions";
import { getSlotInfo, isCustomSlotId } from "@/constants/timeSlots";
import { useEnrichTripPlaces } from "@/hooks/useEnrichTripPlaces";
import { useTrip } from "@/hooks/useTrip";
import { useTripWeather } from "@/hooks/useTripWeather";
import {
  arrivalReadyMinutes,
  departureCutoffMinutes,
  formatMinutes,
  getAirportInfo,
} from "@/services/airports";
import {
  autoMode,
  directionsUrl,
  haversineKm,
  MODE_LABEL,
  placeMapsUrl,
  type TravelMode,
} from "@/services/maps";
import { getCurrentLocation, type Coords, type GeoStatus } from "@/services/geolocation";
import { describeWeather, isForecastAvailable, weatherDetailLine, weatherSourceLabel } from "@/services/weather";
import type { Place, SlotItem, Trip } from "@/types/trip";

type ModeOverride = "auto" | "driving";

/**
 * "분할 레이아웃을 띄울만한 화면" 판단.
 * 폭만 보면 폴드7 펼침 (CSS ~700~870) 이 누락될 수 있어서
 * 짧은 변(min(width, height))이 600 이상이면 와이드로 간주.
 * → 일반 폰 가로(예: 844x390)는 짧은 변이 작아서 제외됨.
 */
const WIDE_MIN_SIDE = 600;

export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { trip } = useTrip(id);
  const { width, height } = useWindowDimensions();
  const isWide = Math.min(width, height) >= WIDE_MIN_SIDE;
  // 폭이 800 미만일 때는 좌 컬럼이 너무 좁아져서 카드 깨짐 → 50:50 + 항상 컴팩트
  const isNarrowSplit = isWide && width < 800;

  const [activeDay, setActiveDay] = useState(1);
  const [modeOverride, setModeOverride] = useState<ModeOverride>("auto");
  const [origin, setOrigin] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  /** wide 모드에서만 사용. set이 되면 지도가 directions 모드로 전환 */
  const [directionsTarget, setDirectionsTarget] = useState<SlotItem | null>(null);
  /** wide 모드에서 사이드맵에 강조할 장소 (없으면 day 전체 동선) */
  const [focusedPlace, setFocusedPlace] = useState<SlotItem | null>(null);

  useEnrichTripPlaces(trip);
  const { refresh: refreshWeather } = useTripWeather(trip);
  const [weatherUpdating, setWeatherUpdating] = useState(false);

  async function updateWeather() {
    if (weatherUpdating) return;
    setWeatherUpdating(true);
    try {
      await refreshWeather();
    } finally {
      setWeatherUpdating(false);
    }
  }

  useEffect(() => {
    setGeoStatus("loading");
    getCurrentLocation().then((result) => {
      setOrigin(result.coords);
      setGeoStatus(result.status);
    });
  }, []);

  // 활성 day가 바뀌면 사이드맵 상태 초기화
  useEffect(() => {
    setDirectionsTarget(null);
    setFocusedPlace(null);
  }, [activeDay]);

  const dayPlan = useMemo(
    () => trip?.days.find((d) => d.day === activeDay),
    [trip, activeDay],
  );

  const filledSlots = useMemo<SlotItem[]>(
    () => (dayPlan ? dayPlan.slots.filter((s) => !!s.place) : []),
    [dayPlan],
  );

  if (!trip) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.notFoundTitle}>여행을 찾을 수 없어요</Text>
        <Pressable onPress={() => router.replace("/")} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>홈으로</Text>
        </Pressable>
      </View>
    );
  }

  const region = REGION_MAP[trip.region];
  const inDirectionsMode = isWide && !!directionsTarget;

  function resolveMode(place: Place): TravelMode {
    if (modeOverride === "driving") return "driving";
    return autoMode({ lat: place.lat, lng: place.lng }, origin);
  }

  function openExternalMaps(url: string) {
    Linking.openURL(url).catch(() => {});
  }

  function handleViewOnMap(slot: SlotItem) {
    if (isWide) {
      setDirectionsTarget(null);
      setFocusedPlace(slot);
    } else {
      openExternalMaps(placeMapsUrl(slot.place!, trip.region));
    }
  }

  function handleDirections(slot: SlotItem) {
    if (isWide) {
      setDirectionsTarget(slot);
    } else {
      const mode = resolveMode(slot.place!);
      openExternalMaps(directionsUrl(slot.place!, mode, origin, trip.region));
    }
  }

  function geoBadgeLabel(): string {
    if (geoStatus === "loading") return "현위치 확인 중…";
    if (geoStatus === "granted") return "현위치 사용 중";
    if (geoStatus === "denied") return "위치 권한 거부 — 길찾기는 도착지만 사용";
    return "현위치 사용 불가 — 길찾기는 도착지만 사용";
  }

  // 공통 헤더 (hero + day tabs + 모드 row)
  const header = (
    <>
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="white" />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/trip/[id]", params: { id: trip.id } })}
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={14} color="white" />
            <Text style={styles.editBtnText}>수정</Text>
          </Pressable>
        </View>
        <Text style={styles.region}>
          {region?.label ?? "여행"} · {trip.duration}일
        </Text>
        <Text style={styles.heroTitle}>{trip.title}</Text>
        <Text style={styles.heroSub}>
          일정 보기 · 화면 {width}×{height} · {isWide ? "분할" : "단일"}
        </Text>
      </View>

      <View style={styles.dayTabs}>
        {trip.days.map((day) => {
          const active = activeDay === day.day;
          return (
            <Pressable
              key={day.day}
              onPress={() => setActiveDay(day.day)}
              style={[styles.dayTab, active && styles.dayTabActive]}
            >
              <Text style={[styles.dayTabText, active && styles.dayTabTextActive]}>
                {day.day}일차
                {day.weather ? ` ${describeWeather(day.weather.code).emoji}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.modeRow}>
        <View style={styles.geoBadge}>
          <Ionicons
            name={geoStatus === "granted" ? "locate" : "locate-outline"}
            size={12}
            color={geoStatus === "granted" ? Colors.success : Colors.textThird}
          />
          <Text style={styles.geoBadgeText}>{geoBadgeLabel()}</Text>
        </View>
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => setModeOverride("auto")}
            style={[styles.modeChip, modeOverride === "auto" && styles.modeChipActive]}
          >
            <Text style={[styles.modeChipText, modeOverride === "auto" && styles.modeChipTextActive]}>
              자동
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setModeOverride("driving")}
            style={[styles.modeChip, modeOverride === "driving" && styles.modeChipActive]}
          >
            <Ionicons
              name="car-outline"
              size={12}
              color={modeOverride === "driving" ? "white" : Colors.textSecond}
            />
            <Text style={[styles.modeChipText, modeOverride === "driving" && styles.modeChipTextActive]}>
              차량
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  // 슬롯 카드 렌더 — 두 레이아웃에서 공유
  const renderSlots = (compact: boolean) => (
    <>
      {dayPlan?.weather ? (
        <View style={styles.weatherBanner}>
          <Text style={styles.weatherBannerEmoji}>{describeWeather(dayPlan.weather.code).emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.weatherBannerTitle}>
              {describeWeather(dayPlan.weather.code).label} · 최고 {dayPlan.weather.tempMax}° / 최저{" "}
              {dayPlan.weather.tempMin}°
            </Text>
            {weatherDetailLine(dayPlan.weather, dayPlan.date) ? (
              <Text style={styles.weatherBannerSub}>{weatherDetailLine(dayPlan.weather, dayPlan.date)}</Text>
            ) : null}
          </View>
          {dayPlan.weather.isClimate && isForecastAvailable(dayPlan.date) ? (
            <Pressable onPress={updateWeather} disabled={weatherUpdating} style={styles.weatherBannerUpdateBtn}>
              {weatherUpdating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={12} color={Colors.primary} />
                  <Text style={styles.weatherBannerUpdateText}>업데이트</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Text
              style={[
                styles.weatherBannerTag,
                (dayPlan.weather.isHistorical || dayPlan.weather.isClimate) && styles.weatherBannerTagPast,
              ]}
            >
              {weatherSourceLabel(dayPlan.weather)}
            </Text>
          )}
        </View>
      ) : null}
      <FlightBanner trip={trip} day={activeDay} position="arrival" />
      <View style={compact ? styles.listCompact : styles.list}>
        {filledSlots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>이 날짜에는 추가된 장소가 없어요.</Text>
          </View>
        ) : (
          filledSlots.map((slot, index) => {
            const place = slot.place!;
            const mode = resolveMode(place);
            const distanceKm = origin
              ? haversineKm(origin, { lat: place.lat, lng: place.lng })
              : null;
            const info = getSlotInfo(slot.slot);
            const badgeLabel =
              isCustomSlotId(slot.slot) && slot.customLabel ? slot.customLabel : info.label;
            const isActiveTarget =
              isWide &&
              ((directionsTarget && directionsTarget.slot === slot.slot && directionsTarget.time === slot.time) ||
                (focusedPlace && focusedPlace.slot === slot.slot && focusedPlace.time === slot.time));

            return (
              <View key={`${slot.slot}-${index}`} style={styles.itemRow}>
                <View style={styles.spine}>
                  <Text style={styles.spineTime}>{slot.time}</Text>
                  <View style={[styles.spineDot, { backgroundColor: info.color }]} />
                  {index < filledSlots.length - 1 ? <View style={styles.spineLine} /> : null}
                </View>

                <View style={[styles.card, compact && styles.cardCompact, isActiveTarget && styles.cardActive]}>
                  <View style={[styles.badge, { backgroundColor: info.bgColor }]}>
                    <Ionicons name={info.icon as any} size={12} color={info.color} />
                    <Text style={[styles.badgeText, { color: info.color }]}>{badgeLabel}</Text>
                  </View>

                  <Text style={[styles.placeName, compact && styles.placeNameCompact]} numberOfLines={2}>
                    {place.name}
                  </Text>
                  <Text style={styles.placeAddress} numberOfLines={compact ? 1 : 2}>
                    {place.address}
                  </Text>

                  <View style={styles.placeMeta}>
                    {place.rating ? (
                      <Text style={styles.metaRating}>
                        ★ {place.rating}
                        {place.userRatingsTotal
                          ? ` (${place.userRatingsTotal.toLocaleString()})`
                          : ""}
                      </Text>
                    ) : null}
                    {!compact && distanceKm != null ? (
                      <Text style={styles.metaDistance}>
                        현위치에서{" "}
                        {distanceKm < 1
                          ? `${Math.round(distanceKm * 1000)}m`
                          : `${distanceKm.toFixed(1)}km`}
                      </Text>
                    ) : null}
                  </View>

                  {!compact ? <PlaceInsights place={place} /> : null}

                  <View style={styles.btnRow}>
                    <Pressable
                      onPress={() => handleViewOnMap(slot)}
                      style={styles.btnSecondary}
                    >
                      <Ionicons name="map-outline" size={14} color={Colors.primary} />
                      <Text style={styles.btnSecondaryText} numberOfLines={1}>
                        {compact ? "지도" : isWide ? "지도 강조" : "지도에서 보기"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDirections(slot)}
                      style={styles.btnPrimary}
                    >
                      <Ionicons
                        name={
                          mode === "walking"
                            ? "walk-outline"
                            : mode === "driving"
                              ? "car-outline"
                              : "bus-outline"
                        }
                        size={14}
                        color="white"
                      />
                      <Text style={styles.btnPrimaryText} numberOfLines={1}>
                        {compact ? "길찾기" : `길찾기 · ${MODE_LABEL[mode]}`}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      <FlightBanner trip={trip} day={activeDay} position="departure" />
    </>
  );

  // ──────────── Wide layout ────────────
  if (isWide) {
    const places = filledSlots
      .map((s) => s.place)
      .filter((p): p is Place => !!p);

    // 좁은 분할 화면(Fold 펼침, < 800px) 에서는 50:50, 넓은 화면은 40:60
    let timelineRatio: number;
    if (isNarrowSplit) {
      timelineRatio = inDirectionsMode ? 50 : 50;
    } else {
      timelineRatio = inDirectionsMode ? 35 : 40;
    }
    const timelineWidth = `${timelineRatio}%` as `${number}%`;
    const mapWidth = `${100 - timelineRatio}%` as `${number}%`;
    const focused = directionsTarget ?? focusedPlace;
    const focusedSlotItem = focused ?? undefined;
    const directionsMode = resolveMode(directionsTarget?.place ?? { lat: 0, lng: 0 } as Place);
    // 좁은 분할에서는 항상 컴팩트 카드 사용
    const useCompactCards = inDirectionsMode || isNarrowSplit;

    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.splitContainer}>
          <View style={[styles.splitLeft, { width: timelineWidth }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            >
              {renderSlots(useCompactCards)}
            </ScrollView>
          </View>
          <View style={[styles.splitRight, { width: mapWidth }]}>
            <EmbedMap
              mode={inDirectionsMode ? "directions" : "browse"}
              places={
                inDirectionsMode
                  ? []
                  : focused?.place
                    ? [focused.place]
                    : places
              }
              selectedSlot={focusedSlotItem}
              origin={origin}
              travelMode={directionsMode}
              destination={trip.destination}
              region={trip.region}
            />
            {inDirectionsMode ? (
              <Pressable
                onPress={() => setDirectionsTarget(null)}
                style={styles.mapOverlayBack}
              >
                <Ionicons name="chevron-back" size={16} color="white" />
                <Text style={styles.mapOverlayBackText}>일정 모드</Text>
              </Pressable>
            ) : null}
            {(directionsTarget ?? focused) ? (
              <Pressable
                onPress={() => {
                  const slot = directionsTarget ?? focused;
                  if (!slot?.place) return;
                  const url = directionsTarget
                    ? directionsUrl(slot.place, resolveMode(slot.place), origin, trip.region)
                    : placeMapsUrl(slot.place, trip.region);
                  openExternalMaps(url);
                }}
                style={styles.mapOverlayExternal}
              >
                <Ionicons name="open-outline" size={14} color="white" />
                <Text style={styles.mapOverlayExternalText}>Maps 앱에서 열기</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  // ──────────── Mobile layout (< 900px) ────────────
  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {header}
        {renderSlots(false)}
      </ScrollView>
    </View>
  );
}

function FlightBanner({
  trip,
  day,
  position,
}: {
  trip: { arrivalTime?: string; departureTime?: string; destination: string; duration: number };
  day: number;
  position: "arrival" | "departure";
}) {
  if (position === "arrival") {
    if (day !== 1 || !trip.arrivalTime) return null;
    const info = getAirportInfo(trip.destination);
    const ready = arrivalReadyMinutes(trip.arrivalTime, trip.destination);
    return (
      <View style={bannerStyles.row}>
        <View style={bannerStyles.iconWrap}>
          <Ionicons name="airplane-outline" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bannerStyles.title}>
            {trip.arrivalTime} 도착 · {info.airport} 공항
          </Text>
          <Text style={bannerStyles.sub}>
            시내 이동 ≈ {info.transitMinutes}분 · 호텔 도착 ≈{" "}
            {ready !== null ? formatMinutes(ready) : "--:--"}
          </Text>
        </View>
      </View>
    );
  }

  if (day !== trip.duration || !trip.departureTime) return null;
  const info = getAirportInfo(trip.destination);
  const cutoff = departureCutoffMinutes(trip.departureTime, trip.destination);
  return (
    <View style={[bannerStyles.row, { marginTop: 8 }]}>
      <View style={bannerStyles.iconWrap}>
        <Ionicons name="airplane" size={16} color={Colors.primary} style={{ transform: [{ rotate: "90deg" }] }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={bannerStyles.title}>
          {trip.departureTime} 출발 · {info.airport} 공항
        </Text>
        <Text style={bannerStyles.sub}>
          공항 도착 권장 ≈ {cutoff !== null ? formatMinutes(cutoff) : "--:--"} (이동 +
          체크인 2시간)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  notFound: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  hero: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editBtnText: { color: "white", fontWeight: "800", fontSize: 12 },
  region: { color: Colors.primary, fontSize: 13, fontWeight: "900" },
  heroTitle: { color: "white", fontSize: 30, fontWeight: "900", marginTop: 5 },
  heroSub: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  dayTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dayTab: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTabActive: { backgroundColor: Colors.dark, borderColor: Colors.dark },
  dayTabText: { fontSize: 13, fontWeight: "900", color: Colors.textSecond },
  dayTabTextActive: { color: "white" },
  modeRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  geoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  geoBadgeText: { fontSize: 11, color: Colors.textSecond, fontWeight: "700" },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeChipText: { fontSize: 12, color: Colors.textSecond, fontWeight: "800" },
  modeChipTextActive: { color: "white" },
  splitContainer: {
    flex: 1,
    flexDirection: "row",
    minHeight: 600,
  },
  splitLeft: {
    height: "100%",
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  splitRight: {
    height: "100%",
    position: "relative",
    backgroundColor: Colors.bg,
  },
  mapOverlayBack: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
  },
  mapOverlayBackText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
  },
  mapOverlayExternal: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
  },
  mapOverlayExternalText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  weatherBanner: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weatherBannerEmoji: { fontSize: 22 },
  weatherBannerTitle: { fontSize: 13, fontWeight: "900", color: Colors.textPrimary },
  weatherBannerSub: { fontSize: 11, fontWeight: "700", color: Colors.textSecond, marginTop: 3 },
  weatherBannerTag: {
    fontSize: 10,
    fontWeight: "900",
    color: Colors.info,
    backgroundColor: "#EAF3FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  weatherBannerTagPast: {
    color: Colors.textSecond,
    backgroundColor: Colors.bg,
  },
  weatherBannerUpdateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFF3EE",
  },
  weatherBannerUpdateText: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.primary,
  },
  list: { paddingHorizontal: 20, paddingTop: 6 },
  listCompact: { paddingHorizontal: 14, paddingTop: 6 },
  empty: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: { color: Colors.textThird, fontSize: 14 },
  itemRow: { flexDirection: "row", gap: 12 },
  spine: { width: 46, alignItems: "center", paddingTop: 6 },
  spineTime: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecond,
    marginBottom: 5,
  },
  spineDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
  },
  spineLine: {
    flex: 1,
    width: 1.5,
    minHeight: 28,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardCompact: {
    padding: 10,
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: "#FFF7F3",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  placeName: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  placeNameCompact: { fontSize: 14 },
  placeAddress: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 4,
    lineHeight: 17,
  },
  placeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    flexWrap: "wrap",
  },
  metaRating: { fontSize: 11, color: Colors.warning, fontWeight: "800" },
  metaDistance: { fontSize: 11, color: Colors.textThird },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  btnSecondary: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primary,
  },
  btnPrimary: {
    flex: 1.3,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  btnPrimaryText: { fontSize: 12, fontWeight: "800", color: "white" },
  primaryBtn: {
    height: 46,
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "white", fontSize: 15, fontWeight: "900" },
});

const bannerStyles = StyleSheet.create({
  row: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFF7F3",
    borderWidth: 1,
    borderColor: "#FFE0CF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.primary,
  },
  sub: {
    fontSize: 11,
    color: Colors.textSecond,
    marginTop: 3,
    fontWeight: "700",
  },
});
