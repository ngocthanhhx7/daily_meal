import fs from "node:fs/promises";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

export const mealAnalysisSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      portion: z.string(),
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      confidence: z.number().min(0).max(1)
    })
  ),
  total: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number()
  }),
  warnings: z.array(z.string()).default([]),
  raw: z.unknown().optional()
});

export type MealAnalysis = z.infer<typeof mealAnalysisSchema>;

const mealSuitabilityTargetSchema = z.object({
  label: z.string().min(1).max(80),
  reason: z.string().min(1).max(260)
});

const mealSuitabilityItemInsightSchema = z.object({
  key: z.string().min(1).max(80).optional(),
  imageIndex: z.number().int().min(0).default(0),
  itemIndex: z.number().int().min(0).default(0),
  name: z.string().min(1).max(120),
  portion: z.string().min(1).max(160),
  calories: z.number().nonnegative().default(0),
  protein: z.number().nonnegative().default(0),
  verdict: z.string().min(1).max(160),
  macroNote: z.string().min(1).max(360),
  suitableFor: z.array(mealSuitabilityTargetSchema).max(3).default([]),
  cautionFor: z.array(mealSuitabilityTargetSchema).max(3).default([]),
  suggestions: z.array(z.string().min(1).max(220)).max(3).default([]),
  confidence: z.number().min(0).max(1).default(0.65)
});

export const mealSuitabilityInsightSchema = z.object({
  headline: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  macroBalance: z.string().min(1).max(420),
  suitableFor: z.array(mealSuitabilityTargetSchema).max(4).default([]),
  cautionFor: z.array(mealSuitabilityTargetSchema).max(4).default([]),
  itemInsights: z.array(mealSuitabilityItemInsightSchema).max(20).default([]),
  suggestions: z.array(z.string().min(1).max(220)).max(4).default([]),
  confidence: z.number().min(0).max(1).default(0.7),
  source: z.enum(["gemini", "fallback"]).default("gemini")
});

export type MealSuitabilityInsight = z.infer<typeof mealSuitabilityInsightSchema>;

export const nutritionHintsSchema = z.object({
  ingredientsText: z.string().trim().max(2000).optional()
});

export type NutritionHints = z.infer<typeof nutritionHintsSchema>;

type NutritionNumbers = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  confidence?: number;
};

type MealSuitabilityInputItem = NutritionNumbers & {
  name?: string;
  portion?: string;
};

export type MealSuitabilityInput = {
  caption?: string;
  nutritionSummary?: NutritionNumbers | null;
  nutritionDetails?: Array<{
    imageIndex?: number;
    items?: MealSuitabilityInputItem[];
    total?: NutritionNumbers | null;
    warnings?: string[];
  }>;
};

const AI_PROVIDER_TIMEOUT_MS = 20_000;

const basePrompt = `
You are a nutrition estimation assistant for a food photo app.
Estimate visible foods and return only valid JSON with this shape:
{
  "items": [
    {
      "name": "food name",
      "portion": "estimated portion",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "confidence": 0.0
    }
  ],
  "total": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "warnings": ["short uncertainty note"]
}
Use grams for macros. Explain uncertainty only inside warnings.
Return all user-facing text in Vietnamese, especially items[].name, items[].portion, and warnings[].
Do not return English food names or English portion descriptions unless the item is a brand name.
`;

function buildPrompt(hints?: NutritionHints) {
  const ingredientsText = hints?.ingredientsText?.trim();

  if (!ingredientsText) {
    return basePrompt;
  }

  return `${basePrompt}

User-provided ingredients and quantities:
${ingredientsText}

Treat the user-provided ingredients and quantities as stronger evidence than visual portion guesses.
If an item is not visible but the user listed it, include it and mention the uncertainty in warnings.
`;
}

function mockAnalysis(): MealAnalysis {
  return {
    items: [
      {
        name: "Món ăn từ ảnh",
        portion: "1 khẩu phần ước tính",
        calories: 420,
        protein: 22,
        carbs: 48,
        fat: 16,
        confidence: 0.62
      }
    ],
    total: {
      calories: 420,
      protein: 22,
      carbs: 48,
      fat: 16
    },
    warnings: [
      "Chưa cấu hình GEMINI_API_KEY nên server trả kết quả mẫu để phục vụ phát triển."
    ],
    raw: { mocked: true }
  };
}

function parseJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

function chatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

async function readImageData(input: { imagePath?: string; imageData?: Buffer }) {
  if (input.imageData) {
    return input.imageData.toString("base64");
  }

  if (input.imagePath) {
    return fs.readFile(input.imagePath, "base64");
  }

  throw new Error("Image data is required for meal analysis");
}

