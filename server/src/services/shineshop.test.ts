import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { analyzeFoodImage } from "./shineshop.js";

const originalEnv = {
  SHINESHOP_API_KEY: env.SHINESHOP_API_KEY,
  SHINESHOP_BASE_URL: env.SHINESHOP_BASE_URL,
  SHINESHOP_MODEL: env.SHINESHOP_MODEL,
  SHINESHOP_FALLBACK_MODEL: env.SHINESHOP_FALLBACK_MODEL
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
      SHINESHOP_FALLBACK_MODEL: undefined
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
});
