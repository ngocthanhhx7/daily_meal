import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";
import { AdminAuditLog } from "../models/AdminAuditLog.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { Meal } from "../models/Meal.js";
import { Payment } from "../models/Payment.js";
import { Post } from "../models/Post.js";
import { PostLike } from "../models/PostLike.js";
import { PostSave } from "../models/PostSave.js";
import { User } from "../models/User.js";
import { UserInteraction } from "../models/UserInteraction.js";
import { generateAdminReport } from "../services/adminReport.js";
import { hasActivePremium, premiumTrialDto } from "../utils/premium.js";
import { buildAnalyticsSummary, parseAnalyticsSummaryQuery, type AnalyticsRangePreset } from "./analytics.js";

export const adminRouter = Router();

const adminLoginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

const adminListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const adminPostsQuerySchema = adminListQuerySchema.extend({
  moderationStatus: z.enum(["visible", "hidden", "review"]).optional(),
  visibility: z.enum(["public", "friends", "private"]).optional()
});

const adminReportsQuerySchema = z.object({
  status: z.enum(["open", "resolved", "dismissed", "all"]).default("open"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const moderationBodySchema = z.object({
  moderationStatus: z.enum(["visible", "hidden", "review"]),
  reason: z.string().trim().max(1000).optional()
});

const reportStatusBodySchema = z.object({
  status: z.enum(["open", "resolved", "dismissed"]),
  adminNote: z.string().trim().max(1000).optional()
});

const premiumBodySchema = z.object({
  isPremium: z.boolean(),
  note: z.string().trim().max(1000).optional()
});

const adminRangeBodySchema = z.object({
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  range: z.enum(["1d", "7d", "all"]).optional()
});

type AdminJwtPayload = {
  sub: string;
  admin: true;
  email: string;
};

type DailyPoint = {
  date: string;
  users: number;
  posts: number;
  interactions: number;
  payments: number;
  revenue: number;
  reports: number;
  apiErrors: number;
};

function assertAdminConfigured() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new HttpError(503, "Tài khoản Admin chưa được cấu hình.");
  }
}

function signAdminToken(email: string) {
  return jwt.sign({ sub: `admin:${email}`, admin: true, email }, env.JWT_SECRET, { expiresIn: "8h" });
}

const requireAdmin: RequestHandler = (req, _res, next) => {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      throw new HttpError(401, "Yêu cầu xác thực tài khoản Admin");
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as Partial<AdminJwtPayload>;

    if (!payload.admin || !payload.email || payload.email !== env.ADMIN_EMAIL?.toLowerCase()) {
      throw new HttpError(403, "Yêu cầu quyền truy cập Admin");
    }

    req.user = {
      id: String(payload.sub ?? "admin"),
      email: payload.email,
      isPremium: true,
      isAdmin: true
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Phiên làm việc Admin không hợp lệ"));
  }
};

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function defaultRange(): { start: Date; end: Date; rangePreset: AnalyticsRangePreset } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end, rangePreset: "7d" };
}

