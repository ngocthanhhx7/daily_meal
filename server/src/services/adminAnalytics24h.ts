import { Types } from "mongoose";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { Comment } from "../models/Comment.js";
import { Meal } from "../models/Meal.js";
import { Payment } from "../models/Payment.js";
import { Post } from "../models/Post.js";
import { PostLike } from "../models/PostLike.js";
import { PostSave } from "../models/PostSave.js";
import { User } from "../models/User.js";
import { UserInteraction } from "../models/UserInteraction.js";

const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
const FAILED_PAYMENT_STATUSES = ["CANCELLED", "EXPIRED"];

export type AdminAnalytics24hOptions = {
  start: Date;
  end: Date;
  preset: string;
  timezone?: string;
};

type HourlyPoint = {
  hour: number;
  label: string;
  activeUsers: number;
  events: number;
  posts: number;
  interactions: number;
  likes: number;
  saves: number;
  comments: number;
  reportsOpened: number;
  payments: number;
  paymentFailed: number;
  revenue: number;
  aiMealUsage: number;
};

type CountRow = { _id: number; count: number };
type SumRow = { _id: number; count: number; total: number };

function makeHourlyMap() {
  const map = new Map<number, HourlyPoint>();
  for (let hour = 6; hour <= 22; hour += 1) {
    map.set(hour, {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      activeUsers: 0,
      events: 0,
      posts: 0,
      interactions: 0,
      likes: 0,
      saves: 0,
      comments: 0,
      reportsOpened: 0,
      payments: 0,
      paymentFailed: 0,
      revenue: 0,
      aiMealUsage: 0
    });
  }
  return map;
}

function hourExpression(field: string, timezone: string) {
  return { $hour: { date: `$${field}`, timezone } };
}

async function countByHour(model: any, field: string, start: Date, end: Date, timezone: string, match: Record<string, unknown> = {}) {
  return (await model.aggregate([
    { $match: { ...match, [field]: { $gte: start, $lt: end } } },
    { $group: { _id: hourExpression(field, timezone), count: { $sum: 1 } } }
  ])) as CountRow[];
}

async function paymentRevenueByHour(start: Date, end: Date, timezone: string) {
  return Payment.aggregate<SumRow>([
    { $match: { createdAt: { $gte: start, $lt: end }, status: "PAID" } },
    {
      $group: {
        _id: hourExpression("createdAt", timezone),
        count: { $sum: 1 },
        total: { $sum: "$amount" }
      }
    }
  ]);
}

async function activeUsersByHour(start: Date, end: Date, timezone: string) {
  return AnalyticsEvent.aggregate<CountRow>([
    { $match: { occurredAt: { $gte: start, $lt: end } } },
    { $group: { _id: { hour: hourExpression("occurredAt", timezone), subjectKey: "$subjectKey" } } },
    { $group: { _id: "$_id.hour", count: { $sum: 1 } } }
  ]);
}

function addCount(map: Map<number, HourlyPoint>, rows: CountRow[], key: keyof HourlyPoint) {
  for (const row of rows) {
    const point = map.get(row._id);
    if (point && typeof point[key] === "number") {
      (point[key] as number) += row.count;
    }
  }
}

function addPayments(map: Map<number, HourlyPoint>, rows: SumRow[]) {
  for (const row of rows) {
    const point = map.get(row._id);
    if (point) {
      point.payments += row.count;
      point.revenue += row.total;
    }
  }
}

function interactionBreakdown(summary: { likes: number; saves: number; comments: number }) {
  return [
    { type: "likes", count: summary.likes },
    { type: "saves", count: summary.saves },
    { type: "comments", count: summary.comments }
  ];
}

function sourceFromProperties(properties: unknown) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return "direct";
  }

  const record = properties as Record<string, any>;
  const utmSource = record.utm?.utm_source ?? record.utm_source;
  if (typeof utmSource === "string" && utmSource.trim()) {
    return utmSource.trim().toLowerCase();
  }

  const referrer = typeof record.referrer === "string" ? record.referrer : "";
  if (!referrer) return "direct";

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    if (hostname.includes("facebook")) return "facebook";
    if (hostname.includes("google")) return "google";
    if (hostname.includes("zalo")) return "zalo";
    if (hostname.includes("tiktok")) return "tiktok";
    return "other";
  } catch {
    return "other";
  }
}

