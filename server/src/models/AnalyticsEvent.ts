import { Schema, model, Types, type InferSchemaType } from "mongoose";

// Internal analytics event contract:
// - name: stable snake_case event name, e.g. feed_impression, feed_click,
//   scroll_depth, session_start, session_end, post_create_started,
//   post_create_completed, meal_analysis_started, meal_analysis_completed,
//   premium_viewed, payment_completed.
// - sessionId: client-generated session identifier.
// - anonymousId: client-generated anonymous identifier for signed-out users.
// - user: set server-side from a valid bearer token; clients must not send user ids.
// - properties: small JSON object for metric-specific values such as durationMs,
//   scrollDepth, scrollDepthPercent, targetType, targetId, planId, or step.
const analyticsEventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, index: true },
    occurredAt: { type: Date, required: true, index: true },
    receivedAt: { type: Date, required: true, default: Date.now, index: true },
    sessionId: { type: String, required: true, trim: true, maxlength: 128, index: true },
    anonymousId: { type: String, trim: true, maxlength: 128, index: true },
    subjectKey: { type: String, required: true, trim: true, maxlength: 160, index: true },
    user: { type: Types.ObjectId, ref: "User", index: true },
    source: { type: String, enum: ["client", "server", "system"], default: "client", index: true },
    platform: { type: String, trim: true, maxlength: 40 },
    appVersion: { type: String, trim: true, maxlength: 40 },
    screen: { type: String, trim: true, maxlength: 80 },
    targetType: { type: String, trim: true, maxlength: 80 },
    targetId: { type: String, trim: true, maxlength: 160 },
    value: { type: Number },
    properties: { type: Schema.Types.Mixed, default: {} }
  },
  { versionKey: false }
);

analyticsEventSchema.index({ name: 1, occurredAt: -1 });
analyticsEventSchema.index({ subjectKey: 1, occurredAt: -1 });
analyticsEventSchema.index({ sessionId: 1, occurredAt: 1 });
analyticsEventSchema.index({ anonymousId: 1, occurredAt: -1 }, { sparse: true });
analyticsEventSchema.index({ user: 1, occurredAt: -1 }, { sparse: true });
analyticsEventSchema.index({ source: 1, name: 1, occurredAt: -1 });

export type AnalyticsEventDocument = InferSchemaType<typeof analyticsEventSchema>;
export const AnalyticsEvent = model("AnalyticsEvent", analyticsEventSchema);
