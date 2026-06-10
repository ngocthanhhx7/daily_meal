import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" }
}));

vi.mock("../api/client", () => ({
  api: { baseUrl: "https://api.test" }
}));

import { createAnalyticsClient, createEventThrottle } from "./analytics";

function stubWebRuntime(gtag?: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("window", {
    gtag,
    location: {
      origin: "https://daily.test",
      pathname: "/",
      search: ""
    }
  });
  vi.stubGlobal("document", {
    referrer: "https://referrer.test/",
    title: "Daily Meal"
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("sends screen views and allowed key events to Google Analytics on web", () => {
    const gtag = vi.fn();
    stubWebRuntime(gtag);
    const client = createAnalyticsClient({
      baseUrl: "https://api.test",
      fetcher: vi.fn(async () => ({ ok: true })),
      now: () => Date.parse("2026-06-10T12:00:00.000Z"),
      storage: null,
      flushIntervalMs: 60_000
    });

    client.track("screen_view", { screen: "Home", referrer: "Login" });
    client.track("meal_analysis_succeeded", {
      screen: "Create",
      value: 450,
      durationMs: 1234,
      referrer: "https://source.test/campaign?token=secret#invite",
      properties: {
        foodCount: 2,
        cached: false,
        email: "hidden@example.com",
        imageUri: "file:///private/meal.jpg"
      }
    });

    expect(gtag).toHaveBeenNthCalledWith(
      1,
      "event",
      "screen_view",
      expect.objectContaining({
        screen_name: "Home",
        page_title: "Daily Meal - Home",
        page_path: "/Home",
        page_location: "https://daily.test/Home",
        referrer: "https://daily.test/Login"
      })
    );
    expect(gtag).toHaveBeenNthCalledWith(
      2,
      "event",
      "meal_analysis_completed",
      expect.objectContaining({
        screen_name: "Create",
        value: 450,
        duration_ms: 1234,
        referrer: "https://source.test/campaign",
        food_count: 2,
        cached: false,
        original_event_name: "meal_analysis_succeeded"
      })
    );
    expect(gtag.mock.calls[1][2]).not.toHaveProperty("email");
    expect(gtag.mock.calls[1][2]).not.toHaveProperty("image_uri");
  });

  it("does not send non-allowlisted events to Google Analytics", () => {
    const gtag = vi.fn();
    stubWebRuntime(gtag);
    const client = createAnalyticsClient({
      baseUrl: "https://api.test",
      fetcher: vi.fn(async () => ({ ok: true })),
      storage: null,
      flushIntervalMs: 60_000
    });

    client.track("runtime_error", {
      screen: "Home",
      properties: {
        message: "hidden",
        stack: "hidden"
      }
    });

    expect(gtag).not.toHaveBeenCalled();
    expect(client.getQueueLength()).toBe(1);
  });

  it("keeps internal analytics working when Google Analytics is unavailable", async () => {
    stubWebRuntime();
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => ({ ok: true }));
    const client = createAnalyticsClient({
      baseUrl: "https://api.test",
      fetcher,
      storage: null,
      flushIntervalMs: 60_000
    });

    expect(() => client.track("meal_analysis_started", { screen: "Create" })).not.toThrow();
    expect(client.getQueueLength()).toBe(1);

    await client.flushNow();
    expect(fetcher).toHaveBeenCalledTimes(1);
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
