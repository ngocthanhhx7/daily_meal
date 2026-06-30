import { Router } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { User } from "../models/User.js";

export const analyticsRouter = Router();

const eventNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z][a-z0-9_.:-]*$/, "Event names must be stable lowercase identifiers.");

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

const propertiesSchema = z
  .record(jsonValueSchema)
  .default({})
  .refine((value) => JSON.stringify(value).length <= 8192, "Event properties must be 8KB or smaller.");

const eventSchema = z.object({
  name: eventNameSchema,
  occurredAt: z.coerce.date().optional(),
  sessionId: z.string().trim().min(1).max(128),
  anonymousId: z.string().trim().min(1).max(128).optional(),
  source: z.enum(["client", "server", "system"]).default("client"),
  platform: z.string().trim().min(1).max(40).optional(),
  appVersion: z.string().trim().min(1).max(40).optional(),
  screen: z.string().trim().min(1).max(80).optional(),
  targetType: z.string().trim().min(1).max(80).optional(),
  targetId: z.string().trim().min(1).max(160).optional(),
  value: z.number().finite().optional(),
  properties: propertiesSchema
});

const ingestSchema = z.object({
  events: z.array(eventSchema).min(1).max(100)
});

const summaryQuerySchema = z.object({
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  range: z.enum(["1d", "7d", "30d", "all"]).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()
});

type JwtPayload = {
  sub: string;
};

type SummaryOptions = {
  start?: Date;
  end?: Date;
  range?: "1d" | "7d" | "30d" | "all";
  startTime?: string;
  endTime?: string;
};

export type AnalyticsRangePreset = "1d" | "7d" | "30d" | "all";

function defaultSummaryRange(): { start: Date; end: Date; rangePreset: AnalyticsRangePreset } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end, rangePreset: "7d" };
}

async function earliestAnalyticsDate(end: Date) {
  const first = await AnalyticsEvent.findOne({ occurredAt: { $lt: end } }).sort({ occurredAt: 1 }).select("occurredAt").lean();
  return first?.occurredAt ? new Date(first.occurredAt) : new Date(end.getTime() - 24 * 60 * 60 * 1000);
}

async function resolveSummaryRange(options: SummaryOptions = {}) {
  const end = options.end ?? new Date();

  if (options.start || options.end) {
    return {
      start: options.start ?? defaultSummaryRange().start,
      end,
      rangePreset: options.range ?? "7d"
    };
  }

  if (options.range === "1d") {
    return {
      start: new Date(end.getTime() - 24 * 60 * 60 * 1000),
      end,
      rangePreset: "1d" as const
    };
  }

  if (options.range === "all") {
    return {
      start: await earliestAnalyticsDate(end),
      end,
      rangePreset: "all" as const
    };
  }

  if (options.range === "30d") {
    return {
      start: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000),
      end,
      rangePreset: "30d" as const
    };
  }

  return defaultSummaryRange();
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function timeToMinutes(value?: string) {
  if (!value) return undefined;
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeOfDayExpression(field: string, startTime?: string, endTime?: string) {
  const startMinute = timeToMinutes(startTime);
  const endMinute = timeToMinutes(endTime);
  if (startMinute === undefined && endMinute === undefined) return undefined;

  const minuteOfDay = {
    $add: [
      { $multiply: [{ $hour: { date: `$${field}`, timezone: "Asia/Ho_Chi_Minh" } }, 60] },
      { $minute: { date: `$${field}`, timezone: "Asia/Ho_Chi_Minh" } }
    ]
  };

  if (startMinute !== undefined && endMinute !== undefined) {
    if (startMinute <= endMinute) {
      return { $and: [{ $gte: [minuteOfDay, startMinute] }, { $lt: [minuteOfDay, endMinute] }] };
    }
    return { $or: [{ $gte: [minuteOfDay, startMinute] }, { $lt: [minuteOfDay, endMinute] }] };
  }

  if (startMinute !== undefined) return { $gte: [minuteOfDay, startMinute] };
  return { $lt: [minuteOfDay, endMinute] };
}

function withTimeOfDayFilter<T extends Record<string, unknown>>(match: T, field: string, startTime?: string, endTime?: string) {
  const expression = timeOfDayExpression(field, startTime, endTime);
  if (!expression) return match;
  return { ...match, $expr: expression };
}

function numberProperty(properties: unknown, keys: string[]) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return undefined;
  }

  const record = properties as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

async function authenticatedUserId(authorizationHeader: string | undefined) {
  const token = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7) : undefined;

  if (!token) {
    return undefined;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.sub).select("_id").lean();

    if (!user) {
      throw new HttpError(401, "Phiên làm việc phân tích không hợp lệ");
    }

    return user._id.toString();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Phiên làm việc phân tích không hợp lệ");
  }
}

