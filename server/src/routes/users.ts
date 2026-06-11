import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { PostLike } from "../models/PostLike.js";
import { PostSave } from "../models/PostSave.js";
import { User } from "../models/User.js";
import { UserInteraction } from "../models/UserInteraction.js";
import { Notification } from "../models/Notification.js";
import { emitToUser } from "../services/socket.js";
import { sendPushNotification } from "../services/pushNotification.js";
import { hasActivePremium, premiumTrialDto } from "../utils/premium.js";

export const usersRouter = Router();

type RelationshipDto = {
  isFollowing: boolean;
  followsMe: boolean;
  isFriend: boolean;
};

function formatDateOnly(value: unknown) {
  if (!value) {
    return "";
  }

  return new Date(value as string | Date).toISOString().slice(0, 10);
}

function birthdayDto(user: any, isOwner: boolean) {
  const visibility = user.birthday?.visibility ?? "hidden";
  const date = user.birthday?.date ? new Date(user.birthday.date) : undefined;

  if (isOwner) {
    return {
      date: formatDateOnly(date),
      visibility
    };
  }

  if (!date || visibility === "hidden") {
    return { visibility };
  }

  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;

  if (visibility === "dayMonth") {
    return { day, month, visibility };
  }

  return {
    date: formatDateOnly(date),
    day,
    month,
    visibility
  };
}

async function relationshipDto(viewerId: string | undefined, targetId: string): Promise<RelationshipDto> {
  if (!viewerId || viewerId === targetId) {
    return { isFollowing: false, followsMe: false, isFriend: false };
  }

  const [isFollowing, followsMe] = await Promise.all([
    Follow.exists({ follower: viewerId, following: targetId }),
    Follow.exists({ follower: targetId, following: viewerId })
  ]);

  return {
    isFollowing: Boolean(isFollowing),
    followsMe: Boolean(followsMe),
    isFriend: Boolean(isFollowing && followsMe)
  };
}

async function publicUserDto(user: any, viewerId?: string) {
  const id = user._id.toString();
  const [relation, interactions] = await Promise.all([
    relationshipDto(viewerId, id),
    viewerId && viewerId !== id
      ? UserInteraction.find({ actor: viewerId, target: id }).select("type").lean()
      : []
  ]);
  const interactionTypes = new Set(interactions.map((item) => item.type));

  return {
    id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    birthday: birthdayDto(user, viewerId === id),
    isPremium: hasActivePremium(user),
    ...premiumTrialDto(user),
    themeColor: user.themeColor,
    counts: user.counts
      ? {
        posts: Math.max(0, user.counts.posts ?? 0),
        followers: Math.max(0, user.counts.followers ?? 0),
        following: Math.max(0, user.counts.following ?? 0),
        friends: Math.max(0, user.counts.friends ?? 0)
      }
      : { posts: 0, followers: 0, following: 0, friends: 0 },
    relationship: relation,
    viewerInteraction: {
      restricted: interactionTypes.has("restrict"),
      blocked: interactionTypes.has("block"),
      reported: interactionTypes.has("report")
    },
    preferences: {
      interests: user.preferences?.interests ?? [],
      eatingStyles: user.preferences?.eatingStyles ?? [],
      completedOnboarding: user.preferences?.completedOnboarding ?? false
    }
  };
}

async function userListDto(users: any[], viewerId?: string) {
  return Promise.all(users.map((user) => publicUserDto(user, viewerId)));
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

  return posts.map((post) =>
    serializePost(
      post,
      new Set(likes.map((like) => like.post.toString())),
      new Set(saves.map((save) => save.post.toString()))
    )
  );
}

async function friendIdsFor(viewerId: string | undefined) {
  if (!viewerId) {
    return new Set<string>();
  }

  const [following, followers] = await Promise.all([
    Follow.find({ follower: viewerId }).select("following").lean(),
    Follow.find({ following: viewerId }).select("follower").lean()
  ]);
  const followingIds = new Set(following.map((item) => item.following.toString()));
  const followerIds = new Set(followers.map((item) => item.follower.toString()));

  return new Set([...followingIds].filter((id) => followerIds.has(id)));
}

function visiblePostFilter(viewerId: string | undefined, friendIds: Set<string>) {
  return {
    moderationStatus: { $ne: "hidden" },
    $or: [
      { visibility: "public" },
      ...(viewerId ? [{ author: viewerId }] : []),
      ...(friendIds.size ? [{ author: { $in: [...friendIds] }, visibility: "friends" }] : [])
    ]
  };
}

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().max(500).optional(),
  coverUrl: z.string().max(500).optional(),
  bio: z.string().max(240).optional(),
  birthday: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
      visibility: z.enum(["hidden", "dayMonth", "full"]).optional()
    })
    .optional(),
  themeColor: z.string().max(30).optional()
});

const interactionBodySchema = z.object({
  type: z.enum(["restrict", "block", "report"]),
  note: z.string().max(1000).optional()
});

usersRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const body = updateMeSchema.parse(req.body);
    const update: Record<string, unknown> = { ...body };

    if (body.birthday) {
      update.birthday = {
        date: body.birthday.date ? new Date(`${body.birthday.date}T00:00:00.000Z`) : undefined,
        visibility: body.birthday.visibility ?? "hidden"
      };
    }

    const user = await User.findByIdAndUpdate(req.user?.id, { $set: update }, { new: true });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.json({ user: await publicUserDto(user, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/me/premium-trial", requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const user = await User.findOneAndUpdate(
      { _id: req.user?.id, premiumTrialUsed: { $ne: true } },
      {
        $set: {
          premiumTrialUsed: true,
          premiumTrialStartedAt: now,
          premiumTrialEndsAt: trialEndsAt
        }
      },
      { new: true }
    );

    if (!user) {
      throw new HttpError(409, "Bạn đã sử dụng ưu đãi Premium miễn phí rồi.");
    }

    res.json({ user: await publicUserDto(user, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

const pushTokenSchema = z.object({
  pushToken: z.string().min(1)
});

const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

usersRouter.post("/push-token", requireAuth, async (req, res, next) => {
  try {
    const { pushToken } = pushTokenSchema.parse(req.body);
    await User.findByIdAndUpdate(req.user?.id, {
      $addToSet: { pushTokens: pushToken }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/push-token", requireAuth, async (req, res, next) => {
  try {
    const { pushToken } = pushTokenSchema.parse(req.body);
    await User.findByIdAndUpdate(req.user?.id, {
      $pull: { pushTokens: pushToken }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/web-push/vapid-public-key", async (_req, res) => {
  res.json({ publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "" });
});

usersRouter.post("/web-push-subscription", requireAuth, async (req, res, next) => {
  try {
    const subscription = webPushSubscriptionSchema.parse(req.body);
    const userAgent = req.get("user-agent") ?? "";

    await User.findByIdAndUpdate(req.user?.id, {
      $pull: { webPushSubscriptions: { endpoint: subscription.endpoint } }
    });

    await User.findByIdAndUpdate(req.user?.id, {
      $push: {
        webPushSubscriptions: {
          ...subscription,
          expirationTime: subscription.expirationTime ?? null,
          userAgent,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/web-push-subscription", requireAuth, async (req, res, next) => {
  try {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    await User.findByIdAndUpdate(req.user?.id, {
      $pull: { webPushSubscriptions: { endpoint } }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/me/interactions/blocked", requireAuth, async (req, res, next) => {
  try {
    const blocks = await UserInteraction.find({ actor: req.user?.id, type: "block" }).select("target").lean();
    const targetIds = blocks.map(b => b.target);
    const users = await User.find({ _id: { $in: targetIds } }).lean();
    res.json({ users: await userListDto(users, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/search", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();

    if (!q) {
      res.json({ users: [] });
      return;
    }

    const users = await User.find({
      _id: { $ne: req.user?.id },
      $or: [
        { displayName: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
        { bio: new RegExp(q, "i") }
      ]
    })
      .sort({ displayName: 1 })
      .limit(25)
      .lean();

    res.json({ users: await userListDto(users, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.json({ user: await publicUserDto(user, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id/followers", requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const follows = await Follow.find({ following: targetId }).populate("follower").lean();
    const users = follows.map(f => f.follower).filter(Boolean);
    res.json({ users: await userListDto(users, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id/following", requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const follows = await Follow.find({ follower: targetId }).populate("following").lean();
    const users = follows.map(f => f.following).filter(Boolean);
    res.json({ users: await userListDto(users, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/:id/follow", requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user?.id) {
      throw new HttpError(400, "You cannot follow yourself");
    }

    const target = await User.findById(targetId);

    if (!target) {
      throw new HttpError(404, "User not found");
    }

    const existing = await Follow.findOne({ follower: req.user?.id, following: targetId });

    if (!existing) {
      await Follow.create({ follower: req.user?.id, following: targetId });

      const followsMe = await Follow.exists({ follower: targetId, following: req.user?.id });
      const friendInc = followsMe ? 1 : 0;

      const [u1, u2] = await Promise.all([
        User.findByIdAndUpdate(req.user?.id, {
          $inc: { "counts.following": 1, "counts.friends": friendInc }
        }, { new: true }),
        User.findByIdAndUpdate(targetId, {
          $inc: { "counts.followers": 1, "counts.friends": friendInc }
        }, { new: true })
      ]);

      if (u1) {
        const updateObj: Record<string, number> = {};
        if ((u1.counts?.following ?? 0) < 0) updateObj["counts.following"] = 1;
        if ((u1.counts?.friends ?? 0) < 0) updateObj["counts.friends"] = friendInc;
        if (Object.keys(updateObj).length > 0) {
          await User.findByIdAndUpdate(req.user?.id, { $set: updateObj });
        }
      }
      if (u2) {
        const updateObj: Record<string, number> = {};
        if ((u2.counts?.followers ?? 0) < 0) updateObj["counts.followers"] = 1;
        if ((u2.counts?.friends ?? 0) < 0) updateObj["counts.friends"] = friendInc;
        if (Object.keys(updateObj).length > 0) {
          await User.findByIdAndUpdate(targetId, { $set: updateObj });
        }
      }

      // Trigger follow notification
      const sender = await User.findById(req.user?.id).select("displayName").lean();
      const senderName = sender?.displayName || "Ai đó";

      const notification = await Notification.create({
        user: targetId,
        sender: req.user?.id,
        type: "follow",
        body: `đã bắt đầu theo dõi bạn.`
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "displayName avatarUrl")
        .lean();

      emitToUser(targetId || "", "notification:created", populatedNotification);

      // Trigger Push Notification
      sendPushNotification(
        targetId || "",
        "Người theo dõi mới 👤",
        `${senderName} đã bắt đầu theo dõi bạn.`,
        { type: "follow", senderId: req.user?.id }
      );
    }

    const updatedTarget = await User.findById(targetId).lean();
    res.json({ user: await publicUserDto(updatedTarget, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id/follow", requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user?.id) {
      throw new HttpError(400, "You cannot unfollow yourself");
    }

    const deleted = await Follow.findOneAndDelete({ follower: req.user?.id, following: targetId });

    if (deleted) {
      const followsMe = await Follow.exists({ follower: targetId, following: req.user?.id });
      const friendInc = followsMe ? -1 : 0;

      const [u1, u2] = await Promise.all([
        User.findByIdAndUpdate(req.user?.id, {
          $inc: { "counts.following": -1, "counts.friends": friendInc }
        }, { new: true }),
        User.findByIdAndUpdate(targetId, {
          $inc: { "counts.followers": -1, "counts.friends": friendInc }
        }, { new: true })
      ]);

      if (u1) {
        const updateObj: Record<string, number> = {};
        if ((u1.counts?.following ?? 0) < 0) updateObj["counts.following"] = 0;
        if ((u1.counts?.friends ?? 0) < 0) updateObj["counts.friends"] = 0;
        if (Object.keys(updateObj).length > 0) {
          await User.findByIdAndUpdate(req.user?.id, { $set: updateObj });
        }
      }
      if (u2) {
        const updateObj: Record<string, number> = {};
        if ((u2.counts?.followers ?? 0) < 0) updateObj["counts.followers"] = 0;
        if ((u2.counts?.friends ?? 0) < 0) updateObj["counts.friends"] = 0;
        if (Object.keys(updateObj).length > 0) {
          await User.findByIdAndUpdate(targetId, { $set: updateObj });
        }
      }
    }

    const updatedTarget = await User.findById(targetId).lean();

    if (!updatedTarget) {
      throw new HttpError(404, "User not found");
    }

    res.json({ user: await publicUserDto(updatedTarget, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id/posts", requireAuth, async (req, res, next) => {
  try {
    const friendIds = await friendIdsFor(req.user?.id);
    const posts = await Post.find({
      author: req.params.id,
      ...visiblePostFilter(req.user?.id, friendIds)
    })
      .sort({ createdAt: -1 })
      .populate("author", "displayName avatarUrl isPremium themeColor")
      .populate("stickerId")
      .lean();

    res.json({ posts: await serializePostsForViewer(posts, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id/saved-posts", requireAuth, async (req, res, next) => {
  try {
    const saves = await PostSave.find({ user: req.params.id }).select("post").sort({ createdAt: -1 }).lean();
    const friendIds = await friendIdsFor(req.user?.id);
    const posts = await Post.find({
      _id: { $in: saves.map((save) => save.post) },
      ...visiblePostFilter(req.user?.id, friendIds)
    })
      .sort({ createdAt: -1 })
      .populate("author", "displayName avatarUrl isPremium themeColor")
      .populate("stickerId")
      .lean();

    res.json({ posts: await serializePostsForViewer(posts, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/:id/interactions", requireAuth, async (req, res, next) => {
  try {
    const body = interactionBodySchema.parse(req.body);

    if (req.params.id === req.user?.id) {
      throw new HttpError(400, "Cannot apply this action to yourself");
    }

    const target = await User.findById(req.params.id).select("_id").lean();

    if (!target) {
      throw new HttpError(404, "User not found");
    }

    await UserInteraction.findOneAndUpdate(
      { actor: req.user?.id, target: req.params.id, type: body.type },
      {
        $set: {
          note: body.note ?? ""
        }
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ type: body.type, active: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id/interactions/:type", requireAuth, async (req, res, next) => {
  try {
    const type = z.enum(["restrict", "block", "report"]).parse(req.params.type);

    await UserInteraction.findOneAndDelete({
      actor: req.user?.id,
      target: req.params.id,
      type
    });

    res.json({ type, active: false });
  } catch (error) {
    next(error);
  }
});

