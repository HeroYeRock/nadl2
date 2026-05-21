import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

function getRedirectTo(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/`;
  }
  // 네이티브: app scheme. expo-router는 자동으로 처리.
  return "nadl2://auth-callback";
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getRedirectTo(),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  // OAuth 는 브라우저 리다이렉트로 처리 → 세션은 콜백 후 onAuthChange 가 잡음
  return { error: error?.message ?? null };
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
