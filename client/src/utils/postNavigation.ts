import type { Post } from "../types/api";

export type ProfilePostTab = "posts" | "saved";

export function getFeedPostParams(post: Post) {
  return {
    postId: post._id,
    targetPost: post
  };
}

export function mergeTargetPostIntoFeed(posts: Post[], targetPostId?: string, targetPost?: Post) {
  if (!targetPostId || posts.some((post) => post._id === targetPostId)) {
    return posts;
  }

  return targetPost ? [targetPost, ...posts] : posts;
}

export function getPostViewerSets(posts: Post[]) {
  const liked = new Set<string>();
  const saved = new Set<string>();

  posts.forEach((post) => {
    if (post.viewerState?.liked) {
      liked.add(post._id);
    }
    if (post.viewerState?.saved) {
      saved.add(post._id);
    }
  });

  return { liked, saved };
}

export function getHomeTargetIndex(posts: Post[], targetPostId?: string) {
  if (!targetPostId) {
    return -1;
  }

  return posts.findIndex((post) => post._id === targetPostId);
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

export function getPublicProfilePostTarget(_tab: ProfilePostTab, post: Post) {
  return {
    screen: "Home",
    params: getFeedPostParams(post)
  };
}
