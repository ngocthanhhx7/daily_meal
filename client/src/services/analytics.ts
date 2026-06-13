import { Platform } from "react-native";
import { api } from "../api/client";

type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status?: number }>;

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type GoogleAnalyticsValue = string | number | boolean;
type GoogleAnalyticsParams = Record<string, GoogleAnalyticsValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: string, eventName: string | Date, params?: GoogleAnalyticsParams) => void;
  }
}

export type AnalyticsEntityFields = {
  entityType?: string;
  entityId?: string;
  entityOwnerId?: string;
};

export type AnalyticsEventInput = AnalyticsEntityFields & {
  screen?: string;
  durationMs?: number;
  value?: number;
  properties?: Record<string, unknown>;
  referrer?: string;
  utm?: Record<string, string>;
};

export type AnalyticsEvent = AnalyticsEntityFields & {
  sessionId: string;
  anonymousId: string;
  eventName: string;
  occurredAt: string;
  platform: string;
  screen?: string;
  durationMs?: number;
  value?: number;
  properties?: Record<string, unknown>;
  referrer?: string;
  utm?: Record<string, string>;
};

type AnalyticsTransportEvent = {
  name: string;
  eventName: string;
  sessionId: string;
  anonymousId: string;
  occurredAt: string;
  source: "client";
  platform: string;
  screen?: string;
  targetType?: string;
  targetId?: string;
  entityType?: string;
  entityId?: string;
  entityOwnerId?: string;
  durationMs?: number;
  value?: number;
  referrer?: string;
  utm?: Record<string, string>;
  properties: Record<string, unknown>;
};

type AnalyticsClientOptions = {
  baseUrl: string;
  platform?: string;
  fetcher?: FetchLike;
  now?: () => number;
  storage?: StorageLike | null;
  flushIntervalMs?: number;
  batchSize?: number;
  maxQueueSize?: number;
};

const ANONYMOUS_ID_KEY = "daily_meal_anonymous_id";
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FLUSH_INTERVAL_MS = 2500;
const DEFAULT_MAX_QUEUE_SIZE = 200;
const GOOGLE_ANALYTICS_MAX_STRING_LENGTH = 100;

const EVENT_NAME_ALIASES: Record<string, string> = {
  feed_scroll_depth: "scroll_depth",
  feed_comment_click: "feed_click",
  feed_detail_click: "feed_click",
  feed_nutrition_click: "feed_click",
  feed_recipe_click: "feed_click",
  detail_recipe_click: "feed_click",
  detail_comment_click: "feed_click",
  create_post_publish_started: "post_create_started",
  create_post_publish_succeeded: "post_create_completed",
  create_post_analysis_started: "meal_analysis_started",
  create_post_analysis_succeeded: "meal_analysis_completed",
  premium_plans_viewed: "premium_viewed",
  premium_checkout_created: "payment_started",
  premium_payment_redirect: "payment_started",
  premium_payment_browser_closed: "payment_started",
  premium_payment_return_success: "payment_completed",
  premium_payment_return_cancel: "payment_failed",
  premium_checkout_failed: "payment_failed",
  meal_analysis_succeeded: "meal_analysis_completed",
  meal_analysis_failed: "meal_analysis_failed"
};

const GOOGLE_ANALYTICS_SENSITIVE_PARAM_PATTERN =
  /(auth|authorization|avatar|content|email|id|image|message|password|photo|secret|stack|text|token|user)/i;

function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function readAnonymousId(storage: StorageLike | null | undefined) {
  const fallbackId = randomId("anon");

  if (!storage) {
    return fallbackId;
  }

  try {
    const existing = storage.getItem(ANONYMOUS_ID_KEY);
    if (existing) {
      return existing;
    }

    storage.setItem(ANONYMOUS_ID_KEY, fallbackId);
  } catch {
    // Analytics cannot be allowed to break app startup because storage is unavailable.
  }

  return fallbackId;
}

function readWebAttribution() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};

  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  }

  const referrer = typeof document !== "undefined" ? document.referrer || undefined : undefined;

  return {
    referrer,
    utm: Object.keys(utm).length ? utm : undefined
  };
}

function transportName(eventName: string) {
  return EVENT_NAME_ALIASES[eventName] ?? eventName;
}

function transportProperties(event: AnalyticsEvent): Record<string, unknown> {
  return {
    ...(event.properties ?? {}),
    originalEventName: event.eventName,
    entityOwnerId: event.entityOwnerId,
    durationMs: event.durationMs,
    referrer: event.referrer,
    utm: event.utm,
    scrollDepthPercent: event.eventName === "feed_scroll_depth" ? event.value : undefined
  };
}

