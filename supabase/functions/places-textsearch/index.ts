import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { googleGet } from "../_shared/google.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const query = url.searchParams.get("query");
  if (!query) {
    return jsonResponse({ results: [] });
  }

  return googleGet("textsearch/json", {
    query,
    location: url.searchParams.get("location") ?? undefined,
    radius: url.searchParams.get("radius") ?? undefined,
  });
});
