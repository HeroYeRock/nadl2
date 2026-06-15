import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { parseYMD, toYMD } from "@/services/dates";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  /** 선택된 날짜 "YYYY-MM-DD" */
  value?: string;
  onChange: (ymd: string) => void;
}

/**
 * 외부 의존성 없이 동작하는 가벼운 달력. 월 단위로 넘기며 날짜 하나를 고른다.
 * 웹/iOS/안드로이드 모두 동일하게 렌더링된다.
 */
export function CalendarPicker({ value, onChange }: Props) {
  const selected = useMemo(() => parseYMD(value), [value]);
  const [view, setView] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const selectedYMD = toYMD(selected);
  const todayYMD = toYMD(new Date());

  const shiftMonth = (delta: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {view.getFullYear()}년 {view.getMonth() + 1}월
        </Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={w} style={[styles.weekday, i === 0 && styles.sun, i === 6 && styles.sat]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`empty-${i}`} style={styles.cell} />;
          const ymd = toYMD(d);
          const isSelected = ymd === selectedYMD;
          const isToday = ymd === todayYMD;
          const dow = d.getDay();
          return (
            <Pressable key={ymd} style={styles.cell} onPress={() => onChange(ymd)}>
              <View style={[styles.dayDot, isSelected && styles.daySelected]}>
                <Text
                  style={[
                    styles.dayText,
                    dow === 0 && styles.sun,
                    dow === 6 && styles.sat,
                    isToday && !isSelected && styles.todayText,
                    isSelected && styles.daySelectedText,
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: { fontSize: 16, fontWeight: "900", color: Colors.textPrimary },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textSecond,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: { backgroundColor: Colors.primary },
  dayText: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  daySelectedText: { color: "white", fontWeight: "900" },
  todayText: { color: Colors.primary, fontWeight: "900" },
  sun: { color: "#FF3B30" },
  sat: { color: "#0A84FF" },
});
