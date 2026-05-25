import fs from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../config/env.js";

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

export async function analyzeFoodImage(input: {
  imagePath: string;
  mimeType: string;
}): Promise<MealAnalysis> {
  if (!env.GEMINI_API_KEY) {
    return mockAnalysis();
  }

  const data = await fs.readFile(input.imagePath, "base64");
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  async function run(model: string) {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: input.mimeType, data } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = parseJson(response.text ?? "{}");
    return mealAnalysisSchema.parse({
      ...parsed,
      raw: parsed
    });
  }

  try {
    return await run(env.GEMINI_MODEL);
  } catch (error) {
    if (!env.GEMINI_FALLBACK_MODEL || env.GEMINI_FALLBACK_MODEL === env.GEMINI_MODEL) {
      throw error;
    }
    return run(env.GEMINI_FALLBACK_MODEL);
  }
}
