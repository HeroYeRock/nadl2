import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { getPlaceDetail, searchPlaces, type PlaceSuggestion } from "@/services/api";
import { useTripStore } from "@/stores/tripStore";
import type { Place } from "@/types/trip";
import { PlaceInsights } from "@/components/trip/PlaceInsights";

interface Props {
  tripId: string;
  day: number;
  destination: string;
  onClose: () => void;
}

function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function CustomSlotInline({ tripId, day, destination, onClose }: Props) {
  const addPlace = useTripStore((state) => state.addPlace);
  const customIdRef = useRef(`custom-${Date.now()}`);

  const [time, setTime] = useState("16:30");
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<Place | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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

  async function openPreview(s: PlaceSuggestion) {
    if (!isValidTime(time)) return;
    setIsLoadingPreview(true);
    setPreview(null);
    const detail = await getPlaceDetail(s.placeId, { withInsights: true });
    setIsLoadingPreview(false);
    if (detail) setPreview(detail);
  }

  async function confirmAdd() {
    if (!preview || !isValidTime(time)) return;
    setIsSaving(true);
    await addPlace(tripId, day, {
      slot: customIdRef.current,
      time,
      place: preview,
      customLabel: label.trim() || undefined,
    });
    setIsSaving(false);
    onClose();
  }

  const timeOk = isValidTime(time);

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>직접 일정 추가</Text>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={Colors.textSecond} />
        </Pressable>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.timeBox}>
          <Ionicons name="time-outline" size={16} color={Colors.textThird} />
          <TextInput
            value={time}
            onChangeText={(t) => setTime(normalizeTimeInput(t))}
            placeholder="HH:MM"
            placeholderTextColor={Colors.textThird}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={styles.timeInput}
          />
        </View>
        <View style={styles.labelBox}>
          <Ionicons name="bookmark-outline" size={16} color={Colors.textThird} />
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="라벨 (선택, 예: 호텔 체크인)"
            placeholderTextColor={Colors.textThird}
            maxLength={20}
            style={styles.labelInput}
          />
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={Colors.textThird} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`${destination || "장소"} 검색`}
          placeholderTextColor={Colors.textThird}
          style={styles.searchInput}
        />
        {isSearching || isSaving ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : null}
      </View>

      {!timeOk && time.length > 0 ? (
        <Text style={styles.errorText}>시각 형식이 올바르지 않아요 (예: 16:30)</Text>
      ) : null}

      {preview || isLoadingPreview ? (
        <View style={styles.previewBox}>
          {isLoadingPreview || !preview ? (
            <View style={styles.previewLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.emptyText}>장소 정보 불러오는 중…</Text>
            </View>
          ) : (
            <>
              <Text style={styles.previewName}>{preview.name}</Text>
              <Text style={styles.previewAddress} numberOfLines={2}>
                {preview.address}
              </Text>
              {preview.rating ? (
                <Text style={styles.previewRating}>
                  ★ {preview.rating}
                  {preview.userRatingsTotal
                    ? ` (${preview.userRatingsTotal.toLocaleString()})`
                    : ""}
                </Text>
              ) : null}
              <PlaceInsights place={preview} compact />
              <View style={styles.previewBtnRow}>
                <Pressable
                  onPress={() => setPreview(null)}
                  style={styles.previewCancel}
                  disabled={isSaving}
                >
                  <Text style={styles.previewCancelText}>다시 고르기</Text>
                </Pressable>
                <Pressable
                  onPress={confirmAdd}
                  style={[styles.previewConfirm, isSaving && { opacity: 0.6 }]}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="add" size={16} color="white" />
                      <Text style={styles.previewConfirmText}>일정에 추가</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      ) : suggestions.length > 0 ? (
        <View style={styles.results}>
          {suggestions.slice(0, 5).map((s) => (
            <Pressable
              key={s.placeId}
              onPress={() => openPreview(s)}
              disabled={!timeOk || isSaving}
              style={[styles.resultCard, (!timeOk || isSaving) && { opacity: 0.5 }]}
            >
              <View style={styles.resultIcon}>
                <Ionicons name="location-outline" size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.resultTitleRow}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {s.mainText}
                  </Text>
                  {s.badge ? (
                    <View
                      style={[
                        styles.badge,
                        s.badge === "인기" ? styles.badgePopular : styles.badgeRecommend,
                      ]}
                    >
                      <Text style={styles.badgeText}>{s.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.resultDesc} numberOfLines={1}>
                  {s.secondaryText || s.description}
                  {s.selectionCount ? `  · ${s.selectionCount}명 선택` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textThird} />
            </Pressable>
          ))}
        </View>
      ) : query.trim().length >= 2 && !isSearching ? (
        <Text style={styles.emptyText}>일치하는 장소가 없어요.</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 8,
  },
  timeBox: {
    width: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  timeInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  labelBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  labelInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: "700",
  },
  results: {
    gap: 6,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.bg,
  },
  resultIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FFF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  resultDesc: {
    fontSize: 11,
    color: Colors.textSecond,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textThird,
    paddingVertical: 6,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeRecommend: {
    backgroundColor: "#FFF3EE",
  },
  badgePopular: {
    backgroundColor: "#FFE8E8",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: Colors.error,
  },
  previewBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  previewLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  previewName: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  previewAddress: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 2,
    lineHeight: 17,
  },
  previewRating: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: "800",
    marginTop: 4,
  },
  previewBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  previewCancel: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCancelText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textSecond,
  },
  previewConfirm: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  previewConfirmText: {
    fontSize: 13,
    fontWeight: "900",
    color: "white",
  },
});
