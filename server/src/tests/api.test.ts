import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { seedDefaultStickers } from "../services/stickers.js";
import { createPayosSignature } from "../services/payos.js";
import { broadcastToRoom, emitToUser } from "../services/socket.js";
import { Payment } from "../models/Payment.js";
import { Sticker } from "../models/Sticker.js";
import { User } from "../models/User.js";
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

let mongo: MongoMemoryServer;
const app = createApp();
const mockedVerifyGoogleIdToken = vi.mocked(verifyGoogleIdToken);
const mockedEmitToUser = vi.mocked(emitToUser);
const mockedBroadcastToRoom = vi.mocked(broadcastToRoom);

async function register(email: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", displayName: "Tester" })
    .expect(201);
  return response.body as { token: string; user: { id: string } };
}

async function createPost(token: string, caption: string) {
  const response = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      images: [{ url: "/uploads/demo.jpg" }],
      caption,
      tags: [],
      visibility: "public"
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
    expect(captions).not.toContain("Carol outside network");

    const followedPost = feed.body.posts.find(
      (post: { caption: string }) => post.caption === "Bob followed meal"
    );
    expect(followedPost.viewerState).toEqual({ liked: true, saved: true });
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
