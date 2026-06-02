import { Schema, model, type InferSchemaType } from "mongoose";

const paymentSchema = new Schema(
  {
    provider: { type: String, enum: ["payos"], required: true, default: "payos" },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: {
      type: String,
      enum: ["premium_month", "premium_quarter", "premium_half"],
      required: true
    },
    orderCode: { type: Number, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "VND" },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "PROCESSING", "CANCELLED", "EXPIRED"],
      required: true,
      default: "PENDING",
      index: true
    },
    paymentLinkId: { type: String, index: true },
    checkoutUrl: { type: String },
    qrCode: { type: String },
    paidAt: { type: Date },
    canceledAt: { type: Date },
    webhookReference: { type: String },
    rawResponse: { type: Schema.Types.Mixed },
    rawWebhook: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export type PaymentDocument = InferSchemaType<typeof paymentSchema>;
export const Payment = model("Payment", paymentSchema);
