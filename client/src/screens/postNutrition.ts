import type { Meal, NutritionDetail, NutritionSummary, Post } from "../types/api";

export type NutritionTableRow = {
  key: string;
  ingredient: string;
  portion: string;
  calories: string;
  protein: string;
  isTotal: boolean;
};

export type NutritionDetailSection = {
  imageIndex: number;
  title: string;
  hasDetails: boolean;
  rows: NutritionTableRow[];
  warnings: string[];
};

const EMPTY_TOTAL: NutritionSummary = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  confidence: 0
};

type NutritionAccumulator = Required<NutritionSummary>;

function formatNumber(value: number | undefined) {
  return `${Math.round(value ?? 0)}`;
}

function isUsableCalories(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function combineNutritionTotals(details: NutritionDetail[]): NutritionSummary | undefined {
  if (!details.length) {
    return undefined;
  }

  const totals = details.reduce(
    (sum, detail) => ({
      calories: sum.calories + (detail.total?.calories ?? 0),
      protein: sum.protein + (detail.total?.protein ?? 0),
      carbs: sum.carbs + (detail.total?.carbs ?? 0),
      fat: sum.fat + (detail.total?.fat ?? 0),
      confidence: sum.confidence + (detail.total?.confidence ?? 0)
    }),
    EMPTY_TOTAL as NutritionAccumulator
  );

  return {
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    confidence: totals.confidence / details.length
  };
}

export function getNutritionForImage(post: Post, imageIndex: number): NutritionSummary | undefined {
  const detailTotal = post.nutritionDetails?.find((detail) => detail.imageIndex === imageIndex)?.total;
  if (isUsableCalories(detailTotal?.calories)) {
    return detailTotal;
  }

  const imageCount = Math.max(post.images?.length ?? 0, 1);
  if (imageIndex === 0 && imageCount === 1 && isUsableCalories(post.nutritionSummary?.calories)) {
    return post.nutritionSummary;
  }

  return undefined;
}

export function getCaloriesOfCurrentImage(post: Post, imageIndex: number): number | undefined {
  return getNutritionForImage(post, imageIndex)?.calories;
}

export function mealToNutritionDetail(meal: Meal, imageIndex: number): NutritionDetail {
  return {
    imageIndex,
    mealId: meal._id,
    items: meal.result.items,
    total: meal.result.total,
    warnings: meal.result.warnings
  };
}

export function formatNutritionDetailRows(detail: NutritionDetail): NutritionTableRow[] {
  const rows = detail.items.map((item, index) => ({
    key: `${detail.imageIndex}-${item.name}-${index}`,
    ingredient: item.name,
    portion: item.portion,
    calories: formatNumber(item.calories),
    protein: formatNumber(item.protein),
    isTotal: false
  }));

  rows.push({
    key: `${detail.imageIndex}-total`,
    ingredient: "TỔNG CỘNG",
    portion: "Toàn bộ ảnh",
    calories: formatNumber(detail.total.calories),
    protein: formatNumber(detail.total.protein),
    isTotal: true
  });

  return rows;
}

export function getNutritionDetailSections(post: Post): NutritionDetailSection[] {
  if (post.nutritionDetails?.length) {
    return post.nutritionDetails
      .slice()
      .sort((left, right) => left.imageIndex - right.imageIndex)
      .map((detail) => ({
        imageIndex: detail.imageIndex,
        title: `Ảnh ${detail.imageIndex + 1}`,
        hasDetails: detail.items.length > 0,
        rows: formatNutritionDetailRows(detail),
        warnings: detail.warnings ?? []
      }));
  }

  if (post.nutritionSummary) {
    return [
      {
        imageIndex: 0,
        title: "Tổng bài viết",
        hasDetails: false,
        rows: [
          {
            key: "legacy-total",
            ingredient: "TỔNG CỘNG",
            portion: "Chi tiết từng thành phần chưa có",
            calories: formatNumber(post.nutritionSummary.calories),
            protein: formatNumber(post.nutritionSummary.protein),
            isTotal: true
          }
        ],
        warnings: []
      }
    ];
  }

  return [];
}
