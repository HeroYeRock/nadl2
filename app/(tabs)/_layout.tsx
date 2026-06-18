import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

function TabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.activeIcon]}>
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}

// 기본 라벨은 numberOfLines={1} 로 overflow:hidden 이 걸려 웹에서 한글 받침(예: "홈"의 ㅁ)이 잘린다.
// 커스텀 Text 로 렌더해 클리핑을 없앤다.
function TabLabel({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.tabLabel, { color }]}>{label}</Text>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // 웹은 safe-area inset 이 0 이라 라벨이 화면/브라우저 하단 바에 바짝 붙는다. 최소 여백 확보.
  const bottomInset = Math.max(insets.bottom, Platform.OS === "web" ? 18 : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textThird,
        tabBarLabelPosition: "below-icon",
        tabBarStyle: {
          height: 60 + bottomInset + 8,
          paddingTop: 8,
          paddingBottom: bottomInset + 8,
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
          tabBarLabel: ({ color }) => <TabLabel label="홈" color={color} />,
          tabBarIcon: ({ color, focused }) => <TabIcon name="home-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "탐색",
          tabBarLabel: ({ color }) => <TabLabel label="탐색" color={color} />,
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
              style={[styles.createButton, { bottom: bottomInset + 10 }]}
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
          tabBarLabel: ({ color }) => <TabLabel label="내 여행" color={color} />,
          tabBarIcon: ({ color, focused }) => <TabIcon name="albums-outline" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "설정",
          tabBarLabel: ({ color }) => <TabLabel label="설정" color={color} />,
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
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
    marginTop: 2,
    paddingBottom: 1,
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
