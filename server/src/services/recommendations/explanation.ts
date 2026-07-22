import { z } from "zod";
import { env } from "../../config/env.js";
import type {
  MealPeriod,
  RankedMealRecommendation,
  RecommendationGoal,
  WeatherContext
} from "./types.js";

export type ExplainMealRecommendationsInput = {
  recommendations: RankedMealRecommendation[];
  mealPeriod: MealPeriod;
  weather?: WeatherContext;
  goals: readonly RecommendationGoal[];
};

type ExplanationCacheEntry = { expiresAt: number; value: RankedMealRecommendation[] };

const explanationCache = new Map<string, ExplanationCacheEntry>();
const EXPLANATION_CACHE_MS = 15 * 60_000;
const GEMINI_TIMEOUT_MS = 8_000;
const MAX_EXPLAINED_MEALS = 3;

const explanationResponseSchema = z.object({
  explanations: z.array(
    z.object({
      key: z.string().min(1),
      explanation: z.string().trim().min(1).max(320)
    })
  )
});

function parseJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

function safeWeather(weather: WeatherContext | undefined) {
  if (!weather) return undefined;
  return {
    condition: weather.condition,
    isHot: weather.isHot,
    isCold: weather.isCold,
    isRainy: weather.isRainy
  };
}

function prompt(input: ExplainMealRecommendationsInput) {
  const meals = input.recommendations.slice(0, MAX_EXPLAINED_MEALS).map((meal) => ({
    key: meal.key,
    name: meal.name,
    description: meal.description,
    cuisine: meal.cuisine,
    calories: meal.calories,
    protein: meal.protein,
    cookingMinutes: meal.cookingMinutes,
    reasons: meal.reasons
  }));

  return [
    "Viết lời giải thích gợi ý món ăn ngắn gọn, tự nhiên bằng tiếng Việt.",
    "Chỉ giải thích dựa trên dữ liệu món ăn, mục tiêu, bữa ăn và thời tiết được cung cấp; không bịa thông tin y tế.",
    "Trả về JSON hợp lệ theo dạng {\"explanations\":[{\"key\":\"...\",\"explanation\":\"...\"}]}. Mỗi explanation tối đa 2 câu.",
    JSON.stringify({ mealPeriod: input.mealPeriod, weather: safeWeather(input.weather), goals: input.goals, meals })
  ].join("\n");
}

function cacheKey(input: ExplainMealRecommendationsInput) {
  return JSON.stringify({
    mealPeriod: input.mealPeriod,
    weather: safeWeather(input.weather),
    goals: input.goals,
    meals: input.recommendations.slice(0, MAX_EXPLAINED_MEALS).map((meal) => ({
      key: meal.key,
      name: meal.name,
      description: meal.description,
      cuisine: meal.cuisine,
      calories: meal.calories,
      protein: meal.protein,
      cookingMinutes: meal.cookingMinutes,
      reasons: meal.reasons
    }))
  });
}

function withGeminiExplanations(
  recommendations: RankedMealRecommendation[],
  explanations: Array<{ key: string; explanation: string }>
) {
  const explanationByKey = new Map(explanations.map((item) => [item.key, item.explanation]));
  return recommendations.map((recommendation) => {
    const explanation = explanationByKey.get(recommendation.key);
    return explanation
      ? { ...recommendation, explanation, explanationSource: "gemini" as const }
      : recommendation;
  });
}

export async function explainMealRecommendations(
  input: ExplainMealRecommendationsInput
): Promise<RankedMealRecommendation[]> {
  if (!env.GEMINI_API_KEY || !env.GEMINI_BASE_URL || !input.recommendations.length) {
    return input.recommendations;
  }

  const key = cacheKey(input);
  const cached = explanationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.GEMINI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GEMINI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.GEMINI_MODEL,
        messages: [{ role: "user", content: prompt(input) }],
        response_format: { type: "json_object" },
        max_tokens: Math.min(env.AI_MAX_TOKENS, 600)
      }),
      signal: controller.signal
    });
    if (!response.ok) return input.recommendations;

    const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = result.choices?.[0]?.message?.content;
    if (!content) return input.recommendations;

    const parsed = explanationResponseSchema.safeParse(parseJson(content));
    if (!parsed.success) return input.recommendations;

    const allowedKeys = new Set(input.recommendations.slice(0, MAX_EXPLAINED_MEALS).map((meal) => meal.key));
    const explanations = parsed.data.explanations.filter((item) => allowedKeys.has(item.key));
    if (!explanations.length) return input.recommendations;

    const value = withGeminiExplanations(input.recommendations, explanations);
    explanationCache.set(key, { value, expiresAt: Date.now() + EXPLANATION_CACHE_MS });
    return value;
  } catch {
    return input.recommendations;
  } finally {
    clearTimeout(timeout);
  }
}
