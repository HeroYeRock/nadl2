import "react-native-gesture-handler";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Colors } from "@/constants/colors";
import { getCurrentSession, onAuthChange } from "@/services/auth";
import { useTripStore } from "@/stores/tripStore";
import type { Session } from "@supabase/supabase-js";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    getCurrentSession().then((s) => {
      setSession(s);
      setReady(true);
    });
    return onAuthChange((s) => setSession(s));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const first = segments[0];
    const inAuthGroup = first === "login";
    const inCallback = first === "auth-callback";
    const inShare = first === "share";

    // 콜백 라우트는 세션 유무와 무관하게 통과 (OAuth 토큰 처리해야 함)
    if (inCallback) return;
    // 공유 보기 페이지는 로그인 없이 누구나 볼 수 있어야 함
    if (inShare) return;

    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [ready, session, segments]);

  useEffect(() => {
    if (session) {
      useTripStore.getState().syncFromCloud();
    } else {
      useTripStore.getState().clearLocal();
    }
  }, [session?.user.id]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="share" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip/new" options={{ presentation: "card" }} />
        <Stack.Screen name="trip/[id]/index" />
        <Stack.Screen name="trip/[id]/timeline" />
        <Stack.Screen name="trip/[id]/add-place" options={{ presentation: "modal" }} />
        <Stack.Screen name="dev/test" />
      </Stack>
    </GestureHandlerRootView>
  );
}
