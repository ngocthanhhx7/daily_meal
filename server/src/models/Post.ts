import { Schema, model, Types, type InferSchemaType } from "mongoose";

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    localPath: { type: String },
    uploadId: { type: Types.ObjectId, ref: "Upload" }
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

const recipeSchema = new Schema(
  {
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
    caption: { type: String, default: "" },
    tags: { type: [String], default: [] },
    recipe: { type: recipeSchema, default: () => ({}) },
    nutritionSummary: { type: nutritionSummarySchema },
    mealId: { type: Types.ObjectId, ref: "Meal" },
    stickerId: { type: Types.ObjectId, ref: "Sticker" },
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
