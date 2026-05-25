import { Schema, model, type InferSchemaType } from "mongoose";

const stickerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    assetPath: { type: String, required: true },
    premiumOnly: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export type StickerDocument = InferSchemaType<typeof stickerSchema>;
export const Sticker = model("Sticker", stickerSchema);
