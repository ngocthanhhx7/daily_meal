export const DEFAULT_DOUBLE_TAP_THRESHOLD_MS = 300;

export function isDoubleTap(
  previousTap: number | undefined,
  currentTap: number,
  thresholdMs = DEFAULT_DOUBLE_TAP_THRESHOLD_MS
) {
  if (previousTap === undefined) {
    return false;
  }

  return currentTap - previousTap <= thresholdMs;
}

export function shouldLikeFromDoubleTap(isAlreadyLiked: boolean) {
  return !isAlreadyLiked;
}
