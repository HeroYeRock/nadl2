import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CourseCard, type Course } from "@/components/home/CourseCard";
import { NewTripCard } from "@/components/home/NewTripCard";
import { TripCard } from "@/components/home/TripCard";
import { Colors } from "@/constants/colors";
import { REGIONS } from "@/constants/regions";
import { generateCourseTrip, type CourseProgress } from "@/services/aiCourse";
import { useTripStore } from "@/stores/tripStore";

// 지역별 3개씩. 도시·기간·테마를 다양하게 두고, 각 도시는 itineraryTemplates 의
// 검증된 권역(day-area)을 따라 일자별로 다른 동선이 채워진다.
const COURSES: Course[] = [
  // 일본
  { id: "tokyo-classic", title: "도쿄 첫 여행 4박5일 핵심", region: "jp", destination: "도쿄", duration: 5, places: 16, theme: "sightseeing", icon: "camera-outline" },
  { id: "osaka-food", title: "오사카 먹방 2박3일", region: "jp", destination: "오사카", duration: 3, places: 11, theme: "food", icon: "restaurant-outline" },
  { id: "kyoto-zen", title: "교토 감성 사찰 2박3일", region: "jp", destination: "교토", duration: 3, places: 10, theme: "sightseeing", icon: "leaf-outline" },
  // 한국
  { id: "seoul-core", title: "서울 핵심 2박3일", region: "kr", destination: "서울", duration: 3, places: 11, theme: "sightseeing", icon: "business-outline" },
  { id: "busan-sea", title: "부산 바다 1박2일", region: "kr", destination: "부산", duration: 2, places: 7, theme: "activity", icon: "boat-outline" },
  { id: "jeju-drive", title: "제주 렌터카 3박4일", region: "kr", destination: "제주", duration: 4, places: 13, theme: "nature", icon: "leaf-outline" },
  // 대만
  { id: "taipei-foodie", title: "타이베이 미식·야시장 3박4일", region: "tw", destination: "타이베이", duration: 4, places: 13, theme: "food", icon: "moon-outline" },
  { id: "taichung-chill", title: "타이중 감성 2박3일", region: "tw", destination: "타이중", duration: 3, places: 10, theme: "sightseeing", icon: "color-palette-outline" },
  { id: "kaohsiung-port", title: "가오슝 항구 1박2일", region: "tw", destination: "가오슝", duration: 2, places: 7, theme: "activity", icon: "boat-outline" },
  // 미국
  { id: "nyc-core", title: "뉴욕 4박5일 핵심", region: "us", destination: "뉴욕", duration: 5, places: 16, theme: "sightseeing", icon: "business-outline" },
  { id: "la-vibes", title: "LA 자유 3박4일", region: "us", destination: "LA", duration: 4, places: 13, theme: "activity", icon: "sunny-outline" },
  { id: "sf-classic", title: "샌프란시스코 2박3일", region: "us", destination: "샌프란시스코", duration: 3, places: 10, theme: "sightseeing", icon: "earth-outline" },
  // 중국
  { id: "shanghai-modern", title: "상하이 3박4일", region: "cn", destination: "상하이", duration: 4, places: 13, theme: "sightseeing", icon: "business-outline" },
  { id: "beijing-history", title: "베이징 역사탐방 3박4일", region: "cn", destination: "베이징", duration: 4, places: 13, theme: "sightseeing", icon: "library-outline" },
  { id: "chengdu-panda", title: "청두 판다·미식 3박4일", region: "cn", destination: "청두", duration: 4, places: 13, theme: "food", icon: "paw-outline" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const trips = useTripStore((state) => state.trips);
  const [region, setRegion] = useState("all");
  const [progress, setProgress] = useState<(CourseProgress & { course: Course }) | null>(null);
  const filteredCourses = COURSES.filter((course) => region === "all" || course.region === region);

  async function handleCourseSelect(course: Course) {
    if (progress) return;
    setProgress({ course, total: course.duration * 6, filled: 0 });

    const startDate = new Date().toISOString().split("T")[0];
    const tripId = await generateCourseTrip(
      course,
      startDate,
      { arrivalTime: "14:00", departureTime: "18:00" },
      (p) => {
        setProgress((prev) => (prev ? { ...prev, ...p } : prev));
      },
    );

    setProgress(null);

    if (tripId) {
      router.push({ pathname: "/trip/[id]/timeline", params: { id: tripId } });
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brand}>Nadl2</Text>
              <Text style={styles.tagline}>해외도 나들이처럼 쉽게</Text>
            </View>
            <Pressable style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={20} color="white" />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Colors.textThird} />
            <TextInput
              placeholder="도시, 맛집, 관광지를 찾아보세요"
              placeholderTextColor={Colors.textThird}
              style={styles.searchInput}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionList}>
          {REGIONS.map((item) => {
            const isActive = region === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setRegion(item.id)}
                style={[styles.regionChip, isActive && styles.regionChipActive]}
              >
                <Text style={[styles.regionText, isActive && styles.regionTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <NewTripCard onPress={() => router.push("/trip/new")} />

        {trips.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>최근 여행</Text>
              <Pressable onPress={() => router.push("/trips")}>
                <Text style={styles.more}>전체보기</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={trips.slice(0, 5)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.tripList}
              renderItem={({ item }) => <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} />}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI 추천 코스</Text>
            <Text style={styles.sectionHint}>탭하면 자동 생성</Text>
          </View>
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} onPress={() => handleCourseSelect(course)} />
          ))}
        </View>
      </ScrollView>

      <GenerateProgressModal progress={progress} />
    </View>
  );
}

function GenerateProgressModal({
  progress,
}: {
  progress: (CourseProgress & { course: Course }) | null;
}) {
  const pct = progress && progress.total > 0 ? Math.round((progress.filled / progress.total) * 100) : 0;
  return (
    <Modal visible={!!progress} transparent animationType="fade">
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.card}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={modalStyles.title}>{progress?.course.title}</Text>
          <Text style={modalStyles.subtitle}>
            {progress?.currentLabel ? `${progress.currentLabel} 추천 중…` : "일정을 만들고 있어요…"}
          </Text>
          <View style={modalStyles.barTrack}>
            <View style={[modalStyles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={modalStyles.counter}>
            {progress?.filled ?? 0}/{progress?.total ?? 0} 슬롯
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "white",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  tagline: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    marginTop: 2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  searchBox: {
    height: 46,
    borderRadius: 8,
    backgroundColor: "white",
    marginTop: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  regionList: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 8,
  },
  regionChip: {
    height: 34,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  regionChipActive: {
    backgroundColor: Colors.dark,
    borderColor: Colors.dark,
  },
  regionText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textSecond,
  },
  regionTextActive: {
    color: "white",
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textThird,
  },
  more: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
  },
  tripList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.textPrimary,
    marginTop: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecond,
    textAlign: "center",
  },
  barTrack: {
    width: "100%",
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 8,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  counter: {
    fontSize: 12,
    color: Colors.textThird,
    fontWeight: "800",
  },
});