async function buildSourceTraffic(start: Date, end: Date) {
  const events = await AnalyticsEvent.find({ occurredAt: { $gte: start, $lt: end } })
    .select("properties subjectKey")
    .lean();
  const bySource = new Map<string, { source: string; events: number; users: Set<string> }>();

  for (const event of events) {
    const source = sourceFromProperties(event.properties);
    const current = bySource.get(source) ?? { source, events: 0, users: new Set<string>() };
    current.events += 1;
    current.users.add(event.subjectKey);
    bySource.set(source, current);
  }

  return [...bySource.values()]
    .map((item) => ({ source: item.source, events: item.events, users: item.users.size }))
    .sort((a, b) => b.events - a.events || a.source.localeCompare(b.source));
}

async function buildAiFunnel(start: Date, end: Date) {
  const meals = await Meal.find({ createdAt: { $gte: start, $lt: end } }).select("user createdAt").lean();
  const aiUsers = new Set(meals.map((meal) => meal.user?.toString()).filter(Boolean));
  const aiUserIds = [...aiUsers].filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  const paidAfterAi = new Set<string>();

  if (aiUserIds.length) {
    const paidPayments = await Payment.find({
      user: { $in: aiUserIds },
      status: "PAID",
      createdAt: { $gte: start, $lt: end }
    })
      .select("user createdAt")
      .lean();
    const firstMealByUser = new Map<string, Date>();

    for (const meal of meals) {
      const userId = meal.user?.toString();
      if (!userId) continue;
      const current = firstMealByUser.get(userId);
      if (!current || meal.createdAt < current) {
        firstMealByUser.set(userId, meal.createdAt);
      }
    }

    for (const payment of paidPayments) {
      const userId = payment.user?.toString();
      const firstMealAt = userId ? firstMealByUser.get(userId) : undefined;
      if (userId && firstMealAt && payment.createdAt >= firstMealAt) {
        paidAfterAi.add(userId);
      }
    }
  }

  return {
    usersUsedAi: aiUsers.size,
    onlyAiNoPurchase: Math.max(0, aiUsers.size - paidAfterAi.size),
    purchasedAfterAi: paidAfterAi.size,
    conversionRate: aiUsers.size > 0 ? paidAfterAi.size / aiUsers.size : 0
  };
}

