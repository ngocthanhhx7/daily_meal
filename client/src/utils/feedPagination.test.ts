import { describe, expect, it } from "vitest";
import { shouldStartFeedLoadMore } from "./feedPagination";

describe("feed pagination guard", () => {
  const baseState = {
    now: 10_000,
    tokenPresent: true,
    loading: false,
    hasMore: true,
    isDemoFeed: false,
    nextPage: 2,
    lastRequestedPage: 1,
    lastRequestAt: 8_000,
    cooldownMs: 900,
    currentIndex: 19,
    lastTriggerIndex: -1
  };

  it("allows the first load-more request near the end of the current page", () => {
    expect(shouldStartFeedLoadMore(baseState)).toBe(true);
  });

  it("blocks repeated end-reached events for the same visible index after append", () => {
    expect(
      shouldStartFeedLoadMore({
        ...baseState,
        nextPage: 3,
        lastRequestedPage: 2,
        lastRequestAt: 9_000,
        currentIndex: 19,
        lastTriggerIndex: 19
      })
    ).toBe(false);
  });

  it("allows the next page after the user advances farther through the appended posts", () => {
    expect(
      shouldStartFeedLoadMore({
        ...baseState,
        now: 11_000,
        nextPage: 3,
        lastRequestedPage: 2,
        lastRequestAt: 9_000,
        currentIndex: 39,
        lastTriggerIndex: 19
      })
    ).toBe(true);
  });

  it("blocks burst requests inside the cooldown window", () => {
    expect(
      shouldStartFeedLoadMore({
        ...baseState,
        now: 10_400,
        lastRequestAt: 10_000,
        currentIndex: 40,
        lastTriggerIndex: 19
      })
    ).toBe(false);
  });

  it("blocks unavailable feed states", () => {
    expect(shouldStartFeedLoadMore({ ...baseState, tokenPresent: false })).toBe(false);
    expect(shouldStartFeedLoadMore({ ...baseState, loading: true })).toBe(false);
    expect(shouldStartFeedLoadMore({ ...baseState, hasMore: false })).toBe(false);
    expect(shouldStartFeedLoadMore({ ...baseState, isDemoFeed: true })).toBe(false);
  });
});
