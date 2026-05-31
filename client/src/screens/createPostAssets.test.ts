import { describe, expect, it } from "vitest";
import { resolveRecentPhotoUri } from "./createPostAssets";

describe("resolveRecentPhotoUri", () => {
  it("uses the asset uri when React Native web does not expose resolveAssetSource", () => {
    expect(resolveRecentPhotoUri({ uri: "/assets/recent.png" })).toBe("/assets/recent.png");
  });

  it("uses resolveAssetSource when it is available", () => {
    expect(resolveRecentPhotoUri(12, (asset) => ({ uri: `/resolved/${asset}.png` }))).toBe("/resolved/12.png");
  });
});
