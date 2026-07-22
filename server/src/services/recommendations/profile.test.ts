import { describe, expect, it } from "vitest";
import { normalizeMealRecommendationProfile } from "./profile.js";

describe("normalizeMealRecommendationProfile", () => {
  it("returns safe defaults for a legacy user", () => {
    expect(normalizeMealRecommendationProfile(undefined)).toEqual({
      diet: "flexible",
      goals: ["balanced"],
      allergens: [],
      dislikes: [],
      preferredCuisines: [],
      budget: "any",
      maxCookingMinutes: 45,
      spiceLevel: "medium"
    });
  });

  it("normalizes and deduplicates private preference text", () => {
    const result = normalizeMealRecommendationProfile({
      allergens: [" Tôm ", "tôm"],
      dislikes: ["Mỡ"],
      goals: ["high_protein"]
    });

    expect(result.allergens).toEqual(["tôm"]);
    expect(result.dislikes).toEqual(["mỡ"]);
    expect(result.goals).toEqual(["high_protein"]);
  });
});
