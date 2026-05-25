import { Schema, model, Types, type InferSchemaType } from "mongoose";

const uploadSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["post", "meal", "avatar", "cover", "sticker", "other"],
      default: "other"
    },
    url: { type: String, required: true },
    localPath: { type: String, required: true },
    originalName: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { timestamps: true }
);

export type UploadDocument = InferSchemaType<typeof uploadSchema>;
export const Upload = model("Upload", uploadSchema);
