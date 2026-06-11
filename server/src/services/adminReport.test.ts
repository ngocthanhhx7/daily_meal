import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { generateAdminReport } from "./adminReport.js";

const originalEnv = {
  SHINESHOP_API_KEY: env.SHINESHOP_API_KEY,
  SHINESHOP_BASE_URL: env.SHINESHOP_BASE_URL,
  SHINESHOP_MODEL: env.SHINESHOP_MODEL,
  SHINESHOP_MAX_TOKENS: env.SHINESHOP_MAX_TOKENS
};

const input = {
  summary: { activeUsers: { dau: 1, wau: 1, mau: 1 } },
  dashboard: { totalsInRange: { users: 1, posts: 1 }, totalsAllTime: { users: 1, posts: 1 } },
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-08T00:00:00.000Z"
};

describe("generateAdminReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(env, originalEnv);
  });

  it("returns a fallback report when the AI provider cannot be reached", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: "shine-key",
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "report-model",
      SHINESHOP_MAX_TOKENS: 1200
    });

    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await generateAdminReport(input);

    expect(report.title).toBe("Báo cáo quản trị Daily Meal");
    expect(report.metricsSnapshot).toMatchObject({ mode: "fallback" });
    expect(report.sections).toHaveLength(4);
    expect(report.sections.map((section) => section.key)).toEqual(["technical", "behavioral", "traffic", "conversion"]);
    expect(report.sections[0]?.metrics.some((metric) => metric.name === "Tốc độ tải ảnh đồ ăn")).toBe(true);
    expect(report.risks[0]).toContain("Provider AI không kết nối được");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fallback report when the AI provider returns invalid JSON content", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: "shine-key",
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "report-model",
      SHINESHOP_MAX_TOKENS: 1200
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "không phải json" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const report = await generateAdminReport(input);

    expect(report.metricsSnapshot).toMatchObject({ mode: "fallback" });
    expect(report.sections).toHaveLength(4);
    expect(report.risks[0]).toContain("không đúng định dạng JSON");
  });

  it("normalizes a structured AI report into the KPI section format", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: "shine-key",
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "report-model",
      SHINESHOP_MAX_TOKENS: 1200
    });

    const section = (key: string, title: string) => ({
      key,
      title,
      objective: `Mục tiêu ${title}`,
      metrics: [{ name: "Metric mẫu", value: "10", assessment: "Ổn định", meaning: "Ý nghĩa mẫu" }],
      insights: ["Phân tích mẫu"],
      conclusion: "Kết luận mẫu",
      actions: ["Hành động mẫu"]
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "Báo cáo KPI",
                    executiveSummary: ["Tóm tắt có số liệu"],
                    sections: [
                      section("technical", "1. Chỉ số hiệu suất kỹ thuật"),
                      section("behavioral", "2. Chỉ số tương tác người dùng"),
                      section("traffic", "3. Chỉ số lưu lượng truy cập"),
                      section("conversion", "4. Chỉ số chuyển đổi")
                    ],
                    anomalies: ["Không có bất thường"],
                    priorityActions: ["Theo dõi KPI"],
                    risks: [],
                    metricsSnapshot: { mode: "ai" }
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const report = await generateAdminReport(input);

    expect(report.title).toBe("Báo cáo KPI");
    expect(report.sections).toHaveLength(4);
    expect(report.sections[2]).toMatchObject({ key: "traffic", title: "3. Chỉ số lưu lượng truy cập" });
    expect(report.priorityActions).toEqual(["Theo dõi KPI"]);
  });
});
