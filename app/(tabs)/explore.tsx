import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { badgeFor } from "@/services/popularity";
import { supabase } from "@/services/supabase";

interface PopularPlace {
  placeId: string;
  name: string;
  address: string | null;
  selectionCount: number;
  lastSelectedAt: string | null;
}

interface DestinationGroup {
  destination: string;
  count: number;
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<PopularPlace[]>([]);
  const [destinations, setDestinations] = useState<DestinationGroup[]>([]);
  const [activeDestination, setActiveDestination] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // 1) 인기 destination 집계 (전체 선택 수 기준)
    const { data: destRows } = await supabase
      .from("place_selections")
      .select("destination")
      .not("destination", "is", null);

    const tally = new Map<string, number>();
    for (const row of destRows ?? []) {
      const d = (row as any).destination as string | null;
      if (!d) continue;
      tally.set(d, (tally.get(d) ?? 0) + 1);
    }
    const destList: DestinationGroup[] = Array.from(tally.entries())
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count);
    setDestinations(destList);

    // 2) 인기 장소 목록
    let query = supabase
      .from("place_popularity")
      .select("place_id, name, address, selection_count, last_selected_at")
      .order("selection_count", { ascending: false })
      .limit(30);

    if (activeDestination) {
      // destination 필터를 view 가 안 가지고 있어서 place_selections 에서 place_id 들을 먼저 추림
      const { data: filteredIds } = await supabase
        .from("place_selections")
        .select("place_id")
        .eq("destination", activeDestination);
      const ids = Array.from(new Set((filteredIds ?? []).map((r: any) => r.place_id)));
      if (ids.length === 0) {
        setPlaces([]);
        setLoading(false);
        return;
      }
      query = query.in("place_id", ids);
    }

    const { data } = await query;
    setPlaces(
      (data ?? []).map((row: any) => ({
        placeId: row.place_id,
        name: row.name,
        address: row.address,
        selectionCount: row.selection_count,
        lastSelectedAt: row.last_selected_at,
      })),
    );
    setLoading(false);
  }, [activeDestination]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openInMaps(place: PopularPlace) {
    const q = encodeURIComponent(`${place.name} ${place.address ?? ""}`.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.placeId}`).catch(() => {});
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <Text style={styles.title}>탐색</Text>
      <Text style={styles.subtitle}>다른 여행자가 가장 많이 담은 장소</Text>

      {destinations.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setActiveDestination(null)}
            style={[styles.chip, !activeDestination && styles.chipActive]}
          >
            <Text style={[styles.chipText, !activeDestination && styles.chipTextActive]}>
              전체
            </Text>
          </Pressable>
          {destinations.map((d) => {
            const active = activeDestination === d.destination;
            return (
              <Pressable
                key={d.destination}
                onPress={() => setActiveDestination(d.destination)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {d.destination} · {d.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && places.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : places.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="compass-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeDestination ? `${activeDestination}에 추가된 장소가 없어요` : "아직 인기 장소가 부족해요"}
            </Text>
            <Text style={styles.emptyCopy}>
              여러 사용자가 일정에 추가할수록 여기에 모입니다. {"\n"}
              친구와 함께 사용해보세요.
            </Text>
          </View>
        ) : (
          places.map((place, index) => {
            const badge = badgeFor(place.selectionCount);
            const isFirst = index === 0 && place.selectionCount > 0;
            return (
              <Pressable
                key={place.placeId}
                onPress={() => openInMaps(place)}
                style={styles.card}
              >
                <View style={[styles.rank, isFirst && styles.rankTop]}>
                  <Text style={[styles.rankText, isFirst && styles.rankTextTop]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    {badge ? (
                      <View
                        style={[
                          styles.badge,
                          badge === "인기" ? styles.badgePopular : styles.badgeRecommend,
                        ]}
                      >
                        <Text style={styles.badgeText}>{badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  {place.address ? (
                    <Text style={styles.cardAddress} numberOfLines={1}>
                      {place.address}
                    </Text>
                  ) : null}
                  <View style={styles.cardMeta}>
                    <Ionicons name="people-outline" size={12} color={Colors.textThird} />
                    <Text style={styles.cardMetaText}>
                      {place.selectionCount}명이 일정에 담음
                    </Text>
                  </View>
                </View>
                <Ionicons name="open-outline" size={18} color={Colors.textThird} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: Colors.textPrimary,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecond,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  chips: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.dark,
    borderColor: Colors.dark,
  },
  chipText: {
    fontSize: 12,
    color: Colors.textSecond,
    fontWeight: "800",
  },
  chipTextActive: {
    color: "white",
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  center: {
    padding: 40,
    alignItems: "center",
  },
  empty: {
    paddingHorizontal: 30,
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#FFF3EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecond,
    textAlign: "center",
    marginTop: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTop: {
    backgroundColor: Colors.primary,
  },
  rankText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.textSecond,
  },
  rankTextTop: {
    color: "white",
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRecommend: { backgroundColor: "#FFF3EE" },
  badgePopular: { backgroundColor: "#FFE8E8" },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: Colors.error,
  },
  cardAddress: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  cardMetaText: {
    fontSize: 11,
    color: Colors.textThird,
    fontWeight: "700",
  },
});
