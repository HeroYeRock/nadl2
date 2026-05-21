import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlaceInsights } from "@/components/trip/PlaceInsights";
import { Colors } from "@/constants/colors";
import { SLOT_MAP, TIME_SLOTS } from "@/constants/timeSlots";
import { getPlaceDetail, searchPlaces, type PlaceSuggestion } from "@/services/api";
import { useTripStore } from "@/stores/tripStore";
import type { Place, SlotId } from "@/types/trip";

function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export default function AddPlaceScreen() {
  const { id, day, slot, custom } = useLocalSearchParams<{
    id: string;
    day?: string;
    slot?: SlotId;
    custom?: string;
  }>();
  const insets = useSafeAreaInsets();
  const trip = useTripStore((state) => state.trips.find((item) => item.id === id));
  const addPlace = useTripStore((state) => state.addPlace);
  const activeDay = Number(day ?? "1");

  const customIdRef = useRef(`custom-${Date.now()}`);
  const [mode, setMode] = useState<"slot" | "custom">(custom === "1" ? "custom" : "slot");
  const [selectedSlot, setSelectedSlot] = useState<SlotId>((slot as SlotId) ?? "lunch");
  const [customTime, setCustomTime] = useState("16:30");
  const [customLabel, setCustomLabel] = useState("");

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<Place | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const dayPlan = trip?.days.find((plan) => plan.day === activeDay);
  const currentSlot = dayPlan?.slots.find((item) => item.slot === selectedSlot);

  const searchHint = useMemo(() => {
    if (mode === "custom") {
      return `${trip?.destination ?? ""} 추가 일정`.trim();
    }
    const slotInfo = SLOT_MAP[selectedSlot];
    return `${trip?.destination ?? ""} ${slotInfo?.description ?? ""}`.trim();
  }, [mode, selectedSlot, trip?.destination]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchPlaces(text);
      setSuggestions(results);
      setIsSearching(false);
    }, 360);

    return () => clearTimeout(timer);
  }, [query]);

  async function openPreview(suggestion: PlaceSuggestion) {
    Keyboard.dismiss();
    setIsLoadingPreview(true);
    setPreview(null);
    const detail = await getPlaceDetail(suggestion.placeId, { withInsights: true });
    setIsLoadingPreview(false);
    if (detail) setPreview(detail);
  }

  async function confirmAdd() {
    if (!trip || !dayPlan || !preview) return;
    setIsSaving(true);

    if (mode === "custom") {
      const time = customTime.length === 5 ? customTime : "16:30";
      await addPlace(trip.id, activeDay, {
        slot: customIdRef.current,
        time,
        place: preview,
        customLabel: customLabel.trim() || undefined,
      });
    } else {
      await addPlace(trip.id, activeDay, {
        slot: selectedSlot,
        time: currentSlot?.time ?? SLOT_MAP[selectedSlot].defaultTime,
        place: preview,
      });
    }
    setIsSaving(false);
    router.back();
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>{activeDay}일차</Text>
          <Text style={styles.title}>{mode === "custom" ? "직접 추가" : "장소 추가"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode("slot")}
            style={[styles.modeChip, mode === "slot" && styles.modeChipActive]}
          >
            <Text style={[styles.modeChipText, mode === "slot" && styles.modeChipTextActive]}>
              시간대 선택
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("custom")}
            style={[styles.modeChip, mode === "custom" && styles.modeChipActive]}
          >
            <Text style={[styles.modeChipText, mode === "custom" && styles.modeChipTextActive]}>
              직접 시각 입력
            </Text>
          </Pressable>
        </View>

        {mode === "slot" ? (
          <>
            <Text style={styles.label}>시간대</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotList}>
              {TIME_SLOTS.map((item) => {
                const active = selectedSlot === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedSlot(item.id as SlotId)}
                    style={[styles.slotChip, active && styles.slotChipActive]}
                  >
                    <Ionicons name={item.icon as any} size={15} color={active ? "white" : item.color} />
                    <Text style={[styles.slotText, active && styles.slotTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.label}>시각 + 라벨</Text>
            <View style={styles.customRow}>
              <View style={styles.timeInputBox}>
                <Ionicons name="time-outline" size={18} color={Colors.textThird} />
                <TextInput
                  value={customTime}
                  onChangeText={(t) => setCustomTime(normalizeTimeInput(t))}
                  placeholder="HH:MM"
                  placeholderTextColor={Colors.textThird}
                  keyboardType="numbers-and-punctuation"
                  style={styles.timeInput}
                  maxLength={5}
                />
              </View>
              <View style={styles.labelInputBox}>
                <Ionicons name="bookmark-outline" size={18} color={Colors.textThird} />
                <TextInput
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder="라벨 (예: 호텔 체크인)"
                  placeholderTextColor={Colors.textThird}
                  style={styles.labelInput}
                  maxLength={20}
                />
              </View>
            </View>
            <Text style={styles.hint}>
              시간대 시간이 같은 기본 슬롯과 별개로 일정에 추가됩니다.
            </Text>
          </>
        )}

        <Text style={[styles.label, { marginTop: 22 }]}>장소 검색</Text>
        <View style={styles.inputBox}>
          <Ionicons name="search" size={19} color={Colors.textThird} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={searchHint || "장소 이름을 입력하세요"}
            placeholderTextColor={Colors.textThird}
            style={styles.input}
          />
          {isSearching || isSaving ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        </View>

        {!query ? (
          <View style={styles.helpBox}>
            <Ionicons name="sparkles-outline" size={20} color={Colors.primary} />
            <Text style={styles.helpText}>
              {mode === "custom"
                ? "체크인, 공항, 미팅 등 시간대로 분류되지 않는 일정을 자유롭게 추가하세요."
                : "예를 들어 “이자카야 저녁”, “전망대 일몰”, “디저트 카페”처럼 시간대가 느껴지는 말로 검색하면 좋아요."}
            </Text>
          </View>
        ) : null}

        {suggestions.slice(0, 5).map((suggestion) => (
          <Pressable key={suggestion.placeId} onPress={() => openPreview(suggestion)} style={styles.resultCard}>
            <View style={styles.resultIcon}>
              <Ionicons name="location-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.resultCopy}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {suggestion.mainText}
                </Text>
                {suggestion.badge ? (
                  <View
                    style={[
                      styles.badge,
                      suggestion.badge === "인기" ? styles.badgePopular : styles.badgeRecommend,
                    ]}
                  >
                    <Text style={styles.badgeText}>{suggestion.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.resultDesc} numberOfLines={1}>
                {suggestion.secondaryText || suggestion.description}
                {suggestion.selectionCount
                  ? `  · ${suggestion.selectionCount}명 선택`
                  : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textThird} />
          </Pressable>
        ))}
      </ScrollView>

      <PlacePreviewModal
        place={preview}
        isLoading={isLoadingPreview}
        isSaving={isSaving}
        onClose={() => setPreview(null)}
        onConfirm={confirmAdd}
      />
    </View>
  );
}

function PlacePreviewModal({
  place,
  isLoading,
  isSaving,
  onClose,
  onConfirm,
}: {
  place: Place | null;
  isLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const visible = !!place || isLoading;
  if (!visible) return null;

  return (
    <View style={previewStyles.backdrop} pointerEvents="auto">
      <Pressable style={previewStyles.dismiss} onPress={isSaving ? undefined : onClose} />
      <View style={previewStyles.sheet}>
        {isLoading || !place ? (
          <View style={previewStyles.loadingBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={previewStyles.loadingText}>장소 정보를 불러오는 중…</Text>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={previewStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={previewStyles.name}>{place.name}</Text>
              <Text style={previewStyles.address}>{place.address}</Text>
              <View style={previewStyles.metaRow}>
                {place.rating ? (
                  <Text style={previewStyles.rating}>
                    ★ {place.rating}
                    {place.userRatingsTotal
                      ? ` (${place.userRatingsTotal.toLocaleString()})`
                      : ""}
                  </Text>
                ) : null}
                {place.openNow !== undefined ? (
                  <Text
                    style={[
                      previewStyles.openBadge,
                      { color: place.openNow ? Colors.success : Colors.textThird },
                    ]}
                  >
                    {place.openNow ? "영업 중" : "영업 종료"}
                  </Text>
                ) : null}
              </View>
              <PlaceInsights place={place} />
            </ScrollView>
            <View style={previewStyles.buttonRow}>
              <Pressable onPress={onClose} style={previewStyles.cancelBtn} disabled={isSaving}>
                <Text style={previewStyles.cancelText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={[previewStyles.confirmBtn, isSaving && { opacity: 0.6 }]}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add" size={18} color="white" />
                    <Text style={previewStyles.confirmText}>일정에 추가</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    maxHeight: "80%",
  },
  scrollContent: {
    paddingBottom: 16,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecond,
  },
  name: {
    fontSize: 19,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  address: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecond,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    flexWrap: "wrap",
  },
  rating: {
    fontSize: 13,
    color: Colors.warning,
    fontWeight: "900",
  },
  openBadge: {
    fontSize: 12,
    fontWeight: "800",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    color: Colors.textSecond,
    fontWeight: "900",
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmText: {
    fontSize: 14,
    color: "white",
    fontWeight: "900",
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 12, color: Colors.primary, fontWeight: "900" },
  title: { fontSize: 22, color: Colors.textPrimary, fontWeight: "900", marginTop: 2 },
  content: { padding: 20, paddingBottom: 60 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  modeChip: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modeChipActive: { backgroundColor: Colors.dark, borderColor: Colors.dark },
  modeChipText: { fontSize: 13, fontWeight: "900", color: Colors.textSecond },
  modeChipTextActive: { color: "white" },
  label: { fontSize: 14, fontWeight: "900", color: Colors.textPrimary, marginBottom: 10 },
  slotList: { gap: 8, paddingBottom: 4 },
  slotChip: {
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  slotChipActive: { backgroundColor: Colors.dark, borderColor: Colors.dark },
  slotText: { fontSize: 13, color: Colors.textSecond, fontWeight: "900" },
  slotTextActive: { color: "white" },
  customRow: { flexDirection: "row", gap: 10 },
  timeInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 50,
    width: 130,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  timeInput: { flex: 1, fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  labelInputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  labelInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  hint: { marginTop: 8, fontSize: 12, color: Colors.textSecond, lineHeight: 17 },
  inputBox: {
    height: 52,
    borderRadius: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  helpBox: {
    borderRadius: 8,
    backgroundColor: "#FFF7F3",
    padding: 14,
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  helpText: { flex: 1, fontSize: 13, color: Colors.textSecond, lineHeight: 19 },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#FFF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  resultCopy: { flex: 1 },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultTitle: { fontSize: 15, fontWeight: "900", color: Colors.textPrimary, flexShrink: 1 },
  resultDesc: { fontSize: 12, color: Colors.textSecond, marginTop: 3 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRecommend: {
    backgroundColor: "#FFF3EE",
  },
  badgePopular: {
    backgroundColor: "#FFE8E8",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: Colors.error,
  },
});
