import { Schema, model, Types, type InferSchemaType } from "mongoose";

const postSaveSchema = new Schema(
  {
    post: { type: Types.ObjectId, ref: "Post", required: true, index: true },
    user: { type: Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true }
);

postSaveSchema.index({ post: 1, user: 1 }, { unique: true });

export type PostSaveDocument = InferSchemaType<typeof postSaveSchema>;
export const PostSave = model("PostSave", postSaveSchema);
