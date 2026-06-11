import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

type AdminReportInput = {
  summary: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  from: string;
  to: string;
};

function reportPrompt(input: AdminReportInput) {
  return `Bạn là hệ thống phân tích nội bộ của Daily Meal.
Hãy tạo báo cáo quản trị bằng tiếng Việt có dấu, chỉ dựa trên dữ liệu được cung cấp, không bịa đặt.

Trả về JSON hợp lệ theo đúng cấu trúc:
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

Nguyên tắc:
- Viết ngắn gọn, rõ ràng, ưu tiên số liệu và hành động.
- Nếu một chỉ số chưa có dữ liệu, ghi nhận rõ "chưa instrumented" hoặc "không có dữ liệu".
- Giữ nguyên các nhãn kỹ thuật như "not_instrumented" nếu chúng là giá trị dữ liệu.
- Bao gồm xu hướng, bất thường, rủi ro và hành động ưu tiên.

Dữ liệu:
FROM: ${input.from}
TO: ${input.to}
SUMMARY: ${JSON.stringify(input.summary)}
DASHBOARD: ${JSON.stringify(input.dashboard)}
`;
}

function fallbackReport(input: AdminReportInput) {
  return {
    title: "Báo cáo quản trị Daily Meal",
    executiveSummary: [
      "Hệ thống đã tổng hợp các nhóm KPI chính cho khu vực admin.",
      "Cần ưu tiên theo dõi độ ổn định kỹ thuật, mức tương tác feed và tỷ lệ chuyển đổi sang tạo nội dung."
    ],
    technical: [
      "Nếu dữ liệu AI hoặc telemetry chưa đầy đủ, báo cáo sẽ đánh dấu rõ các chỉ số chưa instrumented.",
      "Nên tiếp tục đo thời gian phản hồi API, tốc độ tải ảnh, crash và unhandled rejection ở lớp dùng chung."
    ],
    behavioral: [
      "Cần theo dõi thời lượng phiên, bounce rate và scroll depth để đánh giá chất lượng nội dung.",
      "Nếu scroll depth thấp hoặc bounce rate cao, chiến lược nội dung feed cần được điều chỉnh."
    ],
    traffic: [
      "Theo dõi DAU, WAU, MAU và returning users để phân biệt tăng trưởng thật với tăng trưởng ngắn hạn."
    ],
    conversion: [
      "Theo dõi post creation, meal analysis và premium funnel để phát hiện điểm rơi trong các luồng chuyển đổi."
    ],
    anomalies: [
      "Không có dữ liệu phát hiện bất thường được sinh từ fallback report."
    ],
    priorityActions: [
      "Hoàn thiện dashboard admin với chart và breakdown rõ ràng.",
      "Duy trì soft moderation và audit trail cho mọi hành động quan trọng.",
      "Tiếp tục mở rộng telemetry dùng chung để báo cáo AI có dữ liệu đầy đủ hơn."
    ],
    risks: [
      "AI report fallback chỉ là tổng hợp theo quy tắc nếu provider chưa sẵn sàng.",
      "Dữ liệu kỹ thuật có thể còn thiếu instrumentation ở một số bề mặt."
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
    throw new HttpError(502, result.error?.message || "Không thể tạo báo cáo AI.");
  }

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "AI không trả nội dung báo cáo.");
  }

  const parsed = parseJson(content) as Record<string, unknown>;
  return {
    title: String(parsed.title ?? "Báo cáo quản trị Daily Meal"),
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
