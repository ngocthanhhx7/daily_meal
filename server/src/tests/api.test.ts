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
import { Payment } from "../models/Payment.js";
import { PostLike } from "../models/PostLike.js";
import { PostSave } from "../models/PostSave.js";
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
    expect(response.body.upload.url).toContain("/uploads/");
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

  it("validates analytics ingestion batches", async () => {
    await AnalyticsEvent.deleteMany({ sessionId: /^analytics-invalid-/ });

    await request(app).post("/api/analytics/events").send({ events: [] }).expect(400);

    await request(app)
      .post("/api/analytics/events")
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
      .post("/api/analytics/events")
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
      .post("/api/analytics/events")
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
      .post("/api/analytics/events")
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
        nutritionSummary: { calories: 999, protein: 99, carbs: 99, fat: 99, confidence: 1 },
        recipes: [{ imageIndex: 0, title: "Ignore", ingredients: ["x"], steps: ["y"] }]
      })
      .expect(201);

    expect(response.body.post).toMatchObject({
      mediaType: "video",
      video,
      images: [],
      nutritionDetails: []
    });
    expect(response.body.post.nutritionSummary).toBeUndefined();
    expect(response.body.post.recipes).toEqual([]);

    const feed = await request(app)
      .get("/api/posts/feed")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);
    expect(feed.body.posts.find((post: any) => post._id === response.body.post._id)).toMatchObject({
      mediaType: "video",
      video
    });

    const search = await request(app)
      .get("/api/posts/search?q=Video")
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);
    expect(search.body.posts[0]).toMatchObject({ mediaType: "video", video });

    const profile = await request(app)
      .get(`/api/users/${session.user.id}/posts`)
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);
    expect(profile.body.posts[0]).toMatchObject({ mediaType: "video", video });

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

    expect(response.body.message).toContain("Sign in with email and password first");
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