async function runGeminiVisionModel(input: {
  imageBase64: string;
  mimeType: string;
  hints?: NutritionHints;
}) {
  if (!env.GEMINI_API_KEY || !env.GEMINI_BASE_URL) {
    throw new HttpError(500, "Gemini chưa được cấu hình trên server.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(chatCompletionsUrl(env.GEMINI_BASE_URL), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.GEMINI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.GEMINI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(input.hints) },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType};base64,${input.imageBase64}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: env.AI_MAX_TOKENS
      })
    });
  } finally {
    clearTimeout(timeout);
  }

  const result = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    if (!result.error?.message) {
      throw new HttpError(502, "Không thể phân tích ảnh bằng Gemini.");
    }
    throw new HttpError(502, result.error.message || "Không thể phân tích ảnh bằng Gemini.");
  }

  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new HttpError(502, "Gemini không trả nội dung phân tích ảnh.");
  }

  const parsed = parseJson(content);
  return mealAnalysisSchema.parse({
    ...parsed,
    raw: parsed
  });
}

function roundNutritionNumber(value: number | undefined) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value ?? 0 : 0));
}

function normalizeNutritionNumbers(value?: NutritionNumbers | null) {
  return {
    calories: roundNutritionNumber(value?.calories),
    protein: roundNutritionNumber(value?.protein),
    carbs: roundNutritionNumber(value?.carbs),
    fat: roundNutritionNumber(value?.fat),
    confidence: typeof value?.confidence === "number" && Number.isFinite(value.confidence)
      ? Math.min(Math.max(value.confidence, 0), 1)
      : undefined
  };
}

