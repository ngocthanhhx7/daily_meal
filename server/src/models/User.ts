import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    coverUrl: { type: String },
    bio: { type: String, default: "" },
    birthday: {
      date: { type: Date },
      visibility: { type: String, enum: ["hidden", "dayMonth", "full"], default: "hidden" }
    },
    preferences: {
      interests: { type: [String], default: [] },
      eatingStyles: { type: [String], default: [] },
      completedOnboarding: { type: Boolean, default: false }
    },
    isPremium: { type: Boolean, default: false },
    counts: {
      posts: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      friends: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
