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
    note: { type: String, default: "", maxlength: 1000 }
  },
  { timestamps: true }
);

userInteractionSchema.index({ actor: 1, target: 1, type: 1 }, { unique: true });

export type UserInteractionDocument = InferSchemaType<typeof userInteractionSchema>;
export const UserInteraction = model("UserInteraction", userInteractionSchema);
