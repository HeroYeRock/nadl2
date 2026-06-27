import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { googleKey } from "../_shared/google.ts";

const FOOD_TYPES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "meal_takeaway",
  "meal_delivery",
  "food",
]);

const ATTRACTION_TYPES = new Set([
  "tourist_attraction",
  "museum",
  "park",
  "art_gallery",
  "amusement_park",
  "aquarium",
  "zoo",
  "landmark",
  "point_of_interest",
  "shopping_mall",
  "department_store",
]);

const NEW_API_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "priceRange",
  "types",
  "photos",
  "currentOpeningHours.openNow",
  "regularOpeningHours.openNow",
  "editorialSummary",
  "reviews",
].join(",");

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const placeId = url.searchParams.get("place_id");
  const wantInsights = url.searchParams.get("insights") !== "0";
  if (!placeId) {
    return jsonResponse({ error: "missing_place_id" }, 400);
  }

  // 1) Places API (New) detail 시도, 실패하면 Legacy 폴백
  let result: any = null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ko`,
      {
        headers: {
          "X-Goog-Api-Key": googleKey(),
          "X-Goog-FieldMask": NEW_API_FIELD_MASK,
        },
      },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.id) result = transformToLegacy(data);
    } else if (res.status !== 403 && res.status !== 404) {
      // 403 (API not enabled) / 404 외에는 에러로 처리
      const data = await res.json().catch(() => ({}));
      return jsonResponse(
        { error: "upstream_error", status: res.status, detail: data },
        502,
      );
    }
  } catch (error) {
    // 네트워크 에러는 폴백 시도
    console.error("[place-detail] new API failed:", error);
  }

  // Legacy 폴백 (priceRange 없음)
  if (!result) {
    result = await fetchLegacyDetail(placeId);
    if (!result) {
      return jsonResponse({ error: "place_not_found" }, 404);
    }
  }

  // 2) (옵션) Groq 인사이트
  let insights: {
    summary?: string;
    menus?: string[];
    highlights?: string[];
  } | null = null;

  if (wantInsights) {
    insights = await buildInsights(result);
  }

  return jsonResponse({
    result: {
      ...result,
      insights,
    },
  });
});

async function fetchLegacyDetail(placeId: string): Promise<any | null> {
  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "geometry",
    "rating",
    "user_ratings_total",
    "price_level",
    "opening_hours",
    "photos",
    "types",
    "editorial_summary",
    "reviews",
  ].join(",");

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", fields);
  url.searchParams.set("language", "ko");
  url.searchParams.set("key", googleKey());

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.result) return null;
    return data.result;
  } catch (error) {
    console.error("[place-detail] legacy fetch failed:", error);
    return null;
  }
}

function transformToLegacy(p: any): any {
  const photos = Array.isArray(p.photos)
    ? p.photos.map((ph: any) => ({ photo_reference: ph.name }))
    : [];

  const openNow =
    p.currentOpeningHours?.openNow ?? p.regularOpeningHours?.openNow;

  const reviews = Array.isArray(p.reviews)
    ? p.reviews.map((r: any) => ({
        rating: r.rating,
        text: r.text?.text ?? r.originalText?.text ?? "",
        time: r.publishTime,
      }))
    : [];

  return {
    place_id: p.id,
    name: p.displayName?.text ?? "",
    formatted_address: p.formattedAddress,
    geometry: p.location
      ? { location: { lat: p.location.latitude, lng: p.location.longitude } }
      : undefined,
    rating: p.rating,
    user_ratings_total: p.userRatingCount,
    price_level: priceLevelToNumber(p.priceLevel),
    price_range_text: formatPriceRange(p.priceRange),
    opening_hours: openNow !== undefined ? { open_now: openNow } : undefined,
    photos,
    types: Array.isArray(p.types) ? p.types : [],
    editorial_summary: p.editorialSummary?.text
      ? { overview: p.editorialSummary.text }
      : undefined,
    reviews,
  };
}

function priceLevelToNumber(level: unknown): number | undefined {
  switch (level) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return undefined;
  }
}

function currencySymbol(code?: string): string {
  switch (code) {
    case "JPY":
      return "¥";
    case "KRW":
      return "₩";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "CNY":
      return "¥";
    case "TWD":
      return "NT$";
    case "HKD":
      return "HK$";
    case "GBP":
      return "£";
    case "AUD":
      return "A$";
    case "CAD":
      return "C$";
    case "SGD":
      return "S$";
    case "THB":
      return "฿";
    case "VND":
      return "₫";
    default:
      return code ? `${code} ` : "";
  }
}

function formatPriceRange(pr: any): string | undefined {
  if (!pr) return undefined;
  const start = pr.startPrice;
  const end = pr.endPrice;
  if (!start && !end) return undefined;

  const code = start?.currencyCode ?? end?.currencyCode;
  const sym = currencySymbol(code);

  const startNum = start?.units ? Number(start.units) : null;
  const endNum = end?.units ? Number(end.units) : null;
  const fmt = (n: number) => `${sym}${n.toLocaleString()}`;

  if (startNum != null && endNum != null) return `${fmt(startNum)}~${fmt(endNum)}`;
  if (endNum != null) return `~${fmt(endNum)}`;
  if (startNum != null) return `${fmt(startNum)}~`;
  return undefined;
}

async function buildInsights(result: any): Promise<{
  summary?: string;
  menus?: string[];
  highlights?: string[];
} | null> {
  const groqKey = Deno.env.get("GROQ_KEY");
  const groqModel = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-20b";
  if (!groqKey) return null;
  // gpt-oss 등 추론 모델은 reasoning 토큰을 소모하므로 effort 를 낮춰 JSON 응답 확보
  const supportsReasoning = groqModel.includes("gpt-oss");

  const types: string[] = Array.isArray(result.types) ? result.types : [];
  const isFood = types.some((t) => FOOD_TYPES.has(t));
  const isAttraction = !isFood && types.some((t) => ATTRACTION_TYPES.has(t));

  const editorial = result.editorial_summary?.overview ?? "";
  const reviewsText = Array.isArray(result.reviews)
    ? result.reviews
        .slice(0, 4)
        .map((r: any) => `(${r.rating}★) ${(r.text ?? "").slice(0, 220)}`)
        .join("\n")
    : "";

  const formatHint = isFood
    ? '{"summary":"1줄 소개","menus":["메뉴1","메뉴2","메뉴3"]}'
    : isAttraction
      ? '{"summary":"1줄 소개","highlights":["볼거리1","볼거리2","볼거리3"]}'
      : '{"summary":"1줄 소개"}';

  const prompt =
    "다음 장소를 한국어 1줄로 소개하고, " +
    (isFood
      ? "식당/카페면 추천 메뉴 3개"
      : isAttraction
        ? "관광지면 주요 볼거리/체험 포인트 3개"
        : "특징 1줄") +
    "를 정리하세요.\n반드시 JSON만 반환. 정보가 부족하면 빈 배열/빈 문자열로.\n\n" +
    `이름: ${result.name ?? ""}\n` +
    `유형: ${types.join(", ")}\n` +
    `평점: ${result.rating ?? "?"} (${result.user_ratings_total ?? 0}건)\n` +
    `가격대: ${result.price_range_text ?? "(미공개)"}\n` +
    `Google 설명: ${editorial || "(없음)"}\n` +
    `리뷰 일부:\n${reviewsText || "(리뷰 없음)"}\n\n` +
    `응답 형식: ${formatHint}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          {
            role: "system",
            content:
              "당신은 여행 가이드 AI입니다. 장소 정보를 짧고 정확하게 한국어로 요약합니다. 반드시 JSON으로만 답합니다.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_completion_tokens: 1024,
        response_format: { type: "json_object" },
        ...(supportsReasoning ? { reasoning_effort: "low" } : {}),
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    const sanitizeStrArr = (v: unknown): string[] | undefined => {
      if (!Array.isArray(v)) return undefined;
      const out = v
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3);
      return out.length > 0 ? out : undefined;
    };

    return {
      summary: typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : editorial || undefined,
      menus: isFood ? sanitizeStrArr(parsed.menus) : undefined,
      highlights: isAttraction ? sanitizeStrArr(parsed.highlights) : undefined,
    };
  } catch {
    return null;
  }
}
