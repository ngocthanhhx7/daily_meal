import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { PostLike } from "../models/PostLike.js";
import { PostSave } from "../models/PostSave.js";
import { User } from "../models/User.js";
import { UserInteraction } from "../models/UserInteraction.js";
import { hasActivePremium, premiumTrialDto } from "../utils/premium.js";

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

type AdminJwtPayload = {
  sub: string;
  admin: true;
  email: string;
};

function assertAdminConfigured() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new HttpError(503, "Admin account is not configured.");
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
      throw new HttpError(401, "Admin authentication required");
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as Partial<AdminJwtPayload>;

    if (!payload.admin || !payload.email || payload.email !== env.ADMIN_EMAIL?.toLowerCase()) {
      throw new HttpError(403, "Admin access required");
    }

    req.user = {
      id: String(payload.sub ?? "admin"),
      email: payload.email,
      isPremium: true,
      isAdmin: true
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid admin session"));
  }
};

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    counts: user.counts,
    stats: {
      posts: extra?.posts ?? user.counts?.posts ?? 0,
      followers: extra?.followers ?? user.counts?.followers ?? 0,
      following: extra?.following ?? user.counts?.following ?? 0,
      reports: extra?.reports ?? 0
    },
    createdAt: user.createdAt?.toISOString?.(),
    updatedAt: user.updatedAt?.toISOString?.()
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

adminRouter.post("/login", (req, res, next) => {
  try {
    assertAdminConfigured();
    const body = adminLoginSchema.parse(req.body);

    if (body.email !== env.ADMIN_EMAIL?.toLowerCase() || body.password !== env.ADMIN_PASSWORD) {
      throw new HttpError(401, "Invalid admin credentials");
    }

    res.json({
      token: signAdminToken(body.email),
      admin: { email: body.email, displayName: "Daily Meal Admin" }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/dashboard", requireAdmin, async (_req, res, next) => {
  try {
    const today = startOfToday();
    const [totalUsers, totalPosts, usersToday, postsToday, likesToday, savesToday, commentsToday, userInteractionsToday] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      Post.countDocuments({ createdAt: { $gte: today } }),
      PostLike.countDocuments({ createdAt: { $gte: today } }),
      PostSave.countDocuments({ createdAt: { $gte: today } }),
      Comment.countDocuments({ createdAt: { $gte: today } }),
      UserInteraction.countDocuments({ createdAt: { $gte: today } })
    ]);

    res.json({
      totals: { users: totalUsers, posts: totalPosts },
      today: {
        users: usersToday,
        posts: postsToday,
        interactions: likesToday + savesToday + commentsToday + userInteractionsToday,
        likes: likesToday,
        saves: savesToday,
        comments: commentsToday,
        userInteractions: userInteractionsToday
      }
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

adminRouter.get("/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    const [stats, recentPosts, interactions] = await Promise.all([
      userExtraStats(user._id.toString()),
      Post.find({ author: user._id }).sort({ createdAt: -1 }).limit(5).select("caption visibility stats createdAt images"),
      UserInteraction.find({ target: user._id }).sort({ createdAt: -1 }).limit(20).select("type note actor createdAt")
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
          stats: post.stats,
          imageCount: post.images?.length ?? 0,
          createdAt: post.createdAt?.toISOString?.()
        })),
        interactions: interactions.map((item) => ({
          id: item._id.toString(),
          type: item.type,
          note: item.note,
          actor: item.actor?.toString?.(),
          createdAt: item.createdAt?.toISOString?.()
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});
