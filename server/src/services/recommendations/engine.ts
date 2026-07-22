import { Post } from "../../models/Post.js";
import { RecommendationFeedback } from "../../models/RecommendationFeedback.js";
import { User } from "../../models/User.js";
import { env } from "../../config/env.js";
import { blockedUserIdsFor } from "../../utils/userSafety.js";
import { curatedMealCatalog } from "./catalog.js";
import { explainMealRecommendations } from "./explanation.js";
import { findNearbyRestaurants } from "./places.js";
import { normalizeMealRecommendationProfile } from "./profile.js";
import { rankMealCandidates } from "./ranker.js";
import type {
  MealCandidate,
  MealPeriod,
  NearbyRestaurant,
  RecommendationMode,
  WeatherContext
} from "./types.js";
import { getWeatherContext } from "./weather.js";

type RecommendationInput = {
  userId: string;
  mealPeriod: MealPeriod;
  mode: RecommendationMode;
  latitude?: number;
  longitude?: number;
  limit: number;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function candidateDiets(fields: string[]) {
  const text = normalizeText(fields.join(" "));
  const diets: MealCandidate["diets"] = ["flexible"];
  if (/\b(chay|vegetarian|an chay)\b/.test(text)) diets.push("vegetarian");
  if (/\b(vegan|thuan chay)\b/.test(text)) diets.push("vegan", "vegetarian");
  if (/\b(keto|low carb|it tinh bot)\b/.test(text)) diets.push("keto");
  return [...new Set(diets)];
}

function candidateGoals(calories?: number, protein?: number) {
  const goals: MealCandidate["goals"] = ["balanced"];
  if (typeof calories === "number" && calories > 0 && calories <= 500) goals.push("low_calorie");
  if (typeof protein === "number" && protein >= 24) goals.push("high_protein");
  return [...new Set(goals)];
}

function serializePost(post: any) {
  const author = post.author
    ? {
        ...post.author,
        id: post.author._id?.toString?.() ?? post.author.id
      }
    : post.author;
  return {
    ...post,
    _id: post._id.toString(),
    author
  };
}

function postToCandidate(post: any): MealCandidate | undefined {
  const hasImageRecipes = Array.isArray(post.recipes) && post.recipes.length > 0;
  const recipes = hasImageRecipes
    ? post.recipes
    : post.recipe && (post.recipe.title || post.recipe.ingredients?.length || post.recipe.steps?.length)
      ? [{ imageIndex: 0, ...post.recipe }]
      : [];
  const firstRecipe = recipes[0];
  if (!firstRecipe) return undefined;

  const ingredients = recipes.flatMap((recipe: any) => recipe.ingredients ?? []).filter(Boolean);
  const steps = firstRecipe.steps ?? [];
  const calories = post.nutritionSummary?.calories;
  const protein = post.nutritionSummary?.protein;
  const fields = [post.caption, ...(post.tags ?? []), firstRecipe.title, ...ingredients].filter(Boolean);
  const recipeImageIndex = hasImageRecipes ? firstRecipe.imageIndex : 0;
  const imageUrl = Number.isInteger(recipeImageIndex)
    ? post.images?.[recipeImageIndex]?.url
    : undefined;

  return {
    key: `post:${post._id.toString()}`,
    source: "post",
    name: firstRecipe.title?.trim() || post.caption?.trim().slice(0, 80) || "Món ăn từ cộng đồng",
    description: post.caption?.trim() || "Công thức được chia sẻ trong cộng đồng Daily Meal.",
    imageUrl,
    calories,
    protein,
    carbs: post.nutritionSummary?.carbs,
    fat: post.nutritionSummary?.fat,
    ingredients,
    steps,
    tags: post.tags ?? [],
    diets: candidateDiets(fields),
    goals: candidateGoals(calories, protein),
    mealPeriods: ["breakfast", "lunch", "dinner"],
    weatherTags: ["neutral"],
    cuisine: containsVietnameseCuisine(fields) ? "vietnamese" : "international",
    cookingMinutes: 45,
    budget: "medium",
    post: serializePost(post),
    engagement: Math.min(
      10,
      (post.stats?.likes ?? 0) + (post.stats?.saves ?? 0) * 2 + (post.stats?.comments ?? 0)
    ),
    createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : undefined
  };
}

function containsVietnameseCuisine(fields: string[]) {
  return /viet|việt|pho|phở|bun|bún|com|cơm|goi|gỏi|chao|cháo/.test(normalizeText(fields.join(" ")));
}

async function loadPostCandidates(userId: string) {
  const blockedIds = await blockedUserIdsFor(userId);
  const posts = await Post.find({
    moderationStatus: { $ne: "hidden" },
    ...(blockedIds.size ? { author: { $nin: [...blockedIds] } } : {}),
    visibility: "public",
    $and: [
      {
        $or: [
          { "recipes.0": { $exists: true } },
          { "recipe.title": { $nin: [null, ""] } },
          { "recipe.ingredients.0": { $exists: true } }
        ]
      }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(80)
    .populate("author", "displayName avatarUrl themeColor")
    .lean();

  return posts.map(postToCandidate).filter((candidate): candidate is MealCandidate => Boolean(candidate));
}

export async function buildMealRecommendations(input: RecommendationInput) {
  const [user, postCandidates, feedback] = await Promise.all([
    User.findById(input.userId).select("preferences mealRecommendationProfile").lean(),
    loadPostCandidates(input.userId),
    RecommendationFeedback.find({ user: input.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("targetKey action")
      .lean()
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const profile = normalizeMealRecommendationProfile(user.mealRecommendationProfile);
  let weather: WeatherContext | undefined;
  let weatherUnavailable = false;

  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    try {
      weather = await getWeatherContext(input.latitude, input.longitude);
    } catch {
      weatherUnavailable = true;
    }
  }

  const candidates = [...postCandidates, ...curatedMealCatalog];
  let meals = rankMealCandidates(
    candidates,
    {
      profile,
      mealPeriod: input.mealPeriod,
      weather,
      interests: user.preferences?.interests ?? [],
      eatingStyles: user.preferences?.eatingStyles ?? [],
      feedback: feedback.map((item) => ({
        targetKey: item.targetKey,
        action: item.action
      }))
    },
    input.limit
  );

  meals = await explainMealRecommendations({
    recommendations: meals,
    mealPeriod: input.mealPeriod,
    weather,
    goals: profile.goals
  });

  let nearbyRestaurants: NearbyRestaurant[] = [];
  let placesUnavailable = false;
  const shouldLoadRestaurants = input.mode !== "cook" && typeof input.latitude === "number" && typeof input.longitude === "number";
  if (shouldLoadRestaurants) {
    try {
      const cuisines = [...new Set([...profile.preferredCuisines, ...meals.map((meal) => meal.cuisine)])];
      nearbyRestaurants = await findNearbyRestaurants({
        latitude: input.latitude!,
        longitude: input.longitude!,
        cuisines,
        limit: Math.min(8, Math.max(3, input.limit))
      });
    } catch {
      placesUnavailable = true;
    }
  }

  return {
    profile,
    context: {
      mealPeriod: input.mealPeriod,
      weather,
      hasLocation: typeof input.latitude === "number" && typeof input.longitude === "number"
    },
    meals: input.mode === "eat_out" ? meals.slice(0, 3) : meals,
    nearbyRestaurants,
    degraded: {
      weatherUnavailable,
      placesUnavailable,
      placesNotConfigured: shouldLoadRestaurants && !env.GEOAPIFY_API_KEY
    },
    attribution: {
      weather: weather ? "Weather data: MET Norway (CC BY 4.0)" : undefined,
      places: nearbyRestaurants.length ? "Powered by Geoapify and OpenStreetMap" : undefined
    }
  };
}
