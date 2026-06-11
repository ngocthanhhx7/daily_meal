import { describe, expect, it } from "vitest";
import {
  getFeedPostParams,
  getHomeTargetIndex,
  getPostViewerSets,
  getProfilePostTarget,
  getPublicProfilePostTarget,
  mergeTargetPostIntoFeed
} from "./postNavigation";
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

const oldPost = {
  ...post,
  _id: "old-post",
  caption: "Tin cu",
  viewerState: { liked: true, saved: true }
} as Post;

const feedPost = {
  ...post,
  _id: "feed-post",
  viewerState: { liked: false, saved: true }
} as Post;

describe("postNavigation", () => {
  it("builds Home params that jump directly to a saved post in the feed", () => {
    expect(getFeedPostParams(post)).toEqual({
      postId: "post-1",
      targetPost: post
    });
    expect(getFeedPostParams(post).targetPost).toBe(post);
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

  it("sends public profile posts and saved items to Home", () => {
    expect(getPublicProfilePostTarget("posts", post)).toEqual({
      screen: "Home",
      params: {
        postId: "post-1",
        targetPost: post
      }
    });

    expect(getPublicProfilePostTarget("saved", post)).toEqual({
      screen: "Home",
      params: {
        postId: "post-1",
        targetPost: post
      }
    });
  });

  it("prepends a target post when the current feed page does not contain it", () => {
    expect(mergeTargetPostIntoFeed([feedPost], "old-post", oldPost)).toEqual([oldPost, feedPost]);
  });

  it("moves a target post already present in the feed to the first slide without duplicating it", () => {
    const posts = [feedPost, oldPost];

    expect(mergeTargetPostIntoFeed(posts, "old-post", oldPost)).toEqual([oldPost, feedPost]);
    expect(mergeTargetPostIntoFeed(posts, "old-post")).toEqual([oldPost, feedPost]);
  });

  it("leaves the feed unchanged when target params are incomplete", () => {
    const posts = [feedPost];

    expect(mergeTargetPostIntoFeed(posts)).toBe(posts);
    expect(mergeTargetPostIntoFeed(posts, "missing-post")).toBe(posts);
  });

  it("includes prepended target posts in viewer state sets", () => {
    const merged = mergeTargetPostIntoFeed([feedPost], "old-post", oldPost);
    const viewerSets = getPostViewerSets(merged);

    expect([...viewerSets.liked]).toEqual(["old-post"]);
    expect([...viewerSets.saved]).toEqual(["old-post", "feed-post"]);
  });

  it("finds the target index for Home scrolling", () => {
    expect(getHomeTargetIndex([oldPost, feedPost], "old-post")).toBe(0);
    expect(getHomeTargetIndex([feedPost, oldPost], "old-post")).toBe(1);
    expect(getHomeTargetIndex([feedPost], "old-post")).toBe(-1);
    expect(getHomeTargetIndex([feedPost])).toBe(-1);
  });
});
