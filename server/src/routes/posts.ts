import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { PostLike } from "../models/PostLike.js";
import { PostSave } from "../models/PostSave.js";
import { Sticker } from "../models/Sticker.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { emitToUser, broadcastToRoom, broadcastGlobal } from "../services/socket.js";
import { sendPushNotification } from "../services/pushNotification.js";
import { hasActivePremium } from "../utils/premium.js";
import { assertNotBlocked, blockedUserIdsFor } from "../utils/userSafety.js";

export const postsRouter = Router();

const imageSchema = z.object({
  url: z.string().min(1),
  localPath: z.string().optional(),
  uploadId: z.string().optional()
});

const videoSchema = z.object({
  url: z.string().min(1),
  localPath: z.string().optional(),
  uploadId: z.string().optional(),
  mime: z.string().optional(),
  size: z.number().nonnegative().optional().transform(val => val !== undefined ? Math.round(val) : undefined),
  durationMs: z.number().nonnegative().max(30_000).optional().transform(val => val !== undefined ? Math.round(val) : undefined)
});

const imageTransformSchema = z.object({
  scale: z.number().min(0.5).max(3).default(1),
  rotation: z.number().min(-180).max(180).default(0),
  offsetX: z.number().min(-120).max(120).default(0),
  offsetY: z.number().min(-120).max(120).default(0)
});

const stickerPlacementSchema = z.object({
  x: z.number().min(0).max(1).default(0.78),
  y: z.number().min(0).max(1).default(0.78),
  scale: z.number().min(0.5).max(2).default(1),
  rotation: z.number().min(-180).max(180).default(0)
});

const nutritionSchema = z
  .object({
    calories: z.number().nonnegative().default(0),
    protein: z.number().nonnegative().default(0),
    carbs: z.number().nonnegative().default(0),
    fat: z.number().nonnegative().default(0),
    confidence: z.number().min(0).max(1).default(0)
  })
  .optional();

const requiredNutritionSchema = z.object({
  calories: z.number().nonnegative().default(0),
  protein: z.number().nonnegative().default(0),
  carbs: z.number().nonnegative().default(0),
  fat: z.number().nonnegative().default(0),
  confidence: z.number().min(0).max(1).default(0)
});

const nutritionItemSchema = z.object({
  name: z.string().max(120).default(""),
  portion: z.string().max(160).default(""),
  calories: z.number().nonnegative().default(0),
  protein: z.number().nonnegative().default(0),
  carbs: z.number().nonnegative().default(0),
  fat: z.number().nonnegative().default(0),
  confidence: z.number().min(0).max(1).default(0)
});

const nutritionDetailSchema = z.object({
  imageIndex: z.number().int().min(0).max(2),
  items: z.array(nutritionItemSchema).default([]),
  total: requiredNutritionSchema,
  warnings: z.array(z.string().max(240)).default([]),
  mealId: z.string().optional()
});

const recipeSchema = z
  .object({
    title: z.string().max(120).default(""),
    ingredients: z.array(z.string()).default([]),
    steps: z.array(z.string()).default([])
  })
  .optional();

const imageRecipeValidation = z.object({
  imageIndex: z.number().int().min(0).max(2),
  title: z.string().max(120).default(""),
  ingredients: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([])
});

const postBodySchema = z.object({
  mediaType: z.enum(["image", "video"]).default("image"),
  images: z.array(imageSchema).max(3).default([]),
  video: videoSchema.optional(),
  layout: z.enum(["stack", "grid", "cascade"]).default("stack"),
  imageTransforms: z.array(imageTransformSchema).max(3).default([]),
  caption: z.string().max(2000).default(""),
  tags: z.array(z.string()).max(20).default([]),
  recipe: recipeSchema,
  recipes: z.array(imageRecipeValidation).max(3).default([]),
  nutritionSummary: nutritionSchema,
  nutritionDetails: z.array(nutritionDetailSchema).max(3).default([]),
  mealId: z.string().optional(),
  stickerId: z.string().optional(),
  stickerPlacement: stickerPlacementSchema.optional(),
  visibility: z.enum(["public", "friends", "private"]).default("public")
});