function normalizedSuitabilityData(input: MealSuitabilityInput) {
  const detailTotals = input.nutritionDetails?.map((detail) => normalizeNutritionNumbers(detail.total)) ?? [];
  const detailTotal = detailTotals.reduce(
    (sum, detail) => ({
      calories: sum.calories + detail.calories,
      protein: sum.protein + detail.protein,
      carbs: sum.carbs + detail.carbs,
      fat: sum.fat + detail.fat
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const summary = normalizeNutritionNumbers(input.nutritionSummary);
  const total = summary.calories > 0 || summary.protein > 0 ? summary : detailTotal;
  const items =
    input.nutritionDetails?.flatMap((detail) =>
      (detail.items ?? []).map((item, itemIndex) => ({
        key: `${detail.imageIndex ?? 0}-${itemIndex}`,
        imageIndex: detail.imageIndex ?? 0,
        itemIndex,
        name: item.name?.trim() || "Món ăn",
        portion: item.portion?.trim() || "Chưa rõ",
        ...normalizeNutritionNumbers(item)
      }))
    ) ?? [];

  return {
    caption: input.caption?.trim() || undefined,
    total,
    items,
    warnings: input.nutritionDetails?.flatMap((detail) => detail.warnings ?? []) ?? []
  };
}

export function hasMealSuitabilityNutritionData(input: MealSuitabilityInput) {
  const data = normalizedSuitabilityData(input);
  return data.total.calories > 0 || data.items.some((item) => item.calories > 0 || item.protein > 0);
}

type NormalizedSuitabilityItem = ReturnType<typeof normalizedSuitabilityData>["items"][number];

function fallbackItemSuitability(item: NormalizedSuitabilityItem): MealSuitabilityInsight["itemInsights"][number] {
  const proteinPer100Kcal = item.calories > 0 ? item.protein / item.calories * 100 : 0;
  const suitableFor: MealSuitabilityInsight["suitableFor"] = [];
  const cautionFor: MealSuitabilityInsight["cautionFor"] = [];
  const suggestions: string[] = [];

  if (item.protein >= 18 && proteinPer100Kcal >= 6) {
    suitableFor.push({
      label: "Người cần tăng protein",
      reason: `${item.name} có khoảng ${item.protein}g protein với mật độ protein tốt so với ${item.calories} kcal.`
    });
  }

  if (item.calories <= 250 && item.protein >= 8) {
    suitableFor.push({
      label: "Người kiểm soát calo",
      reason: "Năng lượng món này không quá cao và vẫn có protein để hỗ trợ no lâu."
    });
  }

  if (item.calories >= 300 && item.protein < 10) {
    cautionFor.push({
      label: "Người đang thâm hụt calo",
      reason: "Món này khá nhiều calo nhưng protein chưa cao, nên cẩn thận với khẩu phần."
    });
  }

  if (item.protein < 8) {
    cautionFor.push({
      label: "Người cần bữa giàu protein",
      reason: `Protein của món này khoảng ${item.protein}g, phù hợp là phần phụ hơn là nguồn protein chính.`
    });
    suggestions.push("Nếu chọn món này, có thể ăn kèm thêm nguồn protein nạc.");
  }

  if (!suitableFor.length) {
    suitableFor.push({
      label: "Người ăn linh hoạt",
      reason: "Món này có thể phù hợp nếu được cân lại với tổng calo và protein trong ngày."
    });
  }

  if (!suggestions.length) {
    suggestions.push(
      item.calories >= 300
        ? "Có thể giảm khẩu phần nếu muốn bữa nhẹ hơn."
        : "Có thể kèm thêm rau để tăng độ no."
    );
  }

  return {
    key: item.key,
    imageIndex: item.imageIndex,
    itemIndex: item.itemIndex,
    name: item.name,
    portion: item.portion,
    calories: item.calories,
    protein: item.protein,
    verdict: proteinPer100Kcal >= 6 ? "Món này thiên về hỗ trợ protein." : "Món này nên cân theo mục tiêu calo trong ngày.",
    macroNote: `${item.name} khoảng ${item.calories} kcal và ${item.protein}g protein, tương đương ${proteinPer100Kcal.toFixed(1)}g protein/100 kcal.`,
    suitableFor: suitableFor.slice(0, 3),
    cautionFor: cautionFor.slice(0, 3),
    suggestions: suggestions.slice(0, 3),
    confidence: typeof item.confidence === "number" ? Math.max(0.45, Math.min(item.confidence, 0.78)) : 0.58
  };
}

function buildMealSuitabilityPrompt(input: MealSuitabilityInput) {
  const data = normalizedSuitabilityData(input);

  return `
Bạn là trợ lý phân tích dinh dưỡng cho app Daily Meal.
Chỉ dựa trên dữ liệu calo, protein, carbs, fat và định lượng từng món đã được AI ước tính sẵn.
Hãy suy luận bữa ăn này phù hợp với nhóm người nào theo nghĩa rộng: người tập luyện/tăng cơ, giữ cân, thâm hụt calo, cần năng lượng cao, ăn nhẹ, hoặc người cần thận trọng.
Không đưa chẩn đoán y tế, không khẳng định phù hợp cho bệnh lý, trẻ em, thai kỳ hoặc điều trị cá nhân. Nếu cần, chỉ nói nên tham khảo chuyên gia.

Trả về đúng JSON hợp lệ theo shape:
{
  "headline": "một câu ngắn",
  "summary": "2-3 câu tóm tắt",
  "macroBalance": "nhận xét về calo/protein và tỉ lệ protein theo bữa",
  "suitableFor": [{ "label": "nhóm người", "reason": "lý do dựa trên số liệu" }],
  "cautionFor": [{ "label": "nhóm nên cân nhắc", "reason": "lý do" }],
  "suggestions": ["gợi ý chỉnh bữa ăn ngắn gọn"],
  "confidence": 0.0
}
Tối đa 4 mục cho mỗi mảng. Toàn bộ text hướng người dùng phải là tiếng Việt.

Dữ liệu bữa ăn:
${JSON.stringify(data, null, 2)}
`.trim() + `

Return an "itemInsights" array for every object in data.items. Each item insight must copy key, imageIndex, itemIndex, name, portion, calories, and protein from that item, then add its own verdict, macroNote, suitableFor, cautionFor, suggestions, and confidence. Keep all user-facing text in Vietnamese.
`;
}

function fallbackMealSuitability(input: MealSuitabilityInput): MealSuitabilityInsight {
  const data = normalizedSuitabilityData(input);
  const calories = data.total.calories;
  const protein = data.total.protein;
  const fat = data.total.fat;
  const proteinPer100Kcal = calories > 0 ? protein / calories * 100 : 0;
  const suitableFor: MealSuitabilityInsight["suitableFor"] = [];
  const cautionFor: MealSuitabilityInsight["cautionFor"] = [];
  const suggestions: string[] = [];
  const itemInsights = data.items.map(fallbackItemSuitability);

  if (calories <= 0) {
    return {
      headline: "Chưa đủ dữ liệu để phân tích",
      summary: "Bài viết chưa có lượng calo đủ rõ để suy luận nhóm người phù hợp.",
      macroBalance: "Hãy phân tích calo cho từng món trước khi xem nhận định AI.",
      suitableFor: [],
      cautionFor: [],
      itemInsights: [],
      suggestions: ["Thêm định lượng món ăn để kết quả sát hơn."],
      confidence: 0.35,
      source: "fallback"
    };
  }

  if (protein >= 25 && proteinPer100Kcal >= 5) {
    suitableFor.push({
      label: "Người tập luyện hoặc muốn tăng cơ",
      reason: `Bữa ăn có khoảng ${protein}g protein, mật độ protein ở mức tốt so với ${calories} kcal.`
    });
  }

  if (calories <= 500 && protein >= 18) {
    suitableFor.push({
      label: "Người đang kiểm soát calo",
      reason: "Tổng năng lượng không quá cao nhưng vẫn có protein để giúp bữa ăn no hơn."
    });
  }

  if (calories >= 450 && calories <= 700) {
    suitableFor.push({
      label: "Người ăn duy trì cân nặng",
      reason: "Mức calo nằm trong khoảng một bữa chính vừa phải với macro tương đối cân bằng."
    });
  }

  if (calories > 700) {
    suitableFor.push({
      label: "Người hoạt động nhiều hoặc cần nạp năng lượng",
      reason: "Tổng calo cao hơn một bữa nhẹ, phù hợp hơn khi cần năng lượng cho ngày vận động."
    });
    cautionFor.push({
      label: "Người đang thâm hụt calo",
      reason: "Bữa này khá nhiều năng lượng, nên cân lại khẩu phần nếu mục tiêu là giảm calo."
    });
  }

  if (protein < 18) {
    cautionFor.push({
      label: "Người cần bữa giàu protein",
      reason: `Protein khoảng ${protein}g, có thể hơi thấp nếu đây là bữa chính sau tập.`
    });
    suggestions.push("Có thể thêm trứng, thịt nạc, đậu phụ hoặc sữa chua không đường để tăng protein.");
  }

  if (fat >= 28) {
    cautionFor.push({
      label: "Người cần hạn chế chất béo",
      reason: `Fat khoảng ${fat}g, nên chú ý nếu trong ngày đã ăn nhiều món chiên hoặc sốt béo.`
    });
  }

  if (!suggestions.length) {
    suggestions.push(
      calories > 700
        ? "Giảm bớt tinh bột hoặc sốt nếu muốn bữa nhẹ hơn."
        : "Thêm rau hoặc trái cây ít ngọt để bữa ăn no và cân bằng hơn."
    );
  }

  if (!suitableFor.length) {
    suitableFor.push({
      label: "Người cần một bữa ăn linh hoạt",
      reason: "Các chỉ số ở mức trung tính, nên điều chỉnh khẩu phần theo mục tiêu trong ngày."
    });
  }

  return {
    headline: proteinPer100Kcal >= 5 ? "Bữa ăn thiên về hỗ trợ protein" : "Bữa ăn cần cân theo mục tiêu cá nhân",
    summary: `Tổng bữa khoảng ${calories} kcal với ${protein}g protein. Nhận định này dựa trên dữ liệu ước tính từ ảnh và định lượng món ăn.`,
    macroBalance:
      proteinPer100Kcal >= 5
        ? `Mật độ protein khoảng ${proteinPer100Kcal.toFixed(1)}g/100 kcal, phù hợp khi ưu tiên no lâu và phục hồi sau vận động.`
        : `Mật độ protein khoảng ${proteinPer100Kcal.toFixed(1)}g/100 kcal, nên bổ sung protein nếu đây là bữa chính.`,
    suitableFor: suitableFor.slice(0, 4),
    cautionFor: cautionFor.slice(0, 4),
    itemInsights,
    suggestions: suggestions.slice(0, 4),
    confidence: 0.58,
    source: "fallback"
  };
}

async function runGeminiSuitabilityModel(input: MealSuitabilityInput): Promise<MealSuitabilityInsight | undefined> {
  if (!env.GEMINI_API_KEY || !env.GEMINI_BASE_URL) {
    return undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(chatCompletionsUrl(env.GEMINI_BASE_URL), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.GEMINI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.GEMINI_MODEL,
        messages: [
          {
            role: "user",
            content: buildMealSuitabilityPrompt(input)
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: Math.max(env.AI_MAX_TOKENS, 1000)
      })
    });

    const result = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok || !result.choices?.[0]?.message?.content) {
      console.error("[Gemini Suitability] API error:", response.status, result.error?.message || "No content in response");
      return undefined;
    }

    const parsed = parseJson(result.choices[0].message.content);
    const insight = mealSuitabilityInsightSchema.parse({
      ...parsed,
      source: "gemini"
    });
    const fallbackItemInsights = fallbackMealSuitability(input).itemInsights;

    return insight.suitableFor.length
      ? { ...insight, itemInsights: insight.itemInsights.length ? insight.itemInsights : fallbackItemInsights }
      : undefined;
  } catch (err) {
    console.error("[Gemini Suitability] Exception:", err instanceof Error ? err.message : String(err));
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeMealSuitability(input: MealSuitabilityInput): Promise<MealSuitabilityInsight> {
  const insight = await runGeminiSuitabilityModel(input);
  return insight ?? fallbackMealSuitability(input);
}

export async function analyzeFoodImage(input: {
  imagePath?: string;
  imageData?: Buffer;
  mimeType: string;
  hints?: NutritionHints;
}): Promise<MealAnalysis> {
  if (!env.GEMINI_API_KEY) {
    return mockAnalysis();
  }

  const imageBase64 = await readImageData(input);
  return runGeminiVisionModel({
    imageBase64,
    mimeType: input.mimeType,
    hints: input.hints
  });
}
