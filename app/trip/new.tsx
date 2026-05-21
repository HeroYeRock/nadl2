import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { REGION_MAP, REGIONS } from "@/constants/regions";
import {
  arrivalReadyMinutes,
  departureCutoffMinutes,
  formatMinutes,
  getAirportInfo,
} from "@/services/airports";
import { searchPlaces, type PlaceSuggestion } from "@/services/api";
import { useTripStore } from "@/stores/tripStore";
import type { RegionId, ThemeId } from "@/types/trip";

const DURATIONS = [
  { days: 1, label: "당일치기" },
  { days: 2, label: "1박2일" },
  { days: 3, label: "2박3일" },
  { days: 4, label: "3박4일" },
  { days: 5, label: "4박5일" },
];

const THEMES: { id: ThemeId; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: "food", title: "먹방", desc: "맛집, 카페, 로컬 음식 중심", icon: "restaurant-outline", color: Colors.primary },
  { id: "sightseeing", title: "관광", desc: "랜드마크와 사진 명소 중심", icon: "camera-outline", color: Colors.transport },
  { id: "activity", title: "액티비티", desc: "체험, 쇼핑, 야간 일정 중심", icon: "walk-outline", color: Colors.activity },
  { id: "nature", title: "힐링", desc: "산책, 공원, 여유로운 루트 중심", icon: "leaf-outline", color: Colors.food },
];

const STEPS = ["지역", "목적지", "기간", "비행기", "테마", "확인"];

function getStartDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

