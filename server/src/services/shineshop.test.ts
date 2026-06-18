import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { analyzeFoodImage } from "./shineshop.js";

const originalEnv = {
  SHINESHOP_API_KEY: env.SHINESHOP_API_KEY,
  SHINESHOP_BASE_URL: env.SHINESHOP_BASE_URL,
  SHINESHOP_MODEL: env.SHINESHOP_MODEL,
  SHINESHOP_FALLBACK_MODEL: env.SHINESHOP_FALLBACK_MODEL,
  SHINESHOP_MAX_TOKENS: env.SHINESHOP_MAX_TOKENS,
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  GEMINI_BASE_URL: env.GEMINI_BASE_URL,
  GEMINI_MODEL: env.GEMINI_MODEL
};

describe("analyzeFoodImage with Shineshop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(env, originalEnv);
  });

  it("posts a vision chat completion request to Shineshop", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: "shine-key",
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "vision-model",
      SHINESHOP_FALLBACK_MODEL: undefined,
      SHINESHOP_MAX_TOKENS: 900,
      GEMINI_API_KEY: undefined
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(String(_url)).toBe("https://api.shineshop.test/v1/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer shine-key",
        "Content-Type": "application/json"
      });
      expect(body.model).toBe("vision-model");
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.max_tokens).toBe(900);
      expect(body.messages[0].content[1].image_url.url).toBe("data:image/png;base64,aW1hZ2UtYnl0ZXM=");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      name: "Rice bowl",
                      portion: "1 bowl",
                      calories: 520,
                      protein: 24,
                      carbs: 64,
                      fat: 18,
                      confidence: 0.82
                    }
                  ],
                  total: {
                    calories: 520,
                    protein: 24,
                    carbs: 64,
                    fat: 18
                  },
                  warnings: ["Estimated from image"]
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(result.total.calories).toBe(520);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("includes user-provided ingredients and quantities in the analysis prompt", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: "shine-key",
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "vision-model",
      SHINESHOP_FALLBACK_MODEL: undefined,
      SHINESHOP_MAX_TOKENS: 1200,
      GEMINI_API_KEY: undefined
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const promptText = body.messages[0].content[0].text;

      expect(promptText).toContain("User-provided ingredients and quantities");
      expect(promptText).toContain("White rice 120g");
      expect(promptText).toContain("Pork 100g");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      name: "Rice and pork",
                      portion: "user supplied portions",
                      calories: 650,
                      protein: 38,
                      carbs: 76,
                      fat: 20,
                      confidence: 0.9
                    }
                  ],
                  total: {
                    calories: 650,
                    protein: 38,
                    carbs: 76,
                    fat: 20
                  },
                  warnings: []
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
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

  it("instructs Shineshop to return food names, portions, and warnings in Vietnamese", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: "shine-key",
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "vision-model",
      SHINESHOP_FALLBACK_MODEL: undefined,
      SHINESHOP_MAX_TOKENS: 1200,
      GEMINI_API_KEY: undefined
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const promptText = body.messages[0].content[0].text;

      expect(promptText).toContain("Return all user-facing text in Vietnamese");
      expect(promptText).toContain("items[].name");
      expect(promptText).toContain("items[].portion");
      expect(promptText).toContain("warnings[]");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      name: "Hoanh thanh chien",
                      portion: "1 phan",
                      calories: 650,
                      protein: 20,
                      carbs: 80,
                      fat: 28,
                      confidence: 0.82
                    }
                  ],
                  total: {
                    calories: 650,
                    protein: 20,
                    carbs: 80,
                    fat: 28
                  },
                  warnings: ["Uoc tinh tu anh"]
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Gemini when Shineshop returns an upstream error", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: "shine-key",
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "vision-model",
      SHINESHOP_FALLBACK_MODEL: undefined,
      SHINESHOP_MAX_TOKENS: 1200,
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite"
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      if (fetchMock.mock.calls.length === 1) {
        expect(String(_url)).toBe("https://api.shineshop.test/v1/chat/completions");
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer shine-key",
          "Content-Type": "application/json"
        });
        expect(body.model).toBe("vision-model");

        return new Response(JSON.stringify({ error: { message: "Shineshop unavailable" } }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }

      expect(String(_url)).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer gemini-key",
        "Content-Type": "application/json"
      });
      expect(body.model).toBe("gemini-3.1-flash-lite");
      expect(body.max_tokens).toBe(1200);
      expect(body.messages[0].content[1].image_url.url).toBe("data:image/png;base64,aW1hZ2UtYnl0ZXM=");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      name: "Cơm gà",
                      portion: "1 phần",
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
                  warnings: ["Ước tính bằng Gemini sau khi Shineshop lỗi"]
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(result.total.calories).toBe(610);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses Gemini directly when Shineshop is not configured", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: undefined,
      SHINESHOP_BASE_URL: "https://api.shineshop.test/v1",
      SHINESHOP_MODEL: "vision-model",
      SHINESHOP_FALLBACK_MODEL: undefined,
      SHINESHOP_MAX_TOKENS: 1200,
      GEMINI_API_KEY: "gemini-key",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
      GEMINI_MODEL: "gemini-3.1-flash-lite"
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(String(_url)).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer gemini-key",
        "Content-Type": "application/json"
      });
      expect(body.model).toBe("gemini-3.1-flash-lite");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      name: "Bún bò",
                      portion: "1 tô",
                      calories: 540,
                      protein: 28,
                      carbs: 68,
                      fat: 16,
                      confidence: 0.74
                    }
                  ],
                  total: {
                    calories: 540,
                    protein: 28,
                    carbs: 68,
                    fat: 16
                  },
                  warnings: []
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeFoodImage({
      imageData: Buffer.from("image-bytes"),
      mimeType: "image/png"
    });

    expect(result.total.calories).toBe(540);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the mock analysis when no AI provider is configured", async () => {
    Object.assign(env, {
      SHINESHOP_API_KEY: undefined,
      SHINESHOP_FALLBACK_MODEL: undefined,
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
});
