import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TripMap } from "@/components/map/TripMap";
import { CalendarPicker } from "@/components/ui/CalendarPicker";
import { AIRecommendSheet } from "@/components/trip/AIRecommendSheet";
import { AddPlaceInline } from "@/components/trip/AddPlaceInline";
import { TimelineItem } from "@/components/trip/TimelineItem";
import { Colors } from "@/constants/colors";
import { REGION_MAP } from "@/constants/regions";
import { useAIRecommend } from "@/hooks/useAIRecommend";
import { useTrip } from "@/hooks/useTrip";
import { useTripWeather } from "@/hooks/useTripWeather";
import { getAirportInfo } from "@/services/airports";
import { daysInclusive, durationLabelKo, formatShortKo } from "@/services/dates";
import { usesNaverMap } from "@/services/maps";
import { buildScheduleText, createShareUrl } from "@/services/share";
import { droppedDaysWithPlaces, isSlotInFlightWindow, resizeTripDays } from "@/services/tripHelpers";
import { describeWeather, isForecastAvailable, weatherDetailLine, weatherSourceLabel } from "@/services/weather";
import type { Place, SlotId } from "@/types/trip";

const PIN_COLORS = ["#FF3B30", "#0A84FF", "#30D158", "#FF9500", "#5E5CE6", "#AF52DE"];

