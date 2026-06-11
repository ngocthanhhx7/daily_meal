import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

type AdminReportInput = {
  summary: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  from: string;
  to: string;
};

type ReportMetric = {
  name: string;
  value: string;
  assessment: string;
  meaning: string;
};

type ReportSection = {
  key: "technical" | "behavioral" | "traffic" | "conversion";
  title: string;
  objective: string;
  metrics: ReportMetric[];
  insights: string[];
  conclusion: string;
  actions: string[];
};

const AI_REPORT_TIMEOUT_MS = 20000;

function reportPrompt(input: AdminReportInput) {
  return `Bạn là hệ thống phân tích nội bộ của Daily Meal.
Hãy tạo báo cáo quản trị bằng tiếng Việt có dấu theo đúng tài liệu KPI Daily Meal.
Chỉ dựa trên dữ liệu được cung cấp, không bịa đặt số liệu. Nếu thiếu dữ liệu, ghi rõ "chưa instrumented" hoặc "không có dữ liệu".

Trả về JSON hợp lệ theo đúng cấu trúc:
{
  "title": "string",
  "executiveSummary": ["3-5 nhận định tổng quan có số liệu"],
  "sections": [
    {
      "key": "technical",
      "title": "1. Chỉ số hiệu suất kỹ thuật",
      "objective": "Mục tiêu đo lường của nhóm chỉ số này",
      "metrics": [
        { "name": "Tốc độ tải ảnh đồ ăn", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Tỷ lệ crash/runtime", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Thời gian phản hồi máy chủ", "value": "string", "assessment": "string", "meaning": "string" }
      ],
      "insights": ["2-4 phân tích gắn với dữ liệu"],
      "conclusion": "Kết luận rõ ràng cho nhóm này",
      "actions": ["2-4 hành động ưu tiên"]
    },
    {
      "key": "behavioral",
      "title": "2. Chỉ số tương tác người dùng",
      "objective": "string",
      "metrics": [
        { "name": "Thời lượng phiên trung bình", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Độ sâu cuộn trang", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "CTR feed", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Bounce rate", "value": "string", "assessment": "string", "meaning": "string" }
      ],
      "insights": ["2-4 phân tích gắn với dữ liệu"],
      "conclusion": "string",
      "actions": ["2-4 hành động ưu tiên"]
    },
    {
      "key": "traffic",
      "title": "3. Chỉ số lưu lượng truy cập",
      "objective": "string",
      "metrics": [
        { "name": "DAU / WAU / MAU", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Người dùng mới", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Người dùng quay lại", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Nguồn truy cập", "value": "string", "assessment": "string", "meaning": "string" }
      ],
      "insights": ["2-4 phân tích gắn với dữ liệu"],
      "conclusion": "string",
      "actions": ["2-4 hành động ưu tiên"]
    },
    {
      "key": "conversion",
      "title": "4. Chỉ số chuyển đổi",
      "objective": "string",
      "metrics": [
        { "name": "Lurker -> Creator", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Hoàn tất đăng bài", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Hoàn tất AI món ăn", "value": "string", "assessment": "string", "meaning": "string" },
        { "name": "Thanh toán premium", "value": "string", "assessment": "string", "meaning": "string" }
      ],
      "insights": ["2-4 phân tích gắn với dữ liệu"],
      "conclusion": "string",
      "actions": ["2-4 hành động ưu tiên"]
    }
  ],
  "anomalies": ["string"],
  "priorityActions": ["5-7 hành động ưu tiên, sắp theo tác động"],
  "risks": ["string"],
  "metricsSnapshot": { "key": "value" }
}

Nguyên tắc:
- Bắt buộc có đủ 4 section theo tài liệu: kỹ thuật, hành vi, lưu lượng, chuyển đổi.
- Mỗi metric phải có value, assessment và meaning. Không để value rỗng.
- Viết ngắn gọn, rõ ràng, ưu tiên số liệu, ý nghĩa và hành động.
- Giữ nguyên các nhãn kỹ thuật như "not_instrumented" nếu chúng là giá trị dữ liệu.
- Không trả markdown, không trả văn bản ngoài JSON.

Dữ liệu:
FROM: ${input.from}
TO: ${input.to}
SUMMARY: ${JSON.stringify(input.summary)}
DASHBOARD: ${JSON.stringify(input.dashboard)}
`;
}

