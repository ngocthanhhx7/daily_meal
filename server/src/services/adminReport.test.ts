import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { generateAdminReport } from "./adminReport.js";

const originalEnv = {
  AI_MAX_TOKENS: env.AI_MAX_TOKENS,
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  GEMINI_BASE_URL: env.GEMINI_BASE_URL,
  GEMINI_MODEL: env.GEMINI_MODEL
};

const input = {
  summary: { activeUsers: { dau: 1, wau: 1, mau: 1 } },
  dashboard: { totalsInRange: { users: 1, posts: 1 }, totalsAllTime: { users: 1, posts: 1 } },
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-08T00:00:00.000Z"
};

function configureGemini() {
  Object.assign(env, {
    GEMINI_API_KEY: "gemini-key",
    GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
    GEMINI_MODEL: "gemini-3.1-flash-lite",
    AI_MAX_TOKENS: 1200
  });
}

function section(key: string, title: string) {
  return {
    key,
    title,
    objective: `Objective ${title}`,
    metrics: [{ name: "Sample metric", value: "10", assessment: "stable", meaning: "sample meaning" }],
    insights: ["Sample insight"],
    conclusion: "Sample conclusion",
    actions: ["Sample action"]
  };
}

describe("generateAdminReport", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.assign(env, originalEnv);
  });

  it("sends the admin report request to Gemini", async () => {
    configureGemini();

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(String(_url)).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer gemini-key",
        "Content-Type": "application/json"
      });
      expect(body.model).toBe("gemini-3.1-flash-lite");
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.max_tokens).toBe(1800);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "AI report",
                  executiveSummary: ["Summary with data"],
                  sections: [
                    section("technical", "1. Technical"),
                    section("behavioral", "2. Behavioral"),
                    section("traffic", "3. Traffic"),
                    section("conversion", "4. Conversion")
                  ],
                  anomalies: ["No anomaly"],
                  priorityActions: ["Watch KPI"],
                  risks: [],
                  metricsSnapshot: { mode: "ai" }
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await generateAdminReport(input);

    expect(report.title).toBe("AI report");
    expect(report.metricsSnapshot).toMatchObject({ mode: "ai" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fallback report when Gemini is not configured", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: undefined
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const report = await generateAdminReport(input);

    expect(report.metricsSnapshot).toMatchObject({ mode: "fallback" });
    expect(report.sections).toHaveLength(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a fallback report when Gemini cannot be reached", async () => {
    configureGemini();

    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await generateAdminReport(input);

    expect(report.metricsSnapshot).toMatchObject({ mode: "fallback" });
    expect(report.sections.map((reportSection) => reportSection.key)).toEqual([
      "technical",
      "behavioral",
      "traffic",
      "conversion"
    ]);
    expect(report.risks[0]).toContain("Provider AI");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fallback report when Gemini times out", async () => {
    vi.useFakeTimers();
    configureGemini();

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const reportPromise = generateAdminReport(input);
    await vi.advanceTimersByTimeAsync(20_000);
    const report = await reportPromise;

    expect(report.metricsSnapshot).toMatchObject({ mode: "fallback" });
    expect(report.risks[0]).toContain("Provider AI");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fallback report when Gemini returns invalid JSON content", async () => {
    configureGemini();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "not json" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const report = await generateAdminReport(input);

    expect(report.metricsSnapshot).toMatchObject({ mode: "fallback" });
    expect(report.sections).toHaveLength(4);
    expect(report.risks[0]).toContain("JSON");
  });

  it("normalizes a structured Gemini report into the KPI section format", async () => {
    configureGemini();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "KPI report",
                    executiveSummary: ["Summary with data"],
                    sections: [
                      section("technical", "1. Technical"),
                      section("behavioral", "2. Behavioral"),
                      section("traffic", "3. Traffic"),
                      section("conversion", "4. Conversion")
                    ],
                    anomalies: ["No anomaly"],
                    priorityActions: ["Watch KPI"],
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

    expect(report.title).toBe("KPI report");
    expect(report.sections).toHaveLength(4);
    expect(report.sections[2]).toMatchObject({ key: "traffic", title: "3. Traffic" });
    expect(report.priorityActions).toEqual(["Watch KPI"]);
  });
});
