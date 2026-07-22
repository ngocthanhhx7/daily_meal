import { z } from "zod";
import type { MealRecommendationProfile } from "./types.js";

const cleanTextArray = z
  .array(z.string().trim().min(1).max(80))
  .max(20)
  .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]);

export const mealRecommendationProfileSchema = z.object({
  diet: z.enum(["flexible", "vegetarian", "vegan", "keto"]).default("flexible"),
  goals: z
    .array(z.enum(["balanced", "low_calorie", "high_protein"]))
    .min(1)
    .max(3)
    .default(["balanced"]),
  allergens: cleanTextArray.default([]),
  dislikes: cleanTextArray.default([]),
  preferredCuisines: cleanTextArray.default([]),
  budget: z.enum(["low", "medium", "any"]).default("any"),
  maxCookingMinutes: z.number().int().min(5).max(180).default(45),
  spiceLevel: z.enum(["low", "medium", "high"]).default("medium")
});

export const mealRecommendationProfilePatchSchema = mealRecommendationProfileSchema.partial();

export const defaultMealRecommendationProfile: MealRecommendationProfile = {
  diet: "flexible",
  goals: ["balanced"],
  allergens: [],
  dislikes: [],
  preferredCuisines: [],
  budget: "any",
  maxCookingMinutes: 45,
  spiceLevel: "medium"
};

export function normalizeMealRecommendationProfile(value: unknown): MealRecommendationProfile {
  const source = value && typeof value === "object" ? value : {};
  return mealRecommendationProfileSchema.parse({
    ...defaultMealRecommendationProfile,
    ...source
  });
}
