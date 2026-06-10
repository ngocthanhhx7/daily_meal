import type { Post } from "../types/api";

export type ProfilePostTab = "posts" | "saved";

export function getFeedPostParams(post: Post) {
  return {
    postId: post._id,
    targetPost: post
  };
}

export function getProfilePostTarget(tab: ProfilePostTab, post: Post) {
  if (tab === "posts") {
    return {
      screen: "EditPost",
      params: { post }
    };
  }

  return {
    screen: "Home",
    params: getFeedPostParams(post)
  };
}
