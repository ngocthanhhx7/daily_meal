import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import {
  createPayosDescription,
  createPayosOrderCode,
  createPayosPaymentLink,
  getPremiumPlan,
  isValidPayosSignature,
  premiumPlans
} from "../services/payos.js";

export const paymentsRouter = Router();

const createPaymentSchema = z.object({
  planId: z.enum(["premium_month", "premium_quarter", "premium_half"])
});

const webhookSchema = z.object({
  code: z.string().optional(),
  desc: z.string().optional(),
  success: z.boolean().optional(),
  data: z.record(z.unknown()),
  signature: z.string().min(1)
});

function paymentDto(payment: any) {
  return {
    id: payment._id.toString(),
    planId: payment.planId,
    orderCode: payment.orderCode,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paymentLinkId: payment.paymentLinkId,
    checkoutUrl: payment.checkoutUrl,
    qrCode: payment.qrCode
  };
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

paymentsRouter.get("/premium/plans", (_req, res) => {
  res.json({ plans: premiumPlans });
});

paymentsRouter.post("/payos/create", requireAuth, async (req, res, next) => {
  try {
    const body = createPaymentSchema.parse(req.body);
    const plan = getPremiumPlan(body.planId);

    if (!plan) {
      throw new HttpError(400, "Gói Premium không hợp lệ.");
    }

    const orderCode = createPayosOrderCode();
    const description = createPayosDescription(orderCode);
    const payosLink = await createPayosPaymentLink({
      orderCode,
      amount: plan.amount,
      description
    });

    const payment = await Payment.create({
      provider: "payos",
      user: req.user?.id,
      planId: plan.id,
      orderCode,
      amount: plan.amount,
      currency: "VND",
      description,
      status: payosLink.status ?? "PENDING",
      paymentLinkId: payosLink.paymentLinkId,
      checkoutUrl: payosLink.checkoutUrl,
      qrCode: payosLink.qrCode,
      rawResponse: payosLink
    });

    res.status(201).json(paymentDto(payment));
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get("/payos/:orderCode", requireAuth, async (req, res, next) => {
  try {
    const orderCode = Number(req.params.orderCode);

    if (!Number.isFinite(orderCode)) {
      throw new HttpError(400, "Mã đơn hàng không hợp lệ.");
    }

    const payment = await Payment.findOne({ orderCode, user: req.user?.id });

    if (!payment) {
      throw new HttpError(404, "Không tìm thấy thanh toán.");
    }

    res.json(paymentDto(payment));
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post("/payos/webhook", async (req, res, next) => {
  try {
    const body = webhookSchema.parse(req.body);
    const data = body.data as Record<string, string | number | boolean | null | undefined>;

    if (!isValidPayosSignature(data, body.signature)) {
      throw new HttpError(400, "PayOS webhook signature không hợp lệ.");
    }

    const orderCode = Number(data.orderCode);

    if (!Number.isFinite(orderCode)) {
      throw new HttpError(400, "PayOS webhook thiếu mã đơn hàng.");
    }

    const payment = await Payment.findOne({ orderCode });

    if (!payment) {
      res.json({ success: true });
      return;
    }

    const isPaid = body.success !== false && (body.code === "00" || data.code === "00");

    if (isPaid && payment.status !== "PAID") {
      const plan = getPremiumPlan(payment.planId);
      const paidAt = new Date();
      payment.status = "PAID";
      payment.paidAt = paidAt;
      payment.webhookReference = typeof data.reference === "string" ? data.reference : undefined;
      payment.rawWebhook = req.body;
      await payment.save();

      if (plan) {
        const user = await User.findById(payment.user).select("premiumPaidEndsAt").lean();
        const currentPaidEndsAt = user?.premiumPaidEndsAt ? new Date(user.premiumPaidEndsAt) : undefined;
        const startsAt =
          currentPaidEndsAt && currentPaidEndsAt.getTime() > paidAt.getTime() ? currentPaidEndsAt : paidAt;
        await User.findByIdAndUpdate(payment.user, {
          $set: {
            isPremium: true,
            premiumPaidEndsAt: addMonths(startsAt, plan.durationMonths)
          }
        });
      }
    } else {
      payment.rawWebhook = req.body;
      await payment.save();
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
