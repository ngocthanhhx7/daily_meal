export type RecommendationDiet = "flexible" | "vegetarian" | "vegan" | "keto";
export type RecommendationGoal = "balanced" | "low_calorie" | "high_protein";
export type RecommendationBudget = "low" | "medium" | "any";
export type MealPeriod = "breakfast" | "lunch" | "dinner" | "late_night";
export type RecommendationMode = "cook" | "eat_out" | "any";

export type MealRecommendationProfile = {
  diet: RecommendationDiet;
  goals: RecommendationGoal[];
  allergens: string[];
  dislikes: string[];
  preferredCuisines: string[];
  budget: RecommendationBudget;
  maxCookingMinutes: number;
  spiceLevel: "low" | "medium" | "high";
};

export type WeatherContext = {
  temperature: number;
  condition: string;
  symbolCode?: string;
  precipitationMm?: number;
  isHot: boolean;
  isCold: boolean;
  isRainy: boolean;
  fetchedAt: string;
};

export type MealCandidate = {
  key: string;
  source: "curated" | "post";
  name: string;
  description: string;
  imageUrl?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
  diets: RecommendationDiet[];
  goals: RecommendationGoal[];
  mealPeriods: MealPeriod[];
  weatherTags: Array<"hot" | "cold" | "rainy" | "neutral">;
  cuisine: string;
  cookingMinutes: number;
  budget: Exclude<RecommendationBudget, "any">;
  post?: Record<string, unknown>;
  engagement?: number;
  createdAt?: string;
};

export type RankedMealRecommendation = MealCandidate & {
  score: number;
  reasons: string[];
  explanation: string;
  explanationSource: "rules" | "gemini";
  allergyNotice?: string;
};

export type NearbyRestaurant = {
  key: string;
  name: string;
  address: string;
  distanceMeters?: number;
  latitude: number;
  longitude: number;
  categories: string[];
  cuisine?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
  mapUrl: string;
  matchReason: string;
};
