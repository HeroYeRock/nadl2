import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  onChangeTime?: (time: string) => void;
  onDelete?: () => void;
  blocked?: boolean;
  blockedReason?: string;
}

function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** 탭하면 시각을 직접 편집할 수 있는 타임라인 좌측 시간 표시 */
function EditableTime({
  time,
  onChangeTime,
  blocked,
}: {
  time: string;
  onChangeTime?: (time: string) => void;
  blocked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(time);

  if (!onChangeTime) {
    return <Text style={[styles.time, blocked && styles.timeBlocked]}>{time}</Text>;
  }

  function commit() {
    setEditing(false);
    if (isValidTime(draft) && draft !== time) onChangeTime?.(draft);
    else setDraft(time);
  }

  if (editing) {
    return (
      <TextInput
        value={draft}
        onChangeText={(t) => setDraft(normalizeTimeInput(t))}
        onBlur={commit}
        onSubmitEditing={commit}
        autoFocus
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        placeholder="HH:MM"
        placeholderTextColor={Colors.textThird}
        style={styles.timeEdit}
      />
    );
  }

  return (
    <Pressable
      onPress={() => {
        setDraft(time);
        setEditing(true);
      }}
      hitSlop={6}
      style={styles.timeTapWrap}
    >
      <Text style={[styles.time, blocked && styles.timeBlocked]}>{time}</Text>
      <Ionicons name="pencil" size={8} color={Colors.textThird} />
    </Pressable>
  );
}

export function TimelineItem({
  slot,
  isLast,
  pinColor,
  onAdd,
  onRemove,
  onChangeTime,
  onDelete,
  blocked,
  blockedReason,
}: Props) {
  const info = getSlotInfo(slot.slot);
  const isCustom = isCustomSlotId(slot.slot);
  const badgeLabel = isCustom && slot.customLabel ? slot.customLabel : info.label;

  if (blocked && !slot.place) {
    return (
      <Animated.View entering={FadeInDown.duration(220)} style={styles.row}>
        <View style={styles.spine}>
          <EditableTime time={slot.time} onChangeTime={onChangeTime} blocked />
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
              {isCustom && onDelete ? (
                <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteInline}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.row}>
      <View style={styles.spine}>
        <EditableTime time={slot.time} onChangeTime={onChangeTime} />
        <View style={[styles.dot, { backgroundColor: slot.place ? pinColor : Colors.borderLight }]} />
        {!isLast ? <View style={styles.line} /> : null}
      </View>

      <Pressable onPress={slot.place ? undefined : onAdd} style={styles.cardWrap}>
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: info.bgColor }]}>
              <Ionicons name={info.icon as any} size={12} color={info.color} />
              <Text style={[styles.badgeText, { color: info.color }]}>{badgeLabel}</Text>
            </View>
            {isCustom && onDelete ? (
              <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color={Colors.error} />
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            ) : null}
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
              {!isCustom ? (
                <Pressable onPress={onRemove} style={styles.removeButton}>
                  <Ionicons name="close" size={16} color={Colors.textThird} />
                </Pressable>
              ) : null}
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
  timeTapWrap: {
    alignItems: "center",
    gap: 1,
    marginBottom: 3,
  },
  timeEdit: {
    width: 44,
    fontSize: 11,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 0,
    marginBottom: 4,
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
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#FFE8E8",
  },
  deleteText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.error,
  },
  deleteInline: {
    marginLeft: "auto",
    padding: 2,
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