function mapsUrl(places: Place[], region?: string) {
  if (!places.length) {
    return usesNaverMap(region) ? "https://map.naver.com" : "https://www.google.com/maps";
  }
  if (usesNaverMap(region)) {
    // 네이버: 첫 장소 → 마지막 장소 길찾기 (1곳이면 장소 검색)
    const first = places[0];
    if (places.length === 1) {
      const q = encodeURIComponent(`${first.name ?? ""} ${first.address ?? ""}`.trim() || `${first.lat},${first.lng}`);
      return `https://map.naver.com/p/search/${q}`;
    }
    const last = places[places.length - 1];
    const s = `${first.lng},${first.lat},${encodeURIComponent(first.name ?? "출발")}`;
    const g = `${last.lng},${last.lat},${encodeURIComponent(last.name ?? "도착")}`;
    return `https://map.naver.com/p/directions/${s}/${g}/-/transit`;
  }
  const origin = `${places[0].lat},${places[0].lng}`;
  const destination = `${places[places.length - 1].lat},${places[places.length - 1].lng}`;
  const waypoints = places.slice(1, -1).map((place) => `${place.lat},${place.lng}`).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "walking",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const timelineRef = useRef<View>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState<SlotId | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<string>();
  const [pendingEnd, setPendingEnd] = useState<string>();
  const { trip, stats, removePlace, deleteSlot, setSlotTime, updateTrip } = useTrip(id);
  const ai = useAIRecommend(trip);
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

  // 기간을 줄이면 활성 day 가 사라질 수 있으니, 없으면 첫 날로 폴백.
  const dayPlan = trip?.days.find((day) => day.day === activeDay) ?? trip?.days[0];
  const places = useMemo(() => dayPlan?.slots.map((slot) => slot.place).filter(Boolean) as Place[] ?? [], [dayPlan]);
  const region = trip ? REGION_MAP[trip.region] : undefined;
  const sortedDays = useMemo(() => (trip ? [...trip.days].sort((a, b) => a.day - b.day) : []), [trip]);
  const startDate = sortedDays[0]?.date;
  const endDate = sortedDays[sortedDays.length - 1]?.date;

  // 기간이 줄어 활성 day 가 범위를 벗어나면 1일차로 되돌린다.
  useEffect(() => {
    if (trip && activeDay > trip.duration) setActiveDay(1);
  }, [trip, activeDay]);

  if (!trip || !dayPlan) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.notFoundTitle}>여행을 찾을 수 없어요</Text>
        <Pressable onPress={() => router.replace("/")} style={styles.primaryButton}>
          <Text style={styles.primaryText}>홈으로 가기</Text>
        </Pressable>
      </View>
    );
  }

  async function saveImage() {
    if (Platform.OS === "web") {
      try {
        const uri = await captureRef(timelineRef, { format: "png", quality: 1 });
        const link = document.createElement("a");
        link.href = uri;
        link.download = `${trip?.title ?? "nadl2"}-${activeDay}일차.png`;
        link.click();
      } catch {
        Alert.alert("저장 실패", "이미지를 저장하지 못했어요.");
      }
      return;
    }
    try {
      // 네이티브에서만 expo-media-library 동적 로드 (웹에는 네이티브 모듈이 없음)
      const MediaLibrary = await import("expo-media-library");
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("권한이 필요해요", "일정 이미지를 저장하려면 사진 접근 권한이 필요합니다.");
        return;
      }
      const uri = await captureRef(timelineRef, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("저장 완료", "일정 이미지가 사진 앱에 저장됐어요.");
    } catch {
      Alert.alert("저장 실패", "이미지를 저장하지 못했어요.");
    }
  }

  async function shareTrip() {
    if (!trip) return;
    const origin =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin
        : "https://nadl2.vercel.app";
    const url = await createShareUrl(origin, trip);
    // 일정표 텍스트는 링크와 분리해 둔다. 링크는 항상 메시지 맨 끝 단독 줄에
    // 두거나 url 필드로 따로 보내, 본문이 붙어도 링크가 깨지지 않게 한다.
    const schedule = buildScheduleText(trip);
    const message = `${schedule}\n\n🔗 ${url}`;

    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      if (navigator.share) {
        try {
          // 일정표는 text 로, 링크는 url 필드로 따로 전달 → 링크가 깨지지 않게 함
          await navigator.share({ title: trip.title, text: schedule, url });
          return;
        } catch (e) {
          // 사용자가 공유를 취소한 경우 → 조용히 무시
          if ((e as DOMException)?.name === "AbortError") return;
          // 링크 생성 대기 중 사용자 제스처가 만료된 경우 등 → 클립보드 복사로 폴백
        }
      }
      try {
        await navigator.clipboard.writeText(message);
        Alert.alert("일정 복사됨", "일정표와 공유 링크를 클립보드에 복사했어요. 붙여넣어 공유하세요.");
      } catch {}
      return;
    }

    await Share.share({ message, url });
  }

  // 페이지 이동 없이 인라인 패널로 추가. 기본 슬롯이면 시간대 선택 모드로 미리 선택,
  // 커스텀(custom-*) 슬롯이면 일반 추가로 연다.
  function openAddPanel(slot?: string) {
    const isDefault = !!slot && !slot.startsWith("custom");
    setAddSlot(isDefault ? (slot as SlotId) : undefined);
    setAddOpen(true);
  }

  function openDatePicker() {
    setPendingStart(startDate);
    setPendingEnd(endDate);
    setDatePickerOpen(true);
  }

  async function applyDateRange(start: string, duration: number) {
    if (!trip) return;
    await updateTrip(trip.id, {
      duration,
      days: resizeTripDays(trip.days, start, duration),
    });
    setDatePickerOpen(false);
  }

  // 달력에서 기간(시작~종료)을 다 고르면 호출. 날짜가 줄어 장소가 사라질 땐 확인.
  function handleRangeChange(start: string, end?: string) {
    setPendingStart(start);
    setPendingEnd(end);
    if (!trip || !end) return;
    const duration = daysInclusive(start, end);
    const dropped = droppedDaysWithPlaces(trip.days, duration);
    if (dropped.length > 0) {
      Alert.alert(
        "일정이 짧아져요",
        `${dropped.length}개 날의 장소가 함께 삭제됩니다. 계속할까요?`,
        [
          { text: "취소", style: "cancel" },
          { text: "변경", style: "destructive", onPress: () => applyDateRange(start, duration) },
        ],
      );
      return;
    }
    applyDateRange(start, duration);
  }


  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </Pressable>
            <Pressable onPress={shareTrip} style={styles.backButton}>
              <Ionicons name="share-outline" size={20} color="white" />
            </Pressable>
          </View>
          <Text style={styles.region}>{region?.label ?? "여행"} · {trip.duration}일</Text>
          <View style={styles.titleRow}>
            <Text style={styles.heroTitle}>{trip.title}</Text>
            {stats.filledSlots === stats.totalSlots && stats.totalSlots > 0 ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/trip/[id]/timeline", params: { id: trip.id } })
                }
                style={styles.viewTimelineBtn}
              >
                <Ionicons name="calendar-outline" size={14} color="white" />
                <Text style={styles.viewTimelineText}>일정 보기</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={openDatePicker} style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color="white" />
            <Text style={styles.dateRowText}>
              {startDate ? formatShortKo(startDate) : "날짜 미정"}
              {trip.duration > 1 && endDate ? ` ~ ${formatShortKo(endDate)}` : ""}
            </Text>
            <Ionicons name="pencil" size={12} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <View style={styles.progressLine}>
            <View style={[styles.progressFill, { width: `${stats.progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {stats.filledSlots}/{stats.totalSlots}개 슬롯 완료
            {trip.arrivalTime || trip.departureTime
              ? ` · ✈️ ${trip.arrivalTime ?? "--"} 도착 / ${trip.departureTime ?? "--"} 출발 (${getAirportInfo(trip.destination).airport})`
              : ""}
          </Text>
        </View>

        <View style={styles.dayTabs}>
          {trip.days.map((day) => {
            const active = activeDay === day.day;
            return (
              <Pressable key={day.day} onPress={() => setActiveDay(day.day)} style={[styles.dayTab, active && styles.dayTabActive]}>
                <Text style={[styles.dayTabText, active && styles.dayTabTextActive]}>{day.day}일차</Text>
                {day.date ? (
                  <Text style={[styles.dayTabDate, active && styles.dayTabDateActive]}>
                    {formatShortKo(day.date)}
                    {day.weather ? ` ${describeWeather(day.weather.code).emoji}` : ""}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {dayPlan.weather ? (
          <View style={styles.weatherBar}>
            <Text style={styles.weatherEmoji}>{describeWeather(dayPlan.weather.code).emoji}</Text>
            <View style={styles.weatherInfo}>
              <Text style={styles.weatherText}>
                {describeWeather(dayPlan.weather.code).label} · 최고 {dayPlan.weather.tempMax}° / 최저{" "}
                {dayPlan.weather.tempMin}°
              </Text>
              {weatherDetailLine(dayPlan.weather, dayPlan.date) ? (
                <Text style={styles.weatherSub}>{weatherDetailLine(dayPlan.weather, dayPlan.date)}</Text>
              ) : null}
            </View>
            {dayPlan.weather.isClimate && isForecastAvailable(dayPlan.date) ? (
              <Pressable onPress={updateWeather} disabled={weatherUpdating} style={styles.weatherUpdateBtn}>
                {weatherUpdating ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={12} color={Colors.primary} />
                    <Text style={styles.weatherUpdateText}>업데이트</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Text
                style={[
                  styles.weatherTag,
                  (dayPlan.weather.isHistorical || dayPlan.weather.isClimate) && styles.weatherTagPast,
                ]}
              >
                {weatherSourceLabel(dayPlan.weather)}
              </Text>
            )}
          </View>
        ) : null}

        <TripMap places={places} pinColors={PIN_COLORS} />

        <View style={styles.actions}>
          <Pressable
            onPress={() => (addOpen ? setAddOpen(false) : openAddPanel())}
            style={[styles.actionButton, addOpen && styles.actionButtonActive]}
          >
            <Ionicons
              name={addOpen ? "remove" : "add"}
              size={18}
              color={addOpen ? "white" : Colors.primary}
            />
            <Text style={[styles.actionText, addOpen && styles.actionTextActive]}>
              {addOpen ? "닫기" : "장소 추가"}
            </Text>
          </Pressable>
          <Pressable onPress={() => ai.run()} style={styles.actionButton}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>빈 시간 추천</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(mapsUrl(places, trip.region))} style={styles.actionButton}>
            <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>{usesNaverMap(trip.region) ? "네이버지도" : "구글맵"}</Text>
          </Pressable>
        </View>

        {addOpen ? (
          <AddPlaceInline
            key={addSlot ?? "top"}
            tripId={trip.id}
            day={activeDay}
            destination={trip.destination}
            initialMode="slot"
            initialSlot={addSlot}
            onClose={() => setAddOpen(false)}
          />
        ) : null}

        <View ref={timelineRef} collapsable={false} style={styles.timelineWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{activeDay}일차 타임라인</Text>
            <Pressable onPress={saveImage} style={styles.imageButton}>
              <Ionicons name="image-outline" size={16} color={Colors.primary} />
              <Text style={styles.imageButtonText}>이미지 저장</Text>
            </Pressable>
          </View>
          {dayPlan.slots.map((slot, index) => {
            const inWindow = isSlotInFlightWindow(trip, activeDay, slot);
            const reason = !inWindow
              ? activeDay === 1
                ? "공항 도착 / 호텔 이동"
                : "공항으로 이동 / 체크인"
              : undefined;
            return (
              <TimelineItem
                key={slot.slot}
                slot={slot}
                isLast={index === dayPlan.slots.length - 1}
                pinColor={PIN_COLORS[index % PIN_COLORS.length]}
                onAdd={() => openAddPanel(slot.slot)}
                onRemove={() => removePlace(trip.id, activeDay, slot.slot)}
                onChangeTime={(time) => setSlotTime(trip.id, activeDay, slot.slot, time)}
                onDelete={() => deleteSlot(trip.id, activeDay, slot.slot)}
                blocked={!inWindow}
                blockedReason={reason}
              />
            );
          })}
        </View>
      </ScrollView>

      <AIRecommendSheet
        recommendation={ai.recommendation}
        isLoading={ai.isLoading}
        error={ai.error}
        onAccept={ai.accept}
        onClose={ai.dismiss}
      />

      <Modal
        visible={datePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDatePickerOpen(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>여행 날짜</Text>
                <Text style={styles.modalSubtitle}>
                  {pendingEnd
                    ? `${formatShortKo(pendingStart)} ~ ${formatShortKo(pendingEnd)} · ${durationLabelKo(daysInclusive(pendingStart!, pendingEnd))}`
                    : `${formatShortKo(pendingStart)} 출발 · 돌아오는 날을 선택하세요`}
                </Text>
              </View>
              <Pressable onPress={() => setDatePickerOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={Colors.textSecond} />
              </Pressable>
            </View>
            <CalendarPicker
              mode="range"
              startDate={pendingStart}
              endDate={pendingEnd}
              onRangeChange={handleRangeChange}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
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
    paddingBottom: 24,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  region: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 5,
  },
  heroTitle: {
    color: "white",
    fontSize: 30,
    fontWeight: "900",
    flexShrink: 1,
  },
  viewTimelineBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewTimelineText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13,
  },
  progressLine: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 2,
    marginTop: 18,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  progressText: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dateRowText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    marginTop: 4,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 7,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayTabActive: {
    backgroundColor: Colors.dark,
    borderColor: Colors.dark,
  },
  dayTabText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.textSecond,
  },
  dayTabTextActive: {
    color: "white",
  },
  dayTabDate: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textThird,
  },
  dayTabDateActive: {
    color: "rgba(255,255,255,0.75)",
  },
  weatherBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weatherEmoji: { fontSize: 22 },
  weatherInfo: { flex: 1 },
  weatherText: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary },
  weatherSub: { fontSize: 11, fontWeight: "700", color: Colors.textSecond, marginTop: 2 },
  weatherTag: {
    fontSize: 10,
    fontWeight: "900",
    color: Colors.info,
    backgroundColor: "#EAF3FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  weatherTagPast: {
    color: Colors.textSecond,
    backgroundColor: Colors.bg,
  },
  weatherUpdateBtn: {
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
  weatherUpdateText: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.primary,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.primary,
  },
  actionButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionTextActive: {
    color: "white",
  },
  timelineWrap: {
    marginHorizontal: 20,
    backgroundColor: Colors.bg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  imageButton: {
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFF3EE",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  imageButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.primary,
  },
  primaryButton: {
    height: 46,
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
  },
});