export default function NewTripScreen() {
  const insets = useSafeAreaInsets();
  const createTrip = useTripStore((state) => state.createTrip);
  const progress = useSharedValue(0.2);
  const [step, setStep] = useState(0);
  const [region, setRegion] = useState<RegionId>("jp");
  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState(3);
  const [theme, setTheme] = useState<ThemeId>("food");
  const [startDate, setStartDate] = useState(getStartDate());
  const [arrivalTime, setArrivalTime] = useState("14:00");
  const [departureTime, setDepartureTime] = useState("18:00");
  const [useFlight, setUseFlight] = useState(true);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const activeRegion = REGION_MAP[region];
  const canGoNext = step !== 1 || destination.trim().length > 0;

  useEffect(() => {
    progress.value = withTiming((step + 1) / STEPS.length, { duration: 220 });
  }, [progress, step]);

  useEffect(() => {
    if (step !== 1 || destination.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const result = await searchPlaces(destination);
      setSuggestions(result);
      setIsSearching(false);
    }, 420);

    return () => clearTimeout(timer);
  }, [destination, step]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const startOptions = useMemo(
    () => [
      { label: "오늘", value: getStartDate(0) },
      { label: "내일", value: getStartDate(1) },
      { label: "주말", value: getStartDate(5) },
    ],
    [],
  );

  async function submit() {
    const trip = await createTrip({
      region,
      destination: destination.trim(),
      duration,
      theme,
      startDate,
      arrivalTime: useFlight ? arrivalTime : undefined,
      departureTime: useFlight ? departureTime : undefined,
    });
    router.replace(`/trip/${trip.id}`);
  }

  function next() {
    Keyboard.dismiss();
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    submit();
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>새 여행</Text>
          <Text style={styles.title}>{STEPS[step]} 설정</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={styles.grid}>
            {REGIONS.filter((item) => item.id !== "all").map((item) => {
              const active = region === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setRegion(item.id as RegionId)}
                  style={[styles.regionCard, active && styles.selectedCard]}
                >
                  <Text style={styles.regionCode}>{item.flag}</Text>
                  <Text style={styles.cardTitle}>{item.label}</Text>
                  <Text style={styles.cardDesc}>{item.popularCities.slice(0, 3).join(", ")}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <View style={styles.inputBox}>
              <Ionicons name="search" size={19} color={Colors.textThird} />
              <TextInput
                autoFocus
                value={destination}
                onChangeText={setDestination}
                placeholder="예: 도쿄, 오사카, 타이베이"
                placeholderTextColor={Colors.textThird}
                style={styles.input}
              />
              {isSearching ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
            </View>

            {activeRegion?.popularCities?.length ? (
              <View style={styles.quickList}>
                {activeRegion.popularCities.map((city) => (
                  <Pressable key={city} onPress={() => setDestination(city)} style={styles.quickChip}>
                    <Text style={styles.quickText}>{city}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion.placeId}
                onPress={() => {
                  setDestination(suggestion.mainText);
                  setSuggestions([]);
                }}
                style={styles.suggestion}
              >
                <Ionicons name="location-outline" size={18} color={Colors.primary} />
                <View style={styles.suggestionText}>
                  <Text style={styles.suggestionTitle}>{suggestion.mainText}</Text>
                  <Text style={styles.suggestionDesc} numberOfLines={1}>
                    {suggestion.secondaryText}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <View style={styles.grid}>
              {DURATIONS.map((item) => {
                const active = duration === item.days;
                return (
                  <Pressable
                    key={item.days}
                    onPress={() => setDuration(item.days)}
                    style={[styles.durationCard, active && styles.selectedCard]}
                  >
                    <Text style={styles.durationDays}>{item.days}일</Text>
                    <Text style={styles.cardDesc}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.subhead}>출발일</Text>
            <View style={styles.quickList}>
              {startOptions.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setStartDate(item.value)}
                  style={[styles.quickChip, startDate === item.value && styles.quickChipActive]}
                >
                  <Text style={[styles.quickText, startDate === item.value && styles.quickTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <FlightStep
            destination={destination}
            useFlight={useFlight}
            setUseFlight={setUseFlight}
            arrivalTime={arrivalTime}
            setArrivalTime={setArrivalTime}
            departureTime={departureTime}
            setDepartureTime={setDepartureTime}
          />
        ) : null}

        {step === 4 ? (
          <View style={styles.themeList}>
            {THEMES.map((item) => {
              const active = theme === item.id;
              return (
                <Pressable key={item.id} onPress={() => setTheme(item.id)} style={[styles.themeCard, active && styles.selectedCard]}>
                  <View style={[styles.themeIcon, { backgroundColor: `${item.color}18` }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <View style={styles.themeCopy}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDesc}>{item.desc}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{destination || "목적지"} 여행</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>지역</Text>
              <Text style={styles.summaryValue}>{activeRegion?.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>기간</Text>
              <Text style={styles.summaryValue}>{duration}일</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>출발일</Text>
              <Text style={styles.summaryValue}>{startDate}</Text>
            </View>
            {useFlight ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>비행기</Text>
                <Text style={styles.summaryValue}>
                  도착 {arrivalTime} / 출발 {departureTime}
                </Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>테마</Text>
              <Text style={styles.summaryValue}>{THEMES.find((item) => item.id === theme)?.title}</Text>
            </View>
            {activeRegion?.tips.length ? (
              <View style={styles.tipBox}>
                <Text style={styles.tipTitle}>지역 팁</Text>
                {activeRegion.tips.slice(0, 3).map((tip) => (
                  <Text key={tip} style={styles.tipText}>
                    · {tip}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((value) => value - 1)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>이전</Text>
          </Pressable>
        ) : null}
        <Pressable disabled={!canGoNext} onPress={next} style={[styles.primaryButton, !canGoNext && styles.disabledButton]}>
          <Text style={styles.primaryText}>{step === STEPS.length - 1 ? "여행 만들기" : "다음"}</Text>
          <Ionicons name="chevron-forward" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

interface FlightStepProps {
  destination: string;
  useFlight: boolean;
  setUseFlight: (v: boolean) => void;
  arrivalTime: string;
  setArrivalTime: (v: string) => void;
  departureTime: string;
  setDepartureTime: (v: string) => void;
}

function FlightStep({
  destination,
  useFlight,
  setUseFlight,
  arrivalTime,
  setArrivalTime,
  departureTime,
  setDepartureTime,
}: FlightStepProps) {
  const info = getAirportInfo(destination);
  const arriveReady = useFlight ? arrivalReadyMinutes(arrivalTime, destination) : null;
  const departureCutoff = useFlight ? departureCutoffMinutes(departureTime, destination) : null;

  return (
    <View>
      <View style={flightStyles.toggleRow}>
        <Pressable
          onPress={() => setUseFlight(true)}
          style={[flightStyles.toggleChip, useFlight && flightStyles.toggleChipActive]}
        >
          <Text style={[flightStyles.toggleText, useFlight && flightStyles.toggleTextActive]}>
            비행기 시간 반영
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setUseFlight(false)}
          style={[flightStyles.toggleChip, !useFlight && flightStyles.toggleChipActive]}
        >
          <Text style={[flightStyles.toggleText, !useFlight && flightStyles.toggleTextActive]}>
            건너뛰기
          </Text>
        </Pressable>
      </View>

      {useFlight ? (
        <>
          <View style={flightStyles.airportInfo}>
            <Ionicons name="airplane-outline" size={16} color={Colors.primary} />
            <Text style={flightStyles.airportText}>
              {destination || "목적지"} · {info.airport} 공항 (시내까지 ≈ {info.transitMinutes}분)
            </Text>
          </View>

          <Text style={flightStyles.fieldLabel}>도착 시각 (현지)</Text>
          <View style={flightStyles.timeRow}>
            <TimeInput value={arrivalTime} onChange={setArrivalTime} />
            <Text style={flightStyles.hint}>
              호텔 도착 ≈ {arriveReady !== null ? formatMinutes(arriveReady) : "--:--"}
            </Text>
          </View>

          <Text style={[flightStyles.fieldLabel, { marginTop: 18 }]}>출발 시각 (현지)</Text>
          <View style={flightStyles.timeRow}>
            <TimeInput value={departureTime} onChange={setDepartureTime} />
            <Text style={flightStyles.hint}>
              공항 도착 권장 ≈ {departureCutoff !== null ? formatMinutes(departureCutoff) : "--:--"}
            </Text>
          </View>

          <View style={flightStyles.noteBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textSecond} />
            <Text style={flightStyles.noteText}>
              AI 추천은 도착 후 호텔 도착 시각 이후 슬롯과 출발 권장 시각 이전 슬롯만 채워요.
            </Text>
          </View>
        </>
      ) : (
        <Text style={flightStyles.skipNote}>
          비행기 시간을 반영하지 않으면 모든 슬롯에 일정을 채웁니다. 나중에 편집 화면에서도 바꿀 수 있어요.
        </Text>
      )}
    </View>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={flightStyles.timeInputBox}>
      <Ionicons name="time-outline" size={18} color={Colors.textThird} />
      <TextInput
        value={value}
        onChangeText={(t) => onChange(normalizeTimeInput(t))}
        placeholder="HH:MM"
        placeholderTextColor={Colors.textThird}
        keyboardType="numbers-and-punctuation"
        style={flightStyles.timeInput}
        maxLength={5}
      />
    </View>
  );
}

function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

const flightStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  toggleChip: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleChipActive: {
    backgroundColor: Colors.dark,
    borderColor: Colors.dark,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.textSecond,
  },
  toggleTextActive: {
    color: "white",
  },
  airportInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFF7F3",
    borderRadius: 8,
    marginBottom: 18,
  },
  airportText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "800",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  timeInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  hint: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecond,
    fontWeight: "700",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 18,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.bg,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecond,
    lineHeight: 17,
  },
  skipNote: {
    fontSize: 13,
    color: Colors.textSecond,
    lineHeight: 19,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.card,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "900",
  },
  title: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: "900",
    marginTop: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
  },
  content: {
    padding: 20,
    paddingBottom: 130,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  regionCard: {
    width: "48%",
    minHeight: 116,
    borderRadius: 8,
    backgroundColor: Colors.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedCard: {
    borderColor: Colors.primary,
    backgroundColor: "#FFF7F3",
  },
  regionCode: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.primary,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textSecond,
    lineHeight: 17,
    marginTop: 5,
  },
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
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  quickList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  quickChip: {
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickChipActive: {
    backgroundColor: Colors.dark,
    borderColor: Colors.dark,
  },
  quickText: {
    fontSize: 13,
    color: Colors.textSecond,
    fontWeight: "800",
  },
  quickTextActive: {
    color: "white",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  suggestionDesc: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 2,
  },
  durationCard: {
    width: "48%",
    borderRadius: 8,
    backgroundColor: Colors.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  durationDays: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  subhead: {
    marginTop: 24,
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  themeList: {
    gap: 10,
  },
  themeCard: {
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  themeIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  themeCopy: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 8,
    backgroundColor: Colors.card,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecond,
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: "900",
  },
  tipBox: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: "#FFF7F3",
    padding: 12,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.primary,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 12,
    color: Colors.textSecond,
    lineHeight: 18,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textSecond,
  },
  primaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: Colors.primary,
  },
  disabledButton: {
    opacity: 0.35,
  },
  primaryText: {
    fontSize: 15,
    color: "white",
    fontWeight: "900",
  },
});
