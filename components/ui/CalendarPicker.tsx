import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { parseYMD, toYMD } from "@/services/dates";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Props =
  | {
      mode?: "single";
      /** 선택된 날짜 "YYYY-MM-DD" */
      value?: string;
      onChange: (ymd: string) => void;
    }
  | {
      mode: "range";
      /** 시작일 "YYYY-MM-DD" */
      startDate?: string;
      /** 종료일 "YYYY-MM-DD" (시작일만 고른 상태면 undefined) */
      endDate?: string;
      onRangeChange: (start: string, end?: string) => void;
    };

/**
 * 외부 의존성 없이 동작하는 가벼운 달력. 웹/iOS/안드로이드 모두 동일하게 렌더링된다.
 * - single: 날짜 하나 선택
 * - range: 출발일 → 도착일 순으로 두 번 탭해 기간을 선택 (호텔 예약식)
 */
export function CalendarPicker(props: Props) {
  const isRange = props.mode === "range";
  const anchor = isRange ? props.startDate : props.value;
  const selected = useMemo(() => parseYMD(anchor), [anchor]);
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

  const todayYMD = toYMD(new Date());
  const startYMD = isRange ? props.startDate : props.value;
  const endYMD = isRange ? props.endDate : undefined;

  function handlePress(ymd: string) {
    if (!isRange) {
      props.onChange(ymd);
      return;
    }
    // 시작일이 없거나 이미 기간이 완성된 상태 → 새 선택 시작
    if (!props.startDate || props.endDate) {
      props.onRangeChange(ymd, undefined);
      return;
    }
    // 시작일만 있는 상태 → 도착일 확정 (시작 이전을 고르면 시작일로 재설정)
    if (parseYMD(ymd).getTime() >= parseYMD(props.startDate).getTime()) {
      props.onRangeChange(props.startDate, ymd);
    } else {
      props.onRangeChange(ymd, undefined);
    }
  }

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
          const t = d.getTime();
          const isStart = ymd === startYMD;
          const isEnd = ymd === endYMD;
          const inRange =
            !!startYMD &&
            !!endYMD &&
            t > parseYMD(startYMD).getTime() &&
            t < parseYMD(endYMD).getTime();
          const isEndpoint = isStart || isEnd;
          const isToday = ymd === todayYMD;
          const dow = d.getDay();
          return (
            <View key={ymd} style={styles.cell}>
              {inRange ? <View style={styles.rangeFill} /> : null}
              {isStart && endYMD ? <View style={[styles.rangeFill, styles.rangeHalfRight]} /> : null}
              {isEnd && startYMD !== endYMD ? <View style={[styles.rangeFill, styles.rangeHalfLeft]} /> : null}
              <Pressable style={styles.dayPressable} onPress={() => handlePress(ymd)}>
                <View style={[styles.dayDot, isEndpoint && styles.dayEndpoint]}>
                  <Text
                    style={[
                      styles.dayText,
                      dow === 0 && styles.sun,
                      dow === 6 && styles.sat,
                      isToday && !isEndpoint && styles.todayText,
                      isEndpoint && styles.dayEndpointText,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
              </Pressable>
            </View>
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
  // 기간 사이를 잇는 옅은 배경 (시작/끝 셀은 한쪽만 채워 둥근 끝 모양을 만든다)
  rangeFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFE6DA",
  },
  rangeHalfRight: { left: "50%" }, // 시작 셀: 오른쪽 절반만 채워 끝쪽으로 이어짐
  rangeHalfLeft: { right: "50%" }, // 끝 셀: 왼쪽 절반만 채워 시작쪽에서 이어짐
  dayPressable: { alignItems: "center", justifyContent: "center" },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dayEndpoint: { backgroundColor: Colors.primary },
  dayText: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  dayEndpointText: { color: "white", fontWeight: "900" },
  todayText: { color: Colors.primary, fontWeight: "900" },
  sun: { color: "#FF3B30" },
  sat: { color: "#0A84FF" },
});