function readNumber(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const part of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : undefined;
}

function formatNumber(value?: number) {
  return typeof value === "number" ? Math.round(value).toLocaleString("vi-VN") : "không có dữ liệu";
}

function formatMs(value?: number) {
  return typeof value === "number" ? `${Math.round(value).toLocaleString("vi-VN")} ms` : "chưa instrumented";
}

function formatSeconds(value?: number) {
  return typeof value === "number" ? `${Math.round(value / 1000).toLocaleString("vi-VN")} giây` : "chưa instrumented";
}

function formatPercent(value?: number) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "chưa instrumented";
}

function formatPercentFromValue(value?: number) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "chưa instrumented";
}

function assessLowerBetter(value: number | undefined, good: number, warn: number, unit: string) {
  if (typeof value !== "number") return "Chưa có tín hiệu đo lường.";
  if (value <= good) return `Tốt, đang dưới ngưỡng ${good}${unit}.`;
  if (value <= warn) return `Cần theo dõi, đã vượt ngưỡng tốt ${good}${unit}.`;
  return `Rủi ro cao, vượt ngưỡng cảnh báo ${warn}${unit}.`;
}

function assessHigherBetter(value: number | undefined, good: number, warn: number, unit: string) {
  if (typeof value !== "number") return "Chưa có tín hiệu đo lường.";
  if (value >= good) return `Tốt, đạt từ ${good}${unit} trở lên.`;
  if (value >= warn) return `Trung bình, cần tối ưu để vượt ${good}${unit}.`;
  return `Yếu, đang dưới ngưỡng ${warn}${unit}.`;
}

function metric(name: string, value: string, assessment: string, meaning: string): ReportMetric {
  return { name, value, assessment, meaning };
}