function toTransportEvent(event: AnalyticsEvent): AnalyticsTransportEvent {
  return {
    name: transportName(event.eventName),
    eventName: event.eventName,
    sessionId: event.sessionId,
    anonymousId: event.anonymousId,
    occurredAt: event.occurredAt,
    source: "client",
    platform: event.platform,
    screen: event.screen,
    targetType: event.entityType,
    targetId: event.entityId,
    entityType: event.entityType,
    entityId: event.entityId,
    entityOwnerId: event.entityOwnerId,
    durationMs: event.durationMs,
    value: event.value,
    referrer: event.referrer,
    utm: event.utm,
    properties: transportProperties(event)
  };
}

function googleAnalyticsParamName(key: string) {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);

  if (!normalized) {
    return undefined;
  }

  return /^[a-z]/.test(normalized) ? normalized : `param_${normalized}`;
}

function googleAnalyticsValue(value: unknown): GoogleAnalyticsValue | undefined {
  if (typeof value === "string") {
    return value.slice(0, GOOGLE_ANALYTICS_MAX_STRING_LENGTH);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function googleAnalyticsReferrer(referrer?: string) {
  if (!referrer) {
    return undefined;
  }

  try {
    const baseUrl =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://dailymeal.local";
    const url = new URL(referrer, baseUrl);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${url.pathname}`;
    }
  } catch {
    // Fall back to route-name style referrers below.
  }

  if (/[?&#=]/.test(referrer)) {
    return undefined;
  }

  return referrer;
}

function setGoogleAnalyticsParam(params: GoogleAnalyticsParams, key: string, value: unknown) {
  const normalizedKey = googleAnalyticsParamName(key);
  const normalizedValue = googleAnalyticsValue(value);

  if (
    !normalizedKey ||
    normalizedValue === undefined ||
    GOOGLE_ANALYTICS_SENSITIVE_PARAM_PATTERN.test(key) ||
    GOOGLE_ANALYTICS_SENSITIVE_PARAM_PATTERN.test(normalizedKey)
  ) {
    return;
  }

  params[normalizedKey] = normalizedValue;
}

function googleAnalyticsPagePath(screen?: string) {
  if (!screen) {
    return typeof window !== "undefined" ? window.location.pathname || "/" : "/";
  }

  return `/${screen.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function addGoogleAnalyticsCommonParams(params: GoogleAnalyticsParams, event: AnalyticsEvent) {
  setGoogleAnalyticsParam(params, "screen_name", event.screen);
  setGoogleAnalyticsParam(params, "value", event.value);
  setGoogleAnalyticsParam(params, "duration_ms", event.durationMs);
  setGoogleAnalyticsParam(params, "target_type", event.entityType);
  setGoogleAnalyticsParam(params, "referrer", googleAnalyticsReferrer(event.referrer));

  if (event.utm) {
    for (const [key, value] of Object.entries(event.utm)) {
      setGoogleAnalyticsParam(params, key, value);
    }
  }
}

function addGoogleAnalyticsSafeProperties(params: GoogleAnalyticsParams, properties?: Record<string, unknown>) {
  if (!properties) {
    return;
  }

  for (const [key, value] of Object.entries(properties)) {
    setGoogleAnalyticsParam(params, key, value);
  }
}

function trackGoogleAnalyticsEvent(event: AnalyticsEvent) {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  try {
    if (event.eventName === "screen_view") {
      const pagePath = googleAnalyticsPagePath(event.screen);
      const pageLocation = window.location.origin ? `${window.location.origin}${pagePath}` : pagePath;
      const pageTitle = event.screen
        ? `Daily Meal - ${event.screen}`
        : typeof document !== "undefined"
          ? document.title
          : "Daily Meal";
      const params: GoogleAnalyticsParams = {};

      setGoogleAnalyticsParam(params, "screen_name", event.screen);
      setGoogleAnalyticsParam(params, "page_title", pageTitle);
      setGoogleAnalyticsParam(params, "page_path", pagePath);
      setGoogleAnalyticsParam(params, "page_location", pageLocation);
      setGoogleAnalyticsParam(params, "referrer", googleAnalyticsReferrer(event.referrer));

      window.gtag("event", "screen_view", params);
      return;
    }

    const googleAnalyticsEventName = transportName(event.eventName);
    const params: GoogleAnalyticsParams = {};
    addGoogleAnalyticsCommonParams(params, event);
    addGoogleAnalyticsSafeProperties(params, event.properties);
    setGoogleAnalyticsParam(params, "original_event_name", event.eventName);

    if (event.eventName === "feed_scroll_depth") {
      setGoogleAnalyticsParam(params, "scroll_depth_percent", event.value);
    }

    window.gtag("event", googleAnalyticsEventName, params);
  } catch {
    // Google Analytics should never interfere with the app's internal analytics pipeline.
  }
}

export function createEventThrottle(windowMs: number, now: () => number = () => Date.now()) {
  const lastByKey = new Map<string, number>();

  return {
    shouldTrack(key: string) {
      const timestamp = now();
      const last = lastByKey.get(key);

      if (last !== undefined && timestamp - last < windowMs) {
        return false;
      }

      lastByKey.set(key, timestamp);
      return true;
    },
    reset(key?: string) {
      if (key) {
        lastByKey.delete(key);
      } else {
        lastByKey.clear();
      }
    }
  };
}

export function createAnalyticsClient(options: AnalyticsClientOptions) {
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const now = options.now ?? (() => Date.now());
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
  const attribution = readWebAttribution();

  let queue: AnalyticsEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let isFlushing = false;
  let currentScreen: string | undefined;
  let authToken: string | undefined;
  let activeSession = false;
  let sessionStartedAt = now();
  let sessionId = randomId("sess");
  const anonymousId = readAnonymousId(options.storage === undefined ? getBrowserStorage() : options.storage);

  function getQueueLength() {
    return queue.length;
  }

  function setCurrentScreen(screen?: string) {
    currentScreen = screen;
  }

  function setAuthToken(token?: string | null) {
    authToken = token ?? undefined;
  }

  function shapeEvent(eventName: string, input: AnalyticsEventInput = {}): AnalyticsEvent {
    return {
      sessionId,
      anonymousId,
      eventName,
      occurredAt: new Date(now()).toISOString(),
      platform: options.platform ?? Platform.OS,
      screen: input.screen ?? currentScreen,
      entityType: input.entityType,
      entityId: input.entityId,
      entityOwnerId: input.entityOwnerId,
      durationMs: input.durationMs,
      value: input.value,
      properties: input.properties,
      referrer: input.referrer ?? attribution.referrer,
      utm: input.utm ?? attribution.utm
    };
  }

  function scheduleFlush() {
    if (flushTimer || isFlushing) {
      return;
    }

    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, flushIntervalMs);
  }

  function track(eventName: string, input: AnalyticsEventInput = {}) {
    const event = shapeEvent(eventName, input);
    trackGoogleAnalyticsEvent(event);

    if (queue.length >= maxQueueSize) {
      queue.shift();
    }

    queue.push(event);

    if (queue.length >= batchSize) {
      void flush();
    } else {
      scheduleFlush();
    }
  }

  async function flush() {
    if (isFlushing || queue.length === 0) {
      return;
    }

    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }

    const batch = queue.splice(0, batchSize);
    isFlushing = true;

    try {
      const response = await fetcher(`${options.baseUrl}/api/analytics/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ events: batch.map(toTransportEvent) })
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status ?? "unknown"}`);
      }
    } catch {
      queue = [...batch, ...queue].slice(0, maxQueueSize);
    } finally {
      isFlushing = false;
    }
  }

  function flushNow() {
    return flush().catch(() => undefined);
  }

  function startSession(properties?: Record<string, unknown>) {
    if (activeSession) {
      return;
    }

    sessionId = randomId("sess");
    sessionStartedAt = now();
    activeSession = true;
    track("session_start", { properties });
  }

  function endSession(reason: string) {
    if (!activeSession) {
      return;
    }

    activeSession = false;
    track("session_end", {
      durationMs: Math.max(0, now() - sessionStartedAt),
      properties: { reason }
    });
    void flushNow();
  }

  return {
    track,
    flush,
    flushNow,
    startSession,
    endSession,
    setCurrentScreen,
    setAuthToken,
    getQueueLength,
    shapeEvent
  };
}

export const analytics = createAnalyticsClient({
  baseUrl: api.baseUrl,
  platform: Platform.OS
});

api.setTelemetryReporter((event) => {
  analytics.track(event.ok ? "api_request_completed" : "api_request_failed", {
    value: event.durationMs,
    properties: {
      path: event.path,
      method: event.method,
      status: event.status ?? 0,
      durationMs: event.durationMs
    }
  });
});

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown runtime error"
  };
}

let runtimeTrackingCleanup: (() => void) | undefined;

export function setupAnalyticsRuntime() {
  if (runtimeTrackingCleanup) {
    return runtimeTrackingCleanup;
  }

  const cleanups: Array<() => void> = [];

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    const handleError = (event: ErrorEvent) => {
      analytics.track("runtime_error", {
        properties: {
          ...normalizeError(event.error ?? event.message),
          source: "window_error",
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        }
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      analytics.track("runtime_unhandled_rejection", {
        properties: {
          ...normalizeError(event.reason),
          source: "unhandled_rejection"
        }
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    cleanups.push(() => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    });
  }

  const errorUtils = (globalThis as any).ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler();

    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      analytics.track("runtime_error", {
        properties: {
          ...normalizeError(error),
          source: "ErrorUtils",
          isFatal: Boolean(isFatal)
        }
      });

      if (previousHandler) {
        previousHandler(error, isFatal);
      }
    });

    cleanups.push(() => {
      errorUtils.setGlobalHandler(previousHandler);
    });
  }

  runtimeTrackingCleanup = () => {
    cleanups.forEach((cleanup) => cleanup());
    runtimeTrackingCleanup = undefined;
  };

  return runtimeTrackingCleanup;
}
