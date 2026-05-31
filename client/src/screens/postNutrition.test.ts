import { describe, expect, test } from "vitest";
import type { Meal, NutritionDetail, NutritionSummary, Post } from "../types/api";
import {
  combineNutritionTotals,
  formatNutritionDetailRows,
  getNutritionDetailSections,
  mealToNutritionDetail
} from "./postNutrition";

const total = (patch: Partial<NutritionSummary>): NutritionSummary => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ...patch
});

describe("post nutrition helpers", () => {
  test("combines totals across analyzed images", () => {
    const details: NutritionDetail[] = [
      {
        imageIndex: 0,
        total: total({ calories: 250, protein: 12, carbs: 30, fat: 8, confidence: 0.8 }),
        items: [],
        warnings: []
      },
      {
        imageIndex: 1,
        total: total({ calories: 175, protein: 9, carbs: 18, fat: 5, confidence: 0.6 }),
        items: [],
        warnings: []
      }
    ];

    expect(combineNutritionTotals(details)).toEqual({
      calories: 425,
      protein: 21,
      carbs: 48,
      fat: 13,
      confidence: 0.7
    });
  });

  test("converts a meal analysis into a per-image detail", () => {
    const meal: Meal = {
      _id: "meal-1",
      image: { url: "/uploads/meal.png" },
      result: {
        items: [
          {
            name: "Bánh mì",
            portion: "2 lát",
            calories: 190,
            protein: 6,
            carbs: 34,
            fat: 2,
            confidence: 0.75
          }
        ],
        total: total({ calories: 190, protein: 6, carbs: 34, fat: 2, confidence: 0.75 }),
        warnings: ["Ước tính từ ảnh"]
      },
      createdAt: "2026-05-31T00:00:00.000Z"
    };

    expect(mealToNutritionDetail(meal, 2)).toEqual({
      imageIndex: 2,
      mealId: "meal-1",
      items: meal.result.items,
      total: meal.result.total,
      warnings: meal.result.warnings
    });
  });

  test("formats item rows and a total row for the detail table", () => {
    const detail: NutritionDetail = {
      imageIndex: 0,
      total: total({ calories: 275, protein: 13, carbs: 32, fat: 9 }),
      items: [
        {
          name: "Trứng gà",
          portion: "1 quả lớn",
          calories: 85,
          protein: 7,
          carbs: 1,
          fat: 6,
          confidence: 0.8
        },
        {
          name: "Bánh mì",
          portion: "2 lát",
          calories: 190,
          protein: 6,
          carbs: 31,
          fat: 3,
          confidence: 0.7
        }
      ],
      warnings: []
    };

    expect(formatNutritionDetailRows(detail)).toEqual([
      {
        key: "0-Trứng gà-0",
        ingredient: "Trứng gà",
        portion: "1 quả lớn",
        calories: "85",
        protein: "7",
        isTotal: false
      },
      {
        key: "0-Bánh mì-1",
        ingredient: "Bánh mì",
        portion: "2 lát",
        calories: "190",
        protein: "6",
        isTotal: false
      },
      {
        key: "0-total",
        ingredient: "TỔNG CỘNG",
        portion: "Toàn bộ ảnh",
        calories: "275",
        protein: "13",
        isTotal: true
      }
    ]);
  });

  test("returns a legacy summary section when detail rows are absent", () => {
    const post = {
      _id: "post-1",
      nutritionSummary: total({ calories: 480, protein: 24, carbs: 50, fat: 12 })
    } as Post;

    expect(getNutritionDetailSections(post)).toEqual([
      {
        imageIndex: 0,
        title: "Tổng bài viết",
        hasDetails: false,
        rows: [
          {
            key: "legacy-total",
            ingredient: "TỔNG CỘNG",
            portion: "Chi tiết từng thành phần chưa có",
            calories: "480",
            protein: "24",
            isTotal: true
          }
        ],
        warnings: []
      }
    ]);
  });
});