async function earliestAdminDate(end: Date) {
  const [user, post, meal, payment, event, interaction] = await Promise.all([
    User.findOne({ createdAt: { $lt: end } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    Post.findOne({ createdAt: { $lt: end } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    Meal.findOne({ createdAt: { $lt: end } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    Payment.findOne({ createdAt: { $lt: end } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    AnalyticsEvent.findOne({ occurredAt: { $lt: end } }).sort({ occurredAt: 1 }).select("occurredAt").lean(),
    UserInteraction.findOne({ createdAt: { $lt: end } }).sort({ createdAt: 1 }).select("createdAt").lean()
  ]);

  const dates = [user?.createdAt, post?.createdAt, meal?.createdAt, payment?.createdAt, event?.occurredAt, interaction?.createdAt]
    .filter(Boolean)
    .map((value) => new Date(value as Date));

  if (!dates.length) {
    return new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }

  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

async function resolveRange(input: unknown) {
  const parsed = adminRangeBodySchema.parse(input);
  const end = parsed.end ?? new Date();

  if (parsed.start || parsed.end) {
    return {
      start: parsed.start ?? defaultRange().start,
      end,
      rangePreset: parsed.range ?? "7d"
    };
  }

  if (parsed.range === "1d") {
    return {
      start: new Date(end.getTime() - 24 * 60 * 60 * 1000),
      end,
      rangePreset: "1d" as const
    };
  }

  if (parsed.range === "all") {
    return {
      start: await earliestAdminDate(end),
      end,
      rangePreset: "all" as const
    };
  }

  return defaultRange();
}

function toIso(value?: Date | null) {
  return value?.toISOString?.();
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function makeDailyMap(start: Date, end: Date) {
  const map = new Map<string, DailyPoint>();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor <= last) {
    const key = dateKey(cursor);
    map.set(key, { date: key, users: 0, posts: 0, interactions: 0, payments: 0, revenue: 0, reports: 0, apiErrors: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return map;
}

function addToDaily(map: Map<string, DailyPoint>, rows: Array<{ _id: string; count?: number; total?: number }>, key: keyof Omit<DailyPoint, "date">) {
  for (const row of rows) {
    const point = map.get(row._id);
    if (point) {
      point[key] += row.total ?? row.count ?? 0;
    }
  }
}

async function dailyCount(model: any, field: string, start: Date, end: Date, match: Record<string, unknown> = {}) {
  return (await model.aggregate([
    { $match: { ...match, [field]: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } }, count: { $sum: 1 } } }
  ])) as Array<{ _id: string; count: number }>;
}

async function dailyPaymentRevenue(start: Date, end: Date) {
  return Payment.aggregate<{ _id: string; count: number; total: number }>([
    { $match: { createdAt: { $gte: start, $lt: end }, status: "PAID" } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        total: { $sum: "$amount" }
      }
    }
  ]);
}

async function buildDailySeries(start: Date, end: Date) {
  const map = makeDailyMap(start, end);
  const [users, posts, likes, saves, comments, payments, reports, apiErrors] = await Promise.all([
    dailyCount(User, "createdAt", start, end),
    dailyCount(Post, "createdAt", start, end),
    dailyCount(PostLike, "createdAt", start, end),
    dailyCount(PostSave, "createdAt", start, end),
    dailyCount(Comment, "createdAt", start, end),
    dailyPaymentRevenue(start, end),
    dailyCount(UserInteraction, "createdAt", start, end, { type: "report" }),
    dailyCount(AnalyticsEvent, "occurredAt", start, end, { name: { $in: ["runtime_error", "runtime_unhandled_rejection", "api_request_failed"] } })
  ]);

  addToDaily(map, users, "users");
  addToDaily(map, posts, "posts");
  addToDaily(map, likes, "interactions");
  addToDaily(map, saves, "interactions");
  addToDaily(map, comments, "interactions");
  addToDaily(map, payments, "payments");
  addToDaily(map, payments, "revenue");
  addToDaily(map, reports, "reports");
  addToDaily(map, apiErrors, "apiErrors");

  return [...map.values()];
}

function openReportFilter() {
  return { type: "report", $or: [{ status: "open" }, { status: { $exists: false } }] };
}

function adminUserSummary(user: any, extra?: { posts?: number; followers?: number; following?: number; reports?: number }) {
  return {
    id: user._id.toString(),
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isPremium: hasActivePremium(user),
    ...premiumTrialDto(user),
    counts: user.counts
      ? {
          posts: Math.max(0, user.counts.posts ?? 0),
          followers: Math.max(0, user.counts.followers ?? 0),
          following: Math.max(0, user.counts.following ?? 0),
          friends: Math.max(0, user.counts.friends ?? 0)
        }
      : { posts: 0, followers: 0, following: 0, friends: 0 },
    stats: {
      posts: Math.max(0, extra?.posts ?? user.counts?.posts ?? 0),
      followers: Math.max(0, extra?.followers ?? user.counts?.followers ?? 0),
      following: Math.max(0, extra?.following ?? user.counts?.following ?? 0),
      reports: Math.max(0, extra?.reports ?? 0)
    },
    createdAt: toIso(user.createdAt),
    updatedAt: toIso(user.updatedAt)
  };
}

async function userExtraStats(userId: string) {
  const [posts, followers, following, reports] = await Promise.all([
    Post.countDocuments({ author: userId }),
    Follow.countDocuments({ following: userId }),
    Follow.countDocuments({ follower: userId }),
    UserInteraction.countDocuments({ target: userId, type: "report" })
  ]);

  return { posts, followers, following, reports };
}

function postDto(post: any) {
  const images = Array.isArray(post.images) ? post.images.slice(0, 3) : [];

  return {
    id: post._id.toString(),
    caption: post.caption,
    mediaType: post.mediaType ?? "image",
    video: post.video
      ? {
          url: post.video.url,
          localPath: post.video.localPath,
          uploadId: post.video.uploadId,
          mime: post.video.mime,
          size: post.video.size,
          durationMs: post.video.durationMs
        }
      : undefined,
    visibility: post.visibility,
    moderationStatus: post.moderationStatus ?? "visible",
    moderationReason: post.moderationReason ?? "",
    author: post.author
      ? {
          id: post.author._id?.toString?.() ?? post.author.id,
          displayName: post.author.displayName,
          email: post.author.email,
          avatarUrl: post.author.avatarUrl
        }
      : undefined,
    images: images.map((image: any) => ({
      url: image.url,
      localPath: image.localPath,
      uploadId: image.uploadId
    })),
    imageCount: post.images?.length ?? 0,
    stats: post.stats ?? { likes: 0, comments: 0, saves: 0 },
    nutritionAttached: Boolean(post.nutritionSummary || post.nutritionDetails?.length),
    createdAt: toIso(post.createdAt),
    updatedAt: toIso(post.updatedAt),
    moderatedAt: toIso(post.moderatedAt),
    moderatedBy: post.moderatedBy
  };
}

function paymentDto(payment: any) {
  return {
    id: payment._id.toString(),
    user: payment.user
      ? {
          id: payment.user._id?.toString?.() ?? payment.user.id,
          displayName: payment.user.displayName,
          email: payment.user.email
        }
      : undefined,
    planId: payment.planId,
    orderCode: payment.orderCode,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paidAt: toIso(payment.paidAt),
    createdAt: toIso(payment.createdAt),
    updatedAt: toIso(payment.updatedAt)
  };
}

function reportDto(report: any) {
  return {
    id: report._id.toString(),
    type: report.type,
    note: report.note ?? "",
    status: report.status ?? "open",
    adminNote: report.adminNote ?? "",
    actor: report.actor
      ? {
          id: report.actor._id?.toString?.() ?? report.actor.id,
          displayName: report.actor.displayName,
          email: report.actor.email
        }
      : undefined,
    target: report.target
      ? {
          id: report.target._id?.toString?.() ?? report.target.id,
          displayName: report.target.displayName,
          email: report.target.email
        }
      : undefined,
    createdAt: toIso(report.createdAt),
    updatedAt: toIso(report.updatedAt),
    resolvedAt: toIso(report.resolvedAt),
    resolvedBy: report.resolvedBy
  };
}

async function logAdminAction(input: {
  adminEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  note?: string;
  metadata?: Record<string, unknown>;
}) {
  await AdminAuditLog.create({
    adminEmail: input.adminEmail ?? "admin",
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    note: input.note ?? "",
    metadata: input.metadata ?? {}
  });
}

async function aggregateByField(model: any, field: string, match: Record<string, unknown> = {}) {
  return (await model.aggregate([
    { $match: match },
    { $group: { _id: { $ifNull: [`$${field}`, "unknown"] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])) as Array<{ _id: string | null; count: number }>;
}

async function buildAdminDashboard(start: Date, end: Date, rangePreset: AnalyticsRangePreset) {
  const today = startOfToday();
  const rangeFilter = { createdAt: { $gte: start, $lt: end } };
  const [
    analyticsSummary,
    series,
    totalUsersAllTime,
    totalPostsAllTime,
    totalMealsAllTime,
    totalCommentsAllTime,
    totalLikesAllTime,
    totalSavesAllTime,
    totalPaymentsAllTime,
    paidRevenueAllTime,
    premiumUsersAllTime,
    totalUsersInRange,
    totalPostsInRange,
    totalMealsInRange,
    totalCommentsInRange,
    totalLikesInRange,
    totalSavesInRange,
    totalPaymentsInRange,
    paidRevenueInRange,
    premiumUsersInRange,
    usersToday,
    postsToday,
    likesToday,
    savesToday,
    commentsToday,
    userInteractionsToday,
    openReportsAllTime,
    openReportsInRange,
    hiddenPostsAllTime,
    hiddenPostsInRange,
    recentReports,
    recentPosts,
    recentPayments,
    recentAudit,
    usersByPremium,
    postsByVisibility,
    postsByModeration,
    paymentsByStatus,
    reportsByStatus
  ] = await Promise.all([
    buildAnalyticsSummary({ start, end, range: rangePreset }),
    buildDailySeries(start, end),
    User.countDocuments(),
    Post.countDocuments(),
    Meal.countDocuments(),
    Comment.countDocuments(),
    PostLike.countDocuments(),
    PostSave.countDocuments(),
    Payment.countDocuments(),
    Payment.aggregate<{ total: number }>([{ $match: { status: "PAID" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    User.countDocuments({ isPremium: true }),
    User.countDocuments(rangeFilter),
    Post.countDocuments(rangeFilter),
    Meal.countDocuments(rangeFilter),
    Comment.countDocuments(rangeFilter),
    PostLike.countDocuments(rangeFilter),
    PostSave.countDocuments(rangeFilter),
    Payment.countDocuments({ ...rangeFilter, status: "PAID" }),
    Payment.aggregate<{ total: number }>([{ $match: { ...rangeFilter, status: "PAID" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    User.countDocuments({ ...rangeFilter, isPremium: true }),
    User.countDocuments({ createdAt: { $gte: today } }),
    Post.countDocuments({ createdAt: { $gte: today } }),
    PostLike.countDocuments({ createdAt: { $gte: today } }),
    PostSave.countDocuments({ createdAt: { $gte: today } }),
    Comment.countDocuments({ createdAt: { $gte: today } }),
    UserInteraction.countDocuments({ createdAt: { $gte: today } }),
    UserInteraction.countDocuments(openReportFilter()),
    UserInteraction.countDocuments({ ...openReportFilter(), createdAt: { $gte: start, $lt: end } }),
    Post.countDocuments({ moderationStatus: "hidden" }),
    Post.countDocuments({ moderationStatus: "hidden", createdAt: { $gte: start, $lt: end } }),
    UserInteraction.find({ type: "report" }).sort({ createdAt: -1 }).limit(5).populate("actor", "displayName email").populate("target", "displayName email").lean(),
    Post.find().sort({ createdAt: -1 }).limit(5).populate("author", "displayName email avatarUrl").lean(),
    Payment.find().sort({ createdAt: -1 }).limit(5).populate("user", "displayName email").lean(),
    AdminAuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    User.aggregate<{ _id: string; count: number }>([{ $group: { _id: { $cond: ["$isPremium", "premium", "free"] }, count: { $sum: 1 } } }]),
    aggregateByField(Post, "visibility"),
    aggregateByField(Post, "moderationStatus"),
    aggregateByField(Payment, "status"),
    UserInteraction.aggregate<{ _id: string; count: number }>([
      { $match: { type: "report" } },
      { $group: { _id: { $ifNull: ["$status", "open"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    rangePreset,
    totalsAllTime: {
      users: totalUsersAllTime,
      posts: totalPostsAllTime,
      meals: totalMealsAllTime,
      comments: totalCommentsAllTime,
      likes: totalLikesAllTime,
      saves: totalSavesAllTime,
      payments: totalPaymentsAllTime,
      revenue: paidRevenueAllTime[0]?.total ?? 0,
      premiumUsers: premiumUsersAllTime,
      openReports: openReportsAllTime,
      hiddenPosts: hiddenPostsAllTime
    },
    totalsInRange: {
      users: totalUsersInRange,
      posts: totalPostsInRange,
      meals: totalMealsInRange,
      comments: totalCommentsInRange,
      likes: totalLikesInRange,
      saves: totalSavesInRange,
      payments: totalPaymentsInRange,
      revenue: paidRevenueInRange[0]?.total ?? 0,
      premiumUsers: premiumUsersInRange,
      openReports: openReportsInRange,
      hiddenPosts: hiddenPostsInRange
    },
    today: {
      users: usersToday,
      posts: postsToday,
      interactions: likesToday + savesToday + commentsToday + userInteractionsToday,
      likes: likesToday,
      saves: savesToday,
      comments: commentsToday,
      userInteractions: userInteractionsToday
    },
    charts: {
      daily: series
    },
    breakdowns: {
      usersByPremium,
      postsByVisibility,
      postsByModeration,
      paymentsByStatus,
      reportsByStatus
    },
    analytics: analyticsSummary,
    recent: {
      reports: recentReports.map(reportDto),
      posts: recentPosts.map(postDto),
      payments: recentPayments.map(paymentDto),
      audit: recentAudit.map((item) => ({
        id: item._id.toString(),
        adminEmail: item.adminEmail,
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId,
        note: item.note,
        createdAt: toIso(item.createdAt)
      }))
    }
  };
}

adminRouter.post("/login", (req, res, next) => {
  try {
    assertAdminConfigured();
    const body = adminLoginSchema.parse(req.body);

    if (body.email !== env.ADMIN_EMAIL?.toLowerCase() || body.password !== env.ADMIN_PASSWORD) {
      throw new HttpError(401, "Thông tin đăng nhập Admin không hợp lệ");
    }

    res.json({
      token: signAdminToken(body.email),
      admin: { email: body.email, displayName: "Daily Meal Admin" }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/dashboard", requireAdmin, async (req, res, next) => {
  try {
    const { start, end, rangePreset } = await resolveRange(req.query);
    if (start >= end) {
      throw new HttpError(400, "Thời gian bắt đầu bảng điều khiển phải trước thời gian kết thúc.");
    }

    res.json(await buildAdminDashboard(start, end, rangePreset));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/analytics/summary", requireAdmin, async (req, res, next) => {
  try {
    const query = parseAnalyticsSummaryQuery(req.query);
    res.json({ summary: await buildAnalyticsSummary(query) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/reports/ai", requireAdmin, async (req, res, next) => {
  try {
    const { start, end, rangePreset } = await resolveRange(req.body ?? {});
    if (start >= end) {
      throw new HttpError(400, "Thời gian bắt đầu báo cáo phải trước thời gian kết thúc.");
    }

    const [summary, dashboard] = await Promise.all([
      buildAnalyticsSummary({ start, end, range: rangePreset }),
      buildAdminDashboard(start, end, rangePreset)
    ]);
    const report = await generateAdminReport({
      summary: summary as Record<string, unknown>,
      dashboard: dashboard as Record<string, unknown>,
      from: start.toISOString(),
      to: end.toISOString()
    });

    await logAdminAction({
      adminEmail: req.user?.email,
      action: "report.ai.generate",
      targetType: "admin_report",
      targetId: `${start.toISOString()}_${end.toISOString()}`,
      metadata: { start: start.toISOString(), end: end.toISOString(), rangePreset }
    });

    res.json({
      report,
      generatedAt: new Date().toISOString(),
      range: { start: start.toISOString(), end: end.toISOString() },
      rangePreset
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", requireAdmin, async (req, res, next) => {
  try {
    const query = adminListQuerySchema.parse(req.query);
    const filter = query.q
      ? {
          $or: [
            { displayName: { $regex: query.q, $options: "i" } },
            { email: { $regex: query.q, $options: "i" } },
            { phone: { $regex: query.q, $options: "i" } }
          ]
        }
      : {};
    const skip = (query.page - 1) * query.limit;
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      User.countDocuments(filter)
    ]);

    res.json({
      users: users.map((user) => adminUserSummary(user)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/users/:id/premium", requireAdmin, async (req, res, next) => {
  try {
    const body = premiumBodySchema.parse(req.body);
    const update = body.isPremium
      ? { $set: { isPremium: true }, $unset: { premiumPaidEndsAt: "" } }
      : { $set: { isPremium: false }, $unset: { premiumPaidEndsAt: "" } };
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });

    if (!user) {
      throw new HttpError(404, "Không tìm thấy người dùng");
    }

    await logAdminAction({
      adminEmail: req.user?.email,
      action: body.isPremium ? "user.premium.enable" : "user.premium.disable",
      targetType: "user",
      targetId: user._id.toString(),
      note: body.note,
      metadata: { isPremium: body.isPremium }
    });

    res.json({ user: adminUserSummary(user, await userExtraStats(user._id.toString())) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new HttpError(404, "Không tìm thấy người dùng");
    }

    const [stats, recentPosts, interactions, audit] = await Promise.all([
      userExtraStats(user._id.toString()),
      Post.find({ author: user._id }).sort({ createdAt: -1 }).limit(5).select("caption visibility moderationStatus moderationReason stats createdAt images"),
      UserInteraction.find({ target: user._id }).sort({ createdAt: -1 }).limit(20).select("type note status adminNote actor createdAt resolvedAt resolvedBy"),
      AdminAuditLog.find({ targetType: "user", targetId: user._id.toString() }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({
      user: {
        ...adminUserSummary(user, stats),
        bio: user.bio,
        birthday: user.birthday,
        preferences: user.preferences,
        themeColor: user.themeColor,
        recentPosts: recentPosts.map((post) => ({
          id: post._id.toString(),
          caption: post.caption,
          visibility: post.visibility,
          moderationStatus: post.moderationStatus ?? "visible",
          moderationReason: post.moderationReason ?? "",
          stats: post.stats,
          imageCount: post.images?.length ?? 0,
          createdAt: toIso(post.createdAt)
        })),
        interactions: interactions.map((item) => ({
          id: item._id.toString(),
          type: item.type,
          note: item.note,
          status: item.status ?? "open",
          adminNote: item.adminNote ?? "",
          actor: item.actor?.toString?.(),
          createdAt: toIso(item.createdAt),
          resolvedAt: toIso(item.resolvedAt),
          resolvedBy: item.resolvedBy
        })),
        audit: audit.map((item) => ({
          id: item._id.toString(),
          action: item.action,
          note: item.note,
          createdAt: toIso(item.createdAt)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/posts", requireAdmin, async (req, res, next) => {
  try {
    const query = adminPostsQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = {};

    if (query.q) {
      filter.$or = [
        { caption: { $regex: query.q, $options: "i" } },
        { tags: { $regex: query.q, $options: "i" } },
        { "recipe.title": { $regex: query.q, $options: "i" } }
      ];
    }
    if (query.moderationStatus) {
      filter.moderationStatus = query.moderationStatus;
    }
    if (query.visibility) {
      filter.visibility = query.visibility;
    }

    const skip = (query.page - 1) * query.limit;
    const [posts, total] = await Promise.all([
      Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).populate("author", "displayName email avatarUrl").lean(),
      Post.countDocuments(filter)
    ]);

    res.json({
      posts: posts.map(postDto),
      pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/posts/:id/moderation", requireAdmin, async (req, res, next) => {
  try {
    const body = moderationBodySchema.parse(req.body);
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          moderationStatus: body.moderationStatus,
          moderationReason: body.reason ?? "",
          moderatedAt: new Date(),
          moderatedBy: req.user?.email ?? "admin"
        }
      },
      { new: true }
    ).populate("author", "displayName email avatarUrl");

    if (!post) {
      throw new HttpError(404, "Không tìm thấy bài viết");
    }

    await logAdminAction({
      adminEmail: req.user?.email,
      action: `post.moderation.${body.moderationStatus}`,
      targetType: "post",
      targetId: post._id.toString(),
      note: body.reason,
      metadata: { moderationStatus: body.moderationStatus }
    });

    res.json({ post: postDto(post) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/reports", requireAdmin, async (req, res, next) => {
  try {
    const query = adminReportsQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = { type: "report" };
    if (query.status === "open") {
      Object.assign(filter, { $or: [{ status: "open" }, { status: { $exists: false } }] });
    } else if (query.status !== "all") {
      filter.status = query.status;
    }

    const skip = (query.page - 1) * query.limit;
    const [reports, total] = await Promise.all([
      UserInteraction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .populate("actor", "displayName email")
        .populate("target", "displayName email")
        .lean(),
      UserInteraction.countDocuments(filter)
    ]);

    res.json({
      reports: reports.map(reportDto),
      pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/reports/:id", requireAdmin, async (req, res, next) => {
  try {
    const body = reportStatusBodySchema.parse(req.body);
    const report = await UserInteraction.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: body.status,
          adminNote: body.adminNote ?? "",
          resolvedAt: body.status === "open" ? undefined : new Date(),
          resolvedBy: body.status === "open" ? undefined : req.user?.email
        }
      },
      { new: true }
    )
      .populate("actor", "displayName email")
      .populate("target", "displayName email");

    if (!report || report.type !== "report") {
      throw new HttpError(404, "Không tìm thấy báo cáo");
    }

    await logAdminAction({
      adminEmail: req.user?.email,
      action: `report.${body.status}`,
      targetType: "report",
      targetId: report._id.toString(),
      note: body.adminNote,
      metadata: { status: body.status }
    });

    res.json({ report: reportDto(report) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/payments", requireAdmin, async (req, res, next) => {
  try {
    const query = adminListQuerySchema.parse(req.query);
    const filter = query.q
      ? {
          $or: [
            { planId: { $regex: query.q, $options: "i" } },
            { status: { $regex: query.q, $options: "i" } },
            ...(Number.isFinite(Number(query.q)) ? [{ orderCode: Number(query.q) }] : [])
          ]
        }
      : {};
    const skip = (query.page - 1) * query.limit;
    const [payments, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).populate("user", "displayName email").lean(),
      Payment.countDocuments(filter)
    ]);

    res.json({
      payments: payments.map(paymentDto),
      pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) }
    });
  } catch (error) {
    next(error);
  }
});
