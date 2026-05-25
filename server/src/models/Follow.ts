import { Schema, model, Types, type InferSchemaType } from "mongoose";

const followSchema = new Schema(
  {
    follower: { type: Types.ObjectId, ref: "User", required: true, index: true },
    following: { type: Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });

export type FollowDocument = InferSchemaType<typeof followSchema>;
export const Follow = model("Follow", followSchema);