const postUpdateSchema = postBodySchema.partial().extend({
  images: z.array(imageSchema).min(1).max(3).optional()
});

const commentBodySchema = z.object({
  body: z.string().min(1).max(500)
});

async function assertStickerAllowed(stickerId: string | undefined, isPremium: boolean) {
  if (!stickerId) {
    return;
  }

  const sticker = await Sticker.findById(stickerId).lean();

  if (!sticker) {
    throw new HttpError(404, "Không tìm thấy nhãn dán");
  }

  if (sticker.premiumOnly && !isPremium) {
    throw new HttpError(403, "Yêu cầu tài khoản Premium để sử dụng nhãn dán này");
  }
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializePost(post: any, likedPostIds: Set<string>, savedPostIds: Set<string>) {
  const id = post._id.toString();
  const author = post.author
    ? {
        ...post.author,
        id: post.author._id?.toString?.() ?? post.author.id,
        isPremium: hasActivePremium(post.author)
      }
    : post.author;

  return {
    ...post,
    _id: id,
    mediaType: post.mediaType ?? "image",
    author,
    viewerState: {
      liked: likedPostIds.has(id),
      saved: savedPostIds.has(id)
    }
  };
}

async function serializePostsForViewer(posts: any[], viewerId: string | undefined) {
  if (!viewerId || !posts.length) {
    return posts.map((post) => serializePost(post, new Set(), new Set()));
  }

  const postIds = posts.map((post) => post._id);
  const [likes, saves] = await Promise.all([
    PostLike.find({ user: viewerId, post: { $in: postIds } }).select("post").lean(),
    PostSave.find({ user: viewerId, post: { $in: postIds } }).select("post").lean()
  ]);

  const likedPostIds = new Set(likes.map((like) => like.post.toString()));
  const savedPostIds = new Set(saves.map((save) => save.post.toString()));

  return posts.map((post) => serializePost(post, likedPostIds, savedPostIds));
}

async function networkIds(viewerId: string | undefined) {
  if (!viewerId) {
    return { followingIds: new Set<string>(), friendIds: new Set<string>() };
  }

  const [following, followers] = await Promise.all([
    Follow.find({ follower: viewerId }).select("following").lean(),
    Follow.find({ following: viewerId }).select("follower").lean()
  ]);

  const followingIds = new Set(following.map((item) => item.following.toString()));
  const followerIds = new Set(followers.map((item) => item.follower.toString()));
  const friendIds = new Set([...followingIds].filter((id) => followerIds.has(id)));

  return { followingIds, friendIds };
}

function visiblePostFilter(viewerId: string | undefined, friendIds: Set<string>, blockedIds = new Set<string>()) {
  return {
    moderationStatus: { $ne: "hidden" },
    ...(blockedIds.size ? { author: { $nin: [...blockedIds] } } : {}),
    $or: [
      { visibility: "public" },
      ...(viewerId ? [{ author: viewerId }] : []),
      ...(friendIds.size ? [{ author: { $in: [...friendIds] }, visibility: "friends" }] : [])
    ]
  };
}

function feedPriority(post: any, viewerId: string | undefined, followingIds: Set<string>, friendIds: Set<string>) {
  const authorId = post.author?._id?.toString?.() ?? post.author?.id?.toString?.() ?? post.author?.toString?.();

  if (viewerId && authorId === viewerId) {
    return 0;
  }
  if (friendIds.has(authorId)) {
    return 1;
  }
  if (followingIds.has(authorId)) {
    return 2;
  }
  return 3;
}

function rankFeedPosts(posts: any[], viewerId: string | undefined, followingIds: Set<string>, friendIds: Set<string>) {
  return [...posts].sort((a, b) => {
    const dateA = new Date(a.createdAt).toISOString().slice(0, 10);
    const dateB = new Date(b.createdAt).toISOString().slice(0, 10);

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    const priorityDiff = feedPriority(a, viewerId, followingIds, friendIds) - feedPriority(b, viewerId, followingIds, friendIds);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const FEED_STREAK_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;

function timeZoneDayParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FEED_STREAK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function utcDayKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function vietnamDayKey(date: Date) {
  const parts = timeZoneDayParts(date);
  return `${parts.year}-${`${parts.month}`.padStart(2, "0")}-${`${parts.day}`.padStart(2, "0")}`;
}

function vietnamDayKeyFromTodayOffset(offset: number, now = new Date()) {
  const today = timeZoneDayParts(now);
  const todayUtcMidnight = Date.UTC(today.year, today.month - 1, today.day);
  return utcDayKey(new Date(todayUtcMidnight - offset * DAY_MS));
}

function postAuthorId(post: any) {
  return post.author?._id?.toString?.() ?? post.author?.id?.toString?.() ?? post.author?.toString?.();
}

async function buildFeedAuthorStreakMap(postsOnPage: any[]) {
  const authorIds = [...new Set(postsOnPage.map(postAuthorId).filter(Boolean))];
  const streaks = new Map<string, number>();

  if (!authorIds.length) {
    return streaks;
  }

  const streakPosts = await Post.find({
    author: { $in: authorIds },
    moderationStatus: { $ne: "hidden" }
  })
    .select("author createdAt")
    .lean();

  const dayKeysByAuthor = new Map<string, Set<string>>();
  for (const post of streakPosts) {
    const authorId = post.author?.toString?.();
    if (!authorId) continue;
    const dayKeys = dayKeysByAuthor.get(authorId) ?? new Set<string>();
    dayKeys.add(vietnamDayKey(new Date(post.createdAt)));
    dayKeysByAuthor.set(authorId, dayKeys);
  }

  for (const authorId of authorIds) {
    const dayKeys = dayKeysByAuthor.get(authorId) ?? new Set<string>();
    let streakDays = 0;
    for (let offset = 0; offset < dayKeys.size; offset += 1) {
      if (!dayKeys.has(vietnamDayKeyFromTodayOffset(offset))) {
        break;
      }
      streakDays += 1;
    }
    streaks.set(authorId, streakDays);
  }

  return streaks;
}

postsRouter.get("/feed", requireAuth, async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const skip = (Math.max(page, 1) - 1) * limit;
    const [network, blockedIds] = await Promise.all([networkIds(req.user?.id), blockedUserIdsFor(req.user?.id)]);
    const { followingIds, friendIds } = network;

    const posts = await Post.find(visiblePostFilter(req.user?.id, friendIds, blockedIds))
      .sort({ createdAt: -1 })
      .populate("author", "displayName avatarUrl isPremium premiumPaidEndsAt premiumTrialEndsAt themeColor")
      .populate("stickerId")
      .lean();
    const rankedPosts = rankFeedPosts(posts, req.user?.id, followingIds, friendIds).slice(skip, skip + limit);
    const [serializedPosts, authorStreaks] = await Promise.all([
      serializePostsForViewer(rankedPosts, req.user?.id),
      buildFeedAuthorStreakMap(rankedPosts)
    ]);
    const postsWithAuthorStreaks = serializedPosts.map((post) => ({
      ...post,
      author: post.author
        ? {
            ...post.author,
            streakDays: authorStreaks.get(post.author.id) ?? 0
          }
        : post.author
    }));

    res.json({ posts: postsWithAuthorStreaks, page, limit });
  } catch (error) {
    next(error);
  }
});

postsRouter.get("/search", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const maxCalories = req.query.maxCalories ? Number(req.query.maxCalories) : undefined;
    const tag = typeof req.query.tag === "string" ? req.query.tag.toLowerCase() : undefined;
    const savedOnly = req.query.saved === "true";
    const premiumStickerOnly = req.query.premiumSticker === "true";

    const [network, blockedIds] = await Promise.all([networkIds(req.user?.id), blockedUserIdsFor(req.user?.id)]);
    const filter: Record<string, unknown> = visiblePostFilter(req.user?.id, network.friendIds, blockedIds);

    if (q) {
      const searchRegex = new RegExp(escapeRegex(q), "i");
      filter.$and = [
        {
          $or: [
            { caption: searchRegex },
            { tags: searchRegex },
            { "recipe.title": searchRegex }
          ]
        }
      ];
    }

    if (typeof maxCalories === "number" && Number.isFinite(maxCalories)) {
      filter["nutritionSummary.calories"] = { $lte: maxCalories };
    }

    if (tag) {
      filter.tags = tag;
    }

    if (savedOnly) {
      const saves = await PostSave.find({ user: req.user?.id }).select("post").lean();
      filter._id = { $in: saves.map((save) => save.post) };
    }

    let posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("author", "displayName avatarUrl isPremium premiumPaidEndsAt premiumTrialEndsAt themeColor")
      .populate("stickerId")
      .lean();

    if (premiumStickerOnly) {
      posts = posts.filter((post: any) => Boolean(post.stickerId?.premiumOnly));
    }

    res.json({ posts: await serializePostsForViewer(posts, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = postBodySchema.parse(req.body);
    const isPremium = Boolean(req.user?.isPremium);
    const mediaType = body.mediaType ?? "image";
    const isVideoPost = mediaType === "video";

    if (isVideoPost) {
      if (!isPremium) {
        throw new HttpError(403, "Yêu cầu tài khoản Premium để đăng bài viết bằng video");
      }
      if (!body.video) {
        throw new HttpError(400, "Yêu cầu video cho bài viết bằng video");
      }

      body.images = [];
      body.imageTransforms = [];
      body.layout = "stack";
      body.recipe = undefined;
      body.recipes = [];
      body.nutritionSummary = undefined;
      body.nutritionDetails = [];
      body.mealId = undefined;
    } else if (body.images.length < 1) {
      throw new HttpError(400, "Yêu cầu ít nhất một hình ảnh");
    }

    const maxImages = isPremium ? 3 : 1;

    if (!isVideoPost && body.images.length > maxImages) {
      throw new HttpError(403, `Tài khoản miễn phí chỉ được đăng tối đa ${maxImages} ảnh mỗi bài viết. Hãy nâng cấp VIP để đăng tới 3 ảnh!`);
    }

    if (!isPremium) {
      const postCount = await Post.countDocuments({ author: req.user?.id });
      if (postCount >= 6) {
        throw new HttpError(403, "Tài khoản miễn phí chỉ được đăng tối đa 6 bài viết. Hãy nâng cấp VIP để đăng bài không giới hạn!");
      }
    }

    await assertStickerAllowed(body.stickerId, Boolean(req.user?.isPremium));

    const post = await Post.create({
      ...body,
      mediaType,
      tags: normalizeTags(body.tags),
      author: req.user?.id
    });
    const updatedUser = await User.findByIdAndUpdate(req.user?.id, { $inc: { "counts.posts": 1 } }, { new: true });
    if (updatedUser && (updatedUser.counts?.posts ?? 0) < 0) {
      await User.findByIdAndUpdate(req.user?.id, { $set: { "counts.posts": 1 } });
    }

    const populated = await Post.findById(post._id)
      .populate("author", "displayName avatarUrl isPremium premiumPaidEndsAt premiumTrialEndsAt themeColor")
      .populate("stickerId")
      .lean();
    const [serialized] = await serializePostsForViewer(populated ? [populated] : [], req.user?.id);
    res.status(201).json({ post: serialized });
  } catch (error) {
    next(error);
  }
});

postsRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const body = postUpdateSchema.parse(req.body);
    const post = await Post.findById(req.params.id);

    if (!post) {
      throw new HttpError(404, "Không tìm thấy bài viết");
    }

    if (post.author.toString() !== req.user?.id) {
      throw new HttpError(403, "Chỉ người sở hữu mới có quyền chỉnh sửa bài viết này");
    }

    const maxImages = req.user.isPremium ? 3 : 1;
    if ((body.images?.length ?? 0) > maxImages) {
      throw new HttpError(403, "Tài khoản của bạn đã vượt quá giới hạn số lượng hình ảnh");
    }

    await assertStickerAllowed(body.stickerId, Boolean(req.user?.isPremium));

    if (body.tags) {
      body.tags = normalizeTags(body.tags);
    }

    post.set(body);
    await post.save();

    const populated = await Post.findById(post._id)
      .populate("author", "displayName avatarUrl isPremium premiumPaidEndsAt premiumTrialEndsAt themeColor")
      .populate("stickerId")
      .lean();
    const [serialized] = await serializePostsForViewer(populated ? [populated] : [], req.user?.id);
    res.json({ post: serialized });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      throw new HttpError(404, "Không tìm thấy bài viết");
    }

    if (post.author.toString() !== req.user?.id) {
      throw new HttpError(403, "Chỉ người sở hữu mới có quyền xóa bài viết này");
    }

    await post.deleteOne();
    await Comment.deleteMany({ post: post._id });
    await PostLike.deleteMany({ post: post._id });
    const updatedUser = await User.findByIdAndUpdate(req.user?.id, { $inc: { "counts.posts": -1 } }, { new: true });
    if (updatedUser && (updatedUser.counts?.posts ?? 0) < 0) {
      await User.findByIdAndUpdate(req.user?.id, { $set: { "counts.posts": 0 } });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const targetPost = await Post.findById(req.params.id).select("author").lean();
    if (!targetPost) {
      throw new HttpError(404, "Không tìm thấy bài viết");
    }
    await assertNotBlocked(req.user?.id, targetPost.author.toString());

    const existing = await PostLike.findOne({ post: req.params.id, user: req.user?.id });
    const liked = !existing;

    if (existing) {
      await existing.deleteOne();
      const updated = await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.likes": -1 } }, { new: true });
      if (updated && (updated.stats?.likes ?? 0) < 0) {
        await Post.findByIdAndUpdate(req.params.id, { $set: { "stats.likes": 0 } });
      }
    } else {
      await PostLike.create({ post: req.params.id, user: req.user?.id });
      const updated = await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.likes": 1 } }, { new: true });
      if (updated && (updated.stats?.likes ?? 0) < 0) {
        await Post.findByIdAndUpdate(req.params.id, { $set: { "stats.likes": 1 } });
      }
    }

    const post = await Post.findById(req.params.id).select("stats author").lean();

    // Trigger Notification for the post author if it is a new like from another user
    if (liked && post && post.author.toString() !== req.user?.id) {
      const sender = await User.findById(req.user?.id).select("displayName").lean();
      const senderName = sender?.displayName || "Ai đó";

      const notification = await Notification.create({
        user: post.author,
        sender: req.user?.id,
        type: "like",
        post: post._id,
        body: `đã thích bài viết của bạn.`
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "displayName avatarUrl")
        .populate("post", "caption images")
        .lean();

      emitToUser(post.author.toString(), "notification:created", populatedNotification);
      
      // Trigger Push Notification
      sendPushNotification(
        post.author.toString(),
        "Lượt thích mới ❤️",
        `${senderName} đã thích bài viết của bạn.`,
        { type: "like", postId: post._id?.toString() }
      );
    }

    // Broadcast updated stats globally in real-time
    if (post) {
      broadcastGlobal("post:stats-updated", {
        postId: req.params.id,
        stats: post.stats
      });
    }

    res.json({
      liked,
      stats: post?.stats
        ? {
            likes: post.stats.likes ?? 0,
            comments: post.stats.comments ?? 0,
            saves: post.stats.saves ?? 0
          }
        : undefined
    });
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/:id/save", requireAuth, async (req, res, next) => {
  try {
    const targetPost = await Post.findById(req.params.id).select("author").lean();
    if (!targetPost) {
      throw new HttpError(404, "Không tìm thấy bài viết");
    }
    await assertNotBlocked(req.user?.id, targetPost.author.toString());

    const existing = await PostSave.findOne({ post: req.params.id, user: req.user?.id });
    const saved = !existing;

    if (existing) {
      await existing.deleteOne();
      const updated = await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.saves": -1 } }, { new: true });
      if (updated && (updated.stats?.saves ?? 0) < 0) {
        await Post.findByIdAndUpdate(req.params.id, { $set: { "stats.saves": 0 } });
      }
    } else {
      await PostSave.create({ post: req.params.id, user: req.user?.id });
      const updated = await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.saves": 1 } }, { new: true });
      if (updated && (updated.stats?.saves ?? 0) < 0) {
        await Post.findByIdAndUpdate(req.params.id, { $set: { "stats.saves": 1 } });
      }
    }

    const post = await Post.findById(req.params.id).select("stats").lean();
    res.json({ saved, stats: post?.stats });
  } catch (error) {
    next(error);
  }
});

postsRouter.get("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).select("author").lean();
    if (!post) {
      throw new HttpError(404, "Không tìm thấy bài viết");
    }
    await assertNotBlocked(req.user?.id, post.author.toString());

    const comments = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .populate("author", "displayName avatarUrl themeColor")
      .lean();
    res.json({ comments });
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const body = commentBodySchema.parse(req.body);
    const post = await Post.findById(req.params.id).select("_id author").lean();

    if (!post) {
      throw new HttpError(404, "Không tìm thấy bài viết");
    }

    await assertNotBlocked(req.user?.id, post.author?.toString?.());

    const comment = await Comment.create({
      post: req.params.id,
      author: req.user?.id,
      body: body.body
    });
    const updatedPost = await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.comments": 1 } }, { new: true });
    if (updatedPost && (updatedPost.stats?.comments ?? 0) < 0) {
      await Post.findByIdAndUpdate(req.params.id, { $set: { "stats.comments": 1 } });
    }

    // Fetch updated stats and broadcast globally in real-time
    const updatedPostStats = await Post.findById(req.params.id).select("stats").lean();
    if (updatedPostStats) {
      broadcastGlobal("post:stats-updated", {
        postId: req.params.id,
        stats: updatedPostStats.stats
      });
    }

    const populated = await Comment.findById(comment._id)
      .populate("author", "displayName avatarUrl themeColor")
      .lean();

    if (!populated) {
      throw new HttpError(404, "Không tìm thấy bình luận");
    }

    // Broadcast new comment to all sockets viewing this post in real-time
    broadcastToRoom(`post:${req.params.id}`, "comment:created", populated);

    // Trigger Notification for the post author if commented by another user
    if (post.author && post.author.toString() !== req.user?.id) {
      const senderName = (populated.author as any)?.displayName || "Ai đó";
      const snippet = body.body.length > 40 ? `${body.body.slice(0, 40)}...` : body.body;

      const notification = await Notification.create({
        user: post.author,
        sender: req.user?.id,
        type: "comment",
        post: post._id,
        comment: comment._id,
        body: `đã bình luận về bài viết của bạn: "${snippet}"`
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "displayName avatarUrl")
        .populate("post", "caption images")
        .lean();

      emitToUser(post.author.toString(), "notification:created", populatedNotification);
      
      // Trigger Push Notification
      sendPushNotification(
        post.author.toString(),
        "Bình luận mới 💬",
        `${senderName} đã bình luận về bài viết của bạn: "${snippet}"`,
        { type: "comment", postId: post._id?.toString(), commentId: comment._id?.toString() }
      );
    }

    res.status(201).json({ comment: populated });
  } catch (error) {
    next(error);
  }
});
