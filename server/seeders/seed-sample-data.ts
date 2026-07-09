import { Types } from "mongoose";
import { AdminAuditLog } from "../src/models/AdminAuditLog.js";
import { AnalyticsEvent } from "../src/models/AnalyticsEvent.js";
import { Comment } from "../src/models/Comment.js";
import { Conversation } from "../src/models/Conversation.js";
import { Follow } from "../src/models/Follow.js";
import { Meal } from "../src/models/Meal.js";
import { Message } from "../src/models/Message.js";
import { Notification } from "../src/models/Notification.js";
import { Payment } from "../src/models/Payment.js";
import { Post } from "../src/models/Post.js";
import { PostLike } from "../src/models/PostLike.js";
import { PostSave } from "../src/models/PostSave.js";
import { Sticker } from "../src/models/Sticker.js";
import { Upload } from "../src/models/Upload.js";
import { User } from "../src/models/User.js";
import { UserInteraction } from "../src/models/UserInteraction.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { hashPassword } from "../src/services/auth.js";
import { seedDefaultStickers } from "../src/services/stickers.js";

const SAMPLE_USER_COUNT = Number.parseInt(process.env.SAMPLE_USER_COUNT ?? "100", 10);
const POSTS_PER_USER = Number.parseInt(process.env.SAMPLE_POSTS_PER_USER ?? "2", 10);
const SAMPLE_PASSWORD = process.env.SAMPLE_PASSWORD ?? "Password@123";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@dailymeal.local";

const firstNames = [
  "An",
  "Bao",
  "Binh",
  "Chi",
  "Dan",
  "Dung",
  "Gia",
  "Ha",
  "Hieu",
  "Khanh",
  "Lan",
  "Linh",
  "Mai",
  "Minh",
  "Nam",
  "Nhi",
  "Phong",
  "Quan",
  "Thao",
  "Trang",
  "Tuan",
  "Vy"
];

const lastNames = [
  "Nguyen",
  "Tran",
  "Le",
  "Pham",
  "Hoang",
  "Huynh",
  "Phan",
  "Vu",
  "Vo",
  "Dang",
  "Bui",
  "Do",
  "Ngo",
  "Duong",
  "Ly"
];

const dishes = [
  {
    name: "Chicken rice bowl",
    tags: ["protein", "lunch", "rice"],
    ingredients: ["brown rice", "grilled chicken", "cucumber", "sesame sauce"],
    steps: ["Cook rice until soft.", "Grill chicken with light seasoning.", "Plate with vegetables and sauce."],
    calories: 520,
    protein: 34,
    carbs: 58,
    fat: 16
  },
  {
    name: "Shrimp spring rolls",
    tags: ["fresh", "shrimp", "snack"],
    ingredients: ["rice paper", "shrimp", "lettuce", "vermicelli"],
    steps: ["Soften rice paper.", "Add shrimp and vegetables.", "Roll tightly and serve with peanut sauce."],
    calories: 360,
    protein: 22,
    carbs: 44,
    fat: 9
  },
  {
    name: "Salmon pasta",
    tags: ["salmon", "dinner", "pasta"],
    ingredients: ["pasta", "salmon", "mushrooms", "light cream"],
    steps: ["Boil pasta.", "Pan sear salmon.", "Mix pasta with mushroom cream sauce."],
    calories: 610,
    protein: 36,
    carbs: 62,
    fat: 24
  },
  {
    name: "Oat pancake",
    tags: ["breakfast", "oats", "sweet"],
    ingredients: ["oat flour", "egg", "milk", "banana"],
    steps: ["Mix batter.", "Cook small pancakes.", "Serve with fruit."],
    calories: 410,
    protein: 18,
    carbs: 52,
    fat: 12
  },
  {
    name: "Tofu salad",
    tags: ["vegan", "salad", "light"],
    ingredients: ["tofu", "greens", "tomato", "lime dressing"],
    steps: ["Pan sear tofu.", "Prepare salad greens.", "Toss everything with dressing."],
    calories: 330,
    protein: 20,
    carbs: 28,
    fat: 14
  },
  {
    name: "Beef noodle bowl",
    tags: ["beef", "noodle", "dinner"],
    ingredients: ["rice noodles", "beef", "herbs", "broth"],
    steps: ["Warm broth.", "Cook noodles.", "Top with beef and herbs."],
    calories: 570,
    protein: 32,
    carbs: 68,
    fat: 18
  }
];

