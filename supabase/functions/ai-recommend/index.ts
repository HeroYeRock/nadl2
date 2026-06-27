import { handlePreflight, jsonResponse } from "../_shared/cors.ts";

interface RecommendBody {
  destination?: string;
  region?: string;
  theme?: string;
  day?: number | string;
  day_area?: string;
  slot_label?: string;
  slot_time?: string;
  slot_desc?: string;
  filled_places?: string;
  used_places_in_trip?: string;
  candidates?: unknown[];
}

function normalizePicks(raw: unknown, candidatesLen: number): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: number[] = [];

  for (const pick of arr) {
    if (typeof pick === "number" && Number.isInteger(pick)) {
      out.push(pick);
      continue;
    }
    if (typeof pick === "string") {
      const trimmed = pick.trim();
      if (/^\d+$/.test(trimmed) && trimmed.length > 1) {
        for (const digit of trimmed) out.push(parseInt(digit, 10));
      } else if (/^-?\d+$/.test(trimmed)) {
        out.push(parseInt(trimmed, 10));
      }
    }
  }

  const filtered = out.filter((p) => Number.isInteger(p) && p >= 0 && p < candidatesLen);
  const unique = Array.from(new Set(filtered)).slice(0, 5);
  return unique.length ? unique : [0, 1, 2].filter((i) => i < candidatesLen);
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: RecommendBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (candidates.length === 0) {
    return jsonResponse({ picks: [], reason: "추천 후보가 없습니다." });
  }

  const groqKey = Deno.env.get("GROQ_KEY");
  const groqModel = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-20b";
  // gpt-oss 등 추론 모델은 reasoning 토큰을 소모하므로 effort 를 낮춰 JSON 응답 확보
  const supportsReasoning = groqModel.includes("gpt-oss");
  if (!groqKey) {
    return jsonResponse({ error: "missing_groq_key" }, 500);
  }

  const prompt =
    "다음 여행 후보 중 시간대와 동선에 맞는 상위 4~5개 index를 골라주세요.\n" +
    "각 일자(day)는 서로 다른 권역으로 구성되어야 하며, 'trip 전체에서 이미 쓴 장소'와 중복되거나 매우 유사한 후보는 절대 고르지 마세요.\n" +
    '반드시 JSON만 반환하세요. 형식: {"picks":[0,1,2,3],"reason":"한국어 이유 한 문장"}\n\n' +
    `목적지: ${body.destination ?? ""}\n` +
    `지역: ${body.region ?? ""}\n` +
    `테마: ${body.theme ?? ""}\n` +
    `일차: ${body.day ?? ""}\n` +
    `오늘의 권역: ${body.day_area ?? "(미지정)"}\n` +
    `시간대: ${body.slot_label ?? ""} ${body.slot_time ?? ""}\n` +
    `시간대 설명: ${body.slot_desc ?? ""}\n` +
    `같은 날 이미 확정된 장소: ${body.filled_places ?? ""}\n` +
    `여행 전체에서 이미 쓴 장소(중복 금지): ${body.used_places_in_trip ?? "없음"}\n` +
    `후보: ${JSON.stringify(candidates)}`;

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
              "당신은 초보 여행자를 위한 모바일 여행 플래너 AI입니다. 동선, 시간대, 평점, 영업상태를 보고 추천합니다. JSON만 반환합니다.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_completion_tokens: 1024,
        response_format: { type: "json_object" },
        ...(supportsReasoning ? { reasoning_effort: "low" } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return jsonResponse(
        { error: "groq_error", status: res.status, detail: data },
        502,
      );
    }

    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { picks?: unknown; reason?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return jsonResponse({
        picks: [0, 1, 2].filter((i) => i < candidates.length),
        reason: "가까운 후보를 우선으로 골랐어요.",
        raw: content,
      });
    }

    const picks = normalizePicks(parsed.picks, candidates.length);
    const reason = typeof parsed.reason === "string" && parsed.reason
      ? parsed.reason
      : "시간대와 동선에 맞는 후보를 골랐어요.";

    return jsonResponse({ picks, reason });
  } catch (error) {
    return jsonResponse({ error: "request_failed", detail: String(error) }, 502);
  }
});