function buildFallbackSections(input: AdminReportInput): ReportSection[] {
  const { summary, dashboard } = input;
  const totalUsers = readNumber(dashboard, ["totalsInRange", "users"]);
  const totalPosts = readNumber(dashboard, ["totalsInRange", "posts"]);
  const totalInteractions =
    (readNumber(dashboard, ["totalsInRange", "likes"]) ?? 0) +
    (readNumber(dashboard, ["totalsInRange", "saves"]) ?? 0) +
    (readNumber(dashboard, ["totalsInRange", "comments"]) ?? 0);
  const averageApiResponseMs = readNumber(summary, ["technical", "averageApiResponseMs"]);
  const averageImageLoadMs = readNumber(summary, ["technical", "averageImageLoadMs"]);
  const crashRate = readNumber(summary, ["technical", "crashRate"]);
  const apiFailureRate = readNumber(summary, ["technical", "apiFailureRate"]);
  const averageDurationMs = readNumber(summary, ["sessions", "averageDurationMs"]);
  const scrollDepth = readNumber(summary, ["feed", "averageScrollDepth"]);
  const feedCtr = readNumber(summary, ["feed", "ctr"]);
  const bounceRate = readNumber(summary, ["sessions", "bounceRate"]);
  const sessions = readNumber(summary, ["sessions", "total"]);
  const dau = readNumber(summary, ["activeUsers", "dau"]);
  const wau = readNumber(summary, ["activeUsers", "wau"]);
  const mau = readNumber(summary, ["activeUsers", "mau"]);
  const returning = readNumber(summary, ["activeUsers", "returning"]);
  const creatorRate = readNumber(summary, ["creatorConversion", "rate"]);
  const postCompletion = readNumber(summary, ["postCreation", "completionRate"]);
  const mealAiCompletion = readNumber(summary, ["mealAnalysis", "completionRate"]);
  const premiumPayment = readNumber(summary, ["premiumFunnel", "paymentCompletionRate"]);
  const lurkerToCreator = totalUsers && totalUsers > 0 && typeof totalPosts === "number" ? totalPosts / totalUsers : undefined;

  return [
    {
      key: "technical",
      title: "1. Chỉ số hiệu suất kỹ thuật",
      objective: "Đảm bảo app ảnh đồ ăn tải nhanh, ổn định và không làm người dùng rời bỏ vì lỗi kỹ thuật.",
      metrics: [
        metric(
          "Tốc độ tải ảnh đồ ăn",
          formatMs(averageImageLoadMs),
          assessLowerBetter(averageImageLoadMs, 800, 1500, "ms"),
          "Ảnh là nội dung chính của mạng xã hội đồ ăn; tải chậm sẽ làm giảm kiên nhẫn và tăng nguy cơ thoát app."
        ),
        metric(
          "Tỷ lệ crash/runtime",
          formatPercent(crashRate),
          assessLowerBetter(crashRate, 0.01, 0.03, "%"),
          "Crash hoặc lỗi runtime phá vỡ trực tiếp trải nghiệm giữ chân người dùng."
        ),
        metric(
          "Thời gian phản hồi máy chủ",
          formatMs(averageApiResponseMs),
          assessLowerBetter(averageApiResponseMs, 300, 800, "ms"),
          "API phản hồi chậm khiến feed, bình luận, đăng bài và thanh toán có cảm giác thiếu mượt."
        ),
        metric(
          "Tỷ lệ lỗi API",
          formatPercent(apiFailureRate),
          assessLowerBetter(apiFailureRate, 0.01, 0.05, "%"),
          "Tỷ lệ lỗi API giúp phát hiện điểm nghẽn kỹ thuật trước khi người dùng phản ánh."
        )
      ],
      insights: [
        `Trong khoảng báo cáo ghi nhận ${formatNumber(totalPosts)} bài đăng và ${formatNumber(totalInteractions)} tương tác, nên hiệu suất tải ảnh/API ảnh hưởng trực tiếp tới luồng nội dung.`,
        averageImageLoadMs || averageApiResponseMs
          ? "Các tín hiệu kỹ thuật đã có dữ liệu một phần, có thể dùng để theo dõi xu hướng theo thời gian."
          : "Một số tín hiệu kỹ thuật còn chưa instrumented, cần bổ sung đo lường trước khi kết luận xu hướng."
      ],
      conclusion: "Hiệu suất kỹ thuật là nền tảng bắt buộc; nếu tải ảnh, API hoặc runtime không ổn định, mọi tính năng cộng đồng phía trên đều bị suy giảm.",
      actions: [
        "Theo dõi riêng p95/p99 cho tải ảnh và API thay vì chỉ dùng trung bình.",
        "Ưu tiên log lỗi runtime kèm màn hình, phiên và user id ẩn danh để truy vết.",
        "Cảnh báo khi thời gian tải ảnh hoặc phản hồi API vượt ngưỡng trong 2 ngày liên tiếp."
      ]
    },
    {
      key: "behavioral",
      title: "2. Chỉ số tương tác người dùng",
      objective: "Đánh giá nội dung đồ ăn có đủ hấp dẫn để người dùng ở lại, cuộn tiếp và tương tác hay không.",
      metrics: [
        metric(
          "Thời lượng phiên trung bình",
          formatSeconds(averageDurationMs),
          assessHigherBetter(averageDurationMs ? averageDurationMs / 1000 : undefined, 300, 120, " giây"),
          "Thời lượng phiên phản ánh mức độ người dùng thật sự dành thời gian cho app."
        ),
        metric(
          "Độ sâu cuộn trang",
          formatPercentFromValue(scrollDepth),
          assessHigherBetter(scrollDepth, 60, 30, "%"),
          "Scroll depth cho biết feed món ăn có đủ hấp dẫn để người dùng kéo tiếp hay không."
        ),
        metric(
          "CTR feed",
          formatPercent(feedCtr),
          assessHigherBetter(feedCtr, 0.08, 0.03, "%"),
          "CTR thể hiện người dùng có nhấp vào ảnh để xem chi tiết, bình luận, công thức hoặc thông tin liên quan hay không."
        ),
        metric(
          "Bounce rate",
          formatPercent(bounceRate),
          assessLowerBetter(bounceRate, 0.25, 0.45, "%"),
          "Bounce cao cho thấy ảnh đầu tiên hoặc thuật toán gợi ý chưa đúng gu người dùng."
        )
      ],
      insights: [
        `Số phiên ghi nhận: ${formatNumber(sessions)}; đây là nền để đánh giá chất lượng phiên thay vì chỉ nhìn số user.`,
        "Nếu session duration và scroll depth cùng tăng, chiến lược nội dung đang đi đúng hướng; nếu một trong hai giảm, cần xem lại chất lượng feed đầu phiên."
      ],
      conclusion: "Các chỉ số hành vi không biết nói dối: chúng cho thấy người dùng có nhận được giá trị bền vững từ nội dung hay chỉ mở app rồi rời đi.",
      actions: [
        "Tách phân tích hành vi theo user mới và user quay lại để tìm điểm rơi giữ chân.",
        "Đo pages per session cho profile, bài viết, công thức và trang người dùng.",
        "A/B test thứ tự feed đầu phiên nếu bounce rate tăng."
      ]
    },
    {
      key: "traffic",
      title: "3. Chỉ số lưu lượng truy cập",
      objective: "Theo dõi tốc độ tăng trưởng quy mô cộng đồng và chất lượng quay lại của người dùng.",
      metrics: [
        metric(
          "DAU / WAU / MAU",
          `${formatNumber(dau)} / ${formatNumber(wau)} / ${formatNumber(mau)}`,
          dau || wau || mau ? "Đã có tín hiệu active users để theo dõi retention." : "Chưa có đủ dữ liệu active users.",
          "DAU là thước đo quan trọng với mạng xã hội vì chứng minh nội dung đủ hấp dẫn để quay lại mỗi ngày."
        ),
        metric(
          "Người dùng mới",
          formatNumber(totalUsers),
          typeof totalUsers === "number" && totalUsers > 0 ? "Có tăng trưởng trong khoảng lọc." : "Chưa ghi nhận tăng trưởng user trong khoảng lọc.",
          "Người dùng mới cho biết sức hút acquisition, nhưng cần đọc cùng returning users."
        ),
        metric(
          "Người dùng quay lại",
          formatNumber(returning),
          assessHigherBetter(returning, 20, 5, " user"),
          "Returning users phản ánh retention và sức sống cộng đồng tốt hơn lượt tải app hời hợt."
        ),
        metric(
          "Nguồn truy cập",
          "chưa instrumented",
          "Chưa tách được Organic/Paid/Referral.",
          "Nguồn truy cập giúp tránh tăng trưởng ảo từ quảng cáo trả phí ở giai đoạn sớm."
        )
      ],
      insights: [
        "Tăng trưởng cần đi cùng chất lượng quay lại; user mới tăng nhưng returning thấp sẽ không tạo cộng đồng bền vững.",
        "Nên ưu tiên đo nguồn organic, referral và paid để phân biệt tăng trưởng tự nhiên với tăng trưởng mua bằng quảng cáo."
      ],
      conclusion: "Traffic chỉ có ý nghĩa khi đi cùng retention. Với mạng xã hội, cộng đồng quay lại quan trọng ngang với lượng user mới.",
      actions: [
        "Bổ sung tracking traffic source ở lớp analytics dùng chung.",
        "Theo dõi tỷ lệ returning/new theo từng range 1 ngày, 7 ngày và toàn bộ.",
        "Lập cảnh báo khi DAU giảm nhưng user mới vẫn tăng."
      ]
    },
    {
      key: "conversion",
      title: "4. Chỉ số chuyển đổi",
      objective: "Đo khả năng biến người chỉ xem ảnh thành người tạo nội dung, dùng AI món ăn hoặc trả phí premium.",
      metrics: [
        metric(
          "Lurker -> Creator",
          formatPercent(lurkerToCreator),
          assessHigherBetter(lurkerToCreator, 0.2, 0.05, "%"),
          "Mạng xã hội sống nhờ nội dung do người dùng tạo; tỷ lệ này cho biết app có đủ động lực để người dùng đăng ảnh hay không."
        ),
        metric(
          "Hoàn tất đăng bài",
          formatPercent(postCompletion),
          assessHigherBetter(postCompletion, 0.7, 0.4, "%"),
          "Tỷ lệ hoàn tất đăng bài giúp phát hiện form, upload ảnh hoặc kiểm duyệt có gây rơi rụng không."
        ),
        metric(
          "Hoàn tất AI món ăn",
          formatPercent(mealAiCompletion),
          assessHigherBetter(mealAiCompletion, 0.7, 0.4, "%"),
          "AI món ăn là giá trị khác biệt; completion thấp cho thấy trải nghiệm phân tích ảnh cần tối ưu."
        ),
        metric(
          "Thanh toán premium",
          formatPercent(premiumPayment),
          assessHigherBetter(premiumPayment, 0.5, 0.2, "%"),
          "Payment completion đo hiệu quả funnel premium và độ tin cậy của luồng thanh toán."
        )
      ],
      insights: [
        `Trong khoảng lọc có ${formatNumber(totalPosts)} bài đăng trên ${formatNumber(totalUsers)} user mới, đây là tín hiệu ban đầu cho creator conversion.`,
        creatorRate !== undefined
          ? `Creator conversion telemetry hiện ghi nhận ${formatPercent(creatorRate)}.`
          : "Creator conversion telemetry chưa đủ, cần tiếp tục instrument các bước bắt đầu/hoàn tất."
      ],
      conclusion: "Chuyển đổi là chỉ số quyết định app có tạo được vòng lặp nội dung hay không: xem ảnh -> tương tác -> tự đăng ảnh -> quay lại.",
      actions: [
        "Đưa CTA đăng ảnh vào các điểm có tương tác cao trên feed.",
        "Theo dõi funnel đăng bài theo từng bước: chọn ảnh, phân tích AI, nhập caption, publish.",
        "Kiểm tra lại checkout premium nếu payment completion thấp hoặc payment failed tăng."
      ]
    }
  ];
}

