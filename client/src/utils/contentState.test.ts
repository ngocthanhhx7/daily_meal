import { describe, expect, it } from "vitest";
import { getListContentState } from "./contentState";

describe("getListContentState", () => {
  it("keeps empty state hidden while a list is loading", () => {
    expect(getListContentState(true, 0)).toBe("loading");
  });

  it("shows content after items are loaded", () => {
    expect(getListContentState(false, 2)).toBe("content");
  });

  it("shows empty only after loading finishes with no items", () => {
    expect(getListContentState(false, 0)).toBe("empty");
  });
});
