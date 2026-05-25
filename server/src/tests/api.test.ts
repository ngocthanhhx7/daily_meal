import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { seedDefaultStickers } from "../services/stickers.js";
import { Sticker } from "../models/Sticker.js";

let mongo: MongoMemoryServer;
const app = createApp();

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

describe("Daily Meal API", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await seedDefaultStickers();
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

  it("saves onboarding preferences", async () => {
    const session = await register("onboarding@example.com");

    const response = await request(app)
      .patch("/api/onboarding/preferences")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ interests: ["Thích chụp ảnh"], eatingStyles: ["Thâm hụt calo"] })
      .expect(200);

    expect(response.body.preferences.completedOnboarding).toBe(true);
  });

  it("creates posts with up to three images and rejects overflow", async () => {
    const session = await register("post@example.com");
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
});
