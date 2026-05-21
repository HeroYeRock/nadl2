import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Colors } from "@/constants/colors";

interface Props {
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NewTripCard({ onPress }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      style={[styles.card, animatedStyle]}
    >
      <View style={styles.iconBox}>
        <Ionicons name="map-outline" size={28} color="white" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>새 여행 만들기</Text>
        <Text style={styles.subtitle}>가고 싶은 곳만 고르면 빈 시간은 AI가 채워요</Text>
      </View>
      <View style={styles.arrow}>
        <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  title: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
});
