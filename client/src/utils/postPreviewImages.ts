import type { Post } from "../types/api";

type PostWithImages = Pick<Post, "images">;

export function getPostPreviewImageIndexes(post: PostWithImages, maxCount = 3) {
  const imageCount = post.images?.length ?? 0;
  const previewCount = Math.min(Math.max(imageCount, 1), maxCount);

  return Array.from({ length: previewCount }, (_, index) => index);
}