const comments = [
  "Looks so good!",
  "I want to try this recipe tonight.",
  "Nice plating and colors.",
  "This fits my meal plan.",
  "Saving this for later.",
  "Healthy and still tasty.",
  "Great idea for lunch.",
  "The macros look balanced."
];

const messageBodies = [
  "What did you add to the sauce?",
  "I made something similar today.",
  "Send me the recipe later.",
  "Your lunch looks great.",
  "Want to cook this on the weekend?",
  "That meal is perfect after workout."
];

function pick<T>(items: T[], index: number) {
  return items[index % items.length]!;
}

function dayOffset(daysAgo: number, hour = 8) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 15, 0, 0);
  return date;
}

function imageUrl(index: number) {
  return `/uploads/image${(index % 10) + 1}.png`;
}

function idString(id: Types.ObjectId) {
  return id.toString();
}

function conversationKey(a: Types.ObjectId, b: Types.ObjectId) {
  return [idString(a), idString(b)].sort().join(":");
}

async function cleanupSampleData() {
  const sampleUsers = await User.find({ email: /^sample\.user\d+@dailymeal\.local$/i }).select("_id").lean();
  const sampleUserIds = sampleUsers.map((user) => user._id);
  const samplePosts = await Post.find({ author: { $in: sampleUserIds } }).select("_id").lean();
  const samplePostIds = samplePosts.map((post) => post._id);
  const sampleConversations = await Conversation.find({ participants: { $in: sampleUserIds } }).select("_id").lean();
  const sampleConversationIds = sampleConversations.map((conversation) => conversation._id);

  await Promise.all([
    Notification.deleteMany({
      $or: [{ user: { $in: sampleUserIds } }, { sender: { $in: sampleUserIds } }, { post: { $in: samplePostIds } }]
    }),
    Message.deleteMany({
      $or: [{ conversation: { $in: sampleConversationIds } }, { sender: { $in: sampleUserIds } }]
    }),
    Conversation.deleteMany({ _id: { $in: sampleConversationIds } }),
    Comment.deleteMany({
      $or: [{ post: { $in: samplePostIds } }, { author: { $in: sampleUserIds } }]
    }),
    PostLike.deleteMany({
      $or: [{ post: { $in: samplePostIds } }, { user: { $in: sampleUserIds } }]
    }),
    PostSave.deleteMany({
      $or: [{ post: { $in: samplePostIds } }, { user: { $in: sampleUserIds } }]
    }),
    Follow.deleteMany({
      $or: [{ follower: { $in: sampleUserIds } }, { following: { $in: sampleUserIds } }]
    }),
    Meal.deleteMany({
      $or: [{ user: { $in: sampleUserIds } }, { linkedPostId: { $in: samplePostIds } }]
    }),
    Upload.deleteMany({
      $or: [{ owner: { $in: sampleUserIds } }, { originalName: /^sample-/ }]
    }),
    Payment.deleteMany({
      $or: [{ user: { $in: sampleUserIds } }, { description: /^Sample/ }]
    }),
    AnalyticsEvent.deleteMany({
      $or: [{ user: { $in: sampleUserIds } }, { subjectKey: /^sample:/ }]
    }),
    AdminAuditLog.deleteMany({ "metadata.sample": true }),
    UserInteraction.deleteMany({
      $or: [{ actor: { $in: sampleUserIds } }, { target: { $in: sampleUserIds } }]
    }),
    Post.deleteMany({ _id: { $in: samplePostIds } })
  ]);

  await User.deleteMany({ _id: { $in: sampleUserIds } });
}

