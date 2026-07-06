import { describe, expect, it } from "vitest";
import { isDoubleTap, shouldLikeFromDoubleTap } from "./tapGestures";

describe("tap gesture helpers", () => {
  it("does not treat the first tap as a double tap", () => {
    expect(isDoubleTap(undefined, 1000)).toBe(false);
  });

  it("detects a second tap within the default double tap window", () => {
    expect(isDoubleTap(1000, 1240)).toBe(true);
  });

  it("accepts a second tap exactly at the default threshold", () => {
    expect(isDoubleTap(1000, 1300)).toBe(true);
  });

  it("ignores taps outside the default double tap window", () => {
    expect(isDoubleTap(1000, 1301)).toBe(false);
  });

  it("likes from double tap only when the post is not already liked", () => {
    expect(shouldLikeFromDoubleTap(false)).toBe(true);
    expect(shouldLikeFromDoubleTap(true)).toBe(false);
  });
});
