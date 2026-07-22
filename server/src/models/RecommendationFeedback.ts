import { Schema, model, Types, type InferSchemaType } from "mongoose";

const recommendationFeedbackSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    targetKey: { type: String, required: true, trim: true, maxlength: 200 },
    targetType: { type: String, enum: ["meal", "restaurant"], required: true },
    action: {
      type: String,
      enum: ["liked", "dismissed", "opened_recipe", "opened_restaurant"],
      required: true
    }
  },
  { timestamps: true }
);

recommendationFeedbackSchema.index({ user: 1, targetKey: 1, action: 1, createdAt: -1 });

export type RecommendationFeedbackDocument = InferSchemaType<typeof recommendationFeedbackSchema>;
export const RecommendationFeedback = model("RecommendationFeedback", recommendationFeedbackSchema);
