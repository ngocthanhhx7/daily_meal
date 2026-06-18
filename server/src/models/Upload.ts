import { Schema, model, Types, type InferSchemaType } from "mongoose";

const uploadSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["post", "meal", "avatar", "cover", "sticker", "other"],
      default: "other"
    },
    mediaType: { type: String, enum: ["image", "video"], default: "image", index: true },
    url: { type: String, required: true },
    storageProvider: {
      type: String,
      enum: ["local", "s3"],
      default: "local"
    },
    localPath: { type: String },
    s3Bucket: { type: String },
    s3Key: { type: String },
    etag: { type: String },
    originalName: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { timestamps: true }
);

export type UploadDocument = InferSchemaType<typeof uploadSchema>;
export const Upload = model("Upload", uploadSchema);
