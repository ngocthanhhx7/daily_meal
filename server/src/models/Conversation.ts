import { Schema, model, Types, type InferSchemaType } from "mongoose";

const conversationSchema = new Schema(
  {
    participants: [{ type: Types.ObjectId, ref: "User", required: true, index: true }],
    participantKey: { type: String, required: true, unique: true, index: true },
    lastMessage: {
      body: { type: String, default: "" },
      sender: { type: Types.ObjectId, ref: "User" },
      sentAt: { type: Date }
    }
  },
  { timestamps: true }
);

export type ConversationDocument = InferSchemaType<typeof conversationSchema>;
export const Conversation = model("Conversation", conversationSchema);
