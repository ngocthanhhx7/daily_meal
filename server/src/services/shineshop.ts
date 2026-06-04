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

const prompt = `
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
`;

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
      "Chưa cấu hình SHINESHOP_API_KEY nên server trả kết quả mẫu để phục vụ phát triển."
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

async function runShineshopVisionModel(input: {
  model: string;
  imageBase64: string;
  mimeType: string;
}) {
  if (!env.SHINESHOP_API_KEY || !env.SHINESHOP_BASE_URL) {
    throw new HttpError(500, "Shineshop chưa được cấu hình trên server.");
  }

  const response = await fetch(chatCompletionsUrl(env.SHINESHOP_BASE_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SHINESHOP_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${input.mimeType};base64,${input.imageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  const result = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new HttpError(502, result.error?.message || "Không thể phân tích ảnh bằng Shineshop.");
  }

  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new HttpError(502, "Shineshop không trả nội dung phân tích ảnh.");
  }

  const parsed = parseJson(content);
  return mealAnalysisSchema.parse({
    ...parsed,
    raw: parsed
  });
}

export async function analyzeFoodImage(input: {
  imagePath?: string;
  imageData?: Buffer;
  mimeType: string;
}): Promise<MealAnalysis> {
  if (!env.SHINESHOP_API_KEY) {
    return mockAnalysis();
  }

  const imageBase64 = await readImageData(input);

  try {
    return await runShineshopVisionModel({
      model: env.SHINESHOP_MODEL,
      imageBase64,
      mimeType: input.mimeType
    });
  } catch (error) {
    if (!env.SHINESHOP_FALLBACK_MODEL || env.SHINESHOP_FALLBACK_MODEL === env.SHINESHOP_MODEL) {
      throw error;
    }

    return runShineshopVisionModel({
      model: env.SHINESHOP_FALLBACK_MODEL,
      imageBase64,
      mimeType: input.mimeType
    });
  }
}
