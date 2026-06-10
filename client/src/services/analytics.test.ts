import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" }
}));

vi.mock("../api/client", () => ({
  api: { baseUrl: "https://api.test" }
}));

import { createAnalyticsClient, createEventThrottle } from "./analytics";

describe("analytics client", () => {
  it("serializes events for the backend analytics contract", async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => ({ ok: true }));
    const client = createAnalyticsClient({
      baseUrl: "https://api.test",
      fetcher,
      now: () => Date.parse("2026-06-10T12:00:00.000Z"),
      storage: null,
      flushIntervalMs: 60_000
    });

    client.setAuthToken("session-token");
    client.track("feed_scroll_depth", {
      screen: "Home",
      entityType: "post",
      entityId: "post-1",
      entityOwnerId: "user-1",
      value: 75,
      durationMs: 321,
      properties: { index: 2 }
    });

    await client.flushNow();

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.test/api/analytics/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer session-token"
        })
      })
    );

    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      name: "scroll_depth",
      eventName: "feed_scroll_depth",
      sessionId: expect.any(String),
      anonymousId: expect.any(String),
      occurredAt: "2026-06-10T12:00:00.000Z",
      source: "client",
      platform: "web",
      screen: "Home",
      targetType: "post",
      targetId: "post-1",
      value: 75,
      properties: {
        originalEventName: "feed_scroll_depth",
        entityOwnerId: "user-1",
        durationMs: 321,
        scrollDepthPercent: 75,
        index: 2
      }
    });
  });

  it("keeps failed batches queued without throwing", async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 503 }));
    const client = createAnalyticsClient({
      baseUrl: "https://api.test",
      fetcher,
      storage: null,
      flushIntervalMs: 60_000
    });

    client.track("screen_view", { screen: "Home" });

    await expect(client.flushNow()).resolves.toBeUndefined();
    expect(client.getQueueLength()).toBe(1);
  });
});

describe("createEventThrottle", () => {
  it("throttles repeated keys within the configured window", () => {
    let now = 1_000;
    const throttle = createEventThrottle(500, () => now);

    expect(throttle.shouldTrack("feed")).toBe(true);
    expect(throttle.shouldTrack("feed")).toBe(false);

    now = 1_600;
    expect(throttle.shouldTrack("feed")).toBe(true);

    throttle.reset("feed");
    expect(throttle.shouldTrack("feed")).toBe(true);
  });
});
