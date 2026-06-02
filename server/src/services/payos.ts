import crypto from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

export type PremiumPlan = {
  id: "premium_month" | "premium_quarter" | "premium_half";
  name: string;
  displayPrice: string;
  amount: number;
  durationMonths: number;
};

export const premiumPlans: PremiumPlan[] = [
  {
    id: "premium_month",
    name: "Gói tháng",
    displayPrice: "39k/tháng",
    amount: 39000,
    durationMonths: 1
  },
  {
    id: "premium_quarter",
    name: "Gói 3 tháng",
    displayPrice: "99k/3 tháng",
    amount: 99000,
    durationMonths: 3
  },
  {
    id: "premium_half",
    name: "Gói 6 tháng",
    displayPrice: "199k/6 tháng",
    amount: 199000,
    durationMonths: 6
  }
];

type SignatureValue = string | number | boolean | null | undefined | Record<string, unknown>[];

type PaymentLinkResponse = {
  orderCode: number;
  amount: number;
  paymentLinkId: string;
  status: "PENDING" | "PAID" | "PROCESSING" | "CANCELLED" | "EXPIRED";
  checkoutUrl: string;
  qrCode?: string;
};

function requirePayosConfig() {
  if (
    !env.PAYOS_CLIENT_ID ||
    !env.PAYOS_API_KEY ||
    !env.PAYOS_CHECKSUM_KEY ||
    !env.PAYOS_RETURN_URL ||
    !env.PAYOS_CANCEL_URL
  ) {
    throw new HttpError(500, "PayOS chưa được cấu hình trên server.");
  }

  return {
    clientId: env.PAYOS_CLIENT_ID,
    apiKey: env.PAYOS_API_KEY,
    checksumKey: env.PAYOS_CHECKSUM_KEY,
    returnUrl: env.PAYOS_RETURN_URL,
    cancelUrl: env.PAYOS_CANCEL_URL,
    apiBaseUrl: env.PAYOS_API_BASE_URL
  };
}

function sortRecord(value: Record<string, unknown>) {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = value[key];
      return sorted;
    }, {});
}

export function toPayosSignatureData(data: Record<string, SignatureValue>) {
  return Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      let value = data[key];

      if (Array.isArray(value)) {
        value = JSON.stringify(value.map((item) => sortRecord(item)));
      }

      if ([null, undefined, "undefined", "null"].includes(value as null | undefined | string)) {
        value = "";
      }

      return `${key}=${value}`;
    })
    .join("&");
}

export function createPayosSignature(data: Record<string, SignatureValue>, checksumKey = env.PAYOS_CHECKSUM_KEY) {
  if (!checksumKey) {
    throw new HttpError(500, "PayOS checksum key chưa được cấu hình.");
  }

  return crypto.createHmac("sha256", checksumKey).update(toPayosSignatureData(data)).digest("hex");
}

export function isValidPayosSignature(
  data: Record<string, SignatureValue>,
  signature: string,
  checksumKey = env.PAYOS_CHECKSUM_KEY
) {
  return createPayosSignature(data, checksumKey) === signature;
}

export function getPremiumPlan(planId: string) {
  return premiumPlans.find((plan) => plan.id === planId);
}

export function createPayosOrderCode() {
  const timestampPart = Date.now().toString().slice(-9);
  const randomPart = crypto.randomInt(0, 100).toString().padStart(2, "0");
  return Number(`${timestampPart}${randomPart}`);
}

export function createPayosDescription(orderCode: number) {
  return `DM${orderCode.toString().slice(-7)}`;
}

export async function createPayosPaymentLink(input: {
  orderCode: number;
  amount: number;
  description: string;
}) {
  const config = requirePayosConfig();
  const payload = {
    orderCode: input.orderCode,
    amount: input.amount,
    description: input.description,
    returnUrl: config.returnUrl,
    cancelUrl: config.cancelUrl,
    signature: createPayosSignature({
      amount: input.amount,
      cancelUrl: config.cancelUrl,
      description: input.description,
      orderCode: input.orderCode,
      returnUrl: config.returnUrl
    }, config.checksumKey)
  };

  const response = await fetch(`${config.apiBaseUrl}/v2/payment-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": config.clientId,
      "x-api-key": config.apiKey
    },
    body: JSON.stringify(payload)
  });
  const result = (await response.json().catch(() => ({}))) as {
    code?: string;
    desc?: string;
    data?: PaymentLinkResponse;
  };

  if (!response.ok || result.code !== "00" || !result.data?.checkoutUrl) {
    throw new HttpError(502, result.desc || "Không thể tạo link thanh toán PayOS.");
  }

  return result.data;
}
