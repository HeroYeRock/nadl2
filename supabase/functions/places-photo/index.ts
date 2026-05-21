import { corsHeaders, handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { googleKey } from "../_shared/google.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  if (!ref) {
    return jsonResponse({ error: "missing_photo_ref" }, 400);
  }

  const maxwidth = url.searchParams.get("maxwidth") ?? "900";

  // New API photo name 형식: "places/<placeId>/photos/<token>"
  // Legacy 형식: photo_reference 토큰만
  const googleUrl = ref.startsWith("places/")
    ? (() => {
        const u = new URL(`https://places.googleapis.com/v1/${ref}/media`);
        u.searchParams.set("maxHeightPx", maxwidth);
        u.searchParams.set("key", googleKey());
        u.searchParams.set("skipHttpRedirect", "false");
        return u;
      })()
    : (() => {
        const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
        u.searchParams.set("photo_reference", ref);
        u.searchParams.set("maxwidth", maxwidth);
        u.searchParams.set("key", googleKey());
        return u;
      })();

  try {
    const res = await fetch(googleUrl, { redirect: "follow" });
    if (!res.ok) {
      return jsonResponse(
        { error: "photo_fetch_failed", status: res.status },
        502,
      );
    }
    return new Response(res.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return jsonResponse(
      { error: "photo_fetch_failed", detail: String(error) },
      502,
    );
  }
});
