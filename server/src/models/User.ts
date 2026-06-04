import { Schema, model, type InferSchemaType } from "mongoose";

const otpSchema = new Schema(
  {
    codeHash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String },
    phoneOtp: { type: otpSchema, default: undefined },
    passwordResetOtp: { type: otpSchema, default: undefined },
    facebookId: { type: String },
    authProviders: {
      google: {
        sub: { type: String },
        email: { type: String, lowercase: true, trim: true },
        linkedAt: { type: Date }
      }
    },
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
    themeColor: { type: String, default: "#8BA58A" },
    pushTokens: { type: [String], default: [] },
    webPushSubscriptions: {
      type: [
        {
          endpoint: { type: String, required: true },
          expirationTime: { type: Number, default: null },
          keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true }
          },
          userAgent: { type: String },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
    counts: {
      posts: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      friends: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } }, name: "email_1" }
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } }, name: "phone_1" }
);
userSchema.index(
  { facebookId: 1 },
  { unique: true, partialFilterExpression: { facebookId: { $type: "string" } }, name: "facebookId_1" }
);
userSchema.index(
  { "authProviders.google.sub": 1 },
  {
    unique: true,
    partialFilterExpression: { "authProviders.google.sub": { $type: "string" } },
    name: "authProviders.google.sub_1"
  }
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
