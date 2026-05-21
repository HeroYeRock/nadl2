import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { googleGet } from "../_shared/google.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const location = url.searchParams.get("location");
  if (!location) {
    return jsonResponse({ error: "missing_location" }, 400);
  }

  return googleGet("nearbysearch/json", {
    location,
    radius: url.searchParams.get("radius") ?? "1200",
    type: url.searchParams.get("type") ?? "tourist_attraction",
  });
});
