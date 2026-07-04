import { describe, expect, it } from "vitest";
import {
  getExpandedPostTargetRect,
  normalizeMeasuredRect
} from "./expandedPostMotion";

describe("expandedPostMotion", () => {
  it("keeps the expanded card centered above the bottom bar", () => {
    const rect = getExpandedPostTargetRect({
      viewportWidth: 390,
      viewportHeight: 780,
      safeTop: 24,
      safeBottom: 18,
      bottomBarReserve: 110
    });

    expect(rect.width).toBe(351);
    expect(rect.x).toBe(19.5);
    expect(rect.height).toBeLessThanOrEqual(780 - 24 - 18 - 110 - 18);
    expect(rect.y + rect.height).toBeLessThanOrEqual(780 - 18 - 110);
  });

  it("rejects unusable measured card rects so the UI can fall back safely", () => {
    expect(normalizeMeasuredRect({ x: 20, y: 120, width: 320, height: 430 })).toEqual({
      x: 20,
      y: 120,
      width: 320,
      height: 430
    });
    expect(normalizeMeasuredRect({ x: 0, y: 0, width: 0, height: 430 })).toBeUndefined();
    expect(normalizeMeasuredRect({ x: Number.NaN, y: 0, width: 320, height: 430 })).toBeUndefined();
  });
});
