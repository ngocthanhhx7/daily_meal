import { describe, expect, it } from "vitest";
import { curatedMealCatalog } from "./catalog.js";
import { rankMealCandidates } from "./ranker.js";
import type { MealRecommendationProfile } from "./types.js";

const baseProfile: MealRecommendationProfile = {
  diet: "flexible",
  goals: ["balanced"],
  allergens: [],
  dislikes: [],
  preferredCuisines: [],
  budget: "any",
  maxCookingMinutes: 45,
  spiceLevel: "medium"
};

describe("rankMealCandidates", () => {
  it("prioritizes hot-weather low-calorie meals for the requested period", () => {
    const result = rankMealCandidates(curatedMealCatalog, {
      profile: { ...baseProfile, goals: ["low_calorie"] },
      mealPeriod: "lunch",
      weather: {
        temperature: 33,
        condition: "Trời quang",
        isHot: true,
        isCold: false,
        isRainy: false,
        fetchedAt: new Date().toISOString()
      }
    });

    expect(result[0]?.weatherTags).toContain("hot");
    expect(result[0]?.goals).toContain("low_calorie");
  });

  it("hard-filters incompatible diets and allergens", () => {
    const result = rankMealCandidates(curatedMealCatalog, {
      profile: {
        ...baseProfile,
        diet: "vegan",
        allergens: ["đậu hũ"]
      },
      mealPeriod: "dinner"
    });

    expect(result.some((item) => item.ingredients.some((ingredient) => ingredient.includes("đậu hũ")))).toBe(false);
    expect(result.every((item) => item.diets.includes("vegan"))).toBe(true);
  });

  it("removes dismissed recommendations and boosts liked recommendations", () => {
    const result = rankMealCandidates(curatedMealCatalog, {
      profile: baseProfile,
      mealPeriod: "dinner",
      feedback: [
        { targetKey: "curated:com-ga-rau", action: "dismissed" },
        { targetKey: "curated:canh-chua-ca", action: "liked" }
      ]
    });

    expect(result.some((item) => item.key === "curated:com-ga-rau")).toBe(false);
    expect(result.findIndex((item) => item.key === "curated:canh-chua-ca")).toBeLessThan(3);
  });
});
