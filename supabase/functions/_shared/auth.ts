// Edge Functions은 기본적으로 Supabase JWT 검증을 자동 처리.
// (supabase functions deploy 시 --no-verify-jwt 가 아니면 발급된 토큰만 통과)
// 추가로 user_id가 필요하면 여기서 추출.

export function getUserIdFromAuthHeader(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}
