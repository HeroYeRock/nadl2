import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TripMap } from "@/components/map/TripMap";
import { AIRecommendSheet } from "@/components/trip/AIRecommendSheet";
import { CustomSlotInline } from "@/components/trip/CustomSlotInline";
import { TimelineItem } from "@/components/trip/TimelineItem";
import { Colors } from "@/constants/colors";
import { REGION_MAP } from "@/constants/regions";
import { useAIRecommend } from "@/hooks/useAIRecommend";
import { useTrip } from "@/hooks/useTrip";
import { getAirportInfo } from "@/services/airports";
import { isSlotInFlightWindow } from "@/services/tripHelpers";
import type { Place, SlotId } from "@/types/trip";

const PIN_COLORS = ["#FF3B30", "#0A84FF", "#30D158", "#FF9500", "#5E5CE6", "#AF52DE"];

function mapsUrl(places: Place[]) {
  if (!places.length) return "https://www.google.com/maps";
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
  const [customOpen, setCustomOpen] = useState(false);
  const { trip, stats, removePlace } = useTrip(id);
  const ai = useAIRecommend(trip);

  const dayPlan = trip?.days.find((day) => day.day === activeDay);
  const places = useMemo(() => dayPlan?.slots.map((slot) => slot.place).filter(Boolean) as Place[] ?? [], [dayPlan]);
  const region = trip ? REGION_MAP[trip.region] : undefined;

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
    try {
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
    if (!trip || !dayPlan) return;
    const text = dayPlan.slots
      .filter((slot) => slot.place)
      .map((slot) => `${slot.time} ${slot.place?.name}`)
      .join("\n");
    await Share.share({
      message: `${trip.title} ${activeDay}일차\n${text || "아직 추가된 장소가 없어요."}`,
    });
  }

  function goAddPlace(slot?: string) {
    if (!trip) return;
    router.push({
      pathname: "/trip/[id]/add-place",
      params: { id: trip.id, day: String(activeDay), slot },
    });
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
              </Pressable>
            );
          })}
        </View>

        <TripMap places={places} pinColors={PIN_COLORS} />

        <View style={styles.actions}>
          <Pressable onPress={() => goAddPlace()} style={styles.actionButton}>
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>장소 추가</Text>
          </Pressable>
          <Pressable
            onPress={() => setCustomOpen((v) => !v)}
            style={[styles.actionButton, customOpen && styles.actionButtonActive]}
          >
            <Ionicons
              name={customOpen ? "remove" : "time-outline"}
              size={18}
              color={customOpen ? "white" : Colors.primary}
            />
            <Text style={[styles.actionText, customOpen && styles.actionTextActive]}>
              {customOpen ? "닫기" : "직접 추가"}
            </Text>
          </Pressable>
          <Pressable onPress={() => ai.run()} style={styles.actionButton}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>빈 시간 추천</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(mapsUrl(places))} style={styles.actionButton}>
            <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>구글맵</Text>
          </Pressable>
        </View>

        {customOpen ? (
          <CustomSlotInline
            tripId={trip.id}
            day={activeDay}
            destination={trip.destination}
            onClose={() => setCustomOpen(false)}
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
                onAdd={() => goAddPlace(slot.slot)}
                onRemove={() => removePlace(trip.id, activeDay, slot.slot)}
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
