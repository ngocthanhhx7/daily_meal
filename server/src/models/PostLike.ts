import { Schema, model, Types, type InferSchemaType } from "mongoose";

const postLikeSchema = new Schema(
  {
    post: { type: Types.ObjectId, ref: "Post", required: true, index: true },
    user: { type: Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true }
);

postLikeSchema.index({ post: 1, user: 1 }, { unique: true });

export type PostLikeDocument = InferSchemaType<typeof postLikeSchema>;
export const PostLike = model("PostLike", postLikeSchema);
