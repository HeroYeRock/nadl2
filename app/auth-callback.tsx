import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import { supabase } from "@/services/supabase";

/**
 * OAuth 콜백 핸들러.
 * Supabase 가 nadl2://auth-callback#access_token=... 으로 리다이렉트하면
 * OS 가 이 라우트로 앱을 deep-link 진입시킴. URL 의 fragment 에서
 * access/refresh 토큰을 꺼내 setSession 후 홈으로 이동.
 */
export default function AuthCallbackScreen() {
  const [message, setMessage] = useState("로그인 처리 중…");

  useEffect(() => {
    let cancelled = false;

    async function handle() {
      try {
        let url: string | null = null;

        if (Platform.OS === "web" && typeof window !== "undefined") {
          url = window.location.href;
        } else {
          url = await Linking.getInitialURL();
        }

        if (!url) {
          setMessage("콜백 URL 을 받지 못했어요");
          setTimeout(() => router.replace("/login"), 1500);
          return;
        }

        // fragment (#) 또는 query (?) 둘 다 처리
        let raw = "";
        const hashIdx = url.indexOf("#");
        const queryIdx = url.indexOf("?");
        if (hashIdx >= 0) raw = url.substring(hashIdx + 1);
        else if (queryIdx >= 0) raw = url.substring(queryIdx + 1);

        const params = new URLSearchParams(raw);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const errorDesc = params.get("error_description") || params.get("error");

        if (errorDesc) {
          setMessage(`로그인 실패: ${errorDesc}`);
          setTimeout(() => router.replace("/login"), 2000);
          return;
        }

        if (!access_token || !refresh_token) {
          setMessage("토큰을 찾지 못했어요");
          setTimeout(() => router.replace("/login"), 2000);
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (cancelled) return;

        if (error) {
          setMessage(`세션 설정 실패: ${error.message}`);
          setTimeout(() => router.replace("/login"), 2000);
          return;
        }

        // 로그인 성공 → 홈
        router.replace("/(tabs)");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "알 수 없는 오류");
        setTimeout(() => router.replace("/login"), 2000);
      }
    }

    handle();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={Colors.primary} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  text: {
    color: Colors.textSecond,
    fontSize: 14,
    textAlign: "center",
  },
});
