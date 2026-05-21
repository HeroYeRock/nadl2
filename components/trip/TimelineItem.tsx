import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { getSlotInfo, isCustomSlotId } from "@/constants/timeSlots";
import type { SlotItem } from "@/types/trip";

interface Props {
  slot: SlotItem;
  isLast: boolean;
  pinColor: string;
  onAdd: () => void;
  onRemove: () => void;
  blocked?: boolean;
  blockedReason?: string;
}

export function TimelineItem({
  slot,
  isLast,
  pinColor,
  onAdd,
  onRemove,
  blocked,
  blockedReason,
}: Props) {
  const info = getSlotInfo(slot.slot);
  const badgeLabel = isCustomSlotId(slot.slot) && slot.customLabel ? slot.customLabel : info.label;

  if (blocked && !slot.place) {
    return (
      <Animated.View entering={FadeInDown.duration(220)} style={styles.row}>
        <View style={styles.spine}>
          <Text style={[styles.time, styles.timeBlocked]}>{slot.time}</Text>
          <View style={[styles.dot, styles.dotBlocked]} />
          {!isLast ? <View style={styles.line} /> : null}
        </View>
        <View style={styles.cardWrap}>
          <View style={[styles.card, styles.cardBlocked]}>
            <View style={styles.blockedRow}>
              <Ionicons name="airplane-outline" size={14} color={Colors.textThird} />
              <Text style={styles.blockedText}>
                {blockedReason ?? "비행기 이동 시간대"}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.row}>
      <View style={styles.spine}>
        <Text style={styles.time}>{slot.time}</Text>
        <View style={[styles.dot, { backgroundColor: slot.place ? pinColor : Colors.borderLight }]} />
        {!isLast ? <View style={styles.line} /> : null}
      </View>

      <Pressable onPress={slot.place ? undefined : onAdd} style={styles.cardWrap}>
        <View style={styles.card}>
          <View style={[styles.badge, { backgroundColor: info.bgColor }]}>
            <Ionicons name={info.icon as any} size={12} color={info.color} />
            <Text style={[styles.badgeText, { color: info.color }]}>{badgeLabel}</Text>
          </View>

          {slot.place ? (
            <View style={styles.placeRow}>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {slot.place.name}
                </Text>
                <Text style={styles.placeAddress} numberOfLines={1}>
                  {slot.place.address}
                </Text>
                <View style={styles.placeMeta}>
                  {slot.place.rating ? <Text style={styles.rating}>★ {slot.place.rating}</Text> : null}
                  {slot.isAIFilled ? (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiText}>AI 추천</Text>
                    </View>
                  ) : null}
                  {slot.durationMin ? <Text style={styles.duration}>약 {slot.durationMin}분</Text> : null}
                </View>
              </View>
              <Pressable onPress={onRemove} style={styles.removeButton}>
                <Ionicons name="close" size={16} color={Colors.textThird} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>{info.description}</Text>
              <Ionicons name="add-circle-outline" size={19} color={Colors.primary} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  spine: {
    width: 46,
    alignItems: "center",
    paddingTop: 6,
  },
  time: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecond,
    marginBottom: 5,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  line: {
    flex: 1,
    width: 1.5,
    minHeight: 28,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  cardWrap: {
    flex: 1,
    paddingBottom: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
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
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  placeAddress: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 3,
  },
  placeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 7,
    flexWrap: "wrap",
  },
  rating: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: "800",
  },
  aiBadge: {
    backgroundColor: Colors.aiBg,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  aiText: {
    fontSize: 10,
    color: Colors.aiText,
    fontWeight: "800",
  },
  duration: {
    fontSize: 11,
    color: Colors.textThird,
  },
  removeButton: {
    padding: 4,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  emptyText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textThird,
    lineHeight: 18,
  },
  timeBlocked: {
    color: Colors.textThird,
  },
  dotBlocked: {
    backgroundColor: Colors.border,
    borderColor: Colors.bg,
  },
  cardBlocked: {
    backgroundColor: Colors.bg,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  blockedText: {
    fontSize: 12,
    color: Colors.textThird,
    fontWeight: "700",
  },
});
