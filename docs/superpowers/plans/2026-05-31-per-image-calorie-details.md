# Per-Image Calorie Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculate nutrition for each selected post image and show feed calorie details in an in-app bottom sheet/modal.

**Architecture:** Add a shared per-image nutrition detail shape across client and server. Keep calculation and table formatting in small client helpers with focused tests, then wire those helpers into `CreatePostScreen` and `HomeScreen`. Store `nutritionSummary` as the combined total and `nutritionDetails` as the per-image rows.

## File Structure

- `client/src/types/api.ts`: add `NutritionDetail` and attach `nutritionDetails?: NutritionDetail[]` to `Post`.
- `client/src/screens/postNutrition.ts`: new pure helper module for detail conversion, total aggregation, and bottom-sheet row formatting.
- `client/src/screens/postNutrition.test.ts`: new Vitest tests for nutrition helper behavior.
- `client/src/screens/CreatePostScreen.tsx`: analyze all selected images, store per-image details, publish total plus details.
- `client/src/screens/HomeScreen.tsx`: make calorie badge pressable and render the detail modal/bottom sheet.
- `server/src/models/Post.ts`: add Mongoose schema for per-image nutrition details.
- `server/src/routes/posts.ts`: add zod validation for `nutritionDetails`.
- `server/src/tests/api.test.ts`: add API coverage proving post creation persists and returns detail rows.

## Tasks

- [ ] Add failing client helper tests in `client/src/screens/postNutrition.test.ts`.
  - Cover `combineNutritionTotals` summing calories/protein/carbs/fat and averaging/keeping confidence conservatively.
  - Cover `mealToNutritionDetail(meal, imageIndex)` preserving item rows and totals.
  - Cover `formatNutritionDetailRows` returning ingredient rows plus a total row.
  - Cover legacy fallback when only `nutritionSummary` exists and detail rows are absent.

- [ ] Run the new client helper test and confirm it fails because `postNutrition.ts` does not exist yet.
  - Command: `npm --workspace client exec vitest run src/screens/postNutrition.test.ts`

- [ ] Implement `client/src/screens/postNutrition.ts` minimally.
  - Export `combineNutritionTotals`, `mealToNutritionDetail`, `formatNutritionDetailRows`, and any small row types needed by `HomeScreen`.
  - Do not import React or React Native in this helper.

- [ ] Run the client helper test and confirm it passes.
  - Command: `npm --workspace client exec vitest run src/screens/postNutrition.test.ts`

- [ ] Add failing server API test in `server/src/tests/api.test.ts`.
  - Create a post with `nutritionSummary` and `nutritionDetails`.
  - Assert the response includes the detail item rows and totals.
  - Assert feed/search response keeps `nutritionDetails`.

- [ ] Run the server API test and confirm it fails on validation/model persistence.
  - Command: `npm --workspace server run test -- src/tests/api.test.ts`

- [ ] Update server post schema and validation.
  - In `server/src/models/Post.ts`, add nested schemas for meal item, image nutrition detail, and `nutritionDetails`.
  - In `server/src/routes/posts.ts`, add matching zod schemas and include `nutritionDetails` in create/update bodies.
  - Keep the field optional for existing posts.

- [ ] Run the server API test and confirm it passes.
  - Command: `npm --workspace server run test -- src/tests/api.test.ts`

- [ ] Wire client types to the new data.
  - Add `NutritionDetail` in `client/src/types/api.ts`.
  - Add `nutritionDetails?: NutritionDetail[]` to `Post`.
  - Keep current `MealAnalysisItem`, `NutritionSummary`, and `Meal` shapes compatible.

- [ ] Update `CreatePostScreen.tsx` to analyze all images.
  - Replace single `meal` draft state for new analysis with `nutritionDetails`.
  - Preserve route param `meal` by converting it to one detail at image index 0.
  - Change `analyzeFirstImage` into an all-image analyzer that uploads/analyzes each selected image.
  - Use `combineNutritionTotals(nutritionDetails)` for the visible `NutritionCard` and publish payload.
  - Send `nutritionDetails` in `api.createPost`.

- [ ] Update `HomeScreen.tsx` with the bottom sheet/modal.
  - Add selected-post nutrition modal state.
  - Wrap the calorie badge in `Pressable`.
  - Render a `Modal` with a dim backdrop and bottom-aligned sheet.
  - Show total macros and per-image table sections from `formatNutritionDetailRows`.
  - Show a concise fallback state for legacy summary-only posts.

- [ ] Run client typecheck.
  - Command: `npm --workspace client run typecheck`

- [ ] Run server typecheck.
  - Command: `npm --workspace server run typecheck`

- [ ] Run focused and full relevant tests.
  - Command: `npm --workspace client exec vitest run src/screens/postNutrition.test.ts`
  - Command: `npm --workspace server run test`

- [ ] Review worktree diff for unrelated changes.
  - Command: `git status --short`
  - Command: `git diff -- client/src/types/api.ts client/src/screens/postNutrition.ts client/src/screens/postNutrition.test.ts client/src/screens/CreatePostScreen.tsx client/src/screens/HomeScreen.tsx server/src/models/Post.ts server/src/routes/posts.ts server/src/tests/api.test.ts`

## Spec Coverage Review

- Per-image analysis: covered by create-post wiring and helper tests.
- Combined post total: covered by `combineNutritionTotals` tests and publish wiring.
- Feed bottom sheet/modal: covered by `HomeScreen` task.
- Table detail rows: covered by formatting helper tests and modal render task.
- Backward compatibility: covered by optional server fields and legacy fallback helper test.
