import { router } from "expo-router";
import { Alert, FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TripCard } from "@/components/home/TripCard";
import { Colors } from "@/constants/colors";
import { useTripStore } from "@/stores/tripStore";

function confirmDelete(title: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`'${title}' 일정을 삭제할까요? 되돌릴 수 없어요.`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      "일정 삭제",
      `'${title}' 일정을 삭제할까요? 되돌릴 수 없어요.`,
      [
        { text: "취소", style: "cancel", onPress: () => resolve(false) },
        { text: "삭제", style: "destructive", onPress: () => resolve(true) },
      ],
    );
  });
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const trips = useTripStore((state) => state.trips);
  const deleteTrip = useTripStore((state) => state.deleteTrip);

  async function handleDelete(id: string, title: string) {
    const ok = await confirmDelete(title);
    if (ok) await deleteTrip(id);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>내 여행</Text>
      {trips.length ? (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              showActions
              onPress={() =>
                router.push({ pathname: "/trip/[id]/timeline", params: { id: item.id } })
              }
              onView={() =>
                router.push({ pathname: "/trip/[id]/timeline", params: { id: item.id } })
              }
              onEdit={() => router.push({ pathname: "/trip/[id]", params: { id: item.id } })}
              onDelete={() => handleDelete(item.id, item.title)}
            />
          )}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>아직 만든 여행이 없어요</Text>
          <Text style={styles.emptyCopy}>홈에서 새 여행 만들기를 눌러 첫 일정을 시작해보세요.</Text>
        </View>
      )}
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
    marginBottom: 18,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  emptyCopy: {
    fontSize: 14,
    color: Colors.textSecond,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
});