async function main() {
  await connectDatabase();
  await cleanupSampleData();
  await seedDefaultStickers();

  const stickers = await Sticker.find().select("_id key").lean();
  const passwordHash = await hashPassword(SAMPLE_PASSWORD);

  const userIds = Array.from({ length: SAMPLE_USER_COUNT }, () => new Types.ObjectId());
  const users = userIds.map((userId, index) => {
    const number = String(index + 1).padStart(3, "0");
    const displayName = `${pick(lastNames, index)} ${pick(firstNames, index)} ${number}`;

    return {
      _id: userId,
      email: `sample.user${number}@dailymeal.local`,
      phone: `+8490${String(1000000 + index).slice(1)}`,
      passwordHash,
      displayName,
      avatarUrl: imageUrl(index),
      coverUrl: imageUrl(index + 3),
      bio: `Sample foodie profile ${number}. Loves simple meals, balanced macros, and colorful plates.`,
      birthday: {
        date: new Date(1990 + (index % 15), index % 12, (index % 27) + 1),
        visibility: index % 3 === 0 ? "full" : index % 3 === 1 ? "dayMonth" : "hidden"
      },
      preferences: {
        interests: index % 2 === 0 ? ["recipes", "nutrition"] : ["community", "meal-prep"],
        eatingStyles: index % 3 === 0 ? ["clean-eating"] : index % 3 === 1 ? ["high-protein"] : ["balanced"],
        completedOnboarding: true
      },
      isPremium: index % 4 === 0,
      premiumTrialUsed: index % 5 === 0,
      premiumTrialStartedAt: index % 5 === 0 ? dayOffset(14 + index) : undefined,
      premiumTrialEndsAt: index % 5 === 0 ? dayOffset(index % 7) : undefined,
      themeColor: pick(["#8BA58A", "#D08C60", "#5C7CFA", "#E76F51", "#2A9D8F"], index),
      counts: { posts: 0, followers: 0, following: 0, friends: 0 }
    };
  });

  const avatarUploads = users.map((user, index) => ({
    _id: new Types.ObjectId(),
    owner: user._id,
    category: "avatar",
    mediaType: "image",
    url: user.avatarUrl,
    storageProvider: "local",
    localPath: `uploads\\sample-avatar-${index + 1}.png`,
    originalName: `sample-avatar-${index + 1}.png`,
    mime: "image/png",
    size: 120000 + index
  }));

  const mealUploads = users.map((user, index) => ({
    _id: new Types.ObjectId(),
    owner: user._id,
    category: "meal",
    mediaType: "image",
    url: imageUrl(index + 4),
    storageProvider: "local",
    localPath: `uploads\\sample-meal-${index + 1}.png`,
    originalName: `sample-meal-${index + 1}.png`,
    mime: "image/png",
    size: 210000 + index
  }));

  const mealIds = users.map(() => new Types.ObjectId());
  const meals = users.map((user, index) => {
    const dish = pick(dishes, index);

    return {
      _id: mealIds[index],
      user: user._id,
      image: {
        url: mealUploads[index]!.url,
        localPath: mealUploads[index]!.localPath,
        uploadId: mealUploads[index]!._id
      },
      result: {
        items: [
          {
            name: dish.name,
            portion: "1 serving",
            calories: dish.calories,
            protein: dish.protein,
            carbs: dish.carbs,
            fat: dish.fat,
            confidence: 0.82 + (index % 10) / 100
          }
        ],
        total: {
          calories: dish.calories,
          protein: dish.protein,
          carbs: dish.carbs,
          fat: dish.fat
        },
        warnings: index % 9 === 0 ? ["Sample AI estimate. Verify portions before tracking."] : [],
        raw: { sample: true, source: "seed-sample-data" }
      }
    };
  });

  const postUploads: any[] = [];
  const posts: any[] = [];
  let postCounter = 0;

  for (let userIndex = 0; userIndex < users.length; userIndex += 1) {
    for (let postIndex = 0; postIndex < POSTS_PER_USER; postIndex += 1) {
      postCounter += 1;
      const postId = new Types.ObjectId();
      const uploadId = new Types.ObjectId();
      const dish = pick(dishes, userIndex + postIndex);
      const createdAt = dayOffset((userIndex + postIndex) % 45, 7 + (postIndex % 12));
      const linkedMealId = postIndex === 0 ? mealIds[userIndex] : undefined;

      postUploads.push({
        _id: uploadId,
        owner: users[userIndex]!._id,
        category: "post",
        mediaType: "image",
        url: imageUrl(userIndex + postIndex),
        storageProvider: "local",
        localPath: `uploads\\sample-post-${postCounter}.png`,
        originalName: `sample-post-${postCounter}.png`,
        mime: "image/png",
        size: 240000 + postCounter
      });

      posts.push({
        _id: postId,
        author: users[userIndex]!._id,
        mediaType: "image",
        images: [{ url: imageUrl(userIndex + postIndex), localPath: `uploads\\sample-post-${postCounter}.png`, uploadId }],
        layout: pick(["stack", "grid", "cascade"], postCounter),
        imageTransforms: [{ scale: 1, rotation: 0, offsetX: 0, offsetY: 0 }],
        caption: `${dish.name} for ${postIndex === 0 ? "today" : "meal prep"} - sample post ${postCounter}.`,
        tags: [...dish.tags, "sample-data"],
        recipe: {
          title: dish.name,
          ingredients: dish.ingredients,
          steps: dish.steps
        },
        recipes: [
          {
            imageIndex: 0,
            title: dish.name,
            ingredients: dish.ingredients,
            steps: dish.steps
          }
        ],
        nutritionSummary: {
          calories: dish.calories,
          protein: dish.protein,
          carbs: dish.carbs,
          fat: dish.fat,
          confidence: 0.84 + (postCounter % 10) / 100
        },
        nutritionDetails: [
          {
            imageIndex: 0,
            items: [
              {
                name: dish.name,
                portion: "1 plate",
                calories: dish.calories,
                protein: dish.protein,
                carbs: dish.carbs,
                fat: dish.fat,
                confidence: 0.86
              }
            ],
            total: {
              calories: dish.calories,
              protein: dish.protein,
              carbs: dish.carbs,
              fat: dish.fat,
              confidence: 0.86
            },
            warnings: [],
            mealId: linkedMealId
          }
        ],
        mealId: linkedMealId,
        stickerId: stickers.length ? pick(stickers, postCounter)._id : undefined,
        stickerPlacement: {
          x: 0.2 + ((postCounter % 6) * 0.1),
          y: 0.68 + ((postCounter % 3) * 0.05),
          scale: 0.85 + ((postCounter % 4) * 0.08),
          rotation: (postCounter % 9) - 4
        },
        visibility: pick(["public", "friends", "private"], postCounter),
        moderationStatus: postCounter % 31 === 0 ? "review" : postCounter % 47 === 0 ? "hidden" : "visible",
        moderationReason: postCounter % 47 === 0 ? "Sample hidden post for admin testing." : "",
        moderatedAt: postCounter % 47 === 0 ? createdAt : undefined,
        moderatedBy: postCounter % 47 === 0 ? ADMIN_EMAIL : undefined,
        stats: { likes: 0, comments: 0, saves: 0 },
        createdAt,
        updatedAt: createdAt
      });

      if (postIndex === 0) {
        meals[userIndex] = {
          ...meals[userIndex],
          linkedPostId: postId
        };
      }
    }
  }

  const follows: any[] = [];
  const followingCount = new Map<string, number>();
  const followerCount = new Map<string, number>();

  users.forEach((user, index) => {
    for (const offset of [1, 2, 5]) {
      const target = users[(index + offset) % users.length]!;
      follows.push({ follower: user._id, following: target._id, createdAt: dayOffset((index + offset) % 30) });
      followingCount.set(idString(user._id), (followingCount.get(idString(user._id)) ?? 0) + 1);
      followerCount.set(idString(target._id), (followerCount.get(idString(target._id)) ?? 0) + 1);
    }
  });

  const likes: any[] = [];
  const saves: any[] = [];
  const postLikeCount = new Map<string, number>();
  const postSaveCount = new Map<string, number>();

  posts.forEach((post, postIndex) => {
    for (let offset = 1; offset <= 5; offset += 1) {
      const liker = users[(postIndex + offset * 7) % users.length]!;
      if (!liker._id.equals(post.author)) {
        likes.push({ post: post._id, user: liker._id, createdAt: dayOffset((postIndex + offset) % 40) });
        postLikeCount.set(idString(post._id), (postLikeCount.get(idString(post._id)) ?? 0) + 1);
      }
    }

    for (let offset = 1; offset <= 3; offset += 1) {
      const saver = users[(postIndex + offset * 11) % users.length]!;
      if (!saver._id.equals(post.author)) {
        saves.push({ post: post._id, user: saver._id, createdAt: dayOffset((postIndex + offset + 3) % 40) });
        postSaveCount.set(idString(post._id), (postSaveCount.get(idString(post._id)) ?? 0) + 1);
      }
    }
  });

  const commentDocs: any[] = [];
  const postCommentCount = new Map<string, number>();

  posts.forEach((post, postIndex) => {
    for (let offset = 1; offset <= 3; offset += 1) {
      const author = users[(postIndex + offset * 13) % users.length]!;
      const comment = {
        _id: new Types.ObjectId(),
        post: post._id,
        author: author._id,
        body: pick(comments, postIndex + offset),
        createdAt: dayOffset((postIndex + offset + 5) % 35),
        updatedAt: dayOffset((postIndex + offset + 5) % 35)
      };
      commentDocs.push(comment);
      postCommentCount.set(idString(post._id), (postCommentCount.get(idString(post._id)) ?? 0) + 1);
    }
  });

  posts.forEach((post) => {
    post.stats = {
      likes: postLikeCount.get(idString(post._id)) ?? 0,
      comments: postCommentCount.get(idString(post._id)) ?? 0,
      saves: postSaveCount.get(idString(post._id)) ?? 0
    };
  });

  const postCountByUser = new Map<string, number>();
  posts.forEach((post) => {
    postCountByUser.set(idString(post.author), (postCountByUser.get(idString(post.author)) ?? 0) + 1);
  });

  users.forEach((user) => {
    const userId = idString(user._id);
    user.counts = {
      posts: postCountByUser.get(userId) ?? 0,
      followers: followerCount.get(userId) ?? 0,
      following: followingCount.get(userId) ?? 0,
      friends: Math.min(followerCount.get(userId) ?? 0, followingCount.get(userId) ?? 0)
    };
  });

  const conversations: any[] = [];
  const messages: any[] = [];

  users.forEach((user, index) => {
    const peer = users[(index + 1) % users.length]!;
    const conversationId = new Types.ObjectId();
    const conversationMessages = Array.from({ length: 3 }, (_, messageIndex) => ({
      _id: new Types.ObjectId(),
      conversation: conversationId,
      sender: messageIndex % 2 === 0 ? user._id : peer._id,
      body: pick(messageBodies, index + messageIndex),
      readBy: messageIndex === 2 ? [user._id] : [user._id, peer._id],
      createdAt: dayOffset((index + messageIndex) % 20, 9 + messageIndex),
      updatedAt: dayOffset((index + messageIndex) % 20, 9 + messageIndex)
    }));

    conversations.push({
      _id: conversationId,
      participants: [user._id, peer._id],
      participantKey: conversationKey(user._id, peer._id),
      lastMessage: {
        body: conversationMessages[conversationMessages.length - 1]!.body,
        sender: conversationMessages[conversationMessages.length - 1]!.sender,
        sentAt: conversationMessages[conversationMessages.length - 1]!.createdAt
      },
      createdAt: dayOffset(index % 20),
      updatedAt: conversationMessages[conversationMessages.length - 1]!.createdAt
    });

    messages.push(...conversationMessages);
  });

  const payments = users.slice(0, Math.floor(users.length / 2)).map((user, index) => {
    const status = pick(["PAID", "PENDING", "CANCELLED", "EXPIRED", "PROCESSING"], index);
    const planId = pick(["premium_month", "premium_quarter", "premium_half"], index);
    const amount = planId === "premium_month" ? 49000 : planId === "premium_quarter" ? 129000 : 249000;

    return {
      provider: "payos",
      user: user._id,
      planId,
      orderCode: 8700000000 + index,
      amount,
      currency: "VND",
      description: `Sample ${planId} payment ${index + 1}`,
      status,
      paymentLinkId: `sample-payment-link-${index + 1}`,
      checkoutUrl: `https://pay.dailymeal.local/sample/${index + 1}`,
      qrCode: `sample-qr-${index + 1}`,
      paidAt: status === "PAID" ? dayOffset(index % 28) : undefined,
      canceledAt: status === "CANCELLED" ? dayOffset(index % 28) : undefined,
      webhookReference: `sample-webhook-${index + 1}`,
      rawResponse: { sample: true, planId, amount },
      rawWebhook: status === "PAID" ? { sample: true, status } : undefined,
      createdAt: dayOffset(index % 28),
      updatedAt: dayOffset(index % 28)
    };
  });

  const interactions = users.slice(0, Math.floor(users.length / 2)).map((user, index) => {
    const type = pick(["report", "block", "restrict"], index);
    const status = pick(["open", "resolved", "dismissed"], index);

    return {
      actor: user._id,
      target: users[(index + 17) % users.length]!._id,
      type,
      note: `Sample ${type} interaction ${index + 1}`,
      status,
      adminNote: status === "open" ? "" : "Handled by sample admin flow.",
      resolvedAt: status === "open" ? undefined : dayOffset(index % 14),
      resolvedBy: status === "open" ? undefined : ADMIN_EMAIL,
      createdAt: dayOffset(index % 35),
      updatedAt: dayOffset(index % 14)
    };
  });

  const analyticsEvents: any[] = [];
  const eventNames = [
    "session_start",
    "screen_view",
    "feed_impression",
    "post_opened",
    "post_liked",
    "comment_created",
    "meal_analysis_completed",
    "premium_viewed",
    "payment_started",
    "session_end"
  ];

  users.forEach((user, userIndex) => {
    for (let eventIndex = 0; eventIndex < 10; eventIndex += 1) {
      const post = posts[(userIndex * POSTS_PER_USER + eventIndex) % posts.length]!;
      analyticsEvents.push({
        name: pick(eventNames, eventIndex),
        occurredAt: dayOffset((userIndex + eventIndex) % 30, 6 + (eventIndex % 12)),
        receivedAt: dayOffset((userIndex + eventIndex) % 30, 6 + (eventIndex % 12)),
        sessionId: `sample-session-${String(userIndex + 1).padStart(3, "0")}-${eventIndex}`,
        anonymousId: `sample-anon-${String(userIndex + 1).padStart(3, "0")}`,
        subjectKey: `sample:user:${idString(user._id)}`,
        user: user._id,
        source: eventIndex % 9 === 0 ? "server" : "client",
        platform: pick(["android", "ios", "web"], userIndex + eventIndex),
        appVersion: "1.0.0-sample",
        screen: pick(["Home", "Create", "Profile", "PostSummary", "PremiumBenefits"], eventIndex),
        targetType: "post",
        targetId: idString(post._id),
        value: eventIndex * 10,
        properties: {
          sample: true,
          durationMs: 3000 + eventIndex * 450,
          scrollDepthPercent: Math.min(100, 20 + eventIndex * 8)
        }
      });
    }
  });

  const adminAuditLogs = Array.from({ length: 30 }, (_, index) => {
    const post = posts[index % posts.length]!;

    return {
      adminEmail: ADMIN_EMAIL,
      action: pick(["post.review", "user.inspect", "report.resolve", "premium.adjust"], index),
      targetType: index % 2 === 0 ? "post" : "user",
      targetId: index % 2 === 0 ? idString(post._id) : idString(users[index % users.length]!._id),
      note: `Sample admin audit log ${index + 1}`,
      metadata: { sample: true, source: "seed-sample-data" },
      createdAt: dayOffset(index % 21),
      updatedAt: dayOffset(index % 21)
    };
  });

  const notifications: any[] = [];

  likes.slice(0, 250).forEach((like, index) => {
    const post = posts.find((item) => item._id.equals(like.post));
    if (!post) return;
    notifications.push({
      user: post.author,
      sender: like.user,
      type: "like",
      post: post._id,
      body: "liked your sample post",
      read: index % 3 === 0,
      createdAt: dayOffset(index % 20),
      updatedAt: dayOffset(index % 20)
    });
  });

  commentDocs.slice(0, 250).forEach((comment, index) => {
    const post = posts.find((item) => item._id.equals(comment.post));
    if (!post) return;
    notifications.push({
      user: post.author,
      sender: comment.author,
      type: "comment",
      post: post._id,
      comment: comment._id,
      body: "commented on your sample post",
      read: index % 4 === 0,
      createdAt: dayOffset(index % 20),
      updatedAt: dayOffset(index % 20)
    });
  });

  follows.slice(0, 250).forEach((follow, index) => {
    notifications.push({
      user: follow.following,
      sender: follow.follower,
      type: "follow",
      body: "started following you",
      read: index % 5 === 0,
      createdAt: dayOffset(index % 20),
      updatedAt: dayOffset(index % 20)
    });
  });

  messages.slice(0, 100).forEach((message, index) => {
    const conversation = conversations.find((item) => item._id.equals(message.conversation));
    const receiver = conversation?.participants.find((participant: Types.ObjectId) => !participant.equals(message.sender));
    if (!receiver) return;
    notifications.push({
      user: receiver,
      sender: message.sender,
      type: "message",
      body: message.body,
      read: index % 2 === 0,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    });
  });

  await User.insertMany(users, { ordered: false });
  await Upload.insertMany([...avatarUploads, ...mealUploads, ...postUploads], { ordered: false });
  await Meal.insertMany(meals, { ordered: false });
  await Post.insertMany(posts, { ordered: false });
  await Follow.insertMany(follows, { ordered: false });
  await PostLike.insertMany(likes, { ordered: false });
  await PostSave.insertMany(saves, { ordered: false });
  await Comment.insertMany(commentDocs, { ordered: false });
  await Conversation.insertMany(conversations, { ordered: false });
  await Message.insertMany(messages, { ordered: false });
  await Notification.insertMany(notifications, { ordered: false });
  await Payment.insertMany(payments, { ordered: false });
  await UserInteraction.insertMany(interactions, { ordered: false });
  await AnalyticsEvent.insertMany(analyticsEvents, { ordered: false });
  await AdminAuditLog.insertMany(adminAuditLogs, { ordered: false });

  const counts = {
    users: await User.countDocuments({ email: /^sample\.user\d+@dailymeal\.local$/i }),
    uploads: await Upload.countDocuments({ originalName: /^sample-/ }),
    meals: await Meal.countDocuments({ user: { $in: userIds } }),
    posts: await Post.countDocuments({ author: { $in: userIds } }),
    follows: await Follow.countDocuments({ follower: { $in: userIds } }),
    postlikes: await PostLike.countDocuments({ user: { $in: userIds } }),
    postsaves: await PostSave.countDocuments({ user: { $in: userIds } }),
    comments: await Comment.countDocuments({ author: { $in: userIds } }),
    conversations: await Conversation.countDocuments({ participants: { $in: userIds } }),
    messages: await Message.countDocuments({ sender: { $in: userIds } }),
    notifications: await Notification.countDocuments({ user: { $in: userIds } }),
    payments: await Payment.countDocuments({ user: { $in: userIds } }),
    userinteractions: await UserInteraction.countDocuments({ actor: { $in: userIds } }),
    analyticsevents: await AnalyticsEvent.countDocuments({ user: { $in: userIds } }),
    adminauditlogs: await AdminAuditLog.countDocuments({ "metadata.sample": true }),
    stickers: await Sticker.countDocuments()
  };

  console.log("Sample seed completed.");
  console.table(counts);
  console.log(`Sample user password: ${SAMPLE_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Sample seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
