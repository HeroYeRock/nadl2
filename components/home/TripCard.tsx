import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { REGION_MAP } from "@/constants/regions";
import { countTripSlots } from "@/services/tripHelpers";
import type { Trip } from "@/types/trip";

interface Props {
  trip: Trip;
  onPress: () => void;
  /** 일정 보기 / 수정 버튼을 렌더할지. 기본 false (홈의 "최근 여행"용 단순 카드). */
  showActions?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const REGION_COLOR: Record<string, string> = {
  kr: "#30D158",
  jp: "#0A84FF",
  cn: "#FF3B30",
  tw: "#AF52DE",
  us: "#5E5CE6",
  all: Colors.primary,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TripCard({ trip, onPress, showActions, onView, onEdit, onDelete }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { total, filled } = countTripSlots(trip);
  const region = REGION_MAP[trip.region];
  const color = REGION_COLOR[trip.region] ?? Colors.primary;
  const isComplete = total > 0 && filled === total;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      style={[showActions ? styles.cardWide : styles.card, animatedStyle]}
    >
      <View style={[styles.mapStub, { backgroundColor: color }]}>
        <Ionicons name="location" size={22} color="white" />
        <View style={styles.pinSmall} />
        <View style={styles.routeLine} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {trip.title}
        </Text>
        <Text style={styles.meta}>
          {region?.label ?? "여행"} · {trip.duration}일 · {filled}/{total}개 슬롯
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${total ? (filled / total) * 100 : 0}%`, backgroundColor: color }]} />
        </View>

        {showActions ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onView}
              disabled={!isComplete}
              style={[styles.viewBtn, !isComplete && styles.viewBtnDisabled]}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={isComplete ? "white" : Colors.textThird}
              />
              <Text style={[styles.viewBtnText, !isComplete && styles.viewBtnTextDisabled]}>
                {isComplete ? "일정 보기" : `일정 보기 (${filled}/${total})`}
              </Text>
            </Pressable>
            <Pressable onPress={onEdit} style={styles.editBtn}>
              <Ionicons name="create-outline" size={14} color={Colors.textSecond} />
              <Text style={styles.editBtnText}>수정</Text>
            </Pressable>
            {onDelete ? (
              <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: 8,
    backgroundColor: Colors.card,
    marginRight: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardWide: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: Colors.card,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  mapStub: {
    height: 92,
    padding: 14,
    justifyContent: "space-between",
  },
  pinSmall: {
    position: "absolute",
    top: 30,
    right: 44,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  routeLine: {
    height: 2,
    width: 96,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
    transform: [{ rotate: "-12deg" }],
  },
  body: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    alignItems: "center",
  },
  viewBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  viewBtnDisabled: {
    backgroundColor: Colors.border,
  },
  viewBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },
  viewBtnTextDisabled: {
    color: Colors.textThird,
  },
  editBtn: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textSecond,
  },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
