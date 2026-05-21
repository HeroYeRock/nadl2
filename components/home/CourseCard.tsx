import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { REGION_MAP } from "@/constants/regions";

export interface Course {
  id: string;
  title: string;
  region: string;
  destination: string;
  duration: number;
  places: number;
  theme: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  course: Course;
  onPress?: () => void;
}

const THEME_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  food: { label: "맛집 위주", bg: "#FFF3EE", color: Colors.primary },
  sightseeing: { label: "관광 위주", bg: "#E8F4FD", color: Colors.transport },
  activity: { label: "액티비티", bg: "#FFF4DB", color: Colors.activity },
  nature: { label: "자연/힐링", bg: "#EDFAF2", color: Colors.food },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CourseCard({ course, onPress }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const theme = THEME_CONFIG[course.theme] ?? THEME_CONFIG.food;
  const region = REGION_MAP[course.region];

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
    >
      <View style={[styles.icon, { backgroundColor: theme.bg }]}>
        <Ionicons name={course.icon} size={22} color={theme.color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {course.title}
        </Text>
        <Text style={styles.meta}>
          {region?.label ?? "여행"} · {course.places}개 장소
        </Text>
        <View style={[styles.tag, { backgroundColor: theme.bg }]}>
          <Text style={[styles.tagText, { color: theme.color }]}>{theme.label}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={17} color={Colors.textThird} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 3,
  },
  tag: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 7,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
