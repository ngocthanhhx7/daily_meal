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
    isPremium: user.isPremium,
    themeColor: user.themeColor,
    counts: user.counts,
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
  isPremium: z.boolean().optional(),
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

      await Promise.all([
        User.findByIdAndUpdate(req.user?.id, {
          $inc: { "counts.following": 1, "counts.friends": friendInc }
        }),
        User.findByIdAndUpdate(targetId, {
          $inc: { "counts.followers": 1, "counts.friends": friendInc }
        })
      ]);

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

      await Promise.all([
        User.findByIdAndUpdate(req.user?.id, {
          $inc: { "counts.following": -1, "counts.friends": friendInc }
        }),
        User.findByIdAndUpdate(targetId, {
          $inc: { "counts.followers": -1, "counts.friends": friendInc }
        })
      ]);
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
    const posts = await Post.find({ author: req.params.id, visibility: "public" })
      .sort({ createdAt: -1 })
      .populate("author", "displayName avatarUrl isPremium")
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
    const posts = await Post.find({
      _id: { $in: saves.map((save) => save.post) },
      visibility: "public"
    })
      .sort({ createdAt: -1 })
      .populate("author", "displayName avatarUrl isPremium")
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
