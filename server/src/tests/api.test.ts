import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { repairUserUniqueIndexes } from "../config/db.js";
import { env } from "../config/env.js";
import { seedDefaultStickers } from "../services/stickers.js";
import { createPayosSignature } from "../services/payos.js";
import { broadcastToRoom, emitToUser } from "../services/socket.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { Comment } from "../models/Comment.js";
import { Meal } from "../models/Meal.js";
import { Payment } from "../models/Payment.js";
import { PostLike } from "../models/PostLike.js";
import { PostSave } from "../models/PostSave.js";
import { Post } from "../models/Post.js";
import { Sticker } from "../models/Sticker.js";
import { User } from "../models/User.js";
import { UserInteraction } from "../models/UserInteraction.js";
import { verifyGoogleIdToken } from "../services/googleAuth.js";

vi.mock("../services/googleAuth.js", () => ({
  verifyGoogleIdToken: vi.fn()
}));

vi.mock("../services/socket.js", () => ({
  initSocket: vi.fn(),
  emitToUser: vi.fn(),
  broadcastToRoom: vi.fn(),
  broadcastGlobal: vi.fn()
}));

vi.mock("../services/pushNotification.js", () => ({
  sendPushNotification: vi.fn()
}));

let mongo: MongoMemoryServer;
const app = createApp();
const mockedVerifyGoogleIdToken = vi.mocked(verifyGoogleIdToken);
const mockedEmitToUser = vi.mocked(emitToUser);
const mockedBroadcastToRoom = vi.mocked(broadcastToRoom);
const originalNodeEnv = process.env.NODE_ENV;

async function register(email: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", displayName: "Tester" })
    .expect(201);
  return response.body as { token: string; user: { id: string } };
}

async function createPost(token: string, caption: string, visibility: "public" | "friends" | "private" = "public") {
  const response = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      images: [{ url: "/uploads/demo.jpg" }],
      caption,
      tags: [],
      visibility
    })
    .expect(201);

  return response.body.post as { _id: string; caption: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function vietnamPostDate(dayOffset: number, hour = 12) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const noonInVietnamAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour - 7, 0, 0, 0);
  return new Date(noonInVietnamAsUtc - dayOffset * DAY_MS);
}

async function setPostCreatedAt(postId: string, createdAt: Date, fields: Record<string, unknown> = {}) {
  await Post.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(postId) },
    { $set: { createdAt, updatedAt: createdAt, ...fields } }
  );
}

async function makePremium(userId: string) {
  await User.findByIdAndUpdate(userId, { isPremium: true });
}

