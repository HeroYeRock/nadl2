import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="compass-outline" size={30} color={Colors.primary} />
      </View>
      <Text style={styles.title}>탐색 준비 중</Text>
      <Text style={styles.copy}>지역별 추천 코스와 인기 장소를 모아 보여줄 화면입니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
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
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecond,
    textAlign: "center",
    marginTop: 8,
  },
});
