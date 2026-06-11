import { Schema, model, Types, type InferSchemaType } from "mongoose";

const userInteractionSchema = new Schema(
  {
    actor: { type: Types.ObjectId, ref: "User", required: true, index: true },
    target: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["restrict", "block", "report"],
      required: true,
      index: true
    },
    note: { type: String, default: "", maxlength: 1000 },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
      index: true
    },
    adminNote: { type: String, default: "", maxlength: 1000 },
    resolvedAt: { type: Date },
    resolvedBy: { type: String, trim: true }
  },
  { timestamps: true }
);

userInteractionSchema.index({ actor: 1, target: 1, type: 1 }, { unique: true });
userInteractionSchema.index({ type: 1, status: 1, createdAt: -1 });

export type UserInteractionDocument = InferSchemaType<typeof userInteractionSchema>;
export const UserInteraction = model("UserInteraction", userInteractionSchema);
