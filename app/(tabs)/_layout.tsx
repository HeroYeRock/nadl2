import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

function TabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.activeIcon]}>
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textThird,
        // 웹/넓은 화면에서 라벨이 아이콘 옆으로 붙어 잘리는 것을 막고 항상 아래로 고정
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: "rgba(255,255,255,0.96)",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, focused }) => <TabIcon name="home-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "탐색",
          tabBarIcon: ({ color, focused }) => <TabIcon name="compass-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="new-trip"
        options={{
          title: "",
          tabBarButton: () => (
            <Pressable
              accessibilityLabel="새 여행 만들기"
              onPress={() => router.push("/trip/new")}
              style={[styles.createButton, { bottom: insets.bottom + 10 }]}
            >
              <Ionicons name="add" size={30} color="white" />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "내 여행",
          tabBarIcon: ({ color, focused }) => <TabIcon name="albums-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "설정",
          tabBarIcon: ({ color, focused }) => <TabIcon name="person-outline" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIcon: {
    transform: [{ translateY: -1 }],
  },
  createButton: {
    position: "absolute",
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
});
