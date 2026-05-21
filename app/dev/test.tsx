import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { pingServer, searchPlaces, textSearchPlaces } from "@/services/api";

type Log = {
  title: string;
  body: string;
  ok: boolean;
};

export default function DevTestScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  function addLog(log: Log) {
    setLogs((items) => [log, ...items]);
  }

  async function runPing() {
    setLoading("ping");
    const result = await pingServer();
    setLoading(null);
    addLog({
      title: "Proxy ping",
      ok: Boolean(result?.status === "ok"),
      body: JSON.stringify(result, null, 2),
    });
  }

  async function runAutocomplete() {
    setLoading("autocomplete");
    const result = await searchPlaces("도쿄타워");
    setLoading(null);
    addLog({
      title: "Google Places autocomplete",
      ok: result.length > 0,
      body: JSON.stringify(result.slice(0, 3), null, 2),
    });
  }

  async function runTextSearch() {
    setLoading("text");
    const result = await textSearchPlaces("도쿄 점심 맛집");
    setLoading(null);
    addLog({
      title: "Google Places text search",
      ok: result.length > 0,
      body: JSON.stringify(result.slice(0, 3), null, 2),
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>API 테스트</Text>
      <Text style={styles.copy}>cafe24 프록시, Google Places, Groq 연결 상태를 빠르게 확인합니다.</Text>

      <View style={styles.actions}>
        <TestButton label="프록시" icon="server-outline" loading={loading === "ping"} onPress={runPing} />
        <TestButton label="장소 자동완성" icon="search-outline" loading={loading === "autocomplete"} onPress={runAutocomplete} />
        <TestButton label="장소 검색" icon="map-outline" loading={loading === "text"} onPress={runTextSearch} />
      </View>

      <ScrollView style={styles.logList} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {logs.map((log, index) => (
          <View key={`${log.title}-${index}`} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Ionicons name={log.ok ? "checkmark-circle" : "warning-outline"} size={18} color={log.ok ? Colors.success : Colors.warning} />
              <Text style={styles.logTitle}>{log.title}</Text>
            </View>
            <Text style={styles.logBody}>{log.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function TestButton({
  label,
  icon,
  loading,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.testButton}>
      {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name={icon} size={19} color={Colors.primary} />}
      <Text style={styles.testButtonText}>{label}</Text>
    </Pressable>
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
  },
  copy: {
    fontSize: 14,
    color: Colors.textSecond,
    lineHeight: 21,
    marginTop: 7,
  },
  actions: {
    gap: 10,
    marginTop: 20,
  },
  testButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
  },
  testButtonText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: "900",
  },
  logList: {
    marginTop: 18,
  },
  logCard: {
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  logBody: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecond,
    fontFamily: "Courier",
  },
});
