import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// In-app browser 인증 세션이 완료된 후 처리
WebBrowser.maybeCompleteAuthSession();

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

function getRedirectTo(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/`;
  }
  // 네이티브: app scheme. nadl2:// 로 시작
  return Linking.createURL("/auth-callback");
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
    },
  });
  return {
    user: data.user,
    session: data.session,
    error: error?.message ?? null,
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return {
    user: data.user,
    session: data.session,
    error: error?.message ?? null,
  };
}

export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const redirectTo = getRedirectTo();

  // Web 에서는 브라우저가 자동으로 OAuth URL 로 이동 → 콜백 후 Supabase 가 세션 자동 처리
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    return { error: error?.message ?? null };
  }

  // 네이티브: 직접 in-app 브라우저 열고 콜백 URL 받아서 세션 set
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) return { error: error.message };
  if (!data?.url) return { error: "OAuth URL을 받지 못했어요" };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success" || !result.url) {
    return { error: result.type === "cancel" ? null : "로그인이 취소되었어요" };
  }

  // 콜백 URL 에서 토큰 추출
  // 형식 예: nadl2://auth-callback#access_token=xxx&refresh_token=yyy&...
  const fragment = result.url.includes("#")
    ? result.url.split("#")[1]
    : result.url.includes("?")
      ? result.url.split("?")[1]
      : "";

  const params = new URLSearchParams(fragment);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) {
    return { error: "콜백에서 토큰을 찾지 못했어요" };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  return { error: sessionError?.message ?? null };
}
