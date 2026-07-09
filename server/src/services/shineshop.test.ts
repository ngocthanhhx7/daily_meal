import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { analyzeFoodImage, analyzeMealSuitability } from "./shineshop.js";

const originalEnv = {
  AI_MAX_TOKENS: env.AI_MAX_TOKENS,
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  GEMINI_BASE_URL: env.GEMINI_BASE_URL,
  GEMINI_MODEL: env.GEMINI_MODEL
};

function validMealResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  name: "Com ga",
                  portion: "1 phan",
                  calories: 610,
                  protein: 34,
                  carbs: 72,
                  fat: 18,
                  confidence: 0.78
                }
              ],
              total: {
                calories: 610,
                protein: 34,
                carbs: 72,
                fat: 18
              },
              warnings: [],
              ...overrides
            })
          }
        }
      ]
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("analyzeFoodImage with Gemini", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.assign(env, originalEnv);
  });

  it("posts a vision chat completion request to Gemini", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite",
      AI_MAX_TOKENS: 900
    });

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
      expect(body.max_tokens).toBe(900);
      expect(body.messages[0].content[1].image_url.url).toBe("data:image/png;base64,aW1hZ2UtYnl0ZXM=");

      return validMealResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(result.total.calories).toBe(610);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("includes user-provided ingredients and quantities in the Gemini prompt", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite",
      AI_MAX_TOKENS: 1200
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const promptText = body.messages[0].content[0].text;

      expect(promptText).toContain("User-provided ingredients and quantities");
      expect(promptText).toContain("White rice 120g");
      expect(promptText).toContain("Pork 100g");

      return validMealResponse({
        total: {
          calories: 650,
          protein: 38,
          carbs: 76,
          fat: 20
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png",
      hints: {
        ingredientsText: "White rice 120g\nPork 100g"
      }
    });

    expect(result.total.calories).toBe(650);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("instructs Gemini to return food names, portions, and warnings in Vietnamese", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite",
      AI_MAX_TOKENS: 1200
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const promptText = body.messages[0].content[0].text;

      expect(promptText).toContain("Return all user-facing text in Vietnamese");
      expect(promptText).toContain("items[].name");
      expect(promptText).toContain("items[].portion");
      expect(promptText).toContain("warnings[]");

      return validMealResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the mock analysis when Gemini is not configured", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: undefined
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(result.raw).toEqual({ mocked: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a Gemini HTTP error", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite",
      AI_MAX_TOKENS: 1200
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Gemini unavailable" } }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(
      analyzeFoodImage({
        imageData: Buffer.from("image-bytes"),
        mimeType: "image/png"
      })
    ).rejects.toMatchObject({ statusCode: 502, message: "Gemini unavailable" });
  });

  it("surfaces an empty Gemini response", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite",
      AI_MAX_TOKENS: 1200
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    );

    await expect(
      analyzeFoodImage({
        imageData: Buffer.from("image-bytes"),
        mimeType: "image/png"
      })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("aborts a stalled Gemini request", async () => {
    vi.useFakeTimers();
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite",
      AI_MAX_TOKENS: 1200
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });
    const assertion = expect(resultPromise).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(20_000);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("analyzeMealSuitability with Gemini", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.assign(env, originalEnv);
  });

  it("posts a text nutrition insight request to Gemini", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite",
      AI_MAX_TOKENS: 900
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const promptText = body.messages[0].content;

      expect(String(_url)).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer gemini-key",
        "Content-Type": "application/json"
      });
      expect(body.model).toBe("gemini-3.1-flash-lite");
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.max_tokens).toBe(1000);
      expect(promptText).toContain("Com ga");
      expect(promptText).toContain('"calories": 620');
      expect(promptText).toContain('"protein": 34');

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: "High protein lunch",
                  summary: "Good for training days.",
                  macroBalance: "Protein is solid for the calories.",
                  suitableFor: [{ label: "Active adults", reason: "Enough protein for a main meal." }],
                  cautionFor: [{ label: "Strict deficit", reason: "Portion may be high." }],
                  suggestions: ["Add vegetables."],
                  confidence: 0.8
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const insight = await analyzeMealSuitability({
      caption: "Lunch",
      nutritionSummary: { calories: 620, protein: 34, carbs: 70, fat: 18 },
      nutritionDetails: [
        {
          imageIndex: 0,
          items: [{ name: "Com ga", portion: "1 phan", calories: 620, protein: 34, carbs: 70, fat: 18 }],
          total: { calories: 620, protein: 34, carbs: 70, fat: 18 },
          warnings: []
        }
      ]
    });

    expect(insight.source).toBe("gemini");
    expect(insight.suitableFor[0]?.label).toBe("Active adults");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fallback insight when Gemini is not configured", async () => {
    Object.assign(env, {
      GEMINI_API_KEY: undefined
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const insight = await analyzeMealSuitability({
      nutritionSummary: { calories: 480, protein: 28, carbs: 50, fat: 12 },
      nutritionDetails: []
    });

    expect(insight.source).toBe("fallback");
    expect(insight.suitableFor.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
