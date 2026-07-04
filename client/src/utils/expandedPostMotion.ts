export type MotionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TargetRectInput = {
  viewportWidth: number;
  viewportHeight: number;
  safeTop?: number;
  safeBottom?: number;
  bottomBarReserve?: number;
  horizontalPadding?: number;
  maxWidth?: number;
};

export function normalizeMeasuredRect(rect: MotionRect): MotionRect | undefined {
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (values.some((value) => !Number.isFinite(value)) || rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  return rect;
}

export function getExpandedPostTargetRect({
  viewportWidth,
  viewportHeight,
  safeTop = 0,
  safeBottom = 0,
  bottomBarReserve = 104,
  horizontalPadding = 20,
  maxWidth = 400
}: TargetRectInput): MotionRect {
  const width = Math.min(viewportWidth - horizontalPadding, maxWidth, viewportWidth * 0.9);
  const topGap = Math.max(18, safeTop + 18);
  const usableHeight = Math.max(360, viewportHeight - safeTop - safeBottom - bottomBarReserve - 18);
  const height = Math.min(usableHeight, viewportHeight * 0.74);
  const availableCenterSpace = viewportHeight - safeTop - safeBottom - bottomBarReserve;
  const centeredY = safeTop + Math.max(18, (availableCenterSpace - height) / 2);
  const maxY = viewportHeight - safeBottom - bottomBarReserve - height;

  return {
    x: (viewportWidth - width) / 2,
    y: Math.max(topGap, Math.min(centeredY, maxY)),
    width,
    height
  };
}

export function getFallbackOriginRect(target: MotionRect): MotionRect {
  const width = target.width * 0.9;
  const height = target.height * 0.78;

  return {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height
  };
}
