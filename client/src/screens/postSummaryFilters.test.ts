import { describe, expect, it } from "vitest";
import { POST_SUMMARY_FILTERS, getPostSummaryFilterLabel } from "./postSummaryFilters";

describe("post summary filters", () => {
  it("keeps filter query values and labels in the expected order", () => {
    expect(POST_SUMMARY_FILTERS).toEqual([
      { value: "all", label: "All" },
      { value: "friends", label: "Bạn bè" },
      { value: "following", label: "Đang theo dõi" },
      { value: "strangers", label: "Người lạ" }
    ]);
  });

  it("returns the display label for a selected filter", () => {
    expect(getPostSummaryFilterLabel("following")).toBe("Đang theo dõi");
    expect(getPostSummaryFilterLabel("strangers")).toBe("Người lạ");
  });
});
