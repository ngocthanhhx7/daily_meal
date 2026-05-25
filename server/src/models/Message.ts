import { Schema, model, Types, type InferSchemaType } from "mongoose";

const messageSchema = new Schema(
  {
    conversation: { type: Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readBy: [{ type: Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export type MessageDocument = InferSchemaType<typeof messageSchema>;
export const Message = model("Message", messageSchema);
