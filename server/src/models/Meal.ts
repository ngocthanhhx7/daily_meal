import { Schema, model, Types, type InferSchemaType } from "mongoose";

const macroSchema = new Schema(
  {
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true }
  },
  { _id: false }
);

const mealItemSchema = new Schema(
  {
    name: { type: String, required: true },
    portion: { type: String, required: true },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    confidence: { type: Number, required: true }
  },
  { _id: false }
);

const mealSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    image: {
      url: { type: String, required: true },
      localPath: { type: String },
      uploadId: { type: Types.ObjectId, ref: "Upload" }
    },
    result: {
      items: { type: [mealItemSchema], default: [] },
      total: { type: macroSchema, required: true },
      warnings: { type: [String], default: [] },
      raw: { type: Schema.Types.Mixed }
    },
    linkedPostId: { type: Types.ObjectId, ref: "Post" }
  },
  { timestamps: true }
);

export type MealDocument = InferSchemaType<typeof mealSchema>;
export const Meal = model("Meal", mealSchema);
