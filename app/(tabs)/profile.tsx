import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { getCurrentSession, signOut } from "@/services/auth";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getCurrentSession().then((s) => setEmail(s?.user.email ?? null));
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>설정</Text>

      <View style={styles.card}>
        <Ionicons name="person-circle-outline" size={22} color={Colors.primary} />
        <View style={styles.copy}>
          <Text style={styles.label}>계정</Text>
          <Text style={styles.value}>{email ?? "로그인 정보 없음"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Ionicons name="cloud-outline" size={22} color={Colors.primary} />
        <View style={styles.copy}>
          <Text style={styles.label}>백엔드</Text>
          <Text style={styles.value}>Supabase (Auth + DB + Edge Functions)</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Ionicons name="sparkles-outline" size={22} color={Colors.primary} />
        <View style={styles.copy}>
          <Text style={styles.label}>AI 추천</Text>
          <Text style={styles.value}>Groq via Edge Function</Text>
        </View>
      </View>

      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={styles.signOutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: Colors.textPrimary,
    marginBottom: 18,
  },
  card: {
    borderRadius: 8,
    backgroundColor: Colors.card,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  copy: { flex: 1 },
  label: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  value: {
    fontSize: 13,
    color: Colors.textSecond,
    marginTop: 3,
  },
  signOut: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: {
    color: Colors.error,
    fontWeight: "900",
    fontSize: 14,
  },
});
