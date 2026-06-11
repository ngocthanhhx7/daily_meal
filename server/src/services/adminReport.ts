import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

type AdminReportInput = {
  summary: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  from: string;
  to: string;
};

function reportPrompt(input: AdminReportInput) {
  return `Ban la he thong phan tich noi bo cua Daily Meal.
Hay tao bao cao quan tri bang tieng Viet, chi dua tren du lieu duoc cung cap, khong bau dien.

Tra ve JSON hop le theo dung cau truc:
{
  "title": "string",
  "executiveSummary": ["string"],
  "technical": ["string"],
  "behavioral": ["string"],
  "traffic": ["string"],
  "conversion": ["string"],
  "anomalies": ["string"],
  "priorityActions": ["string"],
  "risks": ["string"],
  "metricsSnapshot": { "key": "value" }
}

Nguyen tac:
- Viet ngan gon, ro rang, uu tien so lieu va hanh dong.
- Neu mot chi so chua co du lieu, ghi nhan ro "chua instrumented" hoac "khong co du lieu".
- Nho dong goi tren them outliers, xu huong, rui ro, hanh dong uu tien.

Du lieu:
FROM: ${input.from}
TO: ${input.to}
SUMMARY: ${JSON.stringify(input.summary)}
DASHBOARD: ${JSON.stringify(input.dashboard)}
`;
}

function fallbackReport(input: AdminReportInput) {
  return {
    title: "Bao cao quan tri Daily Meal",
    executiveSummary: [
      "He thong da tong hop duoc cac nhom KPI chinh cho khu vuc admin.",
      "Can uu tien theo doi do on dinh ky thuat, do tuong tac feed, va ty le chuyen doi sang tao noi dung."
    ],
    technical: [
      "Chua co du lieu AI hoac telemetry day du cho moi KPI ky thuat thi se duoc danh dau ro.",
      "Nen tiep tuc instrument response time, image load speed, crash va unhandled rejection o muc dung chung."
    ],
    behavioral: [
      "Bao cao can theo doi session duration, bounce rate va scroll depth de danh gia chat luong noi dung.",
      "Neu scroll depth thap hoac bounce rate cao, feed dau vao can duoc dieu chinh."
    ],
    traffic: [
      "Theo doi DAU/WAU/MAU va returning users de phan biet tang truong that voi tang truong ao."
    ],
    conversion: [
      "Theo doi post creation, meal analysis va premium funnel de phat hien do ro chai trong cac luong chuyen doi."
    ],
    anomalies: [
      "Khong co du lieu phat hien bat thuong duoc sinh tu fallback report."
    ],
    priorityActions: [
      "Hoan thien dashboard admin voi chart va breakdown ro rang.",
      "Mo rong soft moderation va audit trail.",
      "Duy tri bo do telemetry chung de bao cao AI co du lieu day du hon."
    ],
    risks: [
      "AI report fallback se chi la tong hop quy tac neu provider chua san sang.",
      "Du lieu metrics ky thuat co the con thieu instrumentation."
    ],
    metricsSnapshot: {
      from: input.from,
      to: input.to,
      mode: "fallback"
    }
  };
}

function parseJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

export async function generateAdminReport(input: AdminReportInput) {
  if (!env.SHINESHOP_API_KEY || !env.SHINESHOP_BASE_URL) {
    return fallbackReport(input);
  }

  const response = await fetch(`${env.SHINESHOP_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SHINESHOP_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.SHINESHOP_MODEL,
      messages: [
        {
          role: "user",
          content: reportPrompt(input)
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: env.SHINESHOP_MAX_TOKENS
    })
  });

  const result = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new HttpError(502, result.error?.message || "Khong the tao bao cao AI.");
  }

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "AI khong tra noi dung bao cao.");
  }

  const parsed = parseJson(content) as Record<string, unknown>;
  return {
    title: String(parsed.title ?? "Bao cao quan tri Daily Meal"),
    executiveSummary: Array.isArray(parsed.executiveSummary) ? parsed.executiveSummary.map(String) : [],
    technical: Array.isArray(parsed.technical) ? parsed.technical.map(String) : [],
    behavioral: Array.isArray(parsed.behavioral) ? parsed.behavioral.map(String) : [],
    traffic: Array.isArray(parsed.traffic) ? parsed.traffic.map(String) : [],
    conversion: Array.isArray(parsed.conversion) ? parsed.conversion.map(String) : [],
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies.map(String) : [],
    priorityActions: Array.isArray(parsed.priorityActions) ? parsed.priorityActions.map(String) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    metricsSnapshot: parsed.metricsSnapshot ?? {}
  };
}
