# Per-Image Calorie Details Design

## Goal

Daily Meal should calculate nutrition for every selected post image and let feed viewers open an in-app bottom sheet/modal to inspect how the calories were estimated. The detail view should resemble a compact nutrition calculation table with ingredient, estimated portion, calories, and protein columns.

## Current Behavior

`CreatePostScreen` analyzes only the first selected image through `api.analyzeMeal`, stores `meal.result.total` as `nutritionSummary`, and sends only that summary when publishing. `HomeScreen` renders a non-interactive calorie badge from `post.nutritionSummary.calories`.

## Proposed Behavior

When a user taps "Tính calo bằng AI" in create post, the app analyzes each selected image. Each result is stored locally by image index with item-level rows, total macros, warnings, and optional linked meal id. Publishing sends two nutrition fields:

- `nutritionSummary`: the combined total across analyzed images.
- `nutritionDetails`: per-image nutrition details used by the feed bottom sheet.

In the feed, the calorie badge becomes pressable. Tapping it opens a bottom sheet/modal in `HomeScreen` for that post. The sheet shows the post total, then a per-image section such as "Ảnh 1", "Ảnh 2", and "Ảnh 3". Each section contains rows for detected food items with:

- `Thành phần`: item name.
- `Định lượng ước tính`: item portion.
- `Lượng Calo (kcal)`: item calories.
- `Protein (g)`: item protein.

Each image section ends with a total row for that image. If a post only has legacy `nutritionSummary` and no detail rows, the bottom sheet shows the total summary and a short unavailable-detail state instead of failing.

## Data Model

Add a reusable `NutritionDetail` shape:

- `imageIndex: number`
- `items: MealAnalysisItem[]`
- `total: NutritionSummary`
- `warnings?: string[]`
- `mealId?: string`

Client types, server validation, and the Mongoose post model should all accept `nutritionDetails?: NutritionDetail[]`. The server should continue accepting posts without details for backward compatibility.

## Components And Data Flow

Create-post analysis should use a helper to combine multiple `NutritionSummary` values. The screen should keep per-image analysis state instead of a single `meal` state for new drafts. Existing route param `meal` remains supported by converting it into a single detail at image index 0.

`NutritionCard` can continue displaying totals. A new feed detail helper/component should format detail rows for the modal without embedding calculation logic directly in render code.

## Error Handling

If one image analysis fails, the create-post flow should show the existing error alert and keep any already completed analysis results. Publishing can proceed with whichever analyzed details exist. If no analysis exists, publishing behaves as it does today with no nutrition fields.

## Testing

Add focused tests for:

- Combining nutrition totals from multiple analyzed images.
- Converting meal analysis into per-image nutrition details.
- Formatting bottom-sheet table rows, including the legacy summary-only fallback.

Run the relevant client tests and server tests that cover post validation/model behavior.
