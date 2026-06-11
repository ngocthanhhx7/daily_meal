import React, { useRef } from "react";
import { Image, type ImageProps } from "react-native";
import { analytics } from "../services/analytics";

type TrackedImageProps = ImageProps & {
  metricName?: string;
};

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

export function TrackedImage({ metricName = "image", onLoadStart, onLoad, onError, ...props }: TrackedImageProps) {
  const startedAtRef = useRef<number | null>(null);

  return (
    <Image
      {...props}
      onLoadStart={() => {
        startedAtRef.current = nowMs();
        onLoadStart?.();
      }}
      onLoad={(event) => {
        const durationMs = startedAtRef.current === null ? 0 : Math.max(0, nowMs() - startedAtRef.current);
        analytics.track("image_load_completed", {
          value: durationMs,
          properties: {
            metricName,
            durationMs
          }
        });
        onLoad?.(event);
      }}
      onError={(event) => {
        const durationMs = startedAtRef.current === null ? 0 : Math.max(0, nowMs() - startedAtRef.current);
        analytics.track("image_load_failed", {
          value: durationMs,
          properties: {
            metricName,
            durationMs
          }
        });
        onError?.(event);
      }}
    />
  );
}
