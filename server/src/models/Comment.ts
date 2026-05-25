import { Schema, model, Types, type InferSchemaType } from "mongoose";

const commentSchema = new Schema(
  {
    post: { type: Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export type CommentDocument = InferSchemaType<typeof commentSchema>;
export const Comment = model("Comment", commentSchema);
