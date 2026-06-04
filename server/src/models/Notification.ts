import { Schema, model, Types, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["like", "comment", "follow", "message"], required: true },
    post: { type: Types.ObjectId, ref: "Post", index: true },
    comment: { type: Types.ObjectId, ref: "Comment" },
    body: { type: String, required: true },
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
export const Notification = model("Notification", notificationSchema);
