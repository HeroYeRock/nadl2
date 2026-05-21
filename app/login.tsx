import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { signIn, signInWithGoogle, signUp } from "@/services/auth";

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function continueWithGoogle() {
    setError(null);
    setInfo(null);
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (result.error) {
      setError(result.error);
    }
    // 성공 시 OAuth 페이지로 리다이렉트 (브라우저). 콜백 후 세션은 자동.
  }

  async function submit() {
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setBusy(true);
    const result =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, displayName.trim() || undefined);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "signup" && !result.session) {
      setInfo("가입 확인 메일을 보냈어요. 메일함을 확인해주세요.");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { paddingTop: insets.top + 40 }]}
    >
      <Text style={styles.title}>Nadl2</Text>
      <Text style={styles.subtitle}>
        {mode === "signin" ? "로그인하고 일정을 동기화하세요" : "이메일로 가입하기"}
      </Text>

      {mode === "signup" && (
        <TextInput
          style={styles.input}
          placeholder="닉네임 (선택)"
          placeholderTextColor={Colors.textThird}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="none"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor={Colors.textThird}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호 (6자 이상)"
        placeholderTextColor={Colors.textThird}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {mode === "signin" ? "로그인" : "가입하기"}
          </Text>
        )}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>또는</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        onPress={continueWithGoogle}
        disabled={googleBusy}
        style={[styles.googleBtn, googleBusy && { opacity: 0.6 }]}
      >
        {googleBusy ? (
          <ActivityIndicator color={Colors.textPrimary} />
        ) : (
          <>
            <Ionicons name="logo-google" size={16} color="#DB4437" />
            <Text style={styles.googleBtnText}>Google로 계속하기</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
        style={styles.switchBtn}
      >
        <Text style={styles.switchText}>
          {mode === "signin"
            ? "계정이 없으신가요? 가입하기"
            : "이미 계정이 있어요. 로그인"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecond,
    marginBottom: 28,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  error: {
    color: Colors.error,
    fontSize: 13,
    marginVertical: 6,
  },
  info: {
    color: Colors.info,
    fontSize: 13,
    marginVertical: 6,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  switchBtn: {
    alignItems: "center",
    paddingVertical: 16,
  },
  switchText: {
    color: Colors.textSecond,
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textThird,
    fontSize: 12,
    fontWeight: "700",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 13,
  },
  googleBtnText: {
    color: Colors.textPrimary,
    fontWeight: "800",
    fontSize: 14,
  },
});
