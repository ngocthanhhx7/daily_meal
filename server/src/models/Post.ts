import { Schema, model, Types, type InferSchemaType } from "mongoose";

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    localPath: { type: String },
    uploadId: { type: Types.ObjectId, ref: "Upload" }
  },
  { _id: false }
);

const imageTransformSchema = new Schema(
  {
    scale: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    offsetX: { type: Number, default: 0 },
    offsetY: { type: Number, default: 0 }
  },
  { _id: false }
);

const stickerPlacementSchema = new Schema(
  {
    x: { type: Number, default: 0.78 },
    y: { type: Number, default: 0.78 },
    scale: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 }
  },
  { _id: false }
);

const nutritionSummarySchema = new Schema(
  {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 }
  },
  { _id: false }
);

const nutritionItemSchema = new Schema(
  {
    name: { type: String, default: "" },
    portion: { type: String, default: "" },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 }
  },
  { _id: false }
);

const nutritionDetailSchema = new Schema(
  {
    imageIndex: { type: Number, required: true },
    items: { type: [nutritionItemSchema], default: [] },
    total: { type: nutritionSummarySchema, required: true },
    warnings: { type: [String], default: [] },
    mealId: { type: Types.ObjectId, ref: "Meal" }
  },
  { _id: false }
);

const recipeSchema = new Schema(
  {
    title: { type: String, default: "" },
    ingredients: { type: [String], default: [] },
    steps: { type: [String], default: [] }
  },
  { _id: false }
);

const imageRecipeSchema = new Schema(
  {
    imageIndex: { type: Number, required: true },
    title: { type: String, default: "" },
    ingredients: { type: [String], default: [] },
    steps: { type: [String], default: [] }
  },
  { _id: false }
);

const postSchema = new Schema(
  {
    author: { type: Types.ObjectId, ref: "User", required: true, index: true },
    images: { type: [imageSchema], default: [] },
    layout: { type: String, enum: ["stack", "grid", "cascade"], default: "stack" },
    imageTransforms: { type: [imageTransformSchema], default: [] },
    caption: { type: String, default: "" },
    tags: { type: [String], default: [] },
    recipe: { type: recipeSchema, default: () => ({}) },
    recipes: { type: [imageRecipeSchema], default: [] },
    nutritionSummary: { type: nutritionSummarySchema },
    nutritionDetails: { type: [nutritionDetailSchema], default: [] },
    mealId: { type: Types.ObjectId, ref: "Meal" },
    stickerId: { type: Types.ObjectId, ref: "Sticker" },
    stickerPlacement: { type: stickerPlacementSchema },
    visibility: { type: String, enum: ["public", "private"], default: "public", index: true },
    stats: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      saves: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

postSchema.index({ caption: "text", tags: "text", "recipe.title": "text" });

export type PostDocument = InferSchemaType<typeof postSchema>;
export const Post = model("Post", postSchema);
