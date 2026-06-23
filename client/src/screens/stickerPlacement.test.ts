import { describe, expect, it } from "vitest";
import {
  STICKER_ROTATION_MAX,
  STICKER_ROTATION_MIN,
  STICKER_SCALE_MAX,
  STICKER_SCALE_MIN,
  isStickerScaleMax,
  isStickerScaleMin,
  nextStickerRotation,
  nextStickerScale
} from "./stickerPlacement";

describe("sticker placement helpers", () => {
  it("keeps sticker scale within the API limit when enlarging", () => {
    expect(nextStickerScale(1.95, 0.1)).toBe(STICKER_SCALE_MAX);
  });

  it("keeps sticker scale within the API limit when shrinking", () => {
    expect(nextStickerScale(0.55, -0.1)).toBe(STICKER_SCALE_MIN);
  });

  it("detects sticker scale limits for disabling controls", () => {
    expect(isStickerScaleMax(STICKER_SCALE_MAX)).toBe(true);
    expect(isStickerScaleMax(STICKER_SCALE_MAX - 0.01)).toBe(false);
    expect(isStickerScaleMin(STICKER_SCALE_MIN)).toBe(true);
    expect(isStickerScaleMin(STICKER_SCALE_MIN + 0.01)).toBe(false);
  });

  it("keeps sticker rotation within the API range", () => {
    expect(nextStickerRotation(180, 15)).toBeGreaterThanOrEqual(STICKER_ROTATION_MIN);
    expect(nextStickerRotation(180, 15)).toBeLessThanOrEqual(STICKER_ROTATION_MAX);
    expect(nextStickerRotation(165, 15)).toBe(STICKER_ROTATION_MAX);
  });
});
