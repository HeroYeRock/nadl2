import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmbedMap } from "@/components/trip/EmbedMap";
import { PlaceInsights } from "@/components/trip/PlaceInsights";
import { Colors } from "@/constants/colors";
import { REGION_MAP } from "@/constants/regions";
import { getSlotInfo, isCustomSlotId } from "@/constants/timeSlots";
import { durationLabelKo, formatShortKo } from "@/services/dates";
import { directionsUrl, placeMapsUrl } from "@/services/maps";
import { buildScheduleRows, decodeTripFromShare, fetchSharedTrip } from "@/services/share";
import { describeWeather, weatherDetailLine, weatherSourceLabel } from "@/services/weather";
import type { Place, Trip } from "@/types/trip";

function openExternal(url: string) {
  Linking.openURL(url).catch(() => {});
}

function readHashData(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const match = hash.match(/[#&]d=([^&]+)/);
  return match ? match[1] : null;
}

export default function SharePage() {
  const insets = useSafeAreaInsets();
  const [activeDay, setActiveDay] = useState(1);
  const params = useLocalSearchParams<{ id?: string }>();
  // 공유 시 텍스트가 URL 뒤에 붙어 들어오는 경우를 대비해 앞쪽 영숫자 코드만 추출
  const rawId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const shareId = rawId?.trim().match(/^[A-Za-z0-9]{6,16}/)?.[0];

  // 구버전 링크 호환: 해시(#d=)에 데이터가 통째로 들어있는 경우
  const hashTrip = useMemo(() => {
    const data = readHashData();
    return data ? decodeTripFromShare(data) : null;
  }, []);

  const [fetchedTrip, setFetchedTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(!hashTrip && !!shareId);

  useEffect(() => {
    if (hashTrip || !shareId) return;
    let alive = true;
    fetchSharedTrip(shareId).then((result) => {
      if (!alive) return;
      setFetchedTrip(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [hashTrip, shareId]);

  const trip = hashTrip ?? fetchedTrip;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.emptyDesc}>일정을 불러오는 중...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Ionicons name="map-outline" size={40} color={Colors.textThird} />
        <Text style={styles.emptyTitle}>일정을 불러올 수 없어요</Text>
        <Text style={styles.emptyDesc}>링크가 올바르지 않거나 손상되었어요.</Text>
      </View>
    );
  }

  const region = REGION_MAP[trip.region];
  const dayPlan = trip.days.find((d) => d.day === activeDay) ?? trip.days[0];
  const filledSlots = dayPlan ? dayPlan.slots.filter((s) => s.place) : [];
  const places = filledSlots.map((s) => s.place).filter(Boolean) as Place[];
  const scheduleRows = buildScheduleRows(trip);
  const tripStart = scheduleRows[0]?.date;
  const tripEnd = scheduleRows[scheduleRows.length - 1]?.date;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.region}>
            {region?.label ?? "여행"} · {durationLabelKo(trip.duration)}
          </Text>
          <Text style={styles.title}>{trip.title}</Text>
          {tripStart ? (
            <Text style={styles.dateLine}>
              🗓️ {formatShortKo(tripStart)}
              {tripEnd && trip.duration > 1 ? ` ~ ${formatShortKo(tripEnd)}` : ""}
            </Text>
          ) : null}
          {trip.arrivalTime || trip.departureTime ? (
            <Text style={styles.flightLine}>
              ✈️ {trip.arrivalTime ?? "--"} 도착 / {trip.departureTime ?? "--"} 출발
            </Text>
          ) : null}
          <View style={styles.sharedBadge}>
            <Ionicons name="share-social-outline" size={12} color={Colors.primary} />
            <Text style={styles.sharedBadgeText}>공유된 일정 · 보기 전용</Text>
          </View>
        </View>

        {scheduleRows.length > 1 ? (
          <View style={styles.overview}>
            <Text style={styles.overviewTitle}>전체 일정 · {durationLabelKo(trip.duration)}</Text>
            {scheduleRows.map((row) => {
              const active = activeDay === row.day;
              return (
                <Pressable
                  key={row.day}
                  onPress={() => setActiveDay(row.day)}
                  style={[styles.overviewRow, active && styles.overviewRowActive]}
                >
                  <View style={styles.overviewDay}>
                    <Text style={[styles.overviewDayNum, active && styles.overviewActiveText]}>
                      {row.day}일차
                    </Text>
                    {row.date ? <Text style={styles.overviewDate}>{formatShortKo(row.date)}</Text> : null}
                  </View>
                  <Text
                    style={[styles.overviewArea, active && styles.overviewActiveText]}
                    numberOfLines={1}
                  >
                    {row.areaLabel}
                  </Text>
                  {row.weather ? (
                    <Text style={styles.overviewTemp}>
                      {describeWeather(row.weather.code).emoji} {row.weather.tempMax}°/{row.weather.tempMin}°
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {trip.days.length > 1 ? (
          <View style={styles.dayTabs}>
            {trip.days.map((day) => {
              const active = activeDay === day.day;
              return (
                <Pressable
                  key={day.day}
                  onPress={() => setActiveDay(day.day)}
                  style={[styles.dayTab, active && styles.dayTabActive]}
                >
                  <Text style={[styles.dayTabText, active && styles.dayTabTextActive]}>{day.day}일차</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.mapWrap}>
          <EmbedMap mode="browse" places={places} destination={trip.destination} />
        </View>

        <View style={styles.timeline}>
          <Text style={styles.sectionTitle}>{activeDay}일차 일정</Text>
          {dayPlan?.weather ? (
            <Text style={styles.dayWeather}>
              {describeWeather(dayPlan.weather.code).emoji} {describeWeather(dayPlan.weather.code).label} · 최고{" "}
              {dayPlan.weather.tempMax}° / 최저 {dayPlan.weather.tempMin}° · {weatherSourceLabel(dayPlan.weather)}
              {weatherDetailLine(dayPlan.weather, dayPlan.date)
                ? ` · ${weatherDetailLine(dayPlan.weather, dayPlan.date)}`
                : ""}
            </Text>
          ) : null}
          {filledSlots.length === 0 ? (
            <Text style={styles.emptyDesc}>이 날에 추가된 장소가 없어요.</Text>
          ) : (
            filledSlots.map((slot, index) => {
              const info = getSlotInfo(slot.slot);
              const label = isCustomSlotId(slot.slot) && slot.customLabel ? slot.customLabel : info.label;
              return (
                <View key={slot.slot} style={styles.row}>
                  <View style={styles.spine}>
                    <Text style={styles.time}>{slot.time}</Text>
                    <View style={[styles.dot, { backgroundColor: info.color }]} />
                    {index !== filledSlots.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.card}>
                    <View style={[styles.badge, { backgroundColor: info.bgColor }]}>
                      <Ionicons name={info.icon as any} size={12} color={info.color} />
                      <Text style={[styles.badgeText, { color: info.color }]}>{label}</Text>
                    </View>
                    <Text style={styles.placeName}>{slot.place?.name}</Text>
                    {slot.place?.address ? (
                      <Text style={styles.placeAddress} numberOfLines={2}>
                        {slot.place.address}
                      </Text>
                    ) : null}
                    {slot.place?.rating ? (
                      <Text style={styles.rating}>
                        ★ {slot.place.rating}
                        {slot.place.userRatingsTotal
                          ? ` (${slot.place.userRatingsTotal.toLocaleString()})`
                          : ""}
                      </Text>
                    ) : null}
                    {slot.place ? <PlaceInsights place={slot.place} /> : null}
                    {slot.place ? (
                      <View style={styles.btnRow}>
                        <Pressable
                          onPress={() => openExternal(placeMapsUrl(slot.place!, trip.region))}
                          style={styles.btnSecondary}
                        >
                          <Ionicons name="map-outline" size={14} color={Colors.primary} />
                          <Text style={styles.btnSecondaryText}>지도에서 보기</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openExternal(directionsUrl(slot.place!, "transit", null, trip.region))}
                          style={styles.btnPrimary}
                        >
                          <Ionicons name="navigate-outline" size={14} color="white" />
                          <Text style={styles.btnPrimaryText}>길찾기</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Nadl2 로 만든 여행 일정</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: Colors.textPrimary, marginTop: 8 },
  emptyDesc: { fontSize: 13, color: Colors.textSecond, textAlign: "center" },
  hero: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  region: { color: Colors.primary, fontSize: 13, fontWeight: "900" },
  title: { color: "white", fontSize: 28, fontWeight: "900", marginTop: 5 },
  dateLine: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "800", marginTop: 8 },
  flightLine: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", marginTop: 8 },
  overview: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  overviewTitle: { fontSize: 14, fontWeight: "900", color: Colors.textPrimary, marginBottom: 8 },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  overviewRowActive: { backgroundColor: "#FFF3EE" },
  overviewDay: { width: 86 },
  overviewDayNum: { fontSize: 13, fontWeight: "900", color: Colors.textPrimary },
  overviewDate: { fontSize: 11, fontWeight: "700", color: Colors.textThird, marginTop: 1 },
  overviewArea: { flex: 1, fontSize: 13, fontWeight: "800", color: Colors.textSecond },
  overviewTemp: { fontSize: 12, fontWeight: "800", color: Colors.textSecond },
  overviewActiveText: { color: Colors.primary },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,107,53,0.16)",
  },
  sharedBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: "800" },
  dayTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dayTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayTabActive: { backgroundColor: Colors.dark, borderColor: Colors.dark },
  dayTabText: { fontSize: 13, fontWeight: "800", color: Colors.textSecond },
  dayTabTextActive: { color: "white" },
  mapWrap: {
    height: 280,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.card,
  },
  timeline: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: Colors.textPrimary, marginBottom: 14 },
  dayWeather: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textSecond,
    marginTop: -6,
    marginBottom: 14,
  },
  row: { flexDirection: "row", gap: 12 },
  spine: { width: 46, alignItems: "center", paddingTop: 6 },
  time: { fontSize: 10, fontWeight: "800", color: Colors.textSecond, marginBottom: 5 },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
  },
  line: { flex: 1, width: 1.5, minHeight: 28, backgroundColor: Colors.border, marginTop: 4 },
  card: {
    flex: 1,
    marginBottom: 12,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
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
  placeName: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  placeAddress: { fontSize: 12, color: Colors.textSecond, marginTop: 3 },
  rating: { fontSize: 11, color: Colors.warning, fontWeight: "800", marginTop: 6 },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 12 },
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
  btnSecondaryText: { fontSize: 12, fontWeight: "800", color: Colors.primary },
  btnPrimary: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  btnPrimaryText: { fontSize: 12, fontWeight: "800", color: "white" },
  footer: { alignItems: "center", paddingTop: 24 },
  footerText: { fontSize: 12, color: Colors.textThird, fontWeight: "700" },
});