function flattenSectionItems(sections: ReportSection[], pick: "insights" | "actions") {
  return sections.flatMap((section) => section[pick].slice(0, 2));
}

function fallbackReport(input: AdminReportInput, reason?: string) {
  const sections = buildFallbackSections(input);
  return {
    title: "Báo cáo quản trị Daily Meal",
    executiveSummary: [
      `Báo cáo tổng hợp dữ liệu từ ${input.from} đến ${input.to} theo 4 nhóm KPI trong tài liệu: kỹ thuật, hành vi, lưu lượng và chuyển đổi.`,
      "Ưu tiên hiện tại là đọc số liệu theo ngữ cảnh cộng đồng ảnh đồ ăn, không chỉ nhìn tổng user hay tổng bài đăng.",
      "Các chỉ số chưa instrumented được ghi rõ để tránh suy luận sai hoặc tạo số liệu giả."
    ],
    sections,
    technical: sections[0]?.insights ?? [],
    behavioral: sections[1]?.insights ?? [],
    traffic: sections[2]?.insights ?? [],
    conversion: sections[3]?.insights ?? [],
    anomalies: [
      "Fallback report không tự kết luận bất thường ngoài dữ liệu hiện có; hãy ưu tiên các metric bị thiếu hoặc vượt ngưỡng cảnh báo trong từng section."
    ],
    priorityActions: flattenSectionItems(sections, "actions").slice(0, 7),
    risks: [
      ...(reason ? [reason] : []),
      "AI report fallback vẫn dùng số liệu dashboard/analytics hiện có nhưng không có suy luận ngôn ngữ từ provider.",
      "Các chỉ số chưa instrumented cần được bổ sung trước khi đưa ra quyết định tăng trưởng lớn."
    ],
    metricsSnapshot: {
      from: input.from,
      to: input.to,
      mode: "fallback",
      sections: sections.map((section) => section.key)
    }
  };
}

function parseJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeMetrics(value: unknown): ReportMetric[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
      const record = item as Record<string, unknown>;
      return {
        name: String(record.name ?? ""),
        value: String(record.value ?? ""),
        assessment: String(record.assessment ?? ""),
        meaning: String(record.meaning ?? "")
      };
    })
    .filter((item): item is ReportMetric => Boolean(item?.name && item.value));
}

function normalizeSections(value: unknown): ReportSection[] {
  const validKeys = new Set(["technical", "behavioral", "traffic", "conversion"]);
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
      const record = item as Record<string, unknown>;
      const key = String(record.key ?? "");
      if (!validKeys.has(key)) return undefined;
      return {
        key: key as ReportSection["key"],
        title: String(record.title ?? ""),
        objective: String(record.objective ?? ""),
        metrics: normalizeMetrics(record.metrics),
        insights: normalizeStringArray(record.insights),
        conclusion: String(record.conclusion ?? ""),
        actions: normalizeStringArray(record.actions)
      };
    })
    .filter((item): item is ReportSection => Boolean(item?.title && item.metrics.length));
}

export async function generateAdminReport(input: AdminReportInput) {
  if (!env.SHINESHOP_API_KEY || !env.SHINESHOP_BASE_URL) {
    return fallbackReport(input, "Provider AI chưa được cấu hình, hệ thống dùng fallback report để admin vẫn có báo cáo.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REPORT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.SHINESHOP_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
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
      max_tokens: Math.max(env.SHINESHOP_MAX_TOKENS, 1800)
      }),
      signal: controller.signal
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "Provider AI quá thời gian phản hồi, hệ thống dùng fallback report để không làm gián đoạn luồng admin."
        : "Provider AI không kết nối được, hệ thống dùng fallback report để không làm gián đoạn luồng admin.";
    return fallbackReport(input, reason);
  } finally {
    clearTimeout(timeout);
  }

  const result = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new HttpError(502, result.error?.message || "Không thể tạo báo cáo AI.");
  }

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    return fallbackReport(input, "Provider AI không trả nội dung báo cáo, hệ thống dùng fallback report.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJson(content) as Record<string, unknown>;
  } catch {
    return fallbackReport(input, "Provider AI trả nội dung không đúng định dạng JSON, hệ thống dùng fallback report.");
  }

  const fallback = fallbackReport(input);
  const sections = normalizeSections(parsed.sections);
  const reportSections = sections.length >= 4 ? sections : fallback.sections;

  return {
    title: String(parsed.title ?? "Báo cáo quản trị Daily Meal"),
    executiveSummary: normalizeStringArray(parsed.executiveSummary),
    sections: reportSections,
    technical: normalizeStringArray(parsed.technical).length ? normalizeStringArray(parsed.technical) : reportSections[0]?.insights ?? [],
    behavioral: normalizeStringArray(parsed.behavioral).length ? normalizeStringArray(parsed.behavioral) : reportSections[1]?.insights ?? [],
    traffic: normalizeStringArray(parsed.traffic).length ? normalizeStringArray(parsed.traffic) : reportSections[2]?.insights ?? [],
    conversion: normalizeStringArray(parsed.conversion).length ? normalizeStringArray(parsed.conversion) : reportSections[3]?.insights ?? [],
    anomalies: normalizeStringArray(parsed.anomalies),
    priorityActions: normalizeStringArray(parsed.priorityActions).length ? normalizeStringArray(parsed.priorityActions) : flattenSectionItems(reportSections, "actions").slice(0, 7),
    risks: normalizeStringArray(parsed.risks),
    metricsSnapshot: parsed.metricsSnapshot ?? {}
  };
}
