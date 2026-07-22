import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { explainMealRecommendations } from "./explanation.js";
import type { RankedMealRecommendation } from "./types.js";

const originalEnv = {
  AI_MAX_TOKENS: env.AI_MAX_TOKENS,
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  GEMINI_BASE_URL: env.GEMINI_BASE_URL,
  GEMINI_MODEL: env.GEMINI_MODEL
};

function recommendation(key: string, name = "Phở chay"): RankedMealRecommendation {
  return {
    key,
    source: "curated",
    name,
    description: "Nước dùng nóng, rau củ và đậu hũ.",
    ingredients: ["bánh phở", "đậu hũ"],
    steps: [],
    tags: ["ấm bụng"],
    diets: ["vegetarian"],
    goals: ["balanced"],
    mealPeriods: ["lunch"],
    weatherTags: ["rainy"],
    cuisine: "Vietnamese",
    cookingMinutes: 20,
    budget: "low",
    score: 80,
    reasons: ["Phù hợp cho bữa trưa", "Món ấm phù hợp khi trời mưa"],
    explanation: "Phù hợp cho bữa trưa. Món ấm phù hợp khi trời mưa",
    explanationSource: "rules"
  };
}

describe("explainMealRecommendations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(env, originalEnv);
  });

  it("keeps rule explanations when Gemini is unavailable", async () => {
    Object.assign(env, { GEMINI_API_KEY: undefined });
    const meals = [recommendation("fallback-meal")];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await explainMealRecommendations({
      recommendations: meals,
      mealPeriod: "lunch",
      goals: ["balanced"]
    });

    expect(result).toBe(meals);
    expect(result[0]?.explanationSource).toBe("rules");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses and caches validated Gemini explanations without sending sensitive profile data", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-test",
      AI_MAX_TOKENS: 1200
    });
    const meals = [recommendation("gemini-meal")];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const content = String(body.messages[0]?.content ?? "");
      expect(content).not.toContain("Tôm");
      expect(content).not.toContain("10.776");
      expect(body.response_format).toEqual({ type: "json_object" });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  explanations: [{ key: "gemini-meal", explanation: "Món nóng, nhẹ nhàng và hợp mục tiêu cân bằng." }]
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      recommendations: meals,
      mealPeriod: "lunch" as const,
      goals: ["balanced"] as const,
      weather: {
        temperature: 25,
        condition: "Mưa",
        isHot: false,
        isCold: false,
        isRainy: true,
        fetchedAt: "2026-07-22T00:00:00.000Z"
      }
    };

    const first = await explainMealRecommendations(input);
    const second = await explainMealRecommendations(input);

    expect(first[0]).toMatchObject({
      explanation: "Món nóng, nhẹ nhàng và hợp mục tiêu cân bằng.",
      explanationSource: "gemini"
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
