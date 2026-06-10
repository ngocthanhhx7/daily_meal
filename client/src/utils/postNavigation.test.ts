import { describe, expect, it } from "vitest";
import { getFeedPostParams, getProfilePostTarget } from "./postNavigation";
import type { Post, User } from "../types/api";

const author = {
  id: "user-1",
  displayName: "User",
  isPremium: false,
  preferences: {
    interests: [],
    eatingStyles: [],
    completedOnboarding: true
  }
} as User;

const post = {
  _id: "post-1",
  author,
  caption: "Bua toi",
  images: [],
  tags: [],
  visibility: "public",
  stats: { likes: 0, comments: 0, saves: 0 },
  createdAt: "2026-06-10T12:00:00.000Z",
  updatedAt: "2026-06-10T12:00:00.000Z"
} as Post;

describe("postNavigation", () => {
  it("builds Home params that jump directly to a saved post in the feed", () => {
    expect(getFeedPostParams(post)).toEqual({
      postId: "post-1",
      targetPost: post
    });
  });

  it("keeps own posted items on EditPost but sends saved items to Home", () => {
    expect(getProfilePostTarget("posts", post)).toEqual({
      screen: "EditPost",
      params: { post }
    });

    expect(getProfilePostTarget("saved", post)).toEqual({
      screen: "Home",
      params: {
        postId: "post-1",
        targetPost: post
      }
    });
  });
});
