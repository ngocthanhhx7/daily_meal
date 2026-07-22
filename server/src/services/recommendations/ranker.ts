import type {
  MealCandidate,
  MealPeriod,
  MealRecommendationProfile,
  RankedMealRecommendation,
  WeatherContext
} from "./types.js";

export type RecommendationFeedbackSignal = {
  targetKey: string;
  action: "liked" | "dismissed" | "opened_recipe" | "opened_restaurant";
};

type RankContext = {
  profile: MealRecommendationProfile;
  mealPeriod: MealPeriod;
  weather?: WeatherContext;
  interests?: string[];
  eatingStyles?: string[];
  feedback?: RecommendationFeedbackSignal[];
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsTerm(values: string[], term: string) {
  const normalizedTerm = normalizeText(term);
  return values.some((value) => normalizeText(value).includes(normalizedTerm));
}

function candidateText(candidate: MealCandidate) {
  return [
    candidate.name,
    candidate.description,
    candidate.cuisine,
    ...candidate.ingredients,
    ...candidate.tags
  ];
}

function isDietCompatible(candidate: MealCandidate, profile: MealRecommendationProfile) {
  return profile.diet === "flexible" || candidate.diets.includes(profile.diet);
}

function hasExcludedIngredient(candidate: MealCandidate, profile: MealRecommendationProfile) {
  const fields = candidateText(candidate);
  return [...profile.allergens, ...profile.dislikes].some((term) => term.trim() && containsTerm(fields, term));
}

function hasEnoughAllergyData(candidate: MealCandidate, profile: MealRecommendationProfile) {
  if (!profile.allergens.length) {
    return true;
  }
  return candidate.ingredients.length > 0;
}

function weatherTag(weather?: WeatherContext) {
  if (!weather) return "neutral" as const;
  if (weather.isRainy) return "rainy" as const;
  if (weather.isHot) return "hot" as const;
  if (weather.isCold) return "cold" as const;
  return "neutral" as const;
}

function feedbackAdjustment(candidate: MealCandidate, feedback: RecommendationFeedbackSignal[]) {
  return feedback.reduce((score, item) => {
    if (item.targetKey !== candidate.key) return score;
    if (item.action === "liked") return score + 16;
    if (item.action === "opened_recipe") return score + 6;
    if (item.action === "dismissed") return score - 100;
    return score;
  }, 0);
}

function scoreCandidate(candidate: MealCandidate, context: RankContext) {
  const reasons: string[] = [];
  let score = 0;

  for (const goal of context.profile.goals) {
    if (candidate.goals.includes(goal)) {
      score += 22;
      if (goal === "low_calorie") reasons.push("Phù hợp mục tiêu kiểm soát calo");
      if (goal === "high_protein") reasons.push("Có lượng protein tốt cho một bữa chính");
      if (goal === "balanced") reasons.push("Cân bằng hơn giữa năng lượng và protein");
    }
  }

  if (context.profile.goals.includes("low_calorie") && typeof candidate.calories === "number") {
    if (candidate.calories <= 450) score += 12;
    else if (candidate.calories > 650) score -= 15;
  }

  if (context.profile.goals.includes("high_protein") && typeof candidate.protein === "number") {
    if (candidate.protein >= 30) score += 12;
    else if (candidate.protein < 15) score -= 10;
  }

  if (candidate.mealPeriods.includes(context.mealPeriod)) {
    score += 18;
    reasons.push(
      context.mealPeriod === "breakfast"
        ? "Phù hợp cho bữa sáng"
        : context.mealPeriod === "lunch"
          ? "Phù hợp cho bữa trưa"
          : context.mealPeriod === "dinner"
            ? "Phù hợp cho bữa tối"
            : "Phù hợp cho một bữa ăn nhẹ muộn"
    );
  }

  const currentWeatherTag = weatherTag(context.weather);
  if (candidate.weatherTags.includes(currentWeatherTag)) {
    score += currentWeatherTag === "neutral" ? 5 : 13;
    if (currentWeatherTag === "rainy") reasons.push("Món ấm phù hợp khi trời mưa");
    if (currentWeatherTag === "cold") reasons.push("Phù hợp khi thời tiết mát hoặc lạnh");
    if (currentWeatherTag === "hot") reasons.push("Món nhẹ, dễ ăn hơn trong thời tiết nóng");
  }

  if (candidate.cookingMinutes <= context.profile.maxCookingMinutes) {
    score += 10;
    reasons.push(`Có thể chuẩn bị trong khoảng ${candidate.cookingMinutes} phút`);
  } else {
    score -= Math.min(20, candidate.cookingMinutes - context.profile.maxCookingMinutes);
  }

  if (context.profile.budget === "any" || candidate.budget === context.profile.budget) {
    score += 8;
  }

  const preferenceText = [...(context.interests ?? []), ...(context.eatingStyles ?? [])];
  const fields = candidateText(candidate);
  const preferenceMatches = preferenceText.filter((value) => {
    const terms = normalizeText(value).split(" ").filter((term) => term.length >= 3);
    return terms.some((term) => containsTerm(fields, term));
  }).length;
  score += Math.min(12, preferenceMatches * 4);

  if (candidate.source === "post") {
    score += Math.min(10, candidate.engagement ?? 0);
    score += 4;
  } else {
    score += 6;
  }

  score += feedbackAdjustment(candidate, context.feedback ?? []);

  return { score, reasons: [...new Set(reasons)].slice(0, 4) };
}

export function rankMealCandidates(
  candidates: MealCandidate[],
  context: RankContext,
  limit = 5
): RankedMealRecommendation[] {
  return candidates
    .filter((candidate) => isDietCompatible(candidate, context.profile))
    .filter((candidate) => hasEnoughAllergyData(candidate, context.profile))
    .filter((candidate) => !hasExcludedIngredient(candidate, context.profile))
    .map((candidate) => {
      const ranked = scoreCandidate(candidate, context);
      return {
        ...candidate,
        ...ranked,
        explanation: ranked.reasons.join(". ") || candidate.description,
        explanationSource: "rules" as const,
        allergyNotice: context.profile.allergens.length
          ? "Thông tin dị ứng chỉ dựa trên nguyên liệu được khai báo; hãy xác nhận lại trước khi ăn."
          : undefined
      };
    })
    .filter((candidate) => candidate.score > -50)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "vi"))
    .slice(0, Math.max(1, Math.min(limit, 10)));
}
