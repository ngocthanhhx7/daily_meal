export const STICKER_SCALE_MIN = 0.5;
export const STICKER_SCALE_MAX = 2;
export const STICKER_ROTATION_MIN = -180;
export const STICKER_ROTATION_MAX = 180;

export function nextStickerScale(current: number, delta: number) {
  return clampToApiRange(Number((current + delta).toFixed(2)), STICKER_SCALE_MIN, STICKER_SCALE_MAX);
}

export function isStickerScaleMin(scale: number) {
  return scale <= STICKER_SCALE_MIN;
}

export function isStickerScaleMax(scale: number) {
  return scale >= STICKER_SCALE_MAX;
}

export function nextStickerRotation(current: number, delta: number) {
  const range = STICKER_ROTATION_MAX - STICKER_ROTATION_MIN;
  let next = current + delta;

  while (next > STICKER_ROTATION_MAX) {
    next -= range;
  }
  while (next < STICKER_ROTATION_MIN) {
    next += range;
  }

  return next;
}

function clampToApiRange(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