describe("Daily Meal API", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await seedDefaultStickers();
  });

  beforeEach(() => {
    mockedVerifyGoogleIdToken.mockReset();
    mockedEmitToUser.mockClear();
    mockedBroadcastToRoom.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    delete process.env.SMS_PROVIDER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_PHONE;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("registers and reads the current user", async () => {
    const session = await register("auth@example.com");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    expect(me.body.user.email).toBe("auth@example.com");
  });

  it("returns a user-readable validation error for invalid login input", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "123" })
      .expect(400);

    expect(response.body.message).toBe("Email không hợp lệ. Mật khẩu cần ít nhất 6 ký tự.");
  });

  it("repairs legacy email indexes before creating phone-only OTP users", async () => {
    await User.collection.dropIndex("email_1").catch(() => undefined);
    await User.collection.createIndex({ email: 1 }, { unique: true, name: "email_1" });
    await User.create({ email: null, phone: "0900000000", displayName: "Legacy Phone" });

    await repairUserUniqueIndexes();

    const emailIndex = (await User.collection.indexes()).find((index) => index.name === "email_1");
    expect(emailIndex?.partialFilterExpression).toEqual({ email: { $type: "string" } });

    const response = await request(app)
      .post("/api/auth/phone/request-otp")
      .send({ phone: "0900000001" })
      .expect(200);

    expect(response.body.requiresPasswordSetup).toBe(true);

    const legacyUser = await User.findOne({ phone: "0900000000" }).lean();
    expect(legacyUser?.email).toBeUndefined();
  });

  it("sends phone OTP through Twilio in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC123456789";
    process.env.TWILIO_AUTH_TOKEN = "twilio-token";
    process.env.TWILIO_FROM_PHONE = "+15551234567";

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ sid: "SM123" }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post("/api/auth/phone/request-otp")
      .send({ phone: "0772211666" })
      .expect(200);

    expect(response.body.devOtp).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall!;
    expect(String(url)).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123456789/Messages.json");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("AC123456789:twilio-token").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    });
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("From")).toBe("+15551234567");
    expect(body.get("To")).toBe("+84772211666");
    expect(body.get("Body")).toMatch(/Daily Meal.*\d{6}/);
  });

  it("does not claim phone OTP was sent in production without an SMS provider", async () => {
    process.env.NODE_ENV = "production";

    const response = await request(app)
      .post("/api/auth/phone/request-otp")
      .send({ phone: "0772211667" })
      .expect(503);

    expect(response.body.message).toContain("Chưa cấu hình dịch vụ gửi OTP");
  });

  it("saves onboarding preferences", async () => {
    const session = await register("onboarding@example.com");

    const response = await request(app)
      .patch("/api/onboarding/preferences")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ interests: ["Thích chụp ảnh"], eatingStyles: ["Thâm hụt calo"] })
      .expect(200);

    expect(response.body.preferences.completedOnboarding).toBe(true);
  });

  it("keeps onboarding complete when preferences are updated later", async () => {
    const session = await register("onboarding-profile-update@example.com");

    await request(app)
      .patch("/api/onboarding/preferences")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ interests: ["ThÃ­ch chá»¥p áº£nh"], eatingStyles: ["KhÃ´ng theo phong cÃ¡ch nÃ o"] })
      .expect(200);

    const response = await request(app)
      .patch("/api/onboarding/preferences")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ interests: ["Muá»‘n tÃ¬m nhá»¯ng cÃ´ng thá»©c má»›i"], eatingStyles: ["ThÃ¢m há»¥t calo"] })
      .expect(200);

    expect(response.body.preferences).toMatchObject({
      interests: ["Muá»‘n tÃ¬m nhá»¯ng cÃ´ng thá»©c má»›i"],
      eatingStyles: ["ThÃ¢m há»¥t calo"],
      completedOnboarding: true
    });
  });

  it("does not let profile updates grant Premium", async () => {
    const session = await register("profile-premium@example.com");

    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ displayName: "Profile Premium", isPremium: true })
      .expect(200);

    expect(response.body.user.displayName).toBe("Profile Premium");
    expect(response.body.user.isPremium).toBe(false);

    const user = await User.findById(session.user.id).lean();
    expect(user?.isPremium).toBe(false);
  });

  it("activates a one-month Premium trial only once", async () => {
    const session = await register("premium-trial@example.com");

    const response = await request(app)
      .post("/api/users/me/premium-trial")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    expect(response.body.user.isPremium).toBe(true);
    expect(response.body.user.premiumTrialUsed).toBe(true);
    expect(response.body.user.premiumTrialStartedAt).toEqual(expect.any(String));
    expect(response.body.user.premiumTrialEndsAt).toEqual(expect.any(String));

    const trialEndsAt = new Date(response.body.user.premiumTrialEndsAt).getTime();
    expect(trialEndsAt).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(trialEndsAt).toBeLessThan(Date.now() + 31 * 24 * 60 * 60 * 1000);

    await request(app)
      .post("/api/users/me/premium-trial")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(409);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    expect(me.body.user.isPremium).toBe(true);
    expect(me.body.user.premiumTrialUsed).toBe(true);
  });
  it("does not treat expired Premium trials as active", async () => {
    const session = await register("expired-premium-trial@example.com");
    await User.findByIdAndUpdate(session.user.id, {
      premiumTrialUsed: true,
      premiumTrialStartedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      premiumTrialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    expect(me.body.user.isPremium).toBe(false);
    expect(me.body.user.premiumTrialUsed).toBe(true);

    await request(app)
      .post("/api/users/me/premium-trial")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(409);
  });

  it("keeps public user data private while preserving owner auth me fields", async () => {
    const viewer = await register("privacy-viewer@example.com");
    const target = await register("privacy-target@example.com");
    const other = await register("privacy-other@example.com");

    await User.findByIdAndUpdate(target.user.id, {
      displayName: "Privacy Target",
      phone: "0900000001"
    });
    await User.findByIdAndUpdate(other.user.id, {
      displayName: "Privacy Other",
      phone: "0900000002"
    });

    await request(app)
      .post(`/api/users/${target.user.id}/follow`)
      .set("Authorization", `Bearer ${other.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${other.user.id}/follow`)
      .set("Authorization", `Bearer ${target.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${other.user.id}/interactions`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ type: "block" })
      .expect(201);

    const profile = await request(app)
      .get(`/api/users/${target.user.id}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect(profile.body.user).not.toHaveProperty("email");
    expect(profile.body.user).not.toHaveProperty("phone");

    const search = await request(app)
      .get("/api/users/search?q=privacy")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect(search.body.users).toHaveLength(1);
    expect(search.body.users[0]).not.toHaveProperty("email");
    expect(search.body.users[0]).not.toHaveProperty("phone");

    const followers = await request(app)
      .get(`/api/users/${target.user.id}/followers`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(followers.body.users).toHaveLength(0);

    const following = await request(app)
      .get(`/api/users/${target.user.id}/following`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(following.body.users).toHaveLength(0);

    const owner = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${target.token}`)
      .expect(200);

    expect(owner.body.user.email).toBe("privacy-target@example.com");
    expect(owner.body.user.phone).toBe("0900000001");
  });

  it("suggests users from profile preferences when search query is empty", async () => {
    const viewer = await register("suggest-users-viewer@example.com");
    const recipeCreator = await register("suggest-users-recipe@example.com");
    const unrelatedCreator = await register("suggest-users-unrelated@example.com");

    await request(app)
      .patch("/api/onboarding/preferences")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ interests: ["Muá»‘n tÃ¬m nhá»¯ng cÃ´ng thá»©c má»›i"], eatingStyles: ["Cháº¿ Ä‘á»™ keto"] })
      .expect(200);

    await User.findByIdAndUpdate(recipeCreator.user.id, {
      displayName: "Keto Recipe Creator",
      email: "hidden-recipe@example.com",
      preferences: {
        interests: ["ThÃ­ch note láº¡i cÃ´ng thá»©c náº¥u Äƒn"],
        eatingStyles: ["Cháº¿ Ä‘á»™ keto"],
        completedOnboarding: true
      },
      counts: { posts: 4, followers: 8, following: 0, friends: 0 }
    });
    await User.findByIdAndUpdate(unrelatedCreator.user.id, {
      displayName: "Photo Only Creator",
      preferences: {
        interests: ["ThÃ­ch chá»¥p áº£nh"],
        eatingStyles: ["KhÃ´ng theo phong cÃ¡ch nÃ o"],
        completedOnboarding: true
      },
      counts: { posts: 1, followers: 1, following: 0, friends: 0 }
    });

    const response = await request(app)
      .get("/api/users/search?q=")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect(response.body.users[0]).toMatchObject({
      id: recipeCreator.user.id,
      displayName: "Keto Recipe Creator"
    });
    expect(response.body.users[0]).not.toHaveProperty("email");
    expect(response.body.users.map((user: { id: string }) => user.id)).not.toContain(viewer.user.id);
  });

  it("ranks empty post search by viewer preferences while preserving search filters", async () => {
    const viewer = await register("suggest-posts-viewer@example.com");
    const creator = await register("suggest-posts-creator@example.com");
    const sticker = await Sticker.findOne({ premiumOnly: true }).lean();
    await makePremium(creator.user.id);

    await request(app)
      .patch("/api/onboarding/preferences")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ interests: ["Muá»‘n tÃ¬m nhá»¯ng cÃ´ng thá»©c má»›i"], eatingStyles: ["ThÃ¢m há»¥t calo"] })
      .expect(200);

    const preferred = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${creator.token}`)
      .send({
        images: [{ url: "/uploads/light-recipe.jpg" }],
        caption: "CÃ´ng thá»©c salad calo tháº¥p",
        tags: ["recipe", "healthy"],
        recipe: { title: "Salad healthy", ingredients: ["rau", "trá»©ng"], steps: ["trá»™n"] },
        nutritionSummary: { calories: 420, protein: 20, carbs: 12, fat: 8, confidence: 1 },
        visibility: "public"
      })
      .expect(201);

    const popularButUnmatched = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${creator.token}`)
      .send({
        images: [{ url: "/uploads/cake.jpg" }],
        caption: "BÃ¡nh ngá»t nhiá»u calo",
        tags: ["dessert"],
        nutritionSummary: { calories: 900, protein: 4, carbs: 80, fat: 35, confidence: 1 },
        stickerId: sticker?._id.toString(),
        visibility: "public"
      })
      .expect(201);

    await Post.findByIdAndUpdate(popularButUnmatched.body.post._id, {
      "stats.likes": 50,
      "stats.saves": 20,
      "stats.comments": 5
    });
    await request(app)
      .post(`/api/posts/${preferred.body.post._id}/save`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const personalized = await request(app)
      .get("/api/posts/search?q=")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(personalized.body.posts[0]._id).toBe(preferred.body.post._id);

    const lowCalorie = await request(app)
      .get("/api/posts/search?q=&maxCalories=500")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(lowCalorie.body.posts.map((post: { _id: string }) => post._id)).toContain(preferred.body.post._id);
    expect(lowCalorie.body.posts.map((post: { _id: string }) => post._id)).not.toContain(popularButUnmatched.body.post._id);

    const saved = await request(app)
      .get("/api/posts/search?q=&saved=true")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(saved.body.posts.map((post: { _id: string }) => post._id)).toEqual([preferred.body.post._id]);

    const premiumSticker = await request(app)
      .get("/api/posts/search?q=&premiumSticker=true")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(premiumSticker.body.posts.map((post: { _id: string }) => post._id)).toContain(popularButUnmatched.body.post._id);
    expect(premiumSticker.body.posts.map((post: { _id: string }) => post._id)).not.toContain(preferred.body.post._id);
  });

  it("enforces block restrictions on follow, conversation, message, profile, feed, and search", async () => {
    const alice = await register("block-alice@example.com");
    const bob = await register("block-bob@example.com");

    const conversation = await request(app)
      .post("/api/messages/conversations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id })
      .expect(201);

    const conversationId = conversation.body.conversation.id;
    const blockedPost = await createPost(bob.token, "Blocked bob meal");

    await request(app)
      .post(`/api/users/${bob.user.id}/interactions`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ type: "block" })
      .expect(201);

    await request(app)
      .post(`/api/users/${alice.user.id}/follow`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(403);

    await request(app)
      .post(`/api/users/${bob.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(403);

    await request(app)
      .post("/api/messages/conversations")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ recipientId: alice.user.id })
      .expect(403);

    await request(app)
      .post(`/api/messages/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ body: "blocked message" })
      .expect(403);

    const profile = await request(app)
      .get(`/api/users/${bob.user.id}`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(profile.body.user.viewerInteraction.blocked).toBe(true);

    await request(app)
      .get(`/api/users/${alice.user.id}`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(404);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);
    expect(feed.body.posts.map((post: { _id: string }) => post._id)).not.toContain(blockedPost._id);

    const search = await request(app)
      .get("/api/posts/search?q=Blocked bob meal")
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);
    expect(search.body.posts.map((post: { _id: string }) => post._id)).not.toContain(blockedPost._id);

    await request(app)
      .post(`/api/posts/${blockedPost._id}/like`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(403);

    await request(app)
      .get(`/api/posts/${blockedPost._id}/comments`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(403);

    await request(app)
      .post(`/api/users/${bob.user.id}/interactions`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ type: "report", note: "still reportable" })
      .expect(201);
  });

  it("rejects SVG uploads while allowing common raster image types", async () => {
    const session = await register("upload-guard@example.com");

    await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${session.token}`)
      .attach("image", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), {
        filename: "evil.svg",
        contentType: "image/svg+xml"
      })
      .expect(400);

    await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${session.token}`)
      .attach("image", Buffer.from("fake png"), {
        filename: "good.png",
        contentType: "image/png"
      })
      .expect(201);
  });

  it("allows only premium accounts to upload short post videos", async () => {
    const freeSession = await register("video-free-upload@example.com");
    const premiumSession = await register("video-premium-upload@example.com");
    await makePremium(premiumSession.user.id);

    await request(app)
      .post("/api/uploads?category=post")
      .set("Authorization", `Bearer ${freeSession.token}`)
      .attach("video", Buffer.from("fake mp4"), {
        filename: "meal.mp4",
        contentType: "video/mp4"
      })
      .expect(403);

    await request(app)
      .post("/api/uploads?category=post")
      .set("Authorization", `Bearer ${premiumSession.token}`)
      .attach("video", Buffer.from("not a video"), {
        filename: "meal.txt",
        contentType: "text/plain"
      })
      .expect(400);

    const response = await request(app)
      .post("/api/uploads?category=post")
      .set("Authorization", `Bearer ${premiumSession.token}`)
      .attach("video", Buffer.from("fake mp4"), {
        filename: "meal.mp4",
        contentType: "video/mp4"
      })
      .expect(201);

    expect(response.body.upload).toMatchObject({
      mediaType: "video",
      mime: "video/mp4",
      size: Buffer.byteLength("fake mp4")
    });
    expect(response.body.upload.url).toBeTypeOf("string");
    expect(response.body.upload.url.length).toBeGreaterThan(0);
  });

  it("protects admin APIs and returns dashboard plus user details", async () => {
    Object.assign(env, { ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    const alice = await register("admin-alice@example.com");
    const bob = await register("admin-bob@example.com");
    const post = await createPost(alice.token, "Admin dashboard meal");
    await Payment.create({
      provider: "payos",
      user: alice.user.id,
      planId: "premium_month",
      orderCode: 9234567890,
      amount: 99000,
      currency: "VND",
      description: "Admin test payment",
      status: "PAID",
      paidAt: new Date()
    });
    await AnalyticsEvent.create([
      {
        name: "api_request_completed",
        occurredAt: new Date(),
        receivedAt: new Date(),
        sessionId: "admin-suite-technical",
        anonymousId: "admin-suite-anon",
        subjectKey: "anon:admin-suite-anon",
        source: "client",
        value: 123,
        properties: { durationMs: 123, status: 200 }
      },
      {
        name: "image_load_completed",
        occurredAt: new Date(),
        receivedAt: new Date(),
        sessionId: "admin-suite-technical",
        anonymousId: "admin-suite-anon",
        subjectKey: "anon:admin-suite-anon",
        source: "client",
        value: 456,
        properties: { durationMs: 456 }
      }
    ]);
    await Promise.all([
      PostLike.create({ post: post._id, user: bob.user.id }),
      PostSave.create({ post: post._id, user: bob.user.id }),
      Comment.create({ post: post._id, author: bob.user.id, body: "Looks good" }),
      UserInteraction.create({ actor: bob.user.id, target: alice.user.id, type: "report", note: "admin review" })
    ]);

    await request(app).get("/api/admin/dashboard").expect(401);
    await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(403);

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email: "admin@example.com", password: "admin-secret" })
      .expect(200);

    const adminToken = login.body.token as string;
    expect(adminToken).toBeDefined();

    const dashboard = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(dashboard.body.rangePreset).toBe("7d");
    expect(dashboard.body.totalsAllTime.users).toBeGreaterThanOrEqual(2);
    expect(dashboard.body.totalsAllTime.posts).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.totalsAllTime.revenue).toBeGreaterThanOrEqual(99000);
    expect(dashboard.body.totalsInRange.users).toBeGreaterThanOrEqual(2);
    expect(dashboard.body.totalsInRange.posts).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.totalsInRange.revenue).toBeGreaterThanOrEqual(99000);
    expect(dashboard.body.breakdowns.paymentsByStatus.length).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.analytics.technical.apiRequests).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.analytics.technical.imageLoads).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.today.interactions).toBeGreaterThanOrEqual(4);

    const oneDayDashboard = await request(app)
      .get("/api/admin/dashboard?range=1d")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(oneDayDashboard.body.rangePreset).toBe("1d");
    expect(oneDayDashboard.body.totalsInRange.posts).toBeGreaterThanOrEqual(1);

    const allDashboard = await request(app)
      .get("/api/admin/dashboard?range=all")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(allDashboard.body.rangePreset).toBe("all");
    expect(allDashboard.body.totalsInRange.users).toBe(dashboard.body.totalsAllTime.users);

    const users = await request(app)
      .get("/api/admin/users?q=admin-alice")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(users.body.users[0]).toMatchObject({ email: "admin-alice@example.com" });
    expect(users.body.users[0].stats).toHaveProperty("posts");

    const firstUserPage = await request(app)
      .get("/api/admin/users?limit=1")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(firstUserPage.body.users).toHaveLength(1);
    expect(firstUserPage.body.pagination).toMatchObject({ page: 1, limit: 1 });
    expect(firstUserPage.body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(firstUserPage.body.pagination.pages).toBeGreaterThanOrEqual(2);

    const secondUserPage = await request(app)
      .get("/api/admin/users?limit=1&page=2")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(secondUserPage.body.users).toHaveLength(1);
    expect(secondUserPage.body.pagination).toMatchObject({ page: 2, limit: 1 });

    const detail = await request(app)
      .get(`/api/admin/users/${alice.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.user.email).toBe("admin-alice@example.com");
    expect(detail.body.user.recentPosts[0].caption).toBe("Admin dashboard meal");
    expect(detail.body.user.interactions[0].type).toBe("report");

    const posts = await request(app)
      .get("/api/admin/posts?q=dashboard")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(posts.body.posts[0].caption).toBe("Admin dashboard meal");
    expect(posts.body.posts[0].images).toEqual([
      expect.objectContaining({ url: "/uploads/demo.jpg" })
    ]);

    const hidden = await request(app)
      .patch(`/api/admin/posts/${post._id}/moderation`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ moderationStatus: "hidden", reason: "test hide" })
      .expect(200);

    expect(hidden.body.post.moderationStatus).toBe("hidden");

    const feedAfterHide = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(feedAfterHide.body.posts.some((item: any) => item._id === post._id)).toBe(false);

    const searchAfterHide = await request(app)
      .get("/api/posts/search?q=dashboard")
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(searchAfterHide.body.posts.some((item: any) => item._id === post._id)).toBe(false);

    const reports = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(reports.body.reports[0].status).toBe("open");

    const resolvedReport = await request(app)
      .patch(`/api/admin/reports/${reports.body.reports[0].id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "resolved", adminNote: "Handled in test" })
      .expect(200);

    expect(resolvedReport.body.report.status).toBe("resolved");

    const premiumToggle = await request(app)
      .patch(`/api/admin/users/${bob.user.id}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isPremium: true, note: "test premium" })
      .expect(200);

    expect(premiumToggle.body.user.isPremium).toBe(true);

    const payments = await request(app)
      .get("/api/admin/payments?q=9234567890")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(payments.body.payments[0].orderCode).toBe(9234567890);

    Object.assign(env, { GEMINI_API_KEY: undefined });
    const aiReport = await request(app)
      .post("/api/admin/reports/ai")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ range: "1d" })
      .expect(200);

    expect(aiReport.body.rangePreset).toBe("1d");
    expect(aiReport.body.report.executiveSummary.length).toBeGreaterThan(0);
    expect(aiReport.body.report.sections).toHaveLength(4);
    expect(aiReport.body.report.sections[0].metrics.length).toBeGreaterThan(0);
    expect(aiReport.body.report.metricsSnapshot.mode).toBe("fallback");
  });

  it("returns admin user activity insights for preset and custom ranges", async () => {
    Object.assign(env, { ADMIN_EMAIL: "activity-admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    const active = await register("admin-active-user@example.com");
    const quiet = await register("admin-quiet-user@example.com");
    const activeUser = await User.findByIdAndUpdate(active.user.id, { displayName: "Active Admin User" }, { new: true });
    await User.findByIdAndUpdate(quiet.user.id, { displayName: "Quiet Admin User" });
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

    const activePost = await Post.create({
      author: active.user.id,
      images: [{ url: "/uploads/activity.jpg" }],
      caption: "Active user post",
      tags: [],
      visibility: "public",
      createdAt: twoDaysAgo,
      updatedAt: twoDaysAgo,
      stats: { likes: 1, comments: 1, saves: 1 }
    });

    await Promise.all([
      PostLike.create({ post: activePost._id, user: quiet.user.id, createdAt: twoDaysAgo, updatedAt: twoDaysAgo }),
      PostSave.create({ post: activePost._id, user: quiet.user.id, createdAt: twoDaysAgo, updatedAt: twoDaysAgo }),
      Comment.create({ post: activePost._id, author: quiet.user.id, body: "nice", createdAt: twoDaysAgo, updatedAt: twoDaysAgo }),
      AnalyticsEvent.create([
        {
          name: "session_start",
          occurredAt: twoDaysAgo,
          receivedAt: twoDaysAgo,
          sessionId: "admin-insights-active-session",
          subjectKey: `user:${active.user.id}`,
          user: active.user.id,
          source: "client",
          properties: {}
        },
        {
          name: "session_end",
          occurredAt: new Date(twoDaysAgo.getTime() + 180000),
          receivedAt: new Date(twoDaysAgo.getTime() + 180000),
          sessionId: "admin-insights-active-session",
          subjectKey: `user:${active.user.id}`,
          user: active.user.id,
          source: "client",
          properties: { durationMs: 180000 }
        },
        {
          name: "session_start",
          occurredAt: fortyDaysAgo,
          receivedAt: fortyDaysAgo,
          sessionId: "admin-insights-old-session",
          subjectKey: `user:${quiet.user.id}`,
          user: quiet.user.id,
          source: "client",
          properties: {}
        },
        {
          name: "session_end",
          occurredAt: new Date(fortyDaysAgo.getTime() + 60000),
          receivedAt: new Date(fortyDaysAgo.getTime() + 60000),
          sessionId: "admin-insights-old-session",
          subjectKey: `user:${quiet.user.id}`,
          user: quiet.user.id,
          source: "client",
          properties: { durationMs: 60000 }
        }
      ])
    ]);

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email: "activity-admin@example.com", password: "admin-secret" })
      .expect(200);

    const thirtyDays = await request(app)
      .get("/api/admin/users/insights?range=30d")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(thirtyDays.body.rangePreset).toBe("30d");
    expect(thirtyDays.body.summary.totalSessions).toBeGreaterThanOrEqual(1);
    expect(thirtyDays.body.summary.averageSessionDurationMs).toBeGreaterThanOrEqual(180000);
    expect(thirtyDays.body.topUsers[0]).toMatchObject({
      id: active.user.id,
      displayName: activeUser?.displayName,
      sessions: 1,
      posts: 1,
      interactions: 3
    });

    const custom = await request(app)
      .get(`/api/admin/users/insights?start=${encodeURIComponent(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())}&end=${encodeURIComponent(now.toISOString())}`)
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(custom.body.range.start).toEqual(expect.any(String));
    expect(custom.body.topUsers.some((user: any) => user.id === active.user.id)).toBe(true);
    expect(custom.body.topUsers.some((user: any) => user.id === quiet.user.id)).toBe(false);
  });

  it("filters admin user activity insights by time of day and reports daily and peak activity", async () => {
    Object.assign(env, { ADMIN_EMAIL: "activity-hours-admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    const morningUser = await register("admin-morning-activity@example.com");
    const eveningUser = await register("admin-evening-activity@example.com");
    await User.findByIdAndUpdate(morningUser.user.id, { displayName: "Morning User" });
    await User.findByIdAndUpdate(eveningUser.user.id, { displayName: "Evening User" });

    const morningStart = new Date(2026, 5, 29, 9, 15, 0, 0);
    const morningEnd = new Date(2026, 5, 29, 9, 45, 0, 0);
    const eveningStart = new Date(2026, 5, 29, 20, 0, 0, 0);
    const eveningEnd = new Date(2026, 5, 29, 20, 5, 0, 0);

    await AnalyticsEvent.create([
      {
        name: "session_start",
        occurredAt: morningStart,
        receivedAt: morningStart,
        sessionId: "admin-insights-morning-session",
        subjectKey: `user:${morningUser.user.id}`,
        user: morningUser.user.id,
        source: "client",
        properties: {}
      },
      {
        name: "session_end",
        occurredAt: morningEnd,
        receivedAt: morningEnd,
        sessionId: "admin-insights-morning-session",
        subjectKey: `user:${morningUser.user.id}`,
        user: morningUser.user.id,
        source: "client",
        properties: { durationMs: 30 * 60 * 1000 }
      },
      {
        name: "session_start",
        occurredAt: eveningStart,
        receivedAt: eveningStart,
        sessionId: "admin-insights-evening-session",
        subjectKey: `user:${eveningUser.user.id}`,
        user: eveningUser.user.id,
        source: "client",
        properties: {}
      },
      {
        name: "session_end",
        occurredAt: eveningEnd,
        receivedAt: eveningEnd,
        sessionId: "admin-insights-evening-session",
        subjectKey: `user:${eveningUser.user.id}`,
        user: eveningUser.user.id,
        source: "client",
        properties: { durationMs: 5 * 60 * 1000 }
      }
    ]);

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email: "activity-hours-admin@example.com", password: "admin-secret" })
      .expect(200);

    const start = new Date(2026, 5, 29, 0, 0, 0, 0).toISOString();
    const end = new Date(2026, 5, 30, 0, 0, 0, 0).toISOString();
    const response = await request(app)
      .get(`/api/admin/users/insights?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&startTime=08:00&endTime=12:00`)
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(response.body.timeFilter).toEqual({ startTime: "08:00", endTime: "12:00" });
    expect(response.body.summary.totalSessions).toBe(1);
    expect(response.body.summary.totalDurationMs).toBe(30 * 60 * 1000);
    expect(response.body.topUsers).toHaveLength(1);
    expect(response.body.topUsers[0]).toMatchObject({ id: morningUser.user.id, displayName: "Morning User" });
    expect(response.body.dailyUsage).toEqual([
      expect.objectContaining({
        date: expect.any(String),
        sessions: 1,
        activeUsers: 1,
        totalDurationMs: 30 * 60 * 1000
      })
    ]);
    expect(response.body.hourlyActivity.find((item: any) => item.hour === 9)).toMatchObject({
      sessions: 1,
      totalDurationMs: 30 * 60 * 1000
    });
    expect(response.body.hourlyActivity.find((item: any) => item.hour === 20)).toMatchObject({
      sessions: 0,
      totalDurationMs: 0
    });
    expect(response.body.peakActivityWindow).toMatchObject({
      hour: 9,
      sessions: 1,
      totalDurationMs: 30 * 60 * 1000
    });
  });

  it("filters admin dashboard overview and KPI metrics by time of day", async () => {
    Object.assign(env, { ADMIN_EMAIL: "dashboard-hours-admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    const morningUser = await register("admin-dashboard-morning@example.com");
    const eveningUser = await register("admin-dashboard-evening@example.com");
    const morningAt = new Date(2026, 3, 15, 9, 10, 0, 0);
    const eveningAt = new Date(2026, 3, 15, 20, 10, 0, 0);

    await Promise.all([
      User.collection.updateOne({ _id: new mongoose.Types.ObjectId(morningUser.user.id) }, { $set: { createdAt: morningAt, updatedAt: morningAt } }),
      User.collection.updateOne({ _id: new mongoose.Types.ObjectId(eveningUser.user.id) }, { $set: { createdAt: eveningAt, updatedAt: eveningAt } }),
      Post.create({
        author: morningUser.user.id,
        images: [{ url: "/uploads/dashboard-morning.jpg" }],
        caption: "Morning dashboard post",
        tags: [],
        visibility: "public",
        createdAt: morningAt,
        updatedAt: morningAt
      }),
      Post.create({
        author: eveningUser.user.id,
        images: [{ url: "/uploads/dashboard-evening.jpg" }],
        caption: "Evening dashboard post",
        tags: [],
        visibility: "public",
        createdAt: eveningAt,
        updatedAt: eveningAt
      }),
      AnalyticsEvent.create([
        {
          name: "session_start",
          occurredAt: morningAt,
          receivedAt: morningAt,
          sessionId: "admin-dashboard-morning-session",
          subjectKey: `user:${morningUser.user.id}`,
          user: morningUser.user.id,
          source: "client",
          properties: {}
        },
        {
          name: "session_end",
          occurredAt: new Date(morningAt.getTime() + 60000),
          receivedAt: new Date(morningAt.getTime() + 60000),
          sessionId: "admin-dashboard-morning-session",
          subjectKey: `user:${morningUser.user.id}`,
          user: morningUser.user.id,
          source: "client",
          properties: { durationMs: 60000 }
        },
        {
          name: "session_start",
          occurredAt: eveningAt,
          receivedAt: eveningAt,
          sessionId: "admin-dashboard-evening-session",
          subjectKey: `user:${eveningUser.user.id}`,
          user: eveningUser.user.id,
          source: "client",
          properties: {}
        },
        {
          name: "session_end",
          occurredAt: new Date(eveningAt.getTime() + 120000),
          receivedAt: new Date(eveningAt.getTime() + 120000),
          sessionId: "admin-dashboard-evening-session",
          subjectKey: `user:${eveningUser.user.id}`,
          user: eveningUser.user.id,
          source: "client",
          properties: { durationMs: 120000 }
        }
      ])
    ]);

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email: "dashboard-hours-admin@example.com", password: "admin-secret" })
      .expect(200);

    const start = new Date(2026, 3, 15, 0, 0, 0, 0).toISOString();
    const end = new Date(2026, 3, 16, 0, 0, 0, 0).toISOString();
    const response = await request(app)
      .get(`/api/admin/dashboard?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&startTime=08:00&endTime=12:00`)
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(response.body.timeFilter).toEqual({ startTime: "08:00", endTime: "12:00" });
    expect(response.body.totalsInRange.users).toBe(1);
    expect(response.body.totalsInRange.posts).toBe(1);
    expect(response.body.analytics.sessions.total).toBe(1);
    expect(response.body.analytics.sessions.averageDurationMs).toBe(60000);
    expect(response.body.analytics.activeUsers.dau).toBe(1);
    expect(response.body.charts.daily.some((item: any) => item.users === 1 && item.posts === 1)).toBe(true);
  });

  it("filters admin posts by media and sorts reports by interactions", async () => {
    Object.assign(env, { ADMIN_EMAIL: "posts-admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    const author = await register("admin-post-filter-author@example.com");
    const liker = await register("admin-post-filter-liker@example.com");
    await User.findByIdAndUpdate(author.user.id, { isPremium: true });
    const now = new Date();
    const inRange = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const singleImage = await Post.create({
      author: author.user.id,
      images: [{ url: "/uploads/single.jpg" }],
      caption: "Single image report",
      tags: ["admin-filter"],
      visibility: "public",
      createdAt: inRange,
      updatedAt: inRange,
      stats: { likes: 0, comments: 0, saves: 0 }
    });
    const multiImage = await Post.create({
      author: author.user.id,
      images: [{ url: "/uploads/multi-1.jpg" }, { url: "/uploads/multi-2.jpg" }],
      caption: "Multi image report",
      tags: ["admin-filter"],
      visibility: "public",
      createdAt: inRange,
      updatedAt: inRange,
      stats: { likes: 2, comments: 1, saves: 1 }
    });
    const video = await Post.create({
      author: author.user.id,
      mediaType: "video",
      images: [],
      video: { url: "/uploads/video.mp4", mime: "video/mp4", size: 1000, durationMs: 2000 },
      caption: "Video report",
      tags: ["admin-filter"],
      visibility: "public",
      createdAt: inRange,
      updatedAt: inRange,
      stats: { likes: 1, comments: 0, saves: 0 }
    });
    await Post.create({
      author: author.user.id,
      images: [{ url: "/uploads/old.jpg" }],
      caption: "Old post report",
      tags: ["admin-filter"],
      visibility: "public",
      createdAt: old,
      updatedAt: old,
      stats: { likes: 10, comments: 10, saves: 10 }
    });
    await Promise.all([
      PostLike.create({ post: multiImage._id, user: liker.user.id, createdAt: inRange, updatedAt: inRange }),
      PostSave.create({ post: multiImage._id, user: liker.user.id, createdAt: inRange, updatedAt: inRange }),
      Comment.create({ post: multiImage._id, author: liker.user.id, body: "top", createdAt: inRange, updatedAt: inRange }),
      PostLike.create({ post: video._id, user: liker.user.id, createdAt: inRange, updatedAt: inRange })
    ]);

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email: "posts-admin@example.com", password: "admin-secret" })
      .expect(200);
    const token = login.body.token as string;
    const start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const end = now.toISOString();

    const multi = await request(app)
      .get(`/api/admin/posts?mediaKind=multi_image&sortBy=interactions&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(multi.body.posts.map((post: any) => post.id)).toEqual([multiImage._id.toString()]);

    const sorted = await request(app)
      .get(`/api/admin/posts?q=report&sortBy=interactions&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(sorted.body.posts[0].id).toBe(multiImage._id.toString());
    expect(sorted.body.posts.map((post: any) => post.id)).toContain(singleImage._id.toString());
    expect(sorted.body.posts.map((post: any) => post.id)).toContain(video._id.toString());
    expect(sorted.body.posts.some((post: any) => post.caption === "Old post report")).toBe(false);

    const insights = await request(app)
      .get(`/api/admin/posts/insights?q=report&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(insights.body.summary.totalPosts).toBe(3);
    expect(insights.body.summary.totalInteractions).toBeGreaterThanOrEqual(4);
    expect(insights.body.mediaBreakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "single_image", count: 1 }),
      expect.objectContaining({ key: "multi_image", count: 1 }),
      expect.objectContaining({ key: "video", count: 1 })
    ]));
    expect(insights.body.topPosts[0].id).toBe(multiImage._id.toString());
  });

  it("validates analytics ingestion batches", async () => {
    await AnalyticsEvent.deleteMany({ sessionId: /^analytics-invalid-/ });

    await request(app).post("/api/ingest/events").send({ events: [] }).expect(400);

    await request(app)
      .post("/api/ingest/events")
      .send({
        events: [
          {
            name: "Feed Impression",
            sessionId: "analytics-invalid-session",
            anonymousId: "analytics-invalid-anon"
          }
        ]
      })
      .expect(400);

    await request(app)
      .post("/api/ingest/events")
      .send({
        events: [
          {
            name: "feed_impression",
            sessionId: "analytics-invalid-missing-anon"
          }
        ]
      })
      .expect(400);
  });

  it("ingests anonymous and authenticated analytics events", async () => {
    await AnalyticsEvent.deleteMany({ sessionId: /^analytics-ingest-/ });
    const session = await register("analytics-ingest@example.com");

    const anonymous = await request(app)
      .post("/api/ingest/events")
      .send({
        events: [
          {
            name: "feed_impression",
            occurredAt: "2026-01-10T10:00:00.000Z",
            sessionId: "analytics-ingest-anon-session",
            anonymousId: "analytics-ingest-anon",
            properties: { targetType: "post" }
          }
        ]
      })
      .expect(202);

    expect(anonymous.body.accepted).toBe(1);

    const authenticated = await request(app)
      .post("/api/ingest/events")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        events: [
          {
            name: "post_create_completed",
            occurredAt: "2026-01-10T10:01:00.000Z",
            sessionId: "analytics-ingest-user-session",
            properties: { step: "publish" }
          }
        ]
      })
      .expect(202);

    expect(authenticated.body.accepted).toBe(1);

    const events = await AnalyticsEvent.find({ sessionId: /^analytics-ingest-/ }).sort({ occurredAt: 1 }).lean();
    expect(events).toHaveLength(2);
    expect(events[0]?.subjectKey).toBe("anon:analytics-ingest-anon");
    expect(events[0]?.user).toBeUndefined();
    expect(events[1]?.subjectKey).toBe(`user:${session.user.id}`);
    expect(events[1]?.user?.toString()).toBe(session.user.id);
  });

  it("returns an admin analytics measurement summary", async () => {
    Object.assign(env, { ADMIN_EMAIL: "analytics-admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    await AnalyticsEvent.deleteMany({ sessionId: /^analytics-summary-/ });
    await AnalyticsEvent.deleteMany({ subjectKey: /^analytics-summary-/ });

    const one = "analytics-summary-user-one";
    const two = "analytics-summary-user-two";
    const anon = "analytics-summary-anon-three";
    const at = (iso: string) => new Date(iso);
    const base = {
      receivedAt: at("2026-02-10T12:10:00.000Z"),
      source: "client" as const
    };

    await AnalyticsEvent.create([
      {
        ...base,
        name: "app_open",
        occurredAt: at("2026-01-20T12:00:00.000Z"),
        sessionId: "analytics-summary-before",
        subjectKey: one
      },
      {
        ...base,
        name: "session_start",
        occurredAt: at("2026-02-10T12:00:00.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "feed_impression",
        occurredAt: at("2026-02-10T12:00:05.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "feed_click",
        occurredAt: at("2026-02-10T12:00:10.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "scroll_depth",
        occurredAt: at("2026-02-10T12:00:15.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one,
        properties: { scrollDepthPercent: 80 }
      },
      {
        ...base,
        name: "creator_signup_started",
        occurredAt: at("2026-02-10T12:00:20.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "creator_signup_completed",
        occurredAt: at("2026-02-10T12:00:21.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "post_create_started",
        occurredAt: at("2026-02-10T12:00:25.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "post_create_completed",
        occurredAt: at("2026-02-10T12:00:30.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "meal_analysis_started",
        occurredAt: at("2026-02-10T12:00:35.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "meal_analysis_completed",
        occurredAt: at("2026-02-10T12:00:40.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "premium_viewed",
        occurredAt: at("2026-02-10T12:00:45.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "premium_checkout_started",
        occurredAt: at("2026-02-10T12:00:46.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "payment_started",
        occurredAt: at("2026-02-10T12:00:47.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "payment_completed",
        occurredAt: at("2026-02-10T12:00:48.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one
      },
      {
        ...base,
        name: "session_end",
        occurredAt: at("2026-02-10T12:01:00.000Z"),
        sessionId: "analytics-summary-s1",
        subjectKey: one,
        properties: { durationMs: 60000 }
      },
      {
        ...base,
        name: "session_start",
        occurredAt: at("2026-02-10T13:00:00.000Z"),
        sessionId: "analytics-summary-s2",
        subjectKey: two
      },
      {
        ...base,
        name: "creator_signup_started",
        occurredAt: at("2026-02-10T14:00:01.500Z"),
        sessionId: "analytics-summary-s3",
        subjectKey: anon,
        anonymousId: anon
      },
      {
        ...base,
        name: "session_start",
        occurredAt: at("2026-02-10T14:00:00.000Z"),
        sessionId: "analytics-summary-s3",
        subjectKey: anon,
        anonymousId: anon
      },
      {
        ...base,
        name: "feed_impression",
        occurredAt: at("2026-02-10T14:00:01.000Z"),
        sessionId: "analytics-summary-s3",
        subjectKey: anon,
        anonymousId: anon
      },
      {
        ...base,
        name: "scroll_depth",
        occurredAt: at("2026-02-10T14:00:02.000Z"),
        sessionId: "analytics-summary-s3",
        subjectKey: anon,
        anonymousId: anon,
        properties: { scrollDepthPercent: 30 }
      },
      {
        ...base,
        name: "early_exit",
        occurredAt: at("2026-02-10T14:00:03.000Z"),
        sessionId: "analytics-summary-s3",
        subjectKey: anon,
        anonymousId: anon
      },
      {
        ...base,
        name: "session_end",
        occurredAt: at("2026-02-10T14:00:05.000Z"),
        sessionId: "analytics-summary-s3",
        subjectKey: anon,
        anonymousId: anon,
        properties: { durationMs: 5000 }
      }
    ]);

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email: "analytics-admin@example.com", password: "admin-secret" })
      .expect(200);

    const response = await request(app)
      .get("/api/admin/analytics/summary?start=2026-02-01T00:00:00.000Z&end=2026-02-11T00:00:00.000Z")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(response.body.summary.activeUsers).toMatchObject({ dau: 3, wau: 3, mau: 3, returning: 1 });
    expect(response.body.summary.sessions.total).toBe(3);
    expect(response.body.summary.sessions.bounces).toBe(1);
    expect(response.body.summary.sessions.earlyExits).toBe(1);
    expect(response.body.summary.feed).toMatchObject({
      impressions: 2,
      clicks: 1,
      ctr: 0.5,
      averageScrollDepth: 55,
      maxScrollDepth: 80
    });
    expect(response.body.summary.creatorConversion).toMatchObject({ started: 2, completed: 1, rate: 0.5 });
    expect(response.body.summary.postCreation).toMatchObject({ started: 1, completed: 1, completionRate: 1 });
    expect(response.body.summary.mealAnalysis).toMatchObject({ started: 1, completed: 1, completionRate: 1 });
    expect(response.body.summary.premiumFunnel).toMatchObject({
      viewed: 1,
      checkoutStarted: 1,
      paymentStarted: 1,
      paymentCompleted: 1,
      paymentFailed: 0,
      checkoutStartRate: 1,
      paymentCompletionRate: 1
    });
  });

  it("returns admin 24h analytics and heatmap data with hourly business metrics", async () => {
    Object.assign(env, { ADMIN_EMAIL: "analytics-24h-admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    const buyer = await register("analytics-24h-buyer@example.com");
    const aiOnly = await register("analytics-24h-ai-only@example.com");
    const viewer = await register("analytics-24h-viewer@example.com");

    const morning = new Date("2026-03-01T01:15:00.000Z");
    const morningLater = new Date("2026-03-01T01:45:00.000Z");
    const evening = new Date("2026-03-01T13:05:00.000Z");
    const oldEvent = new Date("2026-02-28T02:00:00.000Z");
    const start = "2026-03-01T00:00:00.000Z";
    const end = "2026-03-02T00:00:00.000Z";

    await Promise.all([
      User.collection.updateOne({ _id: new mongoose.Types.ObjectId(buyer.user.id) }, { $set: { createdAt: morning, updatedAt: morning } }),
      User.collection.updateOne({ _id: new mongoose.Types.ObjectId(aiOnly.user.id) }, { $set: { createdAt: evening, updatedAt: evening } }),
      User.collection.updateOne({ _id: new mongoose.Types.ObjectId(viewer.user.id) }, { $set: { createdAt: oldEvent, updatedAt: oldEvent } })
    ]);

    const post = await Post.create({
      author: buyer.user.id,
      images: [{ url: "/uploads/analytics-24h.jpg" }],
      caption: "Analytics 24h post",
      tags: [],
      visibility: "public",
      createdAt: morning,
      updatedAt: morning
    });
    const [like, save, comment] = await Promise.all([
      PostLike.create({ post: post._id, user: viewer.user.id }),
      PostSave.create({ post: post._id, user: viewer.user.id }),
      Comment.create({ post: post._id, author: viewer.user.id, body: "Great analytics meal" })
    ]);
    await Promise.all([
      PostLike.collection.updateOne({ _id: like._id }, { $set: { createdAt: morningLater, updatedAt: morningLater } }),
      PostSave.collection.updateOne({ _id: save._id }, { $set: { createdAt: morningLater, updatedAt: morningLater } }),
      Comment.collection.updateOne({ _id: comment._id }, { $set: { createdAt: evening, updatedAt: evening } })
    ]);

    await Promise.all([
      Meal.create({
        user: buyer.user.id,
        image: { url: "/uploads/meal-buyer.jpg" },
        result: { items: [], total: { calories: 100, protein: 10, carbs: 12, fat: 3 }, warnings: [] },
        createdAt: morning,
        updatedAt: morning
      }),
      Meal.create({
        user: aiOnly.user.id,
        image: { url: "/uploads/meal-ai-only.jpg" },
        result: { items: [], total: { calories: 120, protein: 8, carbs: 18, fat: 4 }, warnings: [] },
        createdAt: evening,
        updatedAt: evening
      }),
      Payment.create({
        provider: "payos",
        user: buyer.user.id,
        planId: "premium_month",
        orderCode: 9345678901,
        amount: 99000,
        currency: "VND",
        description: "Analytics 24h paid payment",
        status: "PAID",
        paidAt: morningLater,
        createdAt: morningLater,
        updatedAt: morningLater
      }),
      Payment.create({
        provider: "payos",
        user: aiOnly.user.id,
        planId: "premium_month",
        orderCode: 9345678902,
        amount: 99000,
        currency: "VND",
        description: "Analytics 24h failed payment",
        status: "CANCELLED",
        createdAt: evening,
        updatedAt: evening
      }),
      UserInteraction.create({
        actor: viewer.user.id,
        target: buyer.user.id,
        type: "report",
        note: "Analytics 24h report",
        createdAt: evening,
        updatedAt: evening
      }),
      AnalyticsEvent.create([
        {
          name: "session_start",
          occurredAt: morning,
          receivedAt: morning,
          sessionId: "analytics-24h-buyer-session",
          subjectKey: `user:${buyer.user.id}`,
          user: buyer.user.id,
          source: "client",
          properties: { utm: { utm_source: "facebook" }, referrer: "https://facebook.com/daily-meal" }
        },
        {
          name: "feed_click",
          occurredAt: morningLater,
          receivedAt: morningLater,
          sessionId: "analytics-24h-buyer-session",
          subjectKey: `user:${buyer.user.id}`,
          user: buyer.user.id,
          source: "client",
          properties: { utm: { utm_source: "facebook" } }
        },
        {
          name: "session_start",
          occurredAt: evening,
          receivedAt: evening,
          sessionId: "analytics-24h-ai-only-session",
          subjectKey: `user:${aiOnly.user.id}`,
          user: aiOnly.user.id,
          source: "client",
          properties: { referrer: "https://google.com/search?q=daily+meal" }
        },
        {
          name: "session_start",
          occurredAt: oldEvent,
          receivedAt: oldEvent,
          sessionId: "analytics-24h-old-session",
          subjectKey: `user:${viewer.user.id}`,
          user: viewer.user.id,
          source: "client",
          properties: { utm: { utm_source: "zalo" } }
        }
      ])
    ]);

    await request(app).get("/api/admin/analytics/24h").expect(401);
    await request(app)
      .get("/api/admin/analytics/24h")
      .set("Authorization", `Bearer ${buyer.token}`)
      .expect(403);

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email: "analytics-24h-admin@example.com", password: "admin-secret" })
      .expect(200);

    const response = await request(app)
      .get(`/api/admin/analytics/24h?preset=custom&from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&timezone=Asia/Ho_Chi_Minh`)
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(response.body.range).toMatchObject({ timezone: "Asia/Ho_Chi_Minh", preset: "custom" });
    expect(response.body.hourly).toHaveLength(24);
    expect(response.body.summary).toMatchObject({
      activeUsers: 2,
      newUsers: 2,
      posts: 1,
      interactions: 3,
      likes: 1,
      saves: 1,
      comments: 1,
      reportsOpened: 1,
      revenue: 99000,
      paymentSuccess: 1,
      paymentFailed: 1,
      aiMealUsage: 2
    });
    expect(response.body.aiFunnel).toMatchObject({
      usersUsedAi: 2,
      onlyAiNoPurchase: 1,
      purchasedAfterAi: 1,
      conversionRate: 0.5
    });
    expect(response.body.hourly.find((item: any) => item.hour === 8)).toMatchObject({
      activeUsers: 1,
      posts: 1,
      likes: 1,
      saves: 1,
      payments: 1,
      revenue: 99000,
      aiMealUsage: 1
    });
    expect(response.body.hourly.find((item: any) => item.hour === 20)).toMatchObject({
      activeUsers: 1,
      comments: 1,
      reportsOpened: 1,
      paymentFailed: 1,
      aiMealUsage: 1
    });
    expect(response.body.interactionBreakdown).toEqual(
      expect.arrayContaining([
        { type: "likes", count: 1 },
        { type: "saves", count: 1 },
        { type: "comments", count: 1 }
      ])
    );
    expect(response.body.sourceTraffic).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "facebook", events: 2, users: 1 }),
        expect.objectContaining({ source: "google", events: 1, users: 1 })
      ])
    );
    expect(response.body.tables.pendingReports[0]).toMatchObject({ note: "Analytics 24h report", status: "open" });

    const heatmap = await request(app)
      .get(`/api/admin/analytics/heatmap?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&timezone=Asia/Ho_Chi_Minh&metric=events`)
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(heatmap.body.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hour: 8, value: 2 }),
        expect.objectContaining({ hour: 20, value: 1 })
      ])
    );
  });

  it("creates a PayOS checkout link for a selected Premium plan", async () => {
    Object.assign(env, {
      PAYOS_CLIENT_ID: "client-id",
      PAYOS_API_KEY: "api-key",
      PAYOS_CHECKSUM_KEY: "checksum-key",
      PAYOS_RETURN_URL: "https://daily.test/payos/return",
      PAYOS_CANCEL_URL: "https://daily.test/payos/cancel",
      PAYOS_API_BASE_URL: "https://api-merchant.payos.vn"
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      expect(String(_url)).toBe("https://api-merchant.payos.vn/v2/payment-requests");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
        "x-client-id": "client-id",
        "x-api-key": "api-key"
      });
      expect(body).toMatchObject({
        amount: 99000,
        returnUrl: "https://daily.test/payos/return",
        cancelUrl: "https://daily.test/payos/cancel"
      });
      expect(body.description).toMatch(/^DM\d{7}$/);
      expect(body.orderCode).toEqual(expect.any(Number));
      expect(body.signature).toEqual(expect.any(String));

      return new Response(
        JSON.stringify({
          code: "00",
          desc: "success",
          data: {
            orderCode: body.orderCode,
            amount: body.amount,
            paymentLinkId: "payos-link-id",
            status: "PENDING",
            checkoutUrl: "https://pay.payos.vn/web/payos-link-id",
            qrCode: "vietqr-data"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await register("payos-checkout@example.com");

    const response = await request(app)
      .post("/api/payments/payos/create")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ planId: "premium_quarter" })
      .expect(201);

    expect(response.body).toMatchObject({
      planId: "premium_quarter",
      amount: 99000,
      status: "PENDING",
      checkoutUrl: "https://pay.payos.vn/web/payos-link-id"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("activates Premium from a valid PayOS webhook idempotently", async () => {
    Object.assign(env, { PAYOS_CHECKSUM_KEY: "checksum-key" });
    const session = await register("payos-webhook@example.com");
    const orderCode = 1234567890;
    await Payment.create({
      provider: "payos",
      user: session.user.id,
      planId: "premium_half",
      orderCode,
      amount: 199000,
      currency: "VND",
      description: "DM4567890",
      status: "PENDING",
      paymentLinkId: "link-webhook",
      checkoutUrl: "https://pay.payos.vn/web/link-webhook"
    });
    const data = {
      orderCode,
      amount: 199000,
      description: "DM4567890",
      paymentLinkId: "link-webhook",
      reference: "TF230204212323",
      transactionDateTime: "2026-06-02 23:00:00",
      currency: "VND",
      code: "00",
      desc: "success"
    };
    const webhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data,
      signature: createPayosSignature(data, "checksum-key")
    };

    await request(app).post("/api/payments/payos/webhook").send(webhookBody).expect(200);
    await request(app).post("/api/payments/payos/webhook").send(webhookBody).expect(200);

    const [payment, user] = await Promise.all([
      Payment.findOne({ orderCode }).lean(),
      User.findById(session.user.id).lean()
    ]);
    expect(payment?.status).toBe("PAID");
    expect(payment?.webhookReference).toBe("TF230204212323");
    expect(payment?.paidAt).toBeInstanceOf(Date);
    expect(user?.isPremium).toBe(true);
    expect(user?.premiumPaidEndsAt).toBeInstanceOf(Date);
    expect(new Date(user!.premiumPaidEndsAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects PayOS webhooks with invalid signatures", async () => {
    Object.assign(env, { PAYOS_CHECKSUM_KEY: "checksum-key" });
    const session = await register("payos-invalid-signature@example.com");
    const orderCode = 2234567890;
    await Payment.create({
      provider: "payos",
      user: session.user.id,
      planId: "premium_month",
      orderCode,
      amount: 39000,
      currency: "VND",
      description: "DM4567890",
      status: "PENDING",
      paymentLinkId: "link-invalid-signature"
    });

    await request(app)
      .post("/api/payments/payos/webhook")
      .send({
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 39000,
          description: "DM4567890",
          paymentLinkId: "link-invalid-signature",
          code: "00",
          desc: "success"
        },
        signature: "bad-signature"
      })
      .expect(400);

    const [payment, user] = await Promise.all([
      Payment.findOne({ orderCode }).lean(),
      User.findById(session.user.id).lean()
    ]);
    expect(payment?.status).toBe("PENDING");
    expect(user?.isPremium).toBe(false);
  });

  it("returns the current user's PayOS payment status", async () => {
    const session = await register("payos-status@example.com");
    const orderCode = 3234567890;
    await Payment.create({
      provider: "payos",
      user: session.user.id,
      planId: "premium_month",
      orderCode,
      amount: 39000,
      currency: "VND",
      description: "DM4567890",
      status: "PENDING",
      paymentLinkId: "link-status",
      checkoutUrl: "https://pay.payos.vn/web/link-status"
    });

    const response = await request(app)
      .get(`/api/payments/payos/${orderCode}`)
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      planId: "premium_month",
      orderCode,
      amount: 39000,
      status: "PENDING",
      checkoutUrl: "https://pay.payos.vn/web/link-status"
    });
  });

  it("creates posts with up to three images and rejects overflow", async () => {
    const session = await register("post@example.com");
    await makePremium(session.user.id);
    const image = { url: "/uploads/demo.jpg" };

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        images: [image, image, image],
        caption: "Cơm nhà",
        tags: ["home"],
        layout: "grid",
        imageTransforms: [
          { scale: 1.1, rotation: -3, offsetX: 4, offsetY: 0 },
          { scale: 0.95, rotation: 2, offsetX: -2, offsetY: 5 },
          { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 }
        ],
        visibility: "public"
      })
      .expect(201);

    expect(response.body.post.images).toHaveLength(3);
    expect(response.body.post.layout).toBe("grid");
    expect(response.body.post.imageTransforms).toHaveLength(3);

    await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        images: [image, image, image, image],
        caption: "Quá nhiều ảnh",
        tags: [],
        visibility: "public"
      })
      .expect(400);
  });

  it("creates premium video posts and exposes video metadata across post feeds", async () => {
    const session = await register("video-post@example.com");
    await makePremium(session.user.id);
    const sticker = await Sticker.findOne({ premiumOnly: true }).lean();

    const video = {
      url: "/uploads/meal-video.mp4",
      uploadId: "665000000000000000000010",
      mime: "video/mp4",
      size: 1024,
      durationMs: 28_000
    };

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        mediaType: "video",
        video,
        caption: "Video món ngon",
        tags: ["video"],
        visibility: "public",
        stickerId: sticker?._id.toString(),
        stickerPlacement: { x: 0.2, y: 0.3, scale: 1.5, rotation: 15 },
        nutritionSummary: { calories: 999, protein: 99, carbs: 99, fat: 99, confidence: 1 },
        recipes: [{ imageIndex: 0, title: "Ignore", ingredients: ["x"], steps: ["y"] }]
      })
      .expect(201);

    expect(response.body.post).toMatchObject({
      mediaType: "video",
      video,
      images: [],
      nutritionDetails: [],
      stickerPlacement: { x: 0.2, y: 0.3, scale: 1.5, rotation: 15 }
    });
    expect(response.body.post.stickerId).toMatchObject({
      _id: sticker?._id.toString(),
      premiumOnly: true
    });
    expect(response.body.post.nutritionSummary).toBeUndefined();
    expect(response.body.post.recipes).toEqual([]);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);
    expect(feed.body.posts.find((post: any) => post._id === response.body.post._id)).toMatchObject({
      mediaType: "video",
      video,
      stickerPlacement: { x: 0.2, y: 0.3, scale: 1.5, rotation: 15 },
      stickerId: { _id: sticker?._id.toString() }
    });

    const search = await request(app)
      .get("/api/posts/search?q=Video")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);
    expect(search.body.posts[0]).toMatchObject({ mediaType: "video", video, stickerId: { _id: sticker?._id.toString() } });

    const profile = await request(app)
      .get(`/api/users/${session.user.id}/posts`)
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);
    expect(profile.body.posts[0]).toMatchObject({ mediaType: "video", video, stickerId: { _id: sticker?._id.toString() } });

    Object.assign(env, { ADMIN_EMAIL: "video-admin@example.com", ADMIN_PASSWORD: "admin-secret" });
    const admin = await request(app)
      .post("/api/admin/login")
      .send({ email: "video-admin@example.com", password: "admin-secret" })
      .expect(200);
    const adminPosts = await request(app)
      .get("/api/admin/posts?q=Video")
      .set("Authorization", `Bearer ${admin.body.token}`)
      .expect(200);
    expect(adminPosts.body.posts[0]).toMatchObject({
      mediaType: "video",
      video,
      imageCount: 0
    });
  });

  it("rejects video posts from free accounts", async () => {
    const session = await register("video-post-free@example.com");

    await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        mediaType: "video",
        video: {
          url: "/uploads/free-video.mp4",
          uploadId: "665000000000000000000011",
          mime: "video/mp4",
          size: 1024,
          durationMs: 10_000
        },
        caption: "Free video",
        tags: [],
        visibility: "public"
      })
      .expect(403);
  });

  it("rejects video posts with missing stickers", async () => {
    const session = await register("video-post-missing-sticker@example.com");
    await makePremium(session.user.id);

    await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        mediaType: "video",
        video: {
          url: "/uploads/missing-sticker-video.mp4",
          uploadId: "665000000000000000000012",
          mime: "video/mp4",
          size: 1024,
          durationMs: 10_000
        },
        caption: "Missing sticker video",
        tags: [],
        stickerId: "665000000000000000009999",
        stickerPlacement: { x: 0.2, y: 0.3, scale: 1, rotation: 0 },
        visibility: "public"
      })
      .expect(404);
  });

  it("deletes a post when requested by owner and rejects others", async () => {
    const ownerSession = await register("delete-owner@example.com");
    const otherSession = await register("delete-other@example.com");

    const postResponse = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${ownerSession.token}`)
      .send({
        images: [{ url: "/uploads/demo.jpg" }],
        caption: "Owner post to delete",
        tags: [],
        visibility: "public"
      })
      .expect(201);

    const postId = postResponse.body.post._id;

    await request(app)
      .delete(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${otherSession.token}`)
      .expect(403);

    await request(app)
      .delete(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${ownerSession.token}`)
      .expect(204);

    await request(app)
      .delete(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${ownerSession.token}`)
      .expect(404);
  });

  it("persists per-image nutrition details on posts and feed", async () => {
    const session = await register("nutrition-details@example.com");
    await makePremium(session.user.id);

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        images: [{ url: "/uploads/breakfast-1.jpg" }, { url: "/uploads/breakfast-2.jpg" }],
        caption: "Bữa sáng nhiều món",
        tags: ["breakfast"],
        nutritionSummary: {
          calories: 475,
          protein: 24,
          carbs: 52,
          fat: 18,
          confidence: 0.7
        },
        nutritionDetails: [
          {
            imageIndex: 0,
            mealId: "665000000000000000000001",
            total: { calories: 275, protein: 13, carbs: 32, fat: 9, confidence: 0.8 },
            warnings: ["Ước tính ảnh 1"],
            items: [
              {
                name: "Bánh mì",
                portion: "2 lát",
                calories: 190,
                protein: 6,
                carbs: 31,
                fat: 3,
                confidence: 0.75
              },
              {
                name: "Trứng gà",
                portion: "1 quả",
                calories: 85,
                protein: 7,
                carbs: 1,
                fat: 6,
                confidence: 0.85
              }
            ]
          },
          {
            imageIndex: 1,
            total: { calories: 200, protein: 11, carbs: 20, fat: 9, confidence: 0.6 },
            warnings: [],
            items: [
              {
                name: "Sữa chua",
                portion: "1 hũ",
                calories: 200,
                protein: 11,
                carbs: 20,
                fat: 9,
                confidence: 0.6
              }
            ]
          }
        ],
        visibility: "public"
      })
      .expect(201);

    expect(response.body.post.nutritionDetails).toHaveLength(2);
    expect(response.body.post.nutritionDetails[0].items[0]).toMatchObject({
      name: "Bánh mì",
      portion: "2 lát",
      calories: 190,
      protein: 6
    });

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    const post = feed.body.posts.find((item: { caption: string }) => item.caption === "Bữa sáng nhiều món");
    expect(post.nutritionDetails).toHaveLength(2);
    expect(post.nutritionDetails[1].total.calories).toBe(200);
  });

  it("blocks premium stickers for free users", async () => {
    const session = await register("sticker@example.com");
    const sticker = await Sticker.findOne({ premiumOnly: true }).lean();

    await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        images: [{ url: "/uploads/demo.jpg" }],
        caption: "Sticker VIP",
        tags: [],
        stickerId: sticker?._id.toString(),
        visibility: "public"
      })
      .expect(403);
  });

  it("registers custom stickers for premium users and rejects for free users", async () => {
    const freeSession = await register("sticker-free@example.com");
    const vipSession = await register("sticker-vip@example.com");
    await makePremium(vipSession.user.id);

    // 1. Rejects free user
    await request(app)
      .post("/api/stickers")
      .set("Authorization", `Bearer ${freeSession.token}`)
      .send({
        key: "custom-free-key",
        name: "My Custom Sticker",
        assetPath: "/uploads/my-sticker.png"
      })
      .expect(403);

    // 2. Accepts premium user
    const response = await request(app)
      .post("/api/stickers")
      .set("Authorization", `Bearer ${vipSession.token}`)
      .send({
        key: "custom-vip-key",
        name: "VIP Custom Sticker",
        assetPath: "/uploads/vip-sticker.png"
      })
      .expect(201);

    expect(response.body.sticker).toBeDefined();
    expect(response.body.sticker._id).toBeDefined();
    expect(response.body.sticker.name).toBe("VIP Custom Sticker");
    expect(response.body.sticker.premiumOnly).toBe(true);

    // 3. Rejects missing fields
    await request(app)
      .post("/api/stickers")
      .set("Authorization", `Bearer ${vipSession.token}`)
      .send({
        name: "Incomplete"
      })
      .expect(400);
  });

  it("turns mutual follows into friends", async () => {
    const alice = await register("alice@example.com");
    const bob = await register("bob@example.com");

    const aliceFollowsBob = await request(app)
      .post(`/api/users/${bob.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(aliceFollowsBob.body.user.relationship.isFollowing).toBe(true);
    expect(aliceFollowsBob.body.user.relationship.isFriend).toBe(false);

    const bobFollowsAlice = await request(app)
      .post(`/api/users/${alice.user.id}/follow`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(200);

    expect(bobFollowsAlice.body.user.relationship.isFollowing).toBe(true);
    expect(bobFollowsAlice.body.user.relationship.followsMe).toBe(true);
    expect(bobFollowsAlice.body.user.relationship.isFriend).toBe(true);

    const bobProfileForAlice = await request(app)
      .get(`/api/users/${bob.user.id}`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(bobProfileForAlice.body.user.relationship.isFriend).toBe(true);

    const unfollow = await request(app)
      .delete(`/api/users/${bob.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    expect(unfollow.body.user.relationship.isFollowing).toBe(false);
    expect(unfollow.body.user.relationship.isFriend).toBe(false);
  });

  it("returns author streakDays for a 3-day posting streak", async () => {
    const viewer = await register("feed-streak-viewer@example.com");
    const author = await register("feed-streak-author@example.com");

    const todayPost = await createPost(author.token, "Streak today meal");
    const yesterdayPost = await createPost(author.token, "Streak yesterday meal");
    const twoDaysPost = await createPost(author.token, "Streak two days meal");

    await Promise.all([
      setPostCreatedAt(todayPost._id, vietnamPostDate(0)),
      setPostCreatedAt(yesterdayPost._id, vietnamPostDate(1)),
      setPostCreatedAt(twoDaysPost._id, vietnamPostDate(2))
    ]);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const post = feed.body.posts.find((item: any) => item.caption === "Streak today meal");
    expect(post.author.id).toBe(author.user.id);
    expect(post.author.streakDays).toBe(3);
  });

  it("counts unique posting days instead of raw post count for feed streakDays", async () => {
    const viewer = await register("feed-streak-unique-viewer@example.com");
    const author = await register("feed-streak-unique-author@example.com");

    const todayPost = await createPost(author.token, "Unique streak today meal");
    const secondTodayPost = await createPost(author.token, "Unique streak second today meal");
    const yesterdayPost = await createPost(author.token, "Unique streak yesterday meal");
    const twoDaysPost = await createPost(author.token, "Unique streak two days meal");

    await Promise.all([
      setPostCreatedAt(todayPost._id, vietnamPostDate(0, 12)),
      setPostCreatedAt(secondTodayPost._id, vietnamPostDate(0, 18)),
      setPostCreatedAt(yesterdayPost._id, vietnamPostDate(1)),
      setPostCreatedAt(twoDaysPost._id, vietnamPostDate(2))
    ]);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const post = feed.body.posts.find((item: any) => item.caption === "Unique streak today meal");
    expect(post.author.streakDays).toBe(3);
  });

  it("does not count hidden posts toward feed author streakDays", async () => {
    const viewer = await register("feed-streak-hidden-viewer@example.com");
    const author = await register("feed-streak-hidden-author@example.com");

    const todayPost = await createPost(author.token, "Hidden streak today meal");
    const hiddenYesterdayPost = await createPost(author.token, "Hidden streak yesterday meal");
    const twoDaysPost = await createPost(author.token, "Hidden streak two days meal");

    await Promise.all([
      setPostCreatedAt(todayPost._id, vietnamPostDate(0)),
      setPostCreatedAt(hiddenYesterdayPost._id, vietnamPostDate(1), { moderationStatus: "hidden" }),
      setPostCreatedAt(twoDaysPost._id, vietnamPostDate(2))
    ]);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const post = feed.body.posts.find((item: any) => item.caption === "Hidden streak today meal");
    expect(post.author.streakDays).toBe(1);
  });

  it("resets feed author streakDays to 0 when there is no valid post today", async () => {
    const viewer = await register("feed-streak-reset-viewer@example.com");
    const author = await register("feed-streak-reset-author@example.com");

    const yesterdayPost = await createPost(author.token, "Reset streak yesterday meal");
    const twoDaysPost = await createPost(author.token, "Reset streak two days meal");
    const threeDaysPost = await createPost(author.token, "Reset streak three days meal");

    await Promise.all([
      setPostCreatedAt(yesterdayPost._id, vietnamPostDate(1)),
      setPostCreatedAt(twoDaysPost._id, vietnamPostDate(2)),
      setPostCreatedAt(threeDaysPost._id, vietnamPostDate(3))
    ]);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const post = feed.body.posts.find((item: any) => item.caption === "Reset streak yesterday meal");
    expect(post.author.streakDays).toBe(0);
  });

  it("feeds own and followed users posts with viewer state", async () => {
    const alice = await register("feed-alice@example.com");
    const bob = await register("feed-bob@example.com");
    const carol = await register("feed-carol@example.com");

    await createPost(alice.token, "Alice own meal");
    const bobPost = await createPost(bob.token, "Bob followed meal");
    await createPost(carol.token, "Carol outside network");

    await request(app)
      .post(`/api/users/${bob.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    await request(app)
      .post(`/api/posts/${bobPost._id}/like`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    await request(app)
      .post(`/api/posts/${bobPost._id}/save`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    const captions = feed.body.posts.map((post: { caption: string }) => post.caption);
    expect(captions).toContain("Alice own meal");
    expect(captions).toContain("Bob followed meal");
    expect(captions).toContain("Carol outside network");
    expect(captions.indexOf("Alice own meal")).toBeLessThan(captions.indexOf("Bob followed meal"));
    expect(captions.indexOf("Bob followed meal")).toBeLessThan(captions.indexOf("Carol outside network"));

    const followedPost = feed.body.posts.find(
      (post: { caption: string }) => post.caption === "Bob followed meal"
    );
    expect(followedPost.viewerState).toEqual({ liked: true, saved: true });
  });

  it("prioritizes feed by relationship and only exposes friends posts to mutual friends", async () => {
    const viewer = await register("feed-priority-viewer@example.com");
    const friend = await register("feed-priority-friend@example.com");
    const followed = await register("feed-priority-followed@example.com");
    const stranger = await register("feed-priority-stranger@example.com");

    await createPost(stranger.token, "Stranger public meal");
    await createPost(followed.token, "Followed public meal");
    await createPost(friend.token, "Friend friends meal", "friends");
    await createPost(viewer.token, "Viewer own meal", "friends");

    await request(app)
      .post(`/api/users/${friend.user.id}/follow`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${viewer.user.id}/follow`)
      .set("Authorization", `Bearer ${friend.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${followed.user.id}/follow`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const viewerFeed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const viewerCaptions = viewerFeed.body.posts.map((post: { caption: string }) => post.caption);
    expect(viewerCaptions).toContain("Viewer own meal");
    expect(viewerCaptions).toContain("Friend friends meal");
    expect(viewerCaptions).toContain("Followed public meal");
    expect(viewerCaptions).toContain("Stranger public meal");
    expect(viewerCaptions.indexOf("Viewer own meal")).toBeLessThan(viewerCaptions.indexOf("Friend friends meal"));
    expect(viewerCaptions.indexOf("Friend friends meal")).toBeLessThan(viewerCaptions.indexOf("Followed public meal"));
    expect(viewerCaptions.indexOf("Followed public meal")).toBeLessThan(viewerCaptions.indexOf("Stranger public meal"));

    const followedFeed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${followed.token}`)
      .expect(200);

    const followedCaptions = followedFeed.body.posts.map((post: { caption: string }) => post.caption);
    expect(followedCaptions).not.toContain("Friend friends meal");
    expect(followedCaptions).not.toContain("Viewer own meal");

    const friendProfile = await request(app)
      .get(`/api/users/${friend.user.id}/posts`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(friendProfile.body.posts.map((post: { caption: string }) => post.caption)).toContain("Friend friends meal");

    const friendProfileForStranger = await request(app)
      .get(`/api/users/${friend.user.id}/posts`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .expect(200);
    expect(friendProfileForStranger.body.posts.map((post: { caption: string }) => post.caption)).not.toContain("Friend friends meal");
  });

  it("prioritizes feed by calendar day first, then by relationship", async () => {
    const viewer = await register("feed-day-viewer@example.com");
    const friend = await register("feed-day-friend@example.com");
    const stranger = await register("feed-day-stranger@example.com");

    await request(app)
      .post(`/api/users/${friend.user.id}/follow`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${viewer.user.id}/follow`)
      .set("Authorization", `Bearer ${friend.token}`)
      .expect(200);

    const strangerPost = await createPost(stranger.token, "Stranger today meal");
    const friendPost = await createPost(friend.token, "Friend yesterday meal");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const PostModel = mongoose.model("Post");
    await PostModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(friendPost._id) }, { $set: { createdAt: yesterday } });

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const captions = feed.body.posts.map((post: { caption: string }) => post.caption);
    expect(captions.indexOf("Stranger today meal")).toBeLessThan(captions.indexOf("Friend yesterday meal"));
  });

  it("summarizes visible posts by relationship without exposing own, friends-only, or blocked posts", async () => {
    const marker = "summary-relationship-fixture";
    const captions = {
      own: `${marker} viewer own public meal`,
      friendPublic: `${marker} friend public meal`,
      friendFriendsOnly: `${marker} friend friends-only meal`,
      followed: `${marker} followed public meal`,
      stranger: `${marker} stranger public meal`,
      blocked: `${marker} blocked public meal`,
      friendPrivate: `${marker} friend private meal`,
    };
    const viewer = await register("summary-viewer@example.com");
    const friend = await register("summary-friend@example.com");
    const followed = await register("summary-followed@example.com");
    const stranger = await register("summary-stranger@example.com");
    const blocked = await register("summary-blocked@example.com");
    const nonFriend = await register("summary-non-friend@example.com");

    await createPost(viewer.token, captions.own);
    await createPost(friend.token, captions.friendPublic);
    await createPost(friend.token, captions.friendFriendsOnly, "friends");
    await createPost(followed.token, captions.followed);
    await createPost(stranger.token, captions.stranger);
    await createPost(blocked.token, captions.blocked);
    await createPost(friend.token, captions.friendPrivate, "private");

    await request(app)
      .post(`/api/users/${friend.user.id}/follow`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${viewer.user.id}/follow`)
      .set("Authorization", `Bearer ${friend.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${followed.user.id}/follow`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    await request(app)
      .post(`/api/users/${blocked.user.id}/interactions`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ type: "block" })
      .expect(201);

    const all = await request(app)
      .get("/api/posts/summary?filter=all&limit=10")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    const allCaptions = all.body.posts.map((post: { caption: string }) => post.caption);
    expect(allCaptions).toContain(captions.friendPublic);
    expect(allCaptions).toContain(captions.friendFriendsOnly);
    expect(allCaptions).toContain(captions.followed);
    expect(allCaptions).not.toContain(captions.own);
    expect(allCaptions).not.toContain(captions.blocked);
    expect(allCaptions).not.toContain(captions.friendPrivate);

    const limitedAll = await request(app)
      .get("/api/posts/summary?filter=all&limit=3")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(limitedAll.body.hasMore).toBe(true);

    const friends = await request(app)
      .get("/api/posts/summary?filter=friends")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(friends.body.posts.map((post: { caption: string }) => post.caption)).toEqual(
      expect.arrayContaining([captions.friendPublic, captions.friendFriendsOnly])
    );
    expect(friends.body.posts.map((post: { caption: string }) => post.caption)).not.toContain(captions.followed);

    const following = await request(app)
      .get("/api/posts/summary?filter=following")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(
      following.body.posts
        .map((post: { caption: string }) => post.caption)
        .filter((caption: string) => caption.startsWith(marker))
    ).toEqual([captions.followed]);

    const strangers = await request(app)
      .get("/api/posts/summary?filter=strangers")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(
      strangers.body.posts
        .map((post: { caption: string }) => post.caption)
        .filter((caption: string) => caption.startsWith(marker))
    ).toEqual([captions.stranger]);

    const nonFriendSummary = await request(app)
      .get("/api/posts/summary?filter=all")
      .set("Authorization", `Bearer ${nonFriend.token}`)
      .expect(200);
    expect(nonFriendSummary.body.posts.map((post: { caption: string }) => post.caption)).not.toContain(
      captions.friendFriendsOnly
    );
  });

  it("exposes saved posts and profile interactions", async () => {
    const viewer = await register("viewer-actions@example.com");
    const creator = await register("creator-actions@example.com");
    const post = await createPost(creator.token, "Saved creator meal");

    await request(app)
      .post(`/api/posts/${post._id}/save`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const saved = await request(app)
      .get(`/api/users/${viewer.user.id}/saved-posts`)
      .set("Authorization", `Bearer ${creator.token}`)
      .expect(200);

    expect(saved.body.posts[0].caption).toBe("Saved creator meal");

    await request(app)
      .post(`/api/users/${creator.user.id}/interactions`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ type: "restrict" })
      .expect(201);

    const profile = await request(app)
      .get(`/api/users/${creator.user.id}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect(profile.body.user.viewerInteraction.restricted).toBe(true);

    await request(app)
      .delete(`/api/users/${creator.user.id}/interactions/restrict`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
  });

  it("creates conversations and sends messages", async () => {
    const alice = await register("message-alice@example.com");
    const bob = await register("message-bob@example.com");

    const conversation = await request(app)
      .post("/api/messages/conversations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id })
      .expect(201);

    const conversationId = conversation.body.conversation.id;

    await request(app)
      .post(`/api/messages/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ body: "Bạn cho mình xin công thức món này nhé?" })
      .expect(201);

    expect(mockedBroadcastToRoom).toHaveBeenCalledWith(
      `conversation:${conversationId}`,
      "message:created",
      expect.objectContaining({
        conversationId,
        body: "Bạn cho mình xin công thức món này nhé?"
      })
    );
    expect(mockedEmitToUser).toHaveBeenCalledWith(
      alice.user.id,
      "conversation:updated",
      expect.objectContaining({
        id: conversationId,
        otherUser: expect.objectContaining({ id: bob.user.id }),
        lastMessage: expect.objectContaining({ body: "Bạn cho mình xin công thức món này nhé?" })
      })
    );
    expect(mockedEmitToUser).toHaveBeenCalledWith(
      bob.user.id,
      "conversation:updated",
      expect.objectContaining({
        id: conversationId,
        otherUser: expect.objectContaining({ id: alice.user.id }),
        lastMessage: expect.objectContaining({ body: "Bạn cho mình xin công thức món này nhé?" })
      })
    );
    expect(mockedEmitToUser).toHaveBeenCalledWith(
      bob.user.id,
      "notification:created",
      expect.objectContaining({ type: "message" })
    );

    const messages = await request(app)
      .get(`/api/messages/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(200);

    expect(messages.body.messages[0].body).toContain("công thức");

    const inbox = await request(app)
      .get("/api/messages/conversations")
      .set("Authorization", `Bearer ${bob.token}`)
      .expect(200);

    expect(inbox.body.conversations[0].lastMessage.body).toContain("công thức");
  });

  it("changes password after verifying the current password", async () => {
    const session = await register("password@example.com");

    await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ currentPassword: "wrong-password", newPassword: "newpassword123" })
      .expect(401);

    await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ currentPassword: "password123", newPassword: "newpassword123" })
      .expect(204);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "password@example.com", password: "password123" })
      .expect(401);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "password@example.com", password: "newpassword123" })
      .expect(200);
  });

  it("resets a password after verifying an email OTP", async () => {
    await register("forgot-password@example.com");

    const otpResponse = await request(app)
      .post("/api/auth/password/forgot/request-otp")
      .send({ email: "forgot-password@example.com" })
      .expect(200);

    expect(otpResponse.body.message).toContain("OTP");
    expect(otpResponse.body.devOtp).toMatch(/^\d{6}$/);

    await request(app)
      .post("/api/auth/password/forgot/verify-otp")
      .send({ email: "forgot-password@example.com", otp: "000000", newPassword: "mynewpassword" })
      .expect(401);

    const resetResponse = await request(app)
      .post("/api/auth/password/forgot/verify-otp")
      .send({ email: "forgot-password@example.com", otp: otpResponse.body.devOtp, newPassword: "mynewpassword" })
      .expect(200);

    expect(resetResponse.body.message).toEqual(expect.any(String));
    expect(resetResponse.body.token).toBeDefined();
    expect(resetResponse.body.user).toBeDefined();

    await request(app)
      .post("/api/auth/login")
      .send({ email: "forgot-password@example.com", password: "password123" })
      .expect(401);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "forgot-password@example.com", password: "mynewpassword" })
      .expect(200);

    const user = await User.findOne({ email: "forgot-password@example.com" });
    expect(user?.passwordResetOtp).toBeUndefined();
  });


  it("does not reveal whether a forgot-password email exists", async () => {
    const response = await request(app)
      .post("/api/auth/password/forgot/request-otp")
      .send({ email: "missing-forgot-password@example.com" })
      .expect(200);

    expect(response.body.message).toContain("OTP");
    expect(response.body.devOtp).toBeUndefined();
  });

  it("creates a Google user and reads the current user", async () => {
    mockedVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-new-user",
      email: "google-new@example.com",
      displayName: "Google New",
      avatarUrl: "https://example.com/avatar.png"
    });

    const response = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "valid-google-token" })
      .expect(200);

    expect(response.body.user.email).toBe("google-new@example.com");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${response.body.token}`)
      .expect(200);

    expect(me.body.user.displayName).toBe("Google New");
  });

  it("signs in an existing linked Google user", async () => {
    mockedVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-linked-user",
      email: "google-linked@example.com",
      displayName: "Google Linked",
      avatarUrl: undefined
    });

    await request(app).post("/api/auth/google").send({ idToken: "first-token" }).expect(200);
    const response = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "second-token" })
      .expect(200);

    expect(response.body.user.email).toBe("google-linked@example.com");
  });

  it("blocks Google sign-in for an existing password account until it is linked", async () => {
    await register("google-conflict@example.com");
    mockedVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-conflict-sub",
      email: "google-conflict@example.com",
      displayName: "Conflict",
      avatarUrl: undefined
    });

    const response = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "conflict-token" })
      .expect(409);

    expect(response.body.message).toContain("Hãy đăng nhập bằng email và mật khẩu trước");
  });

  it("links Google to the current password account when email matches", async () => {
    const session = await register("google-link@example.com");
    mockedVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-link-sub",
      email: "google-link@example.com",
      displayName: "Google Link",
      avatarUrl: undefined
    });

    const link = await request(app)
      .post("/api/auth/google/link")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ idToken: "link-token" })
      .expect(200);

    expect(link.body.user.email).toBe("google-link@example.com");

    const login = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "link-token" })
      .expect(200);

    expect(login.body.user.email).toBe("google-link@example.com");
  });

  it("rejects linking a Google account already linked to another user", async () => {
    mockedVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-taken-sub",
      email: "google-owner@example.com",
      displayName: "Google Owner",
      avatarUrl: undefined
    });
    await request(app).post("/api/auth/google").send({ idToken: "owner-token" }).expect(200);

    const session = await register("google-link-taken@example.com");
    mockedVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-taken-sub",
      email: "google-link-taken@example.com",
      displayName: "Taken",
      avatarUrl: undefined
    });

    await request(app)
      .post("/api/auth/google/link")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ idToken: "taken-token" })
      .expect(409);
  });

  it("rejects linking Google when the email differs from the current user", async () => {
    const session = await register("google-link-owner@example.com");
    mockedVerifyGoogleIdToken.mockResolvedValue({
      sub: "google-different-email",
      email: "different-google@example.com",
      displayName: "Different",
      avatarUrl: undefined
    });

    await request(app)
      .post("/api/auth/google/link")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ idToken: "different-email-token" })
      .expect(409);
  });
});
