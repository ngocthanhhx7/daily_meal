import { describe, expect, it } from "vitest";
import { getPostPreviewImageIndexes } from "./postPreviewImages";

describe("getPostPreviewImageIndexes", () => {
  it("returns one fallback preview when the post has no images", () => {
    expect(getPostPreviewImageIndexes({ images: [] })).toEqual([0]);
  });

  it("returns the single image index when the post has one image", () => {
    expect(getPostPreviewImageIndexes({ images: [{ url: "/a.jpg" }] })).toEqual([0]);
  });

  it("returns up to three image indexes for stacked previews", () => {
    expect(
      getPostPreviewImageIndexes({
        images: [{ url: "/a.jpg" }, { url: "/b.jpg" }, { url: "/c.jpg" }, { url: "/d.jpg" }]
      })
    ).toEqual([0, 1, 2]);
  });
});
