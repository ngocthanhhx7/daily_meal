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

export const postsRouter = Router();

const imageSchema = z.object({
  url: z.string().min(1),
  localPath: z.string().optional(),
  uploadId: z.string().optional()
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
  images: z.array(imageSchema).min(1).max(3),
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
  visibility: z.enum(["public", "private"]).default("public")
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
    throw new HttpError(404, "Sticker not found");
  }

  if (sticker.premiumOnly && !isPremium) {
    throw new HttpError(403, "Premium is required for this sticker");
  }
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function serializePost(post: any, likedPostIds: Set<string>, savedPostIds: Set<string>) {
  const id = post._id.toString();
  const author = post.author
    ? {
        ...post.author,
        id: post.author._id?.toString?.() ?? post.author.id
      }
    : post.author;

  return {
    ...post,
    _id: id,
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

postsRouter.get("/feed", requireAuth, async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const skip = (Math.max(page, 1) - 1) * limit;
    const following = await Follow.find({ follower: req.user?.id }).select("following").lean();
    const networkAuthorIds = [
      req.user?.id,
      ...following.map((item) => item.following.toString())
    ].filter(Boolean);
    const filter: Record<string, unknown> = { visibility: "public" };

    if (following.length) {
      filter.author = { $in: networkAuthorIds };
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "displayName avatarUrl isPremium themeColor")
      .populate("stickerId")
      .lean();

    res.json({ posts: await serializePostsForViewer(posts, req.user?.id), page, limit });
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

    const filter: Record<string, unknown> = { visibility: "public" };

    if (q) {
      filter.$or = [
        { caption: new RegExp(q, "i") },
        { tags: new RegExp(q, "i") },
        { "recipe.title": new RegExp(q, "i") }
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
      .populate("author", "displayName avatarUrl isPremium themeColor")
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
    const maxImages = isPremium ? 3 : 1;

    if (body.images.length > maxImages) {
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
      tags: normalizeTags(body.tags),
      author: req.user?.id
    });
    await User.findByIdAndUpdate(req.user?.id, { $inc: { "counts.posts": 1 } });

    const populated = await Post.findById(post._id)
      .populate("author", "displayName avatarUrl isPremium themeColor")
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
      throw new HttpError(404, "Post not found");
    }

    if (post.author.toString() !== req.user?.id) {
      throw new HttpError(403, "Only the owner can edit this post");
    }

    if (body.images && body.images.length > 3) {
      throw new HttpError(403, "Image limit exceeded for this account");
    }

    await assertStickerAllowed(body.stickerId, Boolean(req.user?.isPremium));

    if (body.tags) {
      body.tags = normalizeTags(body.tags);
    }

    post.set(body);
    await post.save();

    const populated = await Post.findById(post._id)
      .populate("author", "displayName avatarUrl isPremium themeColor")
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
      throw new HttpError(404, "Post not found");
    }

    if (post.author.toString() !== req.user?.id) {
      throw new HttpError(403, "Only the owner can delete this post");
    }

    await post.deleteOne();
    await Comment.deleteMany({ post: post._id });
    await PostLike.deleteMany({ post: post._id });
    await PostSave.deleteMany({ post: post._id });
    await User.findByIdAndUpdate(req.user?.id, { $inc: { "counts.posts": -1 } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const existing = await PostLike.findOne({ post: req.params.id, user: req.user?.id });
    const liked = !existing;

    if (existing) {
      await existing.deleteOne();
      await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.likes": -1 } });
    } else {
      await PostLike.create({ post: req.params.id, user: req.user?.id });
      await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.likes": 1 } });
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
    const existing = await PostSave.findOne({ post: req.params.id, user: req.user?.id });
    const saved = !existing;

    if (existing) {
      await existing.deleteOne();
      await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.saves": -1 } });
    } else {
      await PostSave.create({ post: req.params.id, user: req.user?.id });
      await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.saves": 1 } });
    }

    const post = await Post.findById(req.params.id).select("stats").lean();
    res.json({ saved, stats: post?.stats });
  } catch (error) {
    next(error);
  }
});

postsRouter.get("/:id/comments", requireAuth, async (req, res, next) => {
  try {
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
      throw new HttpError(404, "Post not found");
    }

    const comment = await Comment.create({
      post: req.params.id,
      author: req.user?.id,
      body: body.body
    });
    await Post.findByIdAndUpdate(req.params.id, { $inc: { "stats.comments": 1 } });

    // Fetch updated stats and broadcast globally in real-time
    const updatedPost = await Post.findById(req.params.id).select("stats").lean();
    if (updatedPost) {
      broadcastGlobal("post:stats-updated", {
        postId: req.params.id,
        stats: updatedPost.stats
      });
    }

    const populated = await Comment.findById(comment._id)
      .populate("author", "displayName avatarUrl themeColor")
      .lean();

    if (!populated) {
      throw new HttpError(404, "Comment not found");
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