export async function buildAnalyticsSummary(options: SummaryOptions = {}) {
  const { start, end, rangePreset } = await resolveSummaryRange(options);

  if (start >= end) {
    throw new HttpError(400, "Thời gian bắt đầu tóm tắt phải trước thời gian kết thúc.");
  }

  const baseFilter = withTimeOfDayFilter({ occurredAt: { $gte: start, $lt: end } }, "occurredAt", options.startTime, options.endTime);
  const oneDayStart = new Date(Math.max(start.getTime(), end.getTime() - 24 * 60 * 60 * 1000));
  const oneWeekStart = new Date(Math.max(start.getTime(), end.getTime() - 7 * 24 * 60 * 60 * 1000));
  const oneMonthStart = new Date(Math.max(start.getTime(), end.getTime() - 30 * 24 * 60 * 60 * 1000));

  const countByName = (name: string) => AnalyticsEvent.countDocuments({ ...baseFilter, name });
  const distinctSubjects = (from: Date) =>
    AnalyticsEvent.distinct("subjectKey", withTimeOfDayFilter({ occurredAt: { $gte: from, $lt: end } }, "occurredAt", options.startTime, options.endTime));

  const [
    dauSubjects,
    wauSubjects,
    mauSubjects,
    activeSubjects,
    feedImpressions,
    feedClicks,
    creatorStarted,
    creatorCompleted,
    postCreateStarted,
    postCreateCompleted,
    mealAnalysisStarted,
    mealAnalysisCompleted,
    premiumViewed,
    premiumCheckoutStarted,
    paymentStarted,
    paymentCompleted,
    paymentFailed,
    earlyExitEvents,
    sessionGroups,
    scrollEvents,
    runtimeErrors,
    apiRequestEvents,
    apiRequestFailures,
    imageLoadEvents
  ] = await Promise.all([
    distinctSubjects(oneDayStart),
    distinctSubjects(oneWeekStart),
    distinctSubjects(oneMonthStart),
    AnalyticsEvent.distinct("subjectKey", baseFilter),
    countByName("feed_impression"),
    countByName("feed_click"),
    countByName("creator_signup_started"),
    countByName("creator_signup_completed"),
    countByName("post_create_started"),
    countByName("post_create_completed"),
    countByName("meal_analysis_started"),
    countByName("meal_analysis_completed"),
    countByName("premium_viewed"),
    countByName("premium_checkout_started"),
    countByName("payment_started"),
    countByName("payment_completed"),
    countByName("payment_failed"),
    countByName("early_exit"),
    AnalyticsEvent.aggregate<{
      _id: string;
      startedAt: Date;
      endedAt: Date;
      eventCount: number;
      explicitDurationMs?: number;
    }>([
      { $match: baseFilter },
      {
        $group: {
          _id: "$sessionId",
          startedAt: { $min: "$occurredAt" },
          endedAt: { $max: "$occurredAt" },
          eventCount: { $sum: 1 },
          explicitDurationMs: {
            $max: {
              $cond: [{ $eq: ["$name", "session_end"] }, "$properties.durationMs", null]
            }
          }
        }
      }
    ]),
    AnalyticsEvent.find({ ...baseFilter, name: "scroll_depth" }).select("properties").lean(),
    AnalyticsEvent.countDocuments({ ...baseFilter, name: { $in: ["runtime_error", "runtime_unhandled_rejection"] } }),
    AnalyticsEvent.find({ ...baseFilter, name: "api_request_completed" }).select("value properties").lean(),
    AnalyticsEvent.countDocuments({ ...baseFilter, name: "api_request_failed" }),
    AnalyticsEvent.find({ ...baseFilter, name: "image_load_completed" }).select("value properties").lean()
  ]);

  const returningSubjects =
    activeSubjects.length > 0
      ? await AnalyticsEvent.distinct("subjectKey", {
          subjectKey: { $in: activeSubjects },
          occurredAt: { $lt: start }
        })
      : [];

  const sessionDurations = sessionGroups.map((session) => {
    if (typeof session.explicitDurationMs === "number" && Number.isFinite(session.explicitDurationMs)) {
      return Math.max(0, session.explicitDurationMs);
    }

    return Math.max(0, session.endedAt.getTime() - session.startedAt.getTime());
  });
  const sessions = sessionGroups.length;
  const averageSessionDurationMs =
    sessionDurations.length > 0
      ? sessionDurations.reduce((total, duration) => total + duration, 0) / sessionDurations.length
      : 0;
  const bounces = sessionGroups.filter((session) => session.eventCount <= 1).length;
  const durationEarlyExits = sessionDurations.filter((duration, index) => {
    const session = sessionGroups[index];
    return !!session && session.eventCount > 1 && duration > 0 && duration < 10_000;
  }).length;
  const earlyExits = Math.max(earlyExitEvents, durationEarlyExits);

  const scrollDepths = scrollEvents
    .map((event) => numberProperty(event.properties, ["scrollDepthPercent", "scrollDepth"]))
    .filter((value): value is number => value !== undefined);
  const averageScrollDepth =
    scrollDepths.length > 0 ? scrollDepths.reduce((total, value) => total + value, 0) / scrollDepths.length : 0;
  const maxScrollDepth = scrollDepths.length > 0 ? Math.max(...scrollDepths) : 0;
  const apiDurations = apiRequestEvents
    .map((event) => (typeof event.value === "number" && Number.isFinite(event.value) ? event.value : numberProperty(event.properties, ["durationMs"])))
    .filter((value): value is number => value !== undefined);
  const imageLoadDurations = imageLoadEvents
    .map((event) => (typeof event.value === "number" && Number.isFinite(event.value) ? event.value : numberProperty(event.properties, ["durationMs"])))
    .filter((value): value is number => value !== undefined);
  const apiFailuresFromCompleted = apiRequestEvents.filter((event) => {
    const status = numberProperty(event.properties, ["status"]);
    return typeof status === "number" && status >= 400;
  }).length;
  const totalApiFailures = apiRequestFailures + apiFailuresFromCompleted;
  const average = (values: number[]) => (values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0);

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    rangePreset,
    activeUsers: {
      dau: dauSubjects.length,
      wau: wauSubjects.length,
      mau: mauSubjects.length,
      returning: returningSubjects.length
    },
    sessions: {
      total: sessions,
      averageDurationMs: averageSessionDurationMs,
      bounces,
      bounceRate: rate(bounces, sessions),
      earlyExits,
      earlyExitRate: rate(earlyExits, sessions)
    },
    feed: {
      impressions: feedImpressions,
      clicks: feedClicks,
      ctr: rate(feedClicks, feedImpressions),
      averageScrollDepth,
      maxScrollDepth
    },
    technical: {
      apiRequests: apiRequestEvents.length,
      averageApiResponseMs: average(apiDurations),
      apiFailures: totalApiFailures,
      apiFailureRate: rate(totalApiFailures, apiRequestEvents.length + apiRequestFailures),
      imageLoads: imageLoadEvents.length,
      averageImageLoadMs: average(imageLoadDurations),
      runtimeErrors,
      crashRate: rate(runtimeErrors, sessions),
      instrumentation: {
        apiResponseTime: apiRequestEvents.length > 0 ? "available" : "not_instrumented",
        imageLoadSpeed: imageLoadEvents.length > 0 ? "available" : "not_instrumented",
        runtimeErrors: runtimeErrors > 0 ? "available" : "available_no_errors"
      }
    },
    creatorConversion: {
      started: creatorStarted,
      completed: creatorCompleted,
      rate: rate(creatorCompleted, creatorStarted)
    },
    postCreation: {
      started: postCreateStarted,
      completed: postCreateCompleted,
      completionRate: rate(postCreateCompleted, postCreateStarted)
    },
    mealAnalysis: {
      started: mealAnalysisStarted,
      completed: mealAnalysisCompleted,
      completionRate: rate(mealAnalysisCompleted, mealAnalysisStarted)
    },
    premiumFunnel: {
      viewed: premiumViewed,
      checkoutStarted: premiumCheckoutStarted,
      paymentStarted,
      paymentCompleted,
      paymentFailed,
      checkoutStartRate: rate(premiumCheckoutStarted, premiumViewed),
      paymentCompletionRate: rate(paymentCompleted, paymentStarted)
    }
  };
}

analyticsRouter.post("/events", async (req, res, next) => {
  try {
    const userId = await authenticatedUserId(req.header("authorization"));
    const body = ingestSchema.parse(req.body);
    const now = new Date();

    const documents = body.events.map((event) => {
      if (!userId && !event.anonymousId) {
        throw new HttpError(400, "Yêu cầu anonymousId cho các sự kiện phân tích chưa đăng nhập.");
      }

      return {
        ...event,
        occurredAt: event.occurredAt ?? now,
        receivedAt: now,
        user: userId ? new Types.ObjectId(userId) : undefined,
        subjectKey: userId ? `user:${userId}` : `anon:${event.anonymousId}`
      };
    });

    await AnalyticsEvent.insertMany(documents, { ordered: true });

    res.status(202).json({ accepted: documents.length });
  } catch (error) {
    next(error);
  }
});

export function parseAnalyticsSummaryQuery(query: unknown) {
  return summaryQuerySchema.parse(query);
}