async function recentTables(start: Date, end: Date) {
  const [pendingReports, paymentErrors, recentImportantEvents, topActions] = await Promise.all([
    UserInteraction.find({ type: "report", createdAt: { $gte: start, $lt: end }, $or: [{ status: "open" }, { status: { $exists: false } }] })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("note status createdAt")
      .lean(),
    Payment.find({ createdAt: { $gte: start, $lt: end }, status: { $in: FAILED_PAYMENT_STATUSES } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("status amount createdAt")
      .lean(),
    AnalyticsEvent.find({ occurredAt: { $gte: start, $lt: end }, name: { $in: ["runtime_error", "runtime_unhandled_rejection", "api_request_failed"] } })
      .sort({ occurredAt: -1 })
      .limit(5)
      .select("name occurredAt screen")
      .lean(),
    AnalyticsEvent.aggregate<{ _id: string; count: number }>([
      { $match: { occurredAt: { $gte: start, $lt: end } } },
      { $group: { _id: "$name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ])
  ]);

  return {
    pendingReports: pendingReports.map((item) => ({
      id: item._id.toString(),
      note: item.note ?? "",
      status: item.status ?? "open",
      createdAt: item.createdAt?.toISOString()
    })),
    paymentErrors: paymentErrors.map((item) => ({
      id: item._id.toString(),
      status: item.status,
      amount: item.amount,
      createdAt: item.createdAt?.toISOString()
    })),
    recentImportantEvents: recentImportantEvents.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      occurredAt: item.occurredAt?.toISOString(),
      screen: item.screen
    })),
    topActions: topActions.map((item) => ({ name: item._id, count: item.count }))
  };
}

export async function buildAdminAnalytics24h(options: AdminAnalytics24hOptions) {
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const { start, end } = options;
  const hourlyMap = makeHourlyMap();

  const [
    activeUsers,
    eventRows,
    postRows,
    likeRows,
    saveRows,
    commentRows,
    reportRows,
    paymentRows,
    paymentFailedRows,
    mealRows,
    summaryActiveUsers,
    newUsers,
    posts,
    likes,
    saves,
    comments,
    reportsOpened,
    paymentSuccess,
    paymentFailed,
    revenueRows,
    aiMealUsage,
    aiFunnel,
    sourceTraffic,
    tables
  ] = await Promise.all([
    activeUsersByHour(start, end, timezone),
    countByHour(AnalyticsEvent, "occurredAt", start, end, timezone),
    countByHour(Post, "createdAt", start, end, timezone),
    countByHour(PostLike, "createdAt", start, end, timezone),
    countByHour(PostSave, "createdAt", start, end, timezone),
    countByHour(Comment, "createdAt", start, end, timezone),
    countByHour(UserInteraction, "createdAt", start, end, timezone, { type: "report" }),
    paymentRevenueByHour(start, end, timezone),
    countByHour(Payment, "createdAt", start, end, timezone, { status: { $in: FAILED_PAYMENT_STATUSES } }),
    countByHour(Meal, "createdAt", start, end, timezone),
    AnalyticsEvent.distinct("subjectKey", { occurredAt: { $gte: start, $lt: end } }),
    User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Post.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    PostLike.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    PostSave.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Comment.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    UserInteraction.countDocuments({ type: "report", createdAt: { $gte: start, $lt: end } }),
    Payment.countDocuments({ status: "PAID", createdAt: { $gte: start, $lt: end } }),
    Payment.countDocuments({ status: { $in: FAILED_PAYMENT_STATUSES }, createdAt: { $gte: start, $lt: end } }),
    Payment.aggregate<{ _id: null; total: number }>([
      { $match: { status: "PAID", createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Meal.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    buildAiFunnel(start, end),
    buildSourceTraffic(start, end),
    recentTables(start, end)
  ]);

  addCount(hourlyMap, activeUsers, "activeUsers");
  addCount(hourlyMap, eventRows, "events");
  addCount(hourlyMap, postRows, "posts");
  addCount(hourlyMap, likeRows, "likes");
  addCount(hourlyMap, saveRows, "saves");
  addCount(hourlyMap, commentRows, "comments");
  addCount(hourlyMap, reportRows, "reportsOpened");
  addCount(hourlyMap, paymentFailedRows, "paymentFailed");
  addCount(hourlyMap, mealRows, "aiMealUsage");
  addPayments(hourlyMap, paymentRows);

  const hourly = [...hourlyMap.values()].map((point) => ({
    ...point,
    interactions: point.likes + point.saves + point.comments
  }));
  const summary = {
    activeUsers: summaryActiveUsers.length,
    newUsers,
    posts,
    interactions: likes + saves + comments,
    likes,
    saves,
    comments,
    reportsOpened,
    revenue: revenueRows[0]?.total ?? 0,
    paymentSuccess,
    paymentFailed,
    aiMealUsage,
    aiToPurchaseRate: aiFunnel.conversionRate
  };

  return {
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      timezone,
      preset: options.preset
    },
    summary,
    hourly,
    interactionBreakdown: interactionBreakdown(summary),
    aiFunnel,
    sourceTraffic,
    paymentMetrics: {
      success: paymentSuccess,
      failed: paymentFailed,
      revenue: summary.revenue
    },
    reportMetrics: {
      opened: reportsOpened,
      pending: tables.pendingReports.length
    },
    tables
  };
}

export async function buildAdminAnalyticsHeatmap(options: AdminAnalytics24hOptions & { metric?: string }) {
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const field = options.metric === "aiMeal" ? "createdAt" : "occurredAt";
  const model = options.metric === "aiMeal" ? Meal : AnalyticsEvent;
  const rows = await model.aggregate<{ _id: { day: string; hour: number }; value: number }>([
    {
      $match: {
        [field]: { $gte: options.start, $lt: options.end }
      }
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone } },
          hour: { $hour: { date: `$${field}`, timezone } }
        },
        value: { $sum: 1 }
      }
    },
    { $sort: { "_id.day": 1, "_id.hour": 1 } }
  ]);

  return {
    range: {
      start: options.start.toISOString(),
      end: options.end.toISOString(),
      timezone,
      preset: options.preset
    },
    metric: options.metric ?? "events",
    cells: rows.map((row) => ({
      day: row._id.day,
      weekday: new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: timezone }).format(new Date(`${row._id.day}T00:00:00.000Z`)),
      hour: row._id.hour,
      value: row.value
    }))
  };
}
