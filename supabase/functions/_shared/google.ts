import { jsonResponse } from "./cors.ts";

const GOOGLE_BASE = "https://maps.googleapis.com/maps/api/place";

export function googleKey(): string {
  const key = Deno.env.get("GOOGLE_PLACES_KEY");
  if (!key) throw new Error("GOOGLE_PLACES_KEY env var is not set");
  return key;
}

export async function googleGet(
  path: string,
  params: Record<string, string | undefined>,
): Promise<Response> {
  const url = new URL(`${GOOGLE_BASE}/${path}`);
  url.searchParams.set("key", googleKey());
  url.searchParams.set("language", params.language ?? "ko");
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "language") url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      return jsonResponse(
        { error: "upstream_error", status: res.status, detail: data },
        502,
      );
    }
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse(
      { error: "request_failed", detail: String(error) },
      502,
    );
  }
}
